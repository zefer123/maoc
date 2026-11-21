import { setTimeout as delay } from 'node:timers/promises';
import { config } from './config.js';
import { HttpError, record, requireValid } from './validation.js';

const PROVIDERS = ['gemini', 'openrouter', 'openai', 'ollama'];
const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash', openrouter: 'nousresearch/hermes-3-llama-3.1-70b', openai: 'gpt-4o-mini', ollama: 'llama3.1' };
const DEFAULTS = Object.freeze({ provider: 'gemini', modelName: DEFAULT_MODELS.gemini, autoFailover: true,
  fallbackProviders: ['openrouter', 'openai'], rpm: 10, maxHandoffs: 12, maxToolRounds: 4,
  maxToolCalls: 24, maxTaskTokens: 60000, maxOutputTokens: 1600, taskTimeoutMs: 300000, providerModels: {} });

function localOllama(value) {
  let url;
  try { url = new URL(value); } catch { throw new HttpError(400, 'Invalid Ollama URL'); }
  requireValid(['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password && !url.search && !url.hash, 'Ollama must use a loopback URL without credentials');
  url.pathname = '/v1/chat/completions';
  return url.href;
}

export class RateLimitQueue {
  constructor({ now = Date.now, sleep = (ms, signal) => delay(ms, undefined, { signal }), windowMs = 60000, maxPending = 100 } = {}) {
    this.now = now; this.sleep = sleep; this.windowMs = windowMs; this.maxPending = maxPending;
    this.states = new Map(); this.pending = 0;
  }
  cooldown(provider, ms) {
    const state = this.states.get(provider);
    if (state) state.cooldown = Math.max(state.cooldown, this.now() + ms);
  }
  async acquire(provider, rpm, signal, onWait = () => {}) {
    signal?.throwIfAborted();
    if (this.pending >= this.maxPending) throw new HttpError(429, 'LLM queue is full');
    let state = this.states.get(provider);
    if (!state) { state = { times: [], cooldown: 0, tail: Promise.resolve() }; this.states.set(provider, state); }
    this.pending += 1;
    const previous = state.tail;
    let release;
    state.tail = new Promise((resolve) => { release = resolve; });
    try {
      await new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        previous.then(() => { signal?.removeEventListener('abort', abort); resolve(); });
      });
      for (;;) {
        signal?.throwIfAborted();
        const now = this.now();
        state.times = state.times.filter((at) => at > now - this.windowMs);
        const wait = Math.max(0, state.cooldown - now, state.times.length >= rpm ? state.times[0] + this.windowMs - now : 0);
        if (!wait) { state.times.push(now); return; }
        onWait(wait);
        await this.sleep(wait, signal);
      }
    } finally {
      this.pending -= 1;
      // An aborted waiter must not let later reservations overtake its predecessor.
      previous.finally(release);
    }
  }
}

export async function boundedJson(response, maxBytes = 2 * 1024 * 1024) {
  if (!response.body?.getReader) return response.json();
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new HttpError(502, 'Provider response exceeded size limit');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(502, 'Provider returned invalid JSON'); }
}

const tokenCount = (value) => Number.isSafeInteger(value) && value >= 0;

function readUsage(provider, data) {
  const gemini = provider === 'gemini';
  const raw = gemini ? data.usageMetadata : data.usage;
  if (!record(raw)) return { usage: null, budgetTotalTokens: null };
  const prompt = raw[gemini ? 'promptTokenCount' : 'prompt_tokens'];
  const completion = raw[gemini ? 'candidatesTokenCount' : 'completion_tokens'];
  const total = raw[gemini ? 'totalTokenCount' : 'total_tokens'];
  return {
    usage: [prompt, completion, total].every(tokenCount)
      ? { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total, reported: true }
      : null,
    // A valid total can still tighten the reservation guard when analytics lacks a full breakdown.
    budgetTotalTokens: tokenCount(total) ? total : null
  };
}
export class LlmEngine {
  constructor({ settings = config, fetcher = (...args) => fetch(...args), queue = new RateLimitQueue() } = {}) {
    this.fetcher = fetcher; this.queue = queue; this.controller = new AbortController();
    this.keys = Object.fromEntries(PROVIDERS.filter((p) => p !== 'ollama').map((p) => [p, settings.providers?.[p] || '']));
    this.ollamaUrl = localOllama(settings.providers?.ollamaUrl || 'http://localhost:11434');
    const provider = process.env.LLM_PROVIDER || DEFAULTS.provider;
    requireValid(PROVIDERS.includes(provider), 'Invalid LLM_PROVIDER');
    this.settings = { ...DEFAULTS, provider, modelName: process.env.LLM_MODEL || DEFAULT_MODELS[provider] };
  }
  configure(patch) {
    requireValid(record(patch), 'LLM config must be an object');
    const allowed = [...Object.keys(DEFAULTS), 'apiKey', 'providerKeys', 'ollamaUrl'];
    requireValid(Object.keys(patch).every((key) => allowed.includes(key)), 'Unknown LLM config field');
    const next = { ...this.settings, ...patch };
    requireValid(PROVIDERS.includes(next.provider), 'Invalid provider');
    requireValid(typeof next.modelName === 'string' && next.modelName.length > 0 && next.modelName.length <= 160, 'Invalid modelName');
    requireValid(typeof next.autoFailover === 'boolean', 'Invalid autoFailover');
    requireValid(Array.isArray(next.fallbackProviders) && next.fallbackProviders.length <= 4 && next.fallbackProviders.every((p) => PROVIDERS.includes(p)), 'Invalid fallbackProviders');
    for (const [name, min, max] of [['rpm', 1, 1000], ['maxHandoffs', 1, 40], ['maxToolRounds', 1, 8], ['maxToolCalls', 1, 64], ['maxTaskTokens', 1000, 500000], ['maxOutputTokens', 64, 8192], ['taskTimeoutMs', 1000, 900000]]) {
      requireValid(Number.isInteger(next[name]) && next[name] >= min && next[name] <= max, `Invalid ${name}`);
    }
    requireValid(record(next.providerModels) && Object.keys(next.providerModels).every((p) => PROVIDERS.includes(p)), 'Invalid providerModels');
    for (const models of Object.values(next.providerModels)) {
      requireValid(record(models) && Object.keys(models).length <= 40 && Object.values(models).every((m) => typeof m === 'string' && m.length > 0 && m.length <= 160), 'Invalid model mapping');
    }
    const keys = { ...this.keys };
    if ('providerKeys' in patch) {
      requireValid(record(patch.providerKeys) && Object.keys(patch.providerKeys).every((p) => PROVIDERS.includes(p) && p !== 'ollama'), 'Invalid providerKeys');
      Object.assign(keys, patch.providerKeys);
    }
    if ('apiKey' in patch && next.provider !== 'ollama') keys[next.provider] = patch.apiKey;
    requireValid(Object.values(keys).every((key) => typeof key === 'string' && key.length <= 4096 && !/[\r\n]/.test(key)), 'Invalid provider key');
    const ollamaUrl = patch.ollamaUrl ? localOllama(patch.ollamaUrl) : this.ollamaUrl;
    delete next.apiKey; delete next.providerKeys; delete next.ollamaUrl;
    this.settings = structuredClone(next); this.keys = keys; this.ollamaUrl = ollamaUrl;
    return this.inspect();
  }
  inspect() {
    return { ...structuredClone(this.settings), ollamaUrl: this.ollamaUrl,
      configured: Object.fromEntries(PROVIDERS.map((p) => [p, p === 'ollama' || Boolean(this.keys[p])])), queuePending: this.queue.pending };
  }
  snapshot() { return { settings: structuredClone(this.settings), keys: { ...this.keys }, ollamaUrl: this.ollamaUrl }; }
  close() { this.controller.abort(); }
  modelFor(provider, tier, snapshot) {
    const mapped = snapshot.settings.providerModels[provider]?.[tier];
    if (mapped) return mapped;
    return provider === snapshot.settings.provider ? snapshot.settings.modelName : DEFAULT_MODELS[provider];
  }
  async complete({ messages, tools = [], tier = '', signal, onEvent = () => {}, snapshot = this.snapshot(), maxOutputTokens }) {
    const combined = AbortSignal.any([this.controller.signal, ...(signal ? [signal] : [])]);
    const cfg = snapshot.settings;
    const providers = [...new Set([cfg.provider, ...(cfg.autoFailover ? cfg.fallbackProviders : [])])]
      .filter((p) => p === 'ollama' || snapshot.keys[p]);
    if (!providers.length) throw new HttpError(503, 'No configured LLM provider; configure Engine Settings or server environment');
    let last;
    for (const provider of providers) {
      combined.throwIfAborted();
      await this.queue.acquire(provider, cfg.rpm, combined, (waitMs) => onEvent({ stage: 'queued', provider, waitMs }));
      const model = this.modelFor(provider, tier, snapshot);
      onEvent({ stage: 'request', provider, model });
      try {
        return await this.request(provider, model, messages, tools, Math.min(maxOutputTokens || cfg.maxOutputTokens, cfg.maxOutputTokens), snapshot, combined);
      } catch (error) {
        combined.throwIfAborted();
        last = error;
        if (error.status === 429) this.queue.cooldown(provider, error.retryMs || 60000);
        if (![429, 500, 502, 503, 504].includes(error.status)) throw error;
        onEvent({ stage: 'failover', provider, status: error.status });
      }
    }
    throw last || new HttpError(503, 'No available LLM provider');
  }
  async request(provider, model, messages, tools, maxTokens, snapshot, signal) {
    let endpoint; let body;
    const headers = { 'Content-Type': 'application/json' };
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    if (provider === 'gemini') {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      headers['x-goog-api-key'] = snapshot.keys.gemini;
      const contents = messages.filter((m) => m.role !== 'system').map((m) => {
        if (m.role === 'tool') return { role: 'user', parts: [{ functionResponse: { name: m.name, ...(m.call_id ? { id: m.call_id } : {}), response: JSON.parse(m.content) } }] };
        if (m.role === 'assistant' && m.geminiContent?.model === model) return m.geminiContent.content;
        const parts = m.content ? [{ text: m.content }] : [];
        for (const call of m.tool_calls || []) parts.push({ functionCall: { name: call.function.name, args: JSON.parse(call.function.arguments) } });
        return { role: m.role === 'assistant' ? 'model' : 'user', parts };
      });
      const groupedContents = [];
      for (const content of contents) {
        const previous = groupedContents.at(-1);
        if (previous?.role === content.role) previous.parts.push(...content.parts);
        else groupedContents.push(structuredClone(content));
      }
      body = { systemInstruction: { parts: [{ text: system }] }, contents: groupedContents, generationConfig: { maxOutputTokens: maxTokens } };
      const geminiSchema = (value) => Array.isArray(value) ? value.map(geminiSchema) : record(value) ? Object.fromEntries(Object.entries(value).filter(([key]) => !['additionalProperties', 'maxLength'].includes(key)).map(([key, item]) => [key, geminiSchema(item)])) : value;
      if (tools.length) body.tools = [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.inputSchema) })) }];
    } else {
      endpoint = provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : provider === 'ollama' ? snapshot.ollamaUrl : 'https://api.openai.com/v1/chat/completions';
      if (provider !== 'ollama') headers.Authorization = `Bearer ${snapshot.keys[provider]}`;
      body = { model, messages: messages.map(({ geminiContent, name, call_id, ...message }) => message),
        [provider === 'openai' ? 'max_completion_tokens' : 'max_tokens']: maxTokens };
      if (tools.length) body.tools = tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } }));
    }
    let response;
    try { response = await this.fetcher(endpoint, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) }); }
    catch { signal.throwIfAborted(); throw new HttpError(503, `${provider} connection failed or timed out`); }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const error = new HttpError(response.status >= 400 && response.status < 600 ? response.status : 502, `${provider} API error (${response.status})`);
      const retry = response.headers?.get('retry-after');
      error.retryMs = Math.min(300000, Math.max(1000, (Number(retry) * 1000) || (Date.parse(retry) - Date.now()) || 60000));
      throw error;
    }
    const data = await boundedJson(response);
    if (data.error) {
      const code = Number(data.error.code);
      throw new HttpError([400, 401, 403, 404, 429, 500, 502, 503, 504].includes(code) ? code : 502, `${provider} returned an API error`);
    }
    const { usage, budgetTotalTokens } = readUsage(provider, data);
    let text; let calls; let geminiContent;
    if (provider === 'gemini') {
      const content = data.candidates?.[0]?.content;
      text = (content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('\n');
      calls = (content?.parts || []).filter((p) => p.functionCall).map((p, i) => ({ id: p.functionCall.id || `gemini_${i}`, call_id: p.functionCall.id, name: p.functionCall.name, arguments: p.functionCall.args || {} }));
      geminiContent = { model, content };
    } else {
      const message = data.choices?.[0]?.message;
      text = typeof message?.content === 'string' ? message.content : '';
      calls = (message?.tool_calls || []).map((call) => {
        let args;
        try { args = JSON.parse(call.function.arguments); } catch { throw new HttpError(502, 'Invalid tool arguments from provider'); }
        return { id: call.id, name: call.function.name, arguments: args };
      });
    }
    if (!text && !calls?.length) throw new HttpError(502, `${provider} returned no usable response`);
    if (calls.length > 16 || calls.some((c) => typeof c.name !== 'string' || typeof c.id !== 'string' || !record(c.arguments))) throw new HttpError(502, 'Invalid provider tool calls');
    return { text: text.slice(0, 100000), toolCalls: calls, usage, budgetTotalTokens, provider, model, geminiContent };
  }
}
import { realpath, open } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { AGENT_DEFINITIONS } from './agentRegistry.js';
import { PROJECT_ROOT } from './config.js';
import { boundedJson } from './llmEngine.js';
import { HttpError, record, requireValid } from './validation.js';

const string = { type: 'string', maxLength: 20000 };
const number = { type: 'number' };
const schema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const safeText = (value) => String(value).replace(/\b(?:sk-[\w-]{12,}|AIza[\w-]{20,})\b/g, '[REDACTED]');

export function validateToolInput(input, definition) {
  requireValid(record(input) && Buffer.byteLength(JSON.stringify(input)) <= 60000, 'Invalid tool input');
  requireValid(Object.keys(input).every((key) => Object.hasOwn(definition.properties, key)), 'Unknown tool argument');
  for (const key of definition.required || []) requireValid(Object.hasOwn(input, key), `Missing tool argument: ${key}`);
  for (const [key, value] of Object.entries(input)) {
    const rule = definition.properties[key];
    requireValid(rule.type === 'array' ? Array.isArray(value) : rule.type === 'object' ? record(value) : typeof value === rule.type, `Invalid tool argument: ${key}`);
    if (typeof value === 'number') requireValid(Number.isFinite(value), 'Tool numbers must be finite');
    if (typeof value === 'string') requireValid(value.length <= (rule.maxLength || 20000), 'Tool text too long');
    if (Array.isArray(value)) requireValid(value.length <= 100 && value.every((v) => typeof v === rule.items.type && (typeof v !== 'number' || Number.isFinite(v))), 'Invalid tool list');
  }
}

export function calculateRisk({ equity, riskPercent, entry, stop, target, maxExposurePercent = 100 }) {
  requireValid([equity, riskPercent, entry, stop, target, maxExposurePercent].every(Number.isFinite), 'Risk inputs must be finite');
  requireValid(equity > 0 && riskPercent > 0 && riskPercent <= 5 && entry > 0 && stop > 0 && target > 0 && entry !== stop && maxExposurePercent > 0 && maxExposurePercent <= 100, 'Invalid risk limits');
  const direction = stop < entry ? 'long' : 'short';
  requireValid(direction === 'long' ? target > entry : target < entry, 'Target must be on the profit side');
  const lossPerUnit = Math.abs(entry - stop);
  const units = Math.min(equity * riskPercent / 100 / lossPerUnit, equity * maxExposurePercent / 100 / entry);
  requireValid(Number.isFinite(units) && Number.isFinite(units * entry) && Number.isFinite(Math.abs(target - entry) / lossPerUnit), 'Risk calculation overflow');
  return { direction, units, notional: units * entry, riskAmount: units * lossPerUnit,
    riskPercentActual: units * lossPerUnit / equity * 100, rewardRisk: Math.abs(target - entry) / lossPerUnit,
    scope: 'Unleveraged spot sizing only; excludes fees, gaps, derivatives contract sizing and slippage. Not an execution approval.' };
}

export class ToolExecutor {
  constructor({ storage, root = PROJECT_ROOT, fetcher = (...args) => fetch(...args) } = {}) {
    this.storage = storage; this.root = root; this.fetcher = fetcher; this.registry = new Map();
    this.installCoreTools();
  }
  register({ name, description, inputSchema, agents, execute, readOnly = true }) {
    requireValid(typeof name === 'string' && /^[a-zA-Z][\w-]{0,63}$/.test(name) && !this.registry.has(name), 'Invalid or duplicate tool name');
    requireValid(typeof execute === 'function' && record(inputSchema?.properties) && inputSchema.type === 'object' && Array.isArray(agents) && agents.every((id) => Object.hasOwn(AGENT_DEFINITIONS, id)), 'Invalid tool registration');
    this.registry.set(name, { name, description, inputSchema, agents: new Set(agents), execute, readOnly });
  }
  list(agent, { task, nodeId } = {}) {
    return [...this.registry.values()].filter((tool) => tool.agents.has(agent.id) &&
      (agent.tools.includes(tool.name) || ['vault-write', 'wikipedia-search', 'hn-search', 'agent-message'].includes(tool.name)) && !(agent.disabledTools || []).includes(tool.name) &&
      (tool.name !== 'agent-message' || task?.mailbox?.available(nodeId, agent.id)))
      .map(({ name, description, inputSchema }) => ({ name, description, inputSchema: structuredClone(inputSchema) }));
  }
  capabilities() {
    return [...this.registry.values()].map(({ name, description, inputSchema, agents, readOnly }) => ({ name, description, inputSchema, agents: [...agents], annotations: { readOnlyHint: readOnly, destructiveHint: false } }));
  }
  async execute(name, input, { agent, signal, task, nodeId, onEvent = () => {} }) {
    signal?.throwIfAborted();
    const tool = this.registry.get(name);
    if (!tool || !this.list(agent, { task, nodeId }).some((item) => item.name === name)) throw new HttpError(403, 'Tool unavailable or not permitted for this agent');
    validateToolInput(input, tool.inputSchema);
    const result = await tool.execute(input, { agent, signal, task, nodeId, onEvent });
    signal?.throwIfAborted();
    const encoded = safeText(JSON.stringify(result));
    requireValid(encoded.length <= 50000, 'Tool result exceeded limit');
    return JSON.parse(encoded);
  }
  async getJson(url, signal) {
    const response = await this.fetcher(url, { redirect: 'error', headers: { 'User-Agent': 'MAOC/4.0 local research tool' }, signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10000)]) });
    if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new HttpError(502, 'Research data source unavailable'); }
    return boundedJson(response, 1024 * 1024);
  }
  async append(collection, create) {
    if (!this.storage) throw new HttpError(503, 'Vault storage is unavailable');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = this.storage.get(collection);
      try { return await this.storage.put(collection, create(current.data), current.revision); }
      catch (error) { if (error.status !== 409 || attempt === 4) throw error; }
    }
  }
  async archive(task, agentId = 'HERMES') {
    const paragraphs = task.outputs.map((item) => `${item.agent}: ${item.text}`);
    if (task.workflow?.nodes.some((node) => node.when)) paragraphs.push(`### Conditional workflow (user-authored routing; not execution approval)\n${task.workflowNodes.map((node) => `${node.id} (${node.agent}): ${node.state}${node.when ? `; ${JSON.stringify(node.when)}; selected=${node.condition_result ?? 'not evaluated'}` : ''}${node.skip_reason ? `; ${node.skip_reason}` : ''}`).join('\n')}`);
    if (task.scheduledRun) paragraphs.unshift(`Scheduled mission provenance: schedule ${task.scheduledRun.schedule_id}, run ${task.scheduledRun.run}, due ${task.scheduledRun.due_at}. Recurrence does not grant permissions or approvals.`);
    if (task.agentMessages?.length) paragraphs.push(`### Direct messages (untrusted reference data; delivery is not agreement)\n${task.agentMessages.map((m) => `${m.from_node} (${m.from_agent}) -> ${m.to_node} (${m.to_agent}) [${m.status}]: ${m.text}`).join('\n\n')}`);
    const saved = await this.append('deliverables', (data) => ({ ...data, [task.department]: [
      ...(data[task.department] || []).filter((item) => item.id !== `task-${task.id}`),
      { id: `task-${task.id}`, title: task.description.slice(0, 180), summary: task.outputs.at(-1)?.text.slice(0, 2000) || '', paragraphs,
        lead: agentId, status: task.swarm ? 'SWARM_LLM' : task.outputs.every((item) => item.agent === 'HUMAN') ? 'HUMAN_INPUT' : task.outputs.some((item) => item.agent === 'HUMAN') ? 'HUMAN_AI' : 'REAL_LLM',
        ...(task.swarm ? { swarm: structuredClone(task.swarm) } : {}),
        ...(task.workflow?.nodes.some((node) => node.when) ? { workflow: structuredClone(task.workflow), workflow_nodes: structuredClone(task.workflowNodes) } : {}),
        ...(task.agentMessages ? { agent_messages: structuredClone(task.agentMessages), messaging: true } : {}),
        ...(task.scheduledRun ? { scheduled_run: structuredClone(task.scheduledRun) } : {}),
        stages: task.outputs.map((item) => `${task.swarm ? `${item.node_id}: ` : ''}${item.agent} (${item.provider}/${item.model})`), coWork: task.outputs.map((item) => item.agent) }
    ] }));
    return { saved: true, revision: saved.revision, projectionStatus: saved.projectionStatus };
  }
  async readSource(path) {
    requireValid(typeof path === 'string' && path.length <= 260 && !isAbsolute(path) && !path.includes(':') && !path.includes('\\') && !path.split('/').some((part) => part === '..' || part.startsWith('.')), 'Use a project-relative source path without hidden/traversal segments');
    requireValid(/^(src\/|server\/src\/|package\.json$|server\/package\.json$|SKILL\.md$|PLAN\.md$|CLAUDE\.md$)/.test(path) && ['.js', '.jsx', '.json', '.css', '.md'].includes(extname(path)), 'Only allowlisted project source files can be read');
    const base = await realpath(this.root);
    const target = await realpath(resolve(base, path));
    const rel = relative(base, target);
    requireValid(rel && !rel.startsWith('..') && !isAbsolute(rel), 'Source path escapes project');
    const normalized = rel.replace(/\\/g, '/');
    requireValid(/^(src\/|server\/src\/|package\.json$|server\/package\.json$|SKILL\.md$|PLAN\.md$|CLAUDE\.md$)/.test(normalized) && !normalized.split('/').some((part) => part.startsWith('.')), 'Resolved source path is not allowlisted');
    const handle = await open(target, 'r');
    try {
      requireValid((await handle.stat()).isFile(), 'Source must be a regular file');
      const buffer = Buffer.alloc(60001);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      requireValid(bytesRead <= 60000, 'Source file exceeds 60KB limit');
      return safeText(buffer.subarray(0, bytesRead).toString('utf8'));
    } finally { await handle.close(); }
  }
  installCoreTools() {
    const all = Object.keys(AGENT_DEFINITIONS);
    const owners = (name) => all.filter((id) => AGENT_DEFINITIONS[id].tools.includes(name));
    const add = (name, description, inputSchema, execute, agents = owners(name), readOnly = true) => this.register({ name, description, inputSchema, execute, agents, readOnly });
    add('agent-message', 'Queue untrusted reference text directly to a pending AI node in a later dependency layer of this opted-in task. No reply, new work, tools or approval authority. Address by node ID, not agent ID.', schema({ to: { type: 'string', maxLength: 40 }, text: { type: 'string', maxLength: 2000 } }, ['to', 'text']),
      (input, { task, nodeId, agent }) => task.mailbox.send(input, nodeId, agent.id), all, false);
    const wiki = async ({ query }, { signal }) => {
      requireValid(query.trim().length > 0 && query.length <= 250, 'Search query must contain 1–250 characters');
      const language = /[\u0E00-\u0E7F]/.test(query) ? 'th' : 'en';
      const data = await this.getJson(`https://${language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`, signal);
      return { sources: (data.query?.search || []).slice(0, 5).map((item) => ({ title: item.title, snippet: item.snippet.replace(/<[^>]+>/g, ''), url: `https://${language}.wikipedia.org/?curid=${item.pageid}` })), untrustedSourceData: true };
    };
    const hn = async ({ query }, { signal }) => {
      requireValid(query.trim().length > 0 && query.length <= 250, 'Search query must contain 1–250 characters');
      const data = await this.getJson(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`, signal);
      return { sources: (data.hits || []).slice(0, 5).map((hit) => ({ title: hit.title, url: hit.url, discussion: `https://news.ycombinator.com/item?id=${hit.objectID}`, points: hit.points })), untrustedSourceData: true };
    };
    add('wikipedia-search', 'Search Wikipedia articles (Thai/English); returns source citations, not instructions.', schema({ query: string }, ['query']), wiki, all);
    add('hn-search', 'Search Hacker News indexed web stories and discussion citations. Not a full-web search engine.', schema({ query: string }, ['query']), hn, all);
    add('web-search', 'Search Wikipedia and Hacker News with real citations; limited indexed web research, not arbitrary URL fetching.', schema({ query: string }, ['query']), async (args, ctx) => ({ wikipedia: await wiki(args, ctx), hackernews: await hn(args, ctx) }));
    add('news-sentiment', 'Retrieve Hacker News sources for the model to analyze; does not fabricate a sentiment score.', schema({ query: string }, ['query']), hn);
    add('vault-write', 'Save a Markdown-backed note in the local Obsidian vault. Does not accept filesystem paths or overwrite existing notes.', schema({ title: string, content: string }, ['title', 'content']), async ({ title, content }, { agent, signal }) => {
      signal?.throwIfAborted();
      requireValid(title.trim().length > 0 && title.length <= 180 && content.trim().length > 0, 'Note requires title and content');
      const id = `agent-${randomUUID()}`;
      const result = await this.append('notes', (notes) => [...notes, { id, title, content, agents: [agent.id], category: agent.team, updatedAt: new Date().toISOString() }]);
      return { id, revision: result.revision, projectionStatus: result.projectionStatus };
    }, all, false);
    const riskSchema = schema({ equity: number, riskPercent: number, entry: number, stop: number, target: number, maxExposurePercent: number }, ['equity', 'riskPercent', 'entry', 'stop', 'target']);
    add('risk-engine', 'Calculate capped unleveraged position sizing and reward:risk. No trading execution.', riskSchema, calculateRisk);
    add('exposure-limit', 'Calculate capped exposure using supplied equity and a maximum exposure percentage.', riskSchema, calculateRisk);
    add('market-data-feed', 'Read Binance 24h ticker. PAXG is tokenized gold, NOT spot XAU/USD. No candles/technical structure in Phase 2.', schema({ symbol: string }, ['symbol']), async ({ symbol }, { signal }) => {
      requireValid(['BTCUSDT', 'ETHUSDT', 'PAXGUSDT'].includes(symbol), 'Unsupported market symbol');
      const data = await this.getJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, signal);
      return { symbol, lastPrice: data.lastPrice, priceChangePercent: data.priceChangePercent, highPrice: data.highPrice, lowPrice: data.lowPrice, closeTime: data.closeTime, proxyWarning: symbol === 'PAXGUSDT' ? 'Tokenized gold proxy; not spot XAU' : null };
    });
    add('repo-insight', 'Read one allowlisted project source file; credentials and arbitrary filesystem paths are forbidden.', schema({ path: string }, ['path']), async ({ path }) => ({ path, content: await this.readSource(path), untrustedSourceData: true }));
    const checkCode = ({ code }, { signal }) => new Promise((resolveResult, reject) => {
      signal?.throwIfAborted();
      const child = spawn(process.execPath, ['--input-type=module', '--check'], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true, shell: false });
      let stderr = ''; let settled = false;
      const finish = (error, value) => {
        if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolveResult(value);
      };
      const abort = () => { child.kill(); finish(signal.reason); };
      const timer = setTimeout(() => { child.kill(); finish(new HttpError(504, 'Syntax check timed out')); }, 3000);
      signal?.addEventListener('abort', abort, { once: true });
      child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(0, 6000); });
      child.on('error', (error) => finish(error));
      child.stdin.on('error', () => {});
      child.on('close', (exitCode) => finish(null, { valid: exitCode === 0, exitCode, diagnostics: stderr, scope: 'JavaScript/ES module syntax check only. Submitted code was NOT executed. JSX requires the project build.' }));
      child.stdin.end(code);
    });
    add('code-sandbox', 'Safely parse/check JS module syntax with node --check; NEVER executes submitted code, no shell or package installation.', schema({ code: string }, ['code']), checkCode);
    add('agent-registry', 'Read real registered agent roles, tool permissions and co-work partners.', schema({}), () => ({ agents: Object.values(AGENT_DEFINITIONS).map(({ id, role, model, team, coWorkPartner, tools }) => ({ id, role, model, team, coWorkPartner, tools })) }));
    add('task-router', 'Read the current deterministic department route. Cannot spawn tasks or bypass handoff limits.', schema({}), (_, { task }) => ({ department: task?.department, description: task?.description }));
    add('executive-dashboard', 'Read this mission status and actual reported token usage.', schema({}), (_, { task }) => ({ department: task?.department, usage: task?.usage, completedAgents: task?.outputs.map((o) => o.agent) }));
    for (const name of ['telemetry-bus', 'signal-broadcaster', 'notification-hub', 'incident-channel']) {
      add(name, 'Emit a local audited status notification. Does not send external webhooks or email.', schema({ message: string }, ['message']), ({ message }, { onEvent }) => { onEvent({ message: message.slice(0, 2000) }); return { delivered: 'local-telemetry' }; }, owners(name), false);
    }
    add('finance-model', 'Compute supplied cash-flow NPV with a decimal discount rate; no market forecasts.', schema({ cashFlows: { type: 'array', items: number }, discountRate: number }, ['cashFlows', 'discountRate']), ({ cashFlows, discountRate }) => {
      requireValid(discountRate > -1 && discountRate <= 10 && cashFlows.length > 0, 'Invalid discount rate/cash flows');
      const npv = cashFlows.reduce((sum, cash, i) => sum + cash / ((1 + discountRate) ** i), 0);
      requireValid(Number.isFinite(npv), 'NPV overflow'); return { npv };
    });
    add('contrast-checker', 'Calculate WCAG relative luminance contrast ratio for two hex colors.', schema({ foreground: string, background: string }, ['foreground', 'background']), ({ foreground, background }) => {
      const luminance = (hex) => {
        requireValid(/^#[\da-f]{6}$/i.test(hex), 'Expected #RRGGBB color');
        return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      };
      const a = luminance(foreground); const b = luminance(background);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return { ratio, normalTextAA: ratio >= 4.5, largeTextAA: ratio >= 3 };
    });
    add('consistency-lint', 'Check supplied writing for repeated words and trailing whitespace. Not a language model grammar service.', schema({ text: string }, ['text']), ({ text }) => ({ repeatedWords: [...text.matchAll(/\b(\w+)\s+\1\b/gi)].slice(0, 30).map((m) => ({ word: m[1], offset: m.index })), trailingWhitespaceLines: text.split('\n').flatMap((line, i) => /[ \t]+$/.test(line) ? [i + 1] : []) }));
    add('contract-reader', 'Analyze supplied contract text for key clauses; heuristic findings require legal review, not legal advice.', schema({ text: string }, ['text']), ({ text }) => ({ clauses: text.split(/\n+/).filter((line) => /liability|termination|indemn|jurisdiction|governing law|ความรับผิด|เลิกสัญญา|ชดใช้/i.test(line)).slice(0, 30), scope: 'Keyword extraction only; qualified human legal review required.' }));
    add('schema-designer', 'Infer a shallow JSON field/type inventory from supplied sample JSON, without database access.', schema({ sampleJson: string }, ['sampleJson']), ({ sampleJson }) => {
      let sample; try { sample = JSON.parse(sampleJson); } catch { throw new HttpError(400, 'Invalid sample JSON'); }
      requireValid(record(sample), 'Sample must be an object');
      return { fields: Object.entries(sample).slice(0, 100).map(([name, value]) => ({ name, type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value })) };
    });
  }
}
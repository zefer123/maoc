import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { LlmEngine, RateLimitQueue } from '../src/llmEngine.js';
import { ToolExecutor, calculateRisk } from '../src/toolExecutor.js';
import { Orchestrator } from '../src/orchestrator.js';
import { AGENT_DEFINITIONS, resolveAgent } from '../src/agentRegistry.js';
import { TelemetryBus } from '../src/eventBus.js';
import { StorageEngine } from '../src/storageEngine.js';
import { createApplication } from '../src/server.js';
import { syncBackendEngine, backendChat } from '../../src/lib/backendLlm.js';
import { loadEngineConfig, saveEngineConfig, exportFullWorkspaceBackup } from '../../src/lib/llmConnector.js';

const messages = [{ role: 'system', content: 'Be accurate.' }, { role: 'user', content: 'Test mission' }];
const reply = (content = 'Verified deliverable', toolCalls) => Response.json({ choices: [{ message: { content, ...(toolCalls ? { tool_calls: toolCalls } : {}) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
const call = (name, args, id = 'call_1') => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
function engine(fetcher = async () => reply(), patch = {}) {
  const llm = new LlmEngine({ settings: { providers: { openai: 'test-openai', gemini: 'test-gemini', openrouter: 'test-router' } }, fetcher });
  llm.configure({ provider: 'openai', modelName: 'test-model', rpm: 1000, autoFailover: false, ...patch });
  return llm;
}
const finish = async (orchestrator, description) => {
  const task = orchestrator.submitTask(description);
  await Promise.all([...orchestrator.running]);
  return task;
};

test('all 27 agents have real prompts, tiers, partners and enforce override tools', () => {
  assert.equal(Object.keys(AGENT_DEFINITIONS).length, 27);
  for (const agent of Object.values(AGENT_DEFINITIONS)) {
    assert.ok(agent.systemPrompt.length > 20);
    assert.ok(AGENT_DEFINITIONS[agent.coWorkPartner]);
    assert.ok(Number.isInteger(agent.tier));
  }
  const agent = resolveAgent('BYTE', { BYTE: { model: 'HAIKU', disabledTools: ['code-sandbox'], systemPrompt: 'Custom prompt' } });
  assert.equal(agent.model, 'claude-3-haiku'); assert.equal(agent.systemPrompt, 'Custom prompt');
  assert.ok(!new ToolExecutor().list(agent).some((tool) => tool.name === 'code-sandbox'));
});

test('report examples are scoped to the department and separated from mission evidence', async (t) => {
  const exampleInputs = {
    tech: 'A test fails only after restart.',
    design: 'A settings button is hard to find.',
    command: 'Two teams propose different priorities.',
    trade: 'A market snapshot has no timestamp.',
    content: 'A draft contains an uncited statistic.',
    data: 'A table has duplicate record IDs.',
    finance: 'A budget estimate omits a unit cost.',
    legal: 'A draft is missing a termination clause.'
  };
  // Finance and Hermes also reach LEX through the existing partner rules.
  const expectedReviewers = { trade: ['SAGE'], data: ['CIPHER'], finance: ['LEX'], legal: ['LEX'], hermes: ['LEX'] };
  const seenAgents = new Set();
  const requests = [];
  const llm = engine(async (_, options) => {
    requests.push(JSON.parse(options.body));
    return reply('Fixture report');
  });
  const bus = new TelemetryBus();
  const toolExecutor = new ToolExecutor();
  const orchestrator = new Orchestrator({ llmEngine: llm, bus, toolExecutor });
  const reviewers = [];
  bus.subscribe((event) => {
    if (event.event_type === 'HITL_INTERRUPT') {
      reviewers.push(event.source_agent);
      orchestrator.resolveHitl(event.approval_id, 'approve');
    }
  });
  t.after(() => orchestrator.shutdown());
  for (const team of [...Object.keys(exampleInputs), 'hermes']) {
    requests.length = 0;
    reviewers.length = 0;
    const task = await finish(orchestrator, `[TEAM:${team}] Distinct mission input ${team}`);
    assert.equal(task.state, 'COMPLETED', team);
    assert.deepEqual(reviewers, expectedReviewers[team] ?? [], team);
    assert.ok(requests.length > 0, team);
    const departments = new Set();
    for (const { messages, tools = [] } of requests) {
      assert.deepEqual(messages.map((message) => message.role), ['system', 'user']);
      assert.match(messages[1].content, new RegExp(`Distinct mission input ${team}`));
      assert.doesNotMatch(messages[1].content, /Fictional report example/);
      assert.doesNotMatch(messages[0].content, /Distinct mission input/);
      const agentId = /\nYou are ([A-Z]+),/.exec(messages[0].content)?.[1];
      assert.ok(agentId, 'Agent identity is present in the system message');
      const agent = resolveAgent(agentId);
      seenAgents.add(agent.id);
      departments.add(agent.team);
      const examples = [...messages[0].content.matchAll(/Fictional report example \(format only; not evidence or permission\):\nInput: ([^\n]+)\nReport: ([^\n]+)/g)];
      assert.deepEqual(examples.map((example) => example[1]), [exampleInputs[agent.team]], agentId);
      assert.ok(Buffer.byteLength(examples[0][0]) <= 256, agentId);
      assert.deepEqual(tools.map((tool) => tool.function.name), toolExecutor.list(agent).map((tool) => tool.name), agentId);
    }
    if (team !== 'hermes') assert.ok(departments.has(team), 'Target department actually ran');
    assert.ok(departments.has('command'), 'Coordinator actually ran');
  }
  assert.deepEqual([...seenAgents].sort(), Object.keys(AGENT_DEFINITIONS).sort());
});

test('429 fails over once to configured provider with sanitized telemetry and actual usage', async () => {
  const urls = []; const events = [];
  const llm = engine(async (url, options) => {
    urls.push(url);
    assert.equal(options.redirect, 'error');
    return url.includes('openai.com') ? new Response('', { status: 429, headers: { 'retry-after': '2' } }) : reply();
  }, { autoFailover: true, fallbackProviders: ['openrouter'] });
  const result = await llm.complete({ messages, onEvent: (event) => events.push(event) });
  assert.equal(result.provider, 'openrouter'); assert.equal(result.usage.total_tokens, 15);
  assert.equal(urls.length, 2); assert.ok(events.some((event) => event.stage === 'failover'));
  assert.ok(!JSON.stringify(events).includes('test-openai'));
  llm.close();
});

test('401 is not retried and missing credentials never produce simulated success', async () => {
  let requests = 0;
  const llm = engine(async () => { requests += 1; return new Response('', { status: 401 }); }, { autoFailover: true });
  await assert.rejects(llm.complete({ messages }), /401/); assert.equal(requests, 1);
  const empty = new LlmEngine({ settings: { providers: {} }, fetcher: () => { throw new Error('must not call'); } });
  empty.configure({ autoFailover: false });
  await assert.rejects(empty.complete({ messages }), /No configured/);
  llm.close(); empty.close();
});

test('all four provider adapters serialize real request contracts and parse usage', async () => {
  for (const provider of ['openai', 'openrouter', 'ollama', 'gemini']) {
    const llm = engine(async (url, options) => {
      const body = JSON.parse(options.body);
      if (provider === 'gemini') {
        assert.ok(options.headers['x-goog-api-key']); assert.ok(!url.includes('key='));
        assert.ok(body.systemInstruction); assert.ok(body.tools[0].functionDeclarations);
        return Response.json({ candidates: [{ content: { role: 'model', parts: [{ thought: true, text: 'private thought' }, { text: 'public report' }] } }], usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 20 } });
      }
      assert.ok(body.messages); assert.equal(body.tools[0].type, 'function');
      if (provider === 'openai') assert.ok(body.max_completion_tokens > 0);
      if (provider === 'ollama') assert.match(url, /localhost:11434\/v1\/chat\/completions/);
      return reply();
    }, { provider, modelName: 'test-model' });
    const result = await llm.complete({ messages, tools: new ToolExecutor().list(resolveAgent('ARIA')) });
    assert.ok(result.usage.reported); assert.ok(!result.text.includes('private thought')); llm.close();
  }
});

test('usage is unknown for incomplete or invalid counters, not for explicitly reported zero', async (t) => {
  for (const provider of ['openai', 'openrouter', 'ollama', 'gemini']) {
    await t.test(provider, async (t) => {
      const [prompt, completion, total] = provider === 'gemini'
        ? ['promptTokenCount', 'candidatesTokenCount', 'totalTokenCount']
        : ['prompt_tokens', 'completion_tokens', 'total_tokens'];
      const valid = { [prompt]: 11, [completion]: 7, [total]: 20 };
      let rawUsage;
      const llm = engine(async () => Response.json(provider === 'gemini'
        ? { candidates: [{ content: { parts: [{ text: 'Fixture answer' }] } }], usageMetadata: rawUsage }
        : { choices: [{ message: { content: 'Fixture answer' } }], usage: rawUsage }), { provider });
      t.after(() => llm.close());
      const invalid = [undefined, null, [], 'unavailable', {},
        { [total]: 20 }, { ...valid, [prompt]: '11' }, { ...valid, [completion]: -1 },
        { ...valid, [total]: null }, { ...valid, [total]: 20.5 },
        { ...valid, [total]: Number.MAX_SAFE_INTEGER + 1 }];
      for (const fixture of invalid) {
        rawUsage = fixture;
        const result = await llm.complete({ messages });
        assert.equal(result.text, 'Fixture answer');
        assert.equal(result.usage, null, JSON.stringify(fixture));
      }
      rawUsage = { [prompt]: 0, [completion]: 0, [total]: 0 };
      assert.deepEqual((await llm.complete({ messages })).usage,
        { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, reported: true });
      rawUsage = valid;
      assert.deepEqual((await llm.complete({ messages })).usage,
        { prompt_tokens: 11, completion_tokens: 7, total_tokens: 20, reported: true });
    });
  }
});

test('Gemini function loop preserves original signatures and groups parallel function results', async () => {
  let turn = 0;
  const content = { role: 'model', parts: [
    { functionCall: { id: 'g1', name: 'agent-registry', args: {} }, thoughtSignature: 'opaque-signature' },
    { functionCall: { id: 'g2', name: 'task-router', args: {} } }
  ] };
  const llm = engine(async (_, options) => {
    turn += 1;
    if (turn === 1) return Response.json({ candidates: [{ content }] });
    const body = JSON.parse(options.body);
    assert.deepEqual(body.contents[1], content);
    assert.equal(body.contents[2].parts.length, 2);
    assert.equal(body.contents[2].parts[0].functionResponse.id, 'g1');
    assert.equal(body.contents[2].parts[1].functionResponse.id, 'g2');
    return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: 'Done' }] } }] });
  }, { provider: 'gemini' });
  const first = await llm.complete({ messages });
  const history = [...messages, { role: 'assistant', content: null, geminiContent: first.geminiContent },
    ...first.toolCalls.map((tool) => ({ role: 'tool', name: tool.name, call_id: tool.call_id, tool_call_id: tool.id, content: '{}' }))];
  assert.equal((await llm.complete({ messages: history })).text, 'Done'); llm.close();
});

test('provider model-tier mapping overrides selected default without reusing other provider models', async () => {
  const llm = engine();
  llm.configure({ providerModels: { openai: { 'claude-3-opus': 'tier-opus-model' }, gemini: { 'claude-3-haiku': 'fast-model' } } });
  const snapshot = llm.snapshot();
  assert.equal(llm.modelFor('openai', 'claude-3-opus', snapshot), 'tier-opus-model');
  assert.equal(llm.modelFor('gemini', 'claude-3-haiku', snapshot), 'fast-model');
  assert.notEqual(llm.modelFor('gemini', 'claude-3-opus', snapshot), 'test-model'); llm.close();
});

test('RPM queue enforces sliding window and Retry-After cooldown', async () => {
  let now = 0; const waits = [];
  const queue = new RateLimitQueue({ now: () => now, sleep: async (ms) => { waits.push(ms); now += ms; } });
  await Promise.all([queue.acquire('a', 2), queue.acquire('a', 2), queue.acquire('a', 2)]);
  assert.deepEqual(waits, [60000]);
  queue.cooldown('a', 3000); await queue.acquire('a', 2);
  assert.deepEqual(waits, [60000, 3000]); assert.equal(queue.pending, 0);
});

test('queue cancellation is bounded and cannot release later waiters early', async () => {
  let release; let entered;
  const sleeping = new Promise((resolve) => { entered = resolve; });
  const queue = new RateLimitQueue({ windowMs: 50, sleep: async () => { entered(); await new Promise((resolve) => { release = resolve; }); } });
  await queue.acquire('a', 1);
  const controller = new AbortController();
  const second = queue.acquire('a', 1, controller.signal);
  await sleeping;
  const thirdController = new AbortController();
  const third = queue.acquire('a', 1, thirdController.signal);
  thirdController.abort(); await assert.rejects(third);
  controller.abort(); release(); await assert.rejects(second); assert.equal(queue.pending, 0);
});

test('settings reject unsafe URLs, malformed limits, unknown fields; public config never exposes keys', () => {
  const llm = engine();
  for (const patch of [{ rpm: 0 }, { maxHandoffs: 999 }, { ollamaUrl: 'http://169.254.169.254/' }, { providerKeys: { unknown: 'secret' } }, { unknown: true }]) assert.throws(() => llm.configure(patch));
  const publicConfig = JSON.stringify(llm.inspect()); assert.ok(!publicConfig.includes('test-openai')); assert.ok(!publicConfig.includes('apiKey'));
  llm.close();
});

test('SAGE risk tool calculates direction/limits and rejects invalid sizing', () => {
  const result = calculateRisk({ equity: 10000, riskPercent: 1, entry: 100, stop: 95, target: 110 });
  assert.equal(result.units, 20); assert.equal(result.rewardRisk, 2); assert.equal(result.riskAmount, 100);
  assert.throws(() => calculateRisk({ equity: 10000, riskPercent: 10, entry: 100, stop: 95, target: 110 }));
  assert.throws(() => calculateRisk({ equity: 10000, riskPercent: 1, entry: 100, stop: 95, target: 90 }));
});

test('tool permissions reject cross-agent access, disabled tools, shell tools and bad schemas', async () => {
  const tools = new ToolExecutor();
  await assert.rejects(tools.execute('risk-engine', {}, { agent: resolveAgent('SCOUT') }), /permitted/);
  await assert.rejects(tools.execute('vault-write', { title: 'x', content: 'x' }, { agent: resolveAgent('SCOUT', { SCOUT: { disabledTools: ['vault-write'] } }) }), /permitted/);
  await assert.rejects(tools.execute('shell', { command: 'echo fail' }, { agent: resolveAgent('BYTE') }), /permitted/);
  await assert.rejects(tools.execute('code-sandbox', { code: 'const x = 1;', path: '.env' }, { agent: resolveAgent('BYTE') }), /Unknown tool argument/);
});

test('TECH syntax checker validates but NEVER executes supplied code', async () => {
  const tools = new ToolExecutor(); const agent = resolveAgent('BYTE');
  assert.equal((await tools.execute('code-sandbox', { code: 'process.exit(99); throw new Error("must not execute");' }, { agent })).valid, true);
  assert.equal((await tools.execute('code-sandbox', { code: 'const = ;' }, { agent })).valid, false);
});

test('source reader rejects traversal, hidden source files and credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-source-')); await mkdir(join(root, 'src'));
  await writeFile(join(root, '.env'), 'SECRET=do-not-read'); await writeFile(join(root, 'src', 'ok.js'), 'export const ok = true;');
  const tools = new ToolExecutor({ root });
  assert.match(await tools.readSource('src/ok.js'), /export const/);
  for (const path of ['.env', 'src/../.env', 'src/../package.json', '../outside.js', 'C:/secret.js']) await assert.rejects(tools.readSource(path));
});

test('real research tools use fixed destinations and return citations; unavailable services fail explicitly', async () => {
  const urls = [];
  const tools = new ToolExecutor({ fetcher: async (url) => {
    urls.push(url);
    return url.includes('wikipedia') ? Response.json({ query: { search: [{ title: 'AI', snippet: '<b>Information</b>', pageid: 123 }] } }) : Response.json({ hits: [{ title: 'AI news', objectID: '456', points: 5, url: 'https://example.org' }] });
  } });
  const output = await tools.execute('web-search', { query: 'AI & security' }, { agent: resolveAgent('SCOUT') });
  assert.equal(output.wikipedia.sources[0].snippet, 'Information'); assert.equal(urls.length, 2);
  assert.match(output.hackernews.sources[0].discussion, /id=456/);
  const unavailable = new ToolExecutor({ fetcher: async () => new Response('', { status: 503 }) });
  await assert.rejects(unavailable.execute('wikipedia-search', { query: 'AI' }, { agent: resolveAgent('SCOUT') }), /unavailable/);
});

test('vault writes and headless mission artifacts persist as JSON and Markdown without browser', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-phase2-')); const storage = await new StorageEngine(root).init();
  const tools = new ToolExecutor({ storage }); const llm = engine(); const bus = new TelemetryBus();
  const orchestrator = new Orchestrator({ storage, toolExecutor: tools, llmEngine: llm, bus });
  t.after(async () => { await orchestrator.shutdown(); await storage.close(); });
  await tools.execute('vault-write', { title: 'ทดสอบ', content: 'Real [[MEMO]] output' }, { agent: resolveAgent('MEMO') });
  const task = await finish(orchestrator, '[TEAM:CONTENT] Write a report');
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.outputs.length, 6);
  assert.equal(storage.get('deliverables').data.content[0].id, `task-${task.id}`);
  assert.equal((await readdir(join(root, 'notes'))).length, 1);
  const files = await readdir(join(root, 'deliverables', 'content'));
  assert.match(await readFile(join(root, 'deliverables', 'content', files[0]), 'utf8'), /Verified deliverable/);
  assert.equal(bus.snapshot(1)[0].archived, true); assert.equal(task.usage.total_tokens, 90);
  assert.deepEqual(task.snapshot.keys, {});
});

test('orchestrator tool calling sends real tool result back to provider and usage via events', async () => {
  let requests = 0;
  const llm = engine(async (_, options) => {
    requests += 1;
    if (requests === 1) return reply('', [call('agent-registry', {})]);
    if (requests === 2) {
      const history = JSON.parse(options.body).messages;
      const output = JSON.parse(history.find((m) => m.role === 'tool').content);
      assert.equal(output.agents.length, 27);
    }
    return reply('Completed with registry evidence');
  });
  const bus = new TelemetryBus(); const orchestrator = new Orchestrator({ llmEngine: llm, bus });
  const task = await finish(orchestrator, '[TEAM:COMMAND] [COWORK:ARIA,HERMES] Summarize');
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.toolCalls, 1);
  assert.equal(task.usage.total_tokens, 45);
  assert.ok(bus.snapshot(100).some((e) => e.tool_name === 'agent-registry' && e.tool_status === 'completed'));
  assert.ok(bus.snapshot(100).some((e) => e.stage === 'response' && e.token_usage.total_tokens === 15));
  await orchestrator.shutdown();
});

test('execution summaries describe observed operations rather than copying mission or output previews', async (t) => {
  const bus = new TelemetryBus();
  const llm = engine(async (_, options) => {
    const history = JSON.parse(options.body).messages;
    if (/\nYou are HERMES,/.test(history[0].content) && !history.some(({ role }) => role === 'tool')) {
      return reply('', [call('signal-broadcaster', { message: 'FIXTURE_NOTIFICATION_TEXT' })]);
    }
    return reply('FIXTURE_REPORT_TEXT');
  });
  const orchestrator = new Orchestrator({ llmEngine: llm, bus });
  t.after(() => orchestrator.shutdown());
  const workflow = { nodes: [{ id: 'relay', agent: 'HERMES', dependsOn: [] }] };
  for (const graph of [undefined, workflow]) {
    const task = orchestrator.submitTask('[TEAM:COMMAND] [COWORK:ARIA,HERMES] FIXTURE_MISSION_TEXT', graph);
    await Promise.all([...orchestrator.running]);
    assert.equal(task.state, 'COMPLETED');
    const events = bus.snapshot(100).filter(({ task_id }) => task_id === task.id);
    const planning = events.find(({ payload_summary }) => payload_summary.startsWith('Decomposing task:'));
    const completion = events.find(({ source_agent, stage }) => source_agent === 'HERMES' && stage === 'completed');
    const notification = events.find(({ payload_summary }) => payload_summary === 'FIXTURE_NOTIFICATION_TEXT');
    assert.match(planning.payload_summary, /FIXTURE_MISSION_TEXT/);
    assert.match(completion.payload_summary, /FIXTURE_REPORT_TEXT/);
    assert.ok(notification, 'Existing local tool notification remains visible');
    assert.deepEqual(planning.reasoning_trace, { kind: 'execution_summary', summary: 'ARIA: preparing the mission workflow.' });
    assert.deepEqual(completion.reasoning_trace, { kind: 'execution_summary', summary: 'HERMES: produced a deliverable.' });
    assert.deepEqual(notification.reasoning_trace, { kind: 'execution_summary', summary: 'HERMES: signal-broadcaster emitted a local notification.' });
    assert.equal(completion.node_id, graph ? 'relay' : null);
  }
});

test('handoff and repeated-tool loop breakers stop bounded missions', async () => {
  let requests = 0;
  const llm = engine(async () => { requests += 1; return reply('', [call('agent-registry', {})]); });
  const orchestrator = new Orchestrator({ llmEngine: llm });
  let task = await finish(orchestrator, '[TEAM:COMMAND] [COWORK:ARIA,HERMES] repeat test');
  assert.equal(task.state, 'FAILED'); assert.equal(requests, 2);
  llm.configure({ maxHandoffs: 1 }); requests = 0;
  task = await finish(orchestrator, '[TEAM:TECH] too many stages');
  assert.equal(task.state, 'FAILED'); assert.equal(requests, 0);
  await orchestrator.shutdown();
});

test('budget guard prevents requests when insufficient; missing usage remains unknown, not fabricated', async () => {
  let requests = 0;
  const llm = engine(async () => { requests += 1; return Response.json({ choices: [{ message: { content: 'Done' } }] }); }, { maxTaskTokens: 1000 });
  const orchestrator = new Orchestrator({ llmEngine: llm });
  assert.equal((await finish(orchestrator, '[TEAM:COMMAND] Budget test')).state, 'FAILED'); assert.equal(requests, 0);
  llm.configure({ maxTaskTokens: 60000 });
  const task = await finish(orchestrator, '[TEAM:COMMAND] [COWORK:ARIA,HERMES] no usage');
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.usage.total_tokens, 0); assert.equal(task.usage.unreported_calls, 2);
  await orchestrator.shutdown();
});

test('known total still exhausts the mission budget when usage coverage is incomplete', async (t) => {
  let calls = 0;
  const llm = engine(async () => {
    calls += 1;
    return Response.json({ choices: [{ message: { content: 'Fixture report' } }], usage: { total_tokens: 100_000 } });
  });
  const orchestrator = new Orchestrator({ llmEngine: llm, bus: new TelemetryBus() });
  t.after(() => orchestrator.shutdown());
  const task = await finish(orchestrator, '[TEAM:COMMAND] Incomplete usage budget fixture');
  assert.equal(task.state, 'FAILED');
  assert.equal(calls, 1);
  assert.deepEqual(task.usage, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, unreported_calls: 1 });
});

test('HITL rejection and custom trade sequence cannot bypass human review', async () => {
  const bus = new TelemetryBus(); const orchestrator = new Orchestrator({ llmEngine: engine(), bus }); let reviews = 0;
  bus.subscribe((event) => { if (event.event_type === 'HITL_INTERRUPT') { reviews += 1; orchestrator.resolveHitl(event.approval_id, 'reject'); } });
  const task = await finish(orchestrator, '[TEAM:TRADE] [COWORK:HAWK,HERMES] review only');
  assert.equal(task.state, 'FAILED'); assert.equal(reviews, 1); assert.equal(orchestrator.approvals.size, 0);
  await orchestrator.shutdown();
});

test('all 27 agents execute through department missions with real transport adapters', async () => {
  const bus = new TelemetryBus(); const orchestrator = new Orchestrator({ llmEngine: engine(), bus }); const executed = new Set();
  bus.subscribe((event) => {
    if (event.stage === 'completed') executed.add(event.source_agent);
    if (event.event_type === 'HITL_INTERRUPT') orchestrator.resolveHitl(event.approval_id, 'approve');
  });
  for (const dept of ['command', 'trade', 'tech', 'design', 'content', 'data', 'finance', 'legal', 'hermes']) {
    const task = await finish(orchestrator, `[TEAM:${dept.toUpperCase()}] Test evidence report`);
    assert.equal(task.state, 'COMPLETED', dept);
  }
  assert.equal(executed.size, 27); await orchestrator.shutdown();
});

test('REST settings sync, backend inference, schema registry and WebSocket usage integration', { timeout: 10000 }, async (t) => {
  const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-api2-'));
  const app = await createApplication({ vaultDir, llmEngine: engine() }); t.after(() => app.close());
  const address = await app.listen(0, '127.0.0.1'); const base = `http://127.0.0.1:${address.port}`;
  const configured = await fetch(`${base}/api/llm/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'openai', apiKey: 'not-for-broadcast', rpm: 1000 }) });
  const configText = await configured.text(); assert.equal(configured.status, 200); assert.ok(!configText.includes('not-for-broadcast'));
  const chat = await fetch(`${base}/api/llm/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userPrompt: 'Test' }) });
  assert.equal((await chat.json()).token_usage.total_tokens, 15);
  const registry = await (await fetch(`${base}/api/tools`)).json(); assert.equal(registry.mcpTransportConnected, false); assert.ok(registry.tools.length > 15);
  const socket = new WebSocket(`${base.replace('http', 'ws')}/ws`); t.after(() => socket.terminate());
  await once(socket, 'open');
  const completed = new Promise((resolve) => {
    socket.on('message', (raw) => {
      const message = JSON.parse(raw);
      if (message.event?.event_type === 'TASK_COMPLETED' && message.event.outcome === 'COMPLETED') resolve(message.event);
    });
  });
  socket.send(JSON.stringify({ type: 'SUBMIT_TASK', description: '[TEAM:CONTENT] [COWORK:ARIA,HERMES] Integration test' }));
  const event = await completed; assert.equal(event.token_usage.total_tokens, 30); assert.equal(event.archived, true);
  assert.ok(!JSON.stringify(event).includes('not-for-broadcast')); socket.close(); await once(socket, 'close');
});

test('OpenRouter HTTP 200 error bodies trigger failover instead of fake success', async () => {
  const llm = engine(async (url) => url.includes('openrouter') ? Response.json({ error: { code: 429, message: 'upstream throttled' } }) : reply(), { provider: 'openrouter', autoFailover: true, fallbackProviders: ['openai'] });
  assert.equal((await llm.complete({ messages })).provider, 'openai'); llm.close();
});

test('browser connector retains provider-scoped keys and sends inference only through backend', async () => {
  const originalStorage = globalThis.localStorage; const originalFetch = globalThis.fetch;
  const values = new Map(); const requests = [];
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  globalThis.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json(url.endsWith('/chat') ? { text: 'Backend response' } : { configured: {} }); };
  try {
    saveEngineConfig({ provider: 'openai', apiKey: 'test-browser-openai' });
    saveEngineConfig({ provider: 'gemini', apiKey: 'test-browser-gemini' });
    const cfg = loadEngineConfig();
    assert.equal(cfg.providerKeys.openai, 'test-browser-openai'); assert.equal(cfg.providerKeys.gemini, 'test-browser-gemini');
    const local = saveEngineConfig({ provider: 'ollama', apiKey: 'legacy-local-value' });
    assert.ok(!Object.hasOwn(local.providerKeys, 'ollama'));
    await syncBackendEngine(cfg);
    assert.ok(!('webhookUrl' in requests[0].body));
    assert.equal((await backendChat({ config: cfg, userPrompt: 'Check backend' })).text, 'Backend response');
    assert.ok(requests.every((request) => request.url.startsWith('/api/llm/')));
  } finally { globalThis.localStorage = originalStorage; globalThis.fetch = originalFetch; }
});

test('registered external adapter tools enforce server-granted agent scopes and disabled overrides', async () => {
  const tools = new ToolExecutor(); let invocations = 0;
  tools.register({ name: 'external-read', description: 'Trusted server-owned adapter', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, agents: ['MEMO'], execute: async () => { invocations += 1; return { content: 'adapter result' }; } });
  const permitted = resolveAgent('MEMO', { MEMO: { tools: ['external-read'] } });
  assert.equal((await tools.execute('external-read', {}, { agent: permitted })).content, 'adapter result');
  await assert.rejects(tools.execute('external-read', {}, { agent: resolveAgent('SCOUT', { SCOUT: { tools: ['external-read'] } }) }), /permitted/);
  await assert.rejects(tools.execute('external-read', {}, { agent: { ...permitted, disabledTools: ['external-read'] } }), /permitted/);
  assert.equal(invocations, 1);
});

test('workspace backup excludes provider credentials and webhook URLs', async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL; const originalRevoke = URL.revokeObjectURL;
  let captured;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    getItem: (key) => key === 'maoc_llm_engine_config_v1' ? JSON.stringify({ provider: 'gemini', apiKey: 'sensitive-key', providerKeys: { openai: 'other-key' }, webhookUrl: 'sensitive-webhook' }) : null
  } });
  globalThis.document = { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } };
  URL.createObjectURL = (blob) => { captured = blob; return 'blob:test'; }; URL.revokeObjectURL = () => {};
  try {
    exportFullWorkspaceBackup(); const body = await captured.text();
    assert.ok(!body.includes('sensitive')); assert.ok(!body.includes('other-key')); assert.match(body, /gemini/);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage;
    globalThis.document = originalDocument; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  }
});
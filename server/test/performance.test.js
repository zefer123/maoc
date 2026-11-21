import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { PerformanceStore, createExecutionObservation, validatePerformanceRecord } from '../src/performanceStore.js';
import { aggregatePerformance } from '../../src/lib/performanceAnalytics.js';
import { createWorkflowExample, createConditionalWorkflowExample } from '../../src/lib/workflowGraph.js';
import { StorageEngine } from '../src/storageEngine.js';
import { Orchestrator } from '../src/orchestrator.js';
import { LlmEngine } from '../src/llmEngine.js';
import { TelemetryBus, telemetryBus } from '../src/eventBus.js';
import { createApplication } from '../src/server.js';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const iso = (time) => new Date(time).toISOString();
const observation = (patch = {}) => ({ ...createExecutionObservation('execution-1', 'BYTE', 'work'), state: 'COMPLETED', duration_ms: 100, ...patch });
const mission = (patch = {}) => ({ task_id: 'task-test', started_at: iso(NOW - 1000), finished_at: iso(NOW), duration_ms: 1000, department: 'tech', mode: 'dag', state: 'COMPLETED', executions: [observation()], ...patch });
const row = (snapshot, id) => snapshot.rows.find((item) => item.id === id);
const reply = (content = 'Evidence-based report', usage = true) => Response.json({ choices: [{ message: { content } }], ...(usage ? { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } } : {}) });
const call = (name = 'agent-registry') => Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: 'test-tool', type: 'function', function: { name, arguments: '{}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
function engine(fetcher = async () => reply()) {
  const llm = new LlmEngine({ settings: { providers: { openai: 'offline-analytics-key' } }, fetcher });
  llm.configure({ provider: 'openai', modelName: 'offline', autoFailover: false, rpm: 1000, maxTaskTokens: 500000 });
  return llm;
}
const drain = (orchestrator) => Promise.all([...orchestrator.running]);
async function wait(check) {
  for (let i = 0; i < 300; i += 1) { const value = check(); if (value) return value; await delay(5); }
  assert.fail('Expected state not reached');
}
async function storeFixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'maoc-performance-')); const storage = await new StorageEngine(root).init();
  const store = await new PerformanceStore(storage, { clock: () => NOW, ...options }).init();
  t.after(async () => { await store.close(); await storage.close(); }); return { root, storage, store };
}
async function executor(t, llm = engine(), options = {}) {
  const { store, storage, root } = await storeFixture(t); let tick = 0;
  const orchestrator = new Orchestrator({ llmEngine: llm, analytics: store, clock: () => NOW, monotonic: () => { tick += 10; return tick; }, bus: new TelemetryBus(), ...options });
  t.after(() => orchestrator.shutdown()); return { store, storage, root, orchestrator, llm };
}

test('empty analytics has no fabricated metrics, all agents plus HUMAN and null rates/latency', () => {
  const result = aggregatePerformance([], { now: NOW });
  assert.equal(result.rows.length, 28); assert.equal(result.mission_count, 0);
  assert.equal(row(result, 'BYTE').completion_rate, null); assert.equal(row(result, 'BYTE').p95_ms, null);
  assert.equal(row(result, 'BYTE').total_tokens, 0); assert.equal(result.recent.length, 0);
});

test('aggregation distinguishes step completion from mission failure and excludes cancelled/skipped from denominator', () => {
  const executions = [observation(), observation({ id: 'e2', state: 'FAILED', duration_ms: 200 }), observation({ id: 'e3', state: 'CANCELLED', duration_ms: 300 }), observation({ id: 'e4', state: 'SKIPPED', duration_ms: 0 })];
  const result = aggregatePerformance([mission({ state: 'FAILED', executions })], { now: NOW }); const byte = row(result, 'BYTE');
  assert.equal(byte.completion_rate, 0.5); assert.equal(byte.mean_ms, 200); assert.equal(byte.p50_ms, 200); assert.equal(byte.p95_ms, 300);
  assert.equal(byte.duration_samples, 3); assert.equal(byte.skipped, 1); assert.equal(result.mission_outcomes.FAILED, 1);
});

test('time windows, team/agent filters and latest-20 provenance apply to retained terminal missions only', () => {
  const records = Array.from({ length: 25 }, (_, i) => mission({ task_id: `task-${i}`, finished_at: iso(NOW - i * 1000) }));
  records.push(mission({ task_id: 'old', finished_at: iso(NOW - 86400001) }), mission({ task_id: 'future', finished_at: iso(NOW + 1) }));
  assert.equal(aggregatePerformance(records, { window: '24h', now: NOW }).mission_count, 25);
  const filtered = aggregatePerformance(records, { window: 'all', team: 'tech', agent: 'BYTE', now: NOW });
  assert.equal(filtered.rows.length, 1); assert.equal(filtered.mission_count, 26); assert.equal(filtered.recent.length, 20); assert.equal(filtered.recent[0].task_id, 'task-0');
  assert.equal(aggregatePerformance(records, { team: 'design', now: NOW }).mission_count, 0);
  assert.throws(() => aggregatePerformance(records, { window: 'invalid' }), /window/);
});

test('missions failing before any execution count as mission failures without blaming an Agent', () => {
  const result = aggregatePerformance([mission({ state: 'FAILED', executions: [] })], { now: NOW });
  assert.equal(result.mission_count, 1); assert.equal(result.mission_outcomes.FAILED, 1); assert.equal(result.rows.reduce((n, item) => n + item.failed, 0), 0);
});

test('strict persistence schema rejects text/secrets, invalid counters, unsafe timestamps and duplicate observations', () => {
  for (const patch of [{ description: 'secret' }, { state: 'RUNNING' }, { duration_ms: -1 }, { finished_at: 'bad' }, { department: 'unknown' }, { executions: [observation({ prompt: 'forbidden' })] }, { executions: [observation({ llm_calls: 1 })] }, { executions: [observation({ tool_errors: 1 })] }, { executions: [observation(), observation()] }, { executions: [observation({ agent: 'HUMAN', llm_calls: 1, responses: 1, reported_calls: 1 })] }, { executions: [observation({ state: 'SKIPPED' })] }]) assert.throws(() => validatePerformanceRecord(mission(patch)));
  const input = mission(); const copy = validatePerformanceRecord(input); input.executions[0].state = 'FAILED'; assert.equal(copy.executions[0].state, 'COMPLETED');
});

test('durable retention is bounded, idempotent and snapshot copies cannot mutate history', async (t) => {
  const { store, storage } = await storeFixture(t, { capacity: 2 });
  await Promise.all([store.append(mission({ task_id: 'first' })), store.append(mission({ task_id: 'second' })), store.append(mission({ task_id: 'third' }))]);
  await store.append(mission({ task_id: 'third', state: 'FAILED' }));
  assert.deepEqual(store.records.map((item) => item.task_id), ['second', 'third']);
  const snapshot = store.snapshot({ window: 'all' }); snapshot.rows[0].completed = 999;
  const restarted = await new PerformanceStore(storage, { clock: () => NOW, capacity: 2 }).init();
  assert.equal(restarted.snapshot({ window: 'all' }).mission_count, 2); assert.equal(restarted.records[1].state, 'COMPLETED');
  assert.equal(restarted.snapshot().retention_limit, 2); await restarted.close();
});

test('disk failure exposes degraded memory-only observations and later writes persist recovery without losing missions', async (t) => {
  const { store, storage } = await storeFixture(t); const original = storage.atomicWrite.bind(storage);
  storage.atomicWrite = async () => { throw new Error('disk offline'); };
  await assert.rejects(store.append(mission()), /disk offline/);
  assert.equal(store.snapshot().persistence, 'degraded'); assert.equal(store.records.length, 1); assert.equal(store.health().write_failures, 1);
  storage.atomicWrite = original; await store.append(mission({ task_id: 'next' }));
  assert.equal(store.health().status, 'ok'); assert.equal(JSON.parse(await readFile(store.path, 'utf8')).records.length, 2);
});

test('close drains accepted writes, retries dirty data and disallows new observations', async (t) => {
  const { store, storage } = await storeFixture(t); const original = storage.atomicWrite.bind(storage); let release; let entered;
  const started = new Promise((resolve) => { entered = resolve; }); const gate = new Promise((resolve) => { release = resolve; });
  storage.atomicWrite = async (...args) => { entered(); await gate; return original(...args); };
  const writing = store.append(mission()); await started; const closing = store.close(); release(); await Promise.all([writing, closing]);
  await assert.rejects(store.append(mission({ task_id: 'late' })), /closed/); assert.equal(JSON.parse(await readFile(store.path, 'utf8')).records.length, 1);
});

test('corrupt analytics storage rejects startup without overwriting file or leaking Vault lock', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-corrupt-analytics-')); const storage = await new StorageEngine(root).init(); const path = join(storage.stateDir, 'performance.json'); await storage.close();
  for (const text of ['{broken', JSON.stringify({ schemaVersion: 1, started_at: iso(NOW), records: [mission({ description: 'not allowed' })] }), JSON.stringify({ schemaVersion: 1, started_at: iso(NOW), records: [mission(), mission()] })]) {
    await writeFile(path, text); await assert.rejects(createApplication({ vaultDir: root })); assert.equal(await readFile(path, 'utf8'), text);
    const probe = await new StorageEngine(root).init(); await probe.close();
  }
});

test('parallel DAG and repeated same agent nodes have distinct observations, measured durations and exact usage', async (t) => {
  const { orchestrator, store } = await executor(t);
  const graph = createWorkflowExample(); graph.nodes[1].agent = 'BYTE'; graph.nodes[2].agent = 'BYTE';
  const task = orchestrator.submitTask('[TEAM:TECH] Analytics parallel', graph); await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED'); const result = store.snapshot(); const byte = row(result, 'BYTE');
  assert.equal(byte.completed, 2); assert.equal(byte.llm_calls, 2); assert.equal(byte.total_tokens, 30); assert.equal(byte.duration_samples, 2); assert.ok(byte.p50_ms > 0);
  assert.equal(new Set(store.records[0].executions.map((item) => item.id)).size, 4);
  assert.equal(store.records[0].executions.reduce((sum, item) => sum + item.total_tokens, 0), task.usage.total_tokens);
});

test('sequential repeated agents are separate executions and Swarm observations retain mission mode', async (t) => {
  const { orchestrator, store } = await executor(t);
  orchestrator.submitTask('[TEAM:TECH] [COWORK:BYTE,NOVA,BYTE] Repeat'); await drain(orchestrator);
  assert.equal(row(store.snapshot(), 'BYTE').completed, 2); assert.equal(store.records[0].mode, 'sequential');
  orchestrator.submitTask('[TEAM:TECH] Swarm analytics', undefined, { agents: ['BYTE', 'NOVA'], synthesizer: 'BYTE' }); await drain(orchestrator);
  assert.equal(store.records[1].mode, 'swarm'); assert.equal(row(store.snapshot(), 'BYTE').completed, 4);
});

test('multiple tool/LLM rounds count real responses, partial usage coverage and errors without imaginary cost', async (t) => {
  const llm = engine(async (_, options) => JSON.parse(options.body).messages.some((item) => item.role === 'tool')
    ? Response.json({ choices: [{ message: { content: 'Final with incomplete usage' } }], usage: { prompt_tokens: 99, total_tokens: 105 } })
    : call());
  const { orchestrator, store } = await executor(t, llm);
  const task = orchestrator.submitTask('[TEAM:TECH] Tool statistics', { nodes: [{ id: 'work', agent: 'ARIA', dependsOn: [] }] }); await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED');
  assert.deepEqual(task.usage, { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, unreported_calls: 1 });
  const aria = row(store.snapshot(), 'ARIA'); assert.equal(aria.llm_calls, 2); assert.equal(aria.responses, 2); assert.equal(aria.reported_calls, 1); assert.equal(aria.unreported_calls, 1); assert.equal(aria.total_tokens, 15); assert.equal(aria.tool_calls, 1); assert.equal(aria.tool_errors, 0);
  assert.equal('cost' in aria, false);
});

test('unpermitted tool errors count as errors even if agent later returns a deliverable', async (t) => {
  const llm = engine(async (_, options) => JSON.parse(options.body).messages.some((item) => item.role === 'tool') ? reply() : call('not-permitted'));
  const { orchestrator, store } = await executor(t, llm);
  orchestrator.submitTask('[TEAM:TECH] Tool failure', { nodes: [{ id: 'work', agent: 'BYTE', dependsOn: [] }] }); await drain(orchestrator);
  const byte = row(store.snapshot(), 'BYTE'); assert.equal(byte.completed, 1); assert.equal(byte.tool_calls, 1); assert.equal(byte.tool_errors, 1);
});

test('provider failure is an execution failure with unknown usage, not a zero-cost successful response', async (t) => {
  const { orchestrator, store } = await executor(t, engine(async () => new Response('Unauthorized', { status: 401 })));
  const task = orchestrator.submitTask('[TEAM:TECH] Failure stats', { nodes: [{ id: 'work', agent: 'BYTE', dependsOn: [] }] }); await drain(orchestrator);
  assert.equal(task.state, 'FAILED'); const byte = row(store.snapshot(), 'BYTE'); assert.equal(byte.failed, 1); assert.equal(byte.request_errors, 1); assert.equal(byte.responses, 0); assert.equal(byte.reported_calls, 0);
});

test('conditional skipped paths have no duration, calls or usage while active path is measured', async (t) => {
  const llm = engine(async (_, options) => { const { messages } = JSON.parse(options.body); return /Workflow node: inspect\b/.test(messages[1].content) && !messages.some((item) => item.role === 'tool') ? call() : reply(); });
  const { orchestrator, store } = await executor(t, llm);
  orchestrator.submitTask('[TEAM:TECH] Branch metrics', createConditionalWorkflowExample()); await drain(orchestrator);
  const byte = row(store.snapshot(), 'BYTE'); assert.equal(byte.skipped, 1); assert.equal(byte.duration_samples, 0); assert.equal(byte.llm_calls, 0); assert.equal(byte.mean_ms, null);
  assert.equal(row(store.snapshot(), 'NOVA').completed, 1);
});

test('HUMAN wait is measured separately with no AI usage and active missions are excluded until terminal', async (t) => {
  const { orchestrator, store } = await executor(t);
  const task = orchestrator.submitTask('[TEAM:TECH] HUMAN analytics', { nodes: [{ id: 'person', agent: 'HUMAN', prompt: 'Requirements?', dependsOn: [] }] });
  const input = await wait(() => orchestrator.listHumanInputs()[0]); assert.equal(store.snapshot().mission_count, 0);
  orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: 'PRIVATE_HUMAN_TEXT' }); await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED'); const human = row(store.snapshot(), 'HUMAN'); assert.equal(human.completed, 1); assert.ok(human.mean_ms > 0); assert.equal(human.llm_calls, 0);
  assert.doesNotMatch(await readFile(store.path, 'utf8'), /PRIVATE_HUMAN_TEXT|Requirements/);
});

test('report rejection changes mission outcome, not completed agent metric or prior duration', async (t) => {
  const { orchestrator, store } = await executor(t);
  const task = orchestrator.submitTask('[TEAM:TECH] Review metrics', { nodes: [{ id: 'review', agent: 'SAGE', dependsOn: [] }] });
  const approval = await wait(() => [...orchestrator.approvals.keys()][0]); const measured = task.observations[0].duration_ms;
  assert.equal(store.snapshot().mission_count, 0); orchestrator.resolveHitl(approval, 'reject'); await drain(orchestrator);
  assert.equal(task.state, 'FAILED'); assert.equal(row(store.snapshot(), 'SAGE').completed, 1); assert.equal(row(store.snapshot(), 'SAGE').failed, 0);
  assert.equal(task.observations[0].duration_ms, measured); assert.equal(store.snapshot().mission_outcomes.FAILED, 1);
});

test('shutdown records cancellation and drains pending observations, distinct from failed execution', async (t) => {
  const llm = engine(async (_, options) => { await delay(10000, undefined, { signal: options.signal }); return reply(); });
  const { orchestrator, store } = await executor(t, llm);
  const task = orchestrator.submitTask('[TEAM:TECH] Cancel metrics', { nodes: [{ id: 'work', agent: 'BYTE', dependsOn: [] }] });
  await wait(() => task.observations[0]?.llm_calls); await orchestrator.shutdown();
  assert.equal(task.state, 'CANCELLED'); assert.equal(row(store.snapshot(), 'BYTE').cancelled, 1); assert.equal(row(store.snapshot(), 'BYTE').failed, 0);
});

test('parallel failure attributes failed execution and cancelled sibling separately without counting unstarted report', async (t) => {
  const llm = engine(async (_, options) => {
    const prompt = JSON.parse(options.body).messages[1].content;
    if (/Workflow node: broken\b/.test(prompt)) { await delay(20); return new Response('Unauthorized', { status: 401 }); }
    await delay(10000, undefined, { signal: options.signal }); return reply();
  });
  const { orchestrator, store } = await executor(t, llm);
  const task = orchestrator.submitTask('[TEAM:TECH] Sibling failure', { maxConcurrency: 2, nodes: [{ id: 'broken', agent: 'BYTE', dependsOn: [] }, { id: 'sibling', agent: 'NOVA', dependsOn: [] }, { id: 'report', agent: 'HERMES', dependsOn: ['broken', 'sibling'] }] });
  await drain(orchestrator); assert.equal(task.state, 'FAILED'); assert.equal(row(store.snapshot(), 'BYTE').failed, 1); assert.equal(row(store.snapshot(), 'NOVA').cancelled, 1); assert.equal(row(store.snapshot(), 'HERMES').executions, 0);
});

test('mission deadline is a failed execution rather than user/shutdown cancellation', async (t) => {
  const llm = engine(async (_, options) => { await delay(10000, undefined, { signal: options.signal }); return reply(); }); llm.configure({ taskTimeoutMs: 1000 });
  const { orchestrator, store } = await executor(t, llm);
  const task = orchestrator.submitTask('[TEAM:TECH] Deadline', { nodes: [{ id: 'work', agent: 'BYTE', dependsOn: [] }] }); await drain(orchestrator);
  assert.equal(task.state, 'FAILED'); assert.equal(row(store.snapshot(), 'BYTE').failed, 1); assert.equal(row(store.snapshot(), 'BYTE').cancelled, 0);
});

test('analytics disk failures do not turn successful missions into failures or expose credentials/text', async (t) => {
  const { orchestrator, store, storage } = await executor(t); const original = storage.atomicWrite.bind(storage);
  storage.atomicWrite = async () => { throw new Error('disk failure'); };
  const task = orchestrator.submitTask('[TEAM:TECH] PRIVATE_MISSION_TEXT', { nodes: [{ id: 'work', agent: 'BYTE', dependsOn: [] }] }); await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED'); assert.equal(store.snapshot().persistence, 'degraded'); assert.deepEqual(task.snapshot.keys, {});
  storage.atomicWrite = original; await store.close(); const saved = await readFile(store.path, 'utf8');
  assert.doesNotMatch(saved, /PRIVATE_MISSION_TEXT|offline-analytics-key|Evidence-based report|apiKey/);
});

test('REST analytics filters are strict read-only, survive ring rollover and persist across application restart', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-analytics-api-')); let calls = 0;
  let app = await createApplication({ vaultDir: root, llmEngine: engine(async () => { calls += 1; return reply(); }) });
  t.after(() => app.close()); await app.listen(0); let base = `http://127.0.0.1:${app.server.address().port}`;
  const task = app.orchestrator.submitTask('[TEAM:TECH] API analytics', { nodes: [{ id: 'work', agent: 'BYTE', dependsOn: [] }] }); await drain(app.orchestrator);
  for (let i = 0; i < 510; i += 1) telemetryBus.publish({ event_type: 'AGENT_THINKING', source_agent: 'BYTE', token_usage: { total_tokens: 999 } });
  const result = await (await fetch(`${base}/api/analytics?window=all&agent=BYTE`)).json(); assert.equal(result.rows[0].total_tokens, 15); assert.equal(result.recent[0].task_id, task.id);
  assert.equal(calls, 1);
  for (const query of ['window=1h', 'team=missing', 'agent=missing', 'window=all&window=7d', 'agent[x]=BYTE', 'reset=true']) assert.equal((await fetch(`${base}/api/analytics?${query}`)).status, 400, query);
  assert.equal((await fetch(`${base}/api/analytics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  assert.equal((await fetch(`${base}/api/storage/performance`)).status, 404);
  await app.close(); app = await createApplication({ vaultDir: root, llmEngine: engine() }); await app.listen(0); base = `http://127.0.0.1:${app.server.address().port}`;
  const restarted = await (await fetch(`${base}/api/analytics?window=all`)).json(); assert.equal(restarted.mission_count, 1); assert.equal(app.orchestrator.listTasks().length, 0);
  assert.equal(restarted.recent[0].task_id, task.id); assert.equal((await (await fetch(`${base}/api/health`)).json()).checks.analytics.status, 'ok');
});
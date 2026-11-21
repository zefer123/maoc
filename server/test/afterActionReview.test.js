import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { buildAfterActionReview } from '../../src/lib/afterActionReview.js';
import { createConditionalWorkflowExample } from '../../src/lib/workflowGraph.js';
import { PerformanceStore, createExecutionObservation, validatePerformanceRecord } from '../src/performanceStore.js';
import { StorageEngine } from '../src/storageEngine.js';
import { Orchestrator } from '../src/orchestrator.js';
import { LlmEngine } from '../src/llmEngine.js';
import { TelemetryBus } from '../src/eventBus.js';
import { ToolExecutor } from '../src/toolExecutor.js';
import { HttpError } from '../src/validation.js';
import { createApplication } from '../src/server.js';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const legacy = (id = 'legacy-task') => ({ task_id: id, started_at: new Date(NOW).toISOString(), finished_at: new Date(NOW).toISOString(), duration_ms: 0,
  department: 'tech', mode: 'dag', state: 'COMPLETED', executions: [{ ...createExecutionObservation('execution-1', 'BYTE', 'work'), state: 'COMPLETED' }] });
const reply = (content = 'PRIVATE_MODEL_PROSE', usage = true) => Response.json({ choices: [{ message: { content } }], ...(usage ? { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } } : {}) });
const call = (name = 'agent-registry') => Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: 'tool', type: 'function', function: { name, arguments: '{}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
function engine(fetcher = async () => reply()) {
  const llm = new LlmEngine({ settings: { providers: { openai: 'PRIVATE_PROVIDER_CREDENTIAL' } }, fetcher });
  llm.configure({ provider: 'openai', modelName: 'offline', autoFailover: false, rpm: 1000, maxTaskTokens: 500000 }); return llm;
}
const drain = (orchestrator) => Promise.all([...orchestrator.running]);
async function wait(check) {
  for (let i = 0; i < 400; i += 1) { const value = check(); if (value) return value; await delay(5); }
  assert.fail('Expected AAR state not reached');
}
async function fixture(t, { llm = engine(), archive = false, capacity, ...options } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'maoc-aar-')); const storage = await new StorageEngine(root).init();
  const store = await new PerformanceStore(storage, { clock: () => NOW, ...(capacity ? { capacity } : {}) }).init(); let tick = 0;
  const orchestrator = new Orchestrator({ llmEngine: llm, analytics: store, clock: () => NOW, monotonic: () => { tick += 10; return tick; },
    bus: new TelemetryBus(), ...(archive ? { storage, toolExecutor: new ToolExecutor({ storage }) } : {}), ...options });
  t.after(async () => { await orchestrator.shutdown(); await store.close(); await storage.close(); });
  return { root, storage, store, orchestrator, llm };
}
const single = (agent = 'BYTE') => ({ nodes: [{ id: 'work', agent, dependsOn: [] }] });
async function run(orchestrator, graph = single()) { const task = orchestrator.submitTask('[TEAM:TECH] PRIVATE_MISSION_DESCRIPTION', graph); await drain(orchestrator); return task; }

test('legacy metrics generate deterministic reports that explicitly lack routing/review/failure context', () => {
  const record = legacy(); const report = buildAfterActionReview(record);
  assert.deepEqual(report, buildAfterActionReview(record)); assert.equal(report.evidence_level, 'legacy_metrics_only'); assert.equal(report.context, null);
  assert.match(report.missing[0], /Legacy analytics/); assert.equal(report.totals.total_tokens, 0);
  report.executions[0].state = 'FAILED'; assert.equal(record.executions[0].state, 'COMPLETED');
  assert.equal('actions' in report, false); assert.equal('cost' in report, false);
});

test('terminal success automatically records AAR in same commit as analytics with exact counters and archive state', async (t) => {
  const { orchestrator, store } = await fixture(t, { archive: true }); const task = await run(orchestrator);
  assert.equal(task.state, 'COMPLETED'); const record = store.records[0]; const report = store.review(task.id).report;
  assert.equal(report.evidence_level, 'recorded_context'); assert.equal(report.context.archive, 'completed'); assert.equal(report.context.stop, null);
  assert.equal(report.executions[0].state, 'COMPLETED'); assert.equal(report.context.nodes[0].execution_id, report.executions[0].id);
  assert.equal(report.totals.total_tokens, 15); assert.deepEqual(report, buildAfterActionReview(record)); assert.equal(store.snapshot().mission_count, 1);
});

test('persisted AAR never contains mission text, credentials, model prose, raw tools, comparison path or values', async (t) => {
  const llm = engine(async (_, options) => {
    const { messages } = JSON.parse(options.body);
    return /Workflow node: inspect\b/.test(messages[1].content) && !messages.some((message) => message.role === 'tool') ? call() : reply();
  });
  const { orchestrator, store } = await fixture(t, { llm }); const graph = createConditionalWorkflowExample();
  for (const node of graph.nodes.filter((item) => item.when)) { node.when.path = 'PRIVATE_COMPARISON_PATH'; node.when.value = 'PRIVATE_COMPARISON_VALUE'; }
  const task = await run(orchestrator, graph); assert.equal(task.state, 'FAILED');
  const text = await readFile(store.path, 'utf8');
  assert.doesNotMatch(text, /PRIVATE_|systemPrompt|apiKey|tool_result|payload_summary|failure_reason|reasoning_trace/);
  assert.equal(store.review(task.id).report.context.stop.code, 'CONDITION_INVALID');
});

test('IF/ELSE decisions, skipped path and join topology persist without raw comparison data', async (t) => {
  const llm = engine(async (_, options) => { const { messages } = JSON.parse(options.body); return /Workflow node: inspect\b/.test(messages[1].content) && !messages.some((message) => message.role === 'tool') ? call() : reply(); });
  const { orchestrator, store } = await fixture(t, { llm }); const task = await run(orchestrator, createConditionalWorkflowExample());
  assert.equal(task.state, 'COMPLETED'); const report = store.review(task.id).report;
  const branches = report.context.nodes.filter((node) => node.condition);
  assert.ok(branches.some((node) => node.condition.outcome === 'selected' && node.state === 'COMPLETED'));
  const skipped = branches.find((node) => node.condition.outcome === 'not_selected'); assert.equal(skipped.skip_code, 'NOT_SELECTED'); assert.equal(skipped.state, 'SKIPPED');
  assert.equal(report.context.nodes.at(-1).join, 'any'); assert.ok(report.findings.some((finding) => finding.id === 'skipped-executions'));
});

test('selected conditional node execution failure never rewrites successful condition evaluation as routing error', async (t) => {
  const llm = engine(async (_, options) => {
    const { messages } = JSON.parse(options.body);
    if (/Workflow node: inspect\b/.test(messages[1].content) && !messages.some((message) => message.role === 'tool')) return call();
    if (/Workflow node: matched\b/.test(messages[1].content)) return new Response('', { status: 401 });
    return reply();
  });
  const { orchestrator, store } = await fixture(t, { llm }); const task = await run(orchestrator, createConditionalWorkflowExample());
  const report = store.review(task.id).report;
  const failed = report.context.nodes.find((node) => node.state === 'FAILED');
  assert.ok(failed); assert.equal(failed.condition.outcome, 'selected'); assert.equal(failed.failure_code, 'LLM_CALL_FAILED');
});

test('missing tool condition stops fail-closed, records routing error and no invented execution for failed/unstarted nodes', async (t) => {
  const { orchestrator, store } = await fixture(t); const task = await run(orchestrator, createConditionalWorkflowExample());
  assert.equal(task.state, 'FAILED'); const report = store.review(task.id).report; assert.equal(report.context.stop.code, 'CONDITION_UNAVAILABLE'); assert.equal(report.context.stop.phase, 'routing');
  const failed = report.context.nodes.find((node) => node.failure_code === 'CONDITION_UNAVAILABLE'); assert.equal(failed.condition.outcome, 'error'); assert.equal(failed.execution_id, null);
  assert.ok(report.context.nodes.some((node) => node.state === 'CANCELLED' && node.execution_id === null));
  assert.equal(report.executions.filter((execution) => execution.state === 'FAILED').length, 0);
});

test('unreachable final path records explicit routing stop rather than a successful empty report', async (t) => {
  const llm = engine(async (_, options) => JSON.parse(options.body).messages.some((message) => message.role === 'tool') ? reply() : call());
  const { orchestrator, store } = await fixture(t, { llm });
  const graph = { nodes: [{ id: 'source', agent: 'ARIA', dependsOn: [] }, { id: 'branch', agent: 'BYTE', dependsOn: ['source'], when: { source: 'source', tool: 'agent-registry', path: 'agents.length', operator: 'eq', value: -1, branch: 'if' } }, { id: 'final', agent: 'HERMES', dependsOn: ['branch'] }] };
  const task = await run(orchestrator, graph); assert.equal(task.state, 'FAILED');
  assert.equal(store.review(task.id).report.context.stop.code, 'FINAL_PATH_UNREACHABLE');
  assert.equal(store.review(task.id).report.context.nodes.at(-1).execution_id, null);
});

test('provider error stores categorical stop and HTTP status, never upstream error body or root cause guess', async (t) => {
  const { orchestrator, store } = await fixture(t, { llm: engine(async () => new Response('PRIVATE_UPSTREAM_BODY', { status: 401 })) });
  const task = await run(orchestrator); const report = store.review(task.id).report;
  assert.equal(report.context.stop.code, 'LLM_CALL_FAILED'); assert.equal(report.context.stop.http_status, 401);
  assert.equal(report.context.execution_failures[0].execution_id, report.executions[0].id); assert.equal(report.totals.request_errors, 1);
  assert.ok(report.findings.some((item) => item.id === 'usage-incomplete')); assert.doesNotMatch(JSON.stringify(report), /PRIVATE_UPSTREAM_BODY|invalid API key|network is down/);
});

test('conditional final report remains rejected before dispatch and does not fabricate terminal AAR', async (t) => {
  const { orchestrator, store } = await fixture(t);
  assert.throws(() => orchestrator.submitTask('[TEAM:TECH] Invalid final', { nodes: [{ id: 'source', agent: 'ARIA', dependsOn: [] }, { id: 'final', agent: 'BYTE', dependsOn: ['source'], when: { source: 'source', tool: 'agent-registry', path: 'agents.length', operator: 'eq', value: -1, branch: 'if' } }] }), /Final report node must be unconditional/);
  assert.equal(orchestrator.running.size, 0); assert.equal(store.records.length, 0);
});

test('parallel failure preserves failed execution, cancelled sibling and unstarted final report distinctly', async (t) => {
  const llm = engine(async (_, options) => {
    if (/Workflow node: broken\b/.test(JSON.parse(options.body).messages[1].content)) { await delay(20); return new Response('', { status: 401 }); }
    await delay(10000, undefined, { signal: options.signal }); return reply();
  });
  const { orchestrator, store } = await fixture(t, { llm }); const task = await run(orchestrator, { maxConcurrency: 2, nodes: [{ id: 'broken', agent: 'BYTE', dependsOn: [] }, { id: 'sibling', agent: 'NOVA', dependsOn: [] }, { id: 'final', agent: 'HERMES', dependsOn: ['broken', 'sibling'] }] });
  const report = store.review(task.id).report; assert.equal(report.executions.find((item) => item.agent === 'BYTE').state, 'FAILED'); assert.equal(report.executions.find((item) => item.agent === 'NOVA').state, 'CANCELLED');
  assert.equal(report.context.stop.node_id, 'broken'); assert.equal(report.context.nodes.at(-1).execution_id, null);
});

test('report approval records explicit decision and measured duration without approving external execution', async (t) => {
  const { orchestrator, store } = await fixture(t); const task = orchestrator.submitTask('[TEAM:TECH] Review', single('SAGE'));
  const approval = await wait(() => [...orchestrator.approvals.keys()][0]); assert.throws(() => store.review(task.id), /unavailable/);
  orchestrator.resolveHitl(approval, 'approve'); await drain(orchestrator); const report = store.review(task.id).report;
  assert.equal(report.context.reviews[0].status, 'APPROVED'); assert.ok(report.context.reviews[0].duration_ms > 0); assert.equal(report.context.reviews[0].node_id, 'work'); assert.equal(report.mission.state, 'COMPLETED');
  assert.match(report.findings[0].text, /ไม่ใช่.*external actions/);
});

test('explicit report rejection fails mission but does not retroactively fail completed Agent execution', async (t) => {
  const { orchestrator, store } = await fixture(t); const task = orchestrator.submitTask('[TEAM:TECH] Reject', single('SAGE'));
  const approval = await wait(() => [...orchestrator.approvals.keys()][0]); const duration = task.observations[0].duration_ms;
  orchestrator.resolveHitl(approval, 'reject'); await drain(orchestrator); const report = store.review(task.id).report;
  assert.equal(report.context.stop.code, 'REPORT_REJECTED'); assert.equal(report.context.reviews[0].status, 'REJECTED'); assert.equal(report.executions[0].state, 'COMPLETED'); assert.equal(report.executions[0].duration_ms, duration);
});

test('shutdown waiting for report review records CANCELLED rather than fabricated user rejection', async (t) => {
  const { orchestrator, store } = await fixture(t); const task = orchestrator.submitTask('[TEAM:TECH] Shutdown review', single('SAGE'));
  await wait(() => orchestrator.approvals.size); await orchestrator.shutdown(); const report = store.review(task.id).report;
  assert.equal(report.mission.state, 'CANCELLED'); assert.equal(report.context.reviews[0].status, 'CANCELLED'); assert.equal(report.context.stop.code, 'SERVER_SHUTDOWN');
  assert.equal(report.findings.some((item) => item.id === 'review-rejected'), false);
});

test('deadline waiting for report review records TIMED_OUT rather than approval or rejection', async (t) => {
  const llm = engine(); llm.configure({ taskTimeoutMs: 1000 }); const { orchestrator, store } = await fixture(t, { llm });
  const task = orchestrator.submitTask('[TEAM:TECH] Timeout review', single('SAGE')); await drain(orchestrator); const report = store.review(task.id).report;
  assert.equal(report.context.reviews[0].status, 'TIMED_OUT'); assert.equal(report.context.stop.code, 'DEADLINE_EXCEEDED'); assert.equal(report.executions[0].state, 'COMPLETED');
});

test('HUMAN contribution wait has no content/AI usage and remains distinct from report approval', async (t) => {
  const { orchestrator, store } = await fixture(t);
  const task = orchestrator.submitTask('[TEAM:TECH] HUMAN', { nodes: [{ id: 'person', agent: 'HUMAN', prompt: 'PRIVATE_QUESTION', dependsOn: [] }, { id: 'review', agent: 'SAGE', dependsOn: ['person'] }] });
  const input = await wait(() => orchestrator.listHumanInputs()[0]); orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: 'PRIVATE_HUMAN_CONTENT' });
  const approval = await wait(() => [...orchestrator.approvals.keys()][0]); orchestrator.resolveHitl(approval, 'approve'); await drain(orchestrator);
  const report = store.review(task.id).report; assert.equal(report.context.human_waits[0].status, 'ANSWERED'); assert.ok(report.context.human_waits[0].duration_ms > 0);
  assert.equal(report.context.reviews[0].status, 'APPROVED'); assert.equal(report.executions[0].llm_calls, 0); assert.doesNotMatch(await readFile(store.path, 'utf8'), /PRIVATE_/);
});

test('HUMAN cancellation preserves existing FAILED outcome with explicit human cancellation evidence', async (t) => {
  const { orchestrator, store } = await fixture(t); const task = orchestrator.submitTask('[TEAM:TECH] Cancel', { nodes: [{ id: 'person', agent: 'HUMAN', prompt: 'Question', dependsOn: [] }] });
  const input = await wait(() => orchestrator.listHumanInputs()[0]); orchestrator.resolveHumanInput(input.input_id, { action: 'cancel' }); await drain(orchestrator);
  const report = store.review(task.id).report; assert.equal(report.mission.state, 'FAILED'); assert.equal(report.context.stop.code, 'HUMAN_CANCELLED'); assert.equal(report.context.human_waits[0].status, 'CANCELLED');
});

test('HUMAN timeout records missing contribution and deadline separately', async (t) => {
  const llm = engine(); llm.configure({ taskTimeoutMs: 1000 }); const { orchestrator, store } = await fixture(t, { llm });
  const task = orchestrator.submitTask('[TEAM:TECH] Timeout human', { nodes: [{ id: 'person', agent: 'HUMAN', prompt: 'Question', dependsOn: [] }] }); await drain(orchestrator);
  const report = store.review(task.id).report; assert.equal(report.context.human_waits[0].status, 'TIMED_OUT'); assert.equal(report.context.stop.code, 'DEADLINE_EXCEEDED');
});

test('archive failure has sanitized phase evidence with completed executions, no fake success archive', async (t) => {
  const { orchestrator, store } = await fixture(t, { archive: true }); orchestrator.tools.archive = async () => { throw new Error('PRIVATE_ARCHIVE_ERROR'); };
  const task = await run(orchestrator); const report = store.review(task.id).report;
  assert.equal(report.context.archive, 'failed'); assert.equal(report.context.stop.code, 'ARCHIVE_FAILED'); assert.equal(report.context.stop.phase, 'archive'); assert.equal(report.executions[0].state, 'COMPLETED');
  assert.doesNotMatch(await readFile(store.path, 'utf8'), /PRIVATE_ARCHIVE_ERROR/);
});

test('planning failure before any Agent records no fabricated execution and names absent sequence', async (t) => {
  const { orchestrator, store } = await fixture(t); const task = orchestrator.submitTask('[TEAM:TECH] [COWORK:UNKNOWN]'); await drain(orchestrator);
  const report = store.review(task.id).report; assert.equal(report.executions.length, 0); assert.equal(report.context.planned_sequence, null); assert.equal(report.context.stop.code, 'PLANNING_FAILED');
});

test('fallback department review is recorded at mission scope without inventing a reviewer execution', async (t) => {
  const { orchestrator, store } = await fixture(t);
  const task = orchestrator.submitTask('[TEAM:TRADE] Review fallback', single());
  const approval = await wait(() => [...orchestrator.approvals.keys()][0]); orchestrator.resolveHitl(approval, 'approve'); await drain(orchestrator);
  const report = store.review(task.id).report; assert.equal(report.context.reviews[0].agent, 'HERMES'); assert.equal(report.context.reviews[0].node_id, null);
  assert.equal(report.executions.some((execution) => execution.agent === 'HERMES'), false); assert.equal(report.mission.state, 'COMPLETED');
});

test('shutdown waiting for HUMAN records cancelled wait and never claims a submitted contribution', async (t) => {
  const { orchestrator, store } = await fixture(t);
  const task = orchestrator.submitTask('[TEAM:TECH] HUMAN shutdown', { nodes: [{ id: 'person', agent: 'HUMAN', prompt: 'Question', dependsOn: [] }] });
  await wait(() => orchestrator.listHumanInputs()[0]); await orchestrator.shutdown();
  const report = store.review(task.id).report; assert.equal(report.context.human_waits[0].status, 'CANCELLED'); assert.equal(report.executions[0].state, 'CANCELLED'); assert.equal(report.context.stop.code, 'SERVER_SHUTDOWN');
});

test('sequential repeated agents and Swarm retain planned/evidenced identity without claiming consensus', async (t) => {
  const { orchestrator, store } = await fixture(t); const sequential = orchestrator.submitTask('[TEAM:TECH] [COWORK:BYTE,NOVA,BYTE]'); await drain(orchestrator);
  const report = store.review(sequential.id).report; assert.equal(report.context.planned_sequence.filter((agent) => agent === 'BYTE').length, 2); assert.equal(report.executions.filter((execution) => execution.agent === 'BYTE').length, 2);
  const swarm = orchestrator.submitTask('[TEAM:TECH] Swarm', undefined, { agents: ['BYTE', 'NOVA'], synthesizer: 'BYTE' }); await drain(orchestrator);
  assert.equal(store.review(swarm.id).report.mission.mode, 'swarm'); assert.match(store.review(swarm.id).report.missing[0], /consensus/);
});

test('tool errors and missing usage generate evidence-bound suggestions without executing anything', async (t) => {
  const llm = engine(async (_, options) => JSON.parse(options.body).messages.some((message) => message.role === 'tool') ? reply('PRIVATE_REPORT', false) : call('unpermitted'));
  const { orchestrator, store } = await fixture(t, { llm }); const task = await run(orchestrator);
  const before = task.toolCalls; const report = store.review(task.id).report; assert.equal(report.totals.tool_errors, 1); assert.equal(report.totals.unreported_calls, 1);
  assert.ok(report.recommendations.some((item) => item.id === 'review-tools')); assert.ok(report.recommendations.some((item) => item.id === 'check-usage'));
  for (let i = 0; i < 5; i += 1) assert.deepEqual(store.review(task.id).report, report); assert.equal(task.toolCalls, before);
});

test('AAR and analytics persistence failures are one degraded commit, preserve outcome and recover on close', async (t) => {
  const { orchestrator, store, storage } = await fixture(t); const original = storage.atomicWrite.bind(storage);
  storage.atomicWrite = async () => { throw new Error('disk failed'); }; const task = await run(orchestrator);
  assert.equal(task.state, 'COMPLETED'); assert.equal(store.review(task.id).persistence, 'degraded'); assert.equal(store.snapshot().persistence, 'degraded');
  storage.atomicWrite = original; await store.close(); const saved = JSON.parse(await readFile(store.path, 'utf8')); assert.equal(saved.records[0].after_action.nodes.length, 1);
});

test('retention, pagination, outcome filters, legacy coexistence and restart use actual retained records', async (t) => {
  const { orchestrator, store, storage } = await fixture(t, { capacity: 2 }); await store.append(legacy('old'));
  const task = await run(orchestrator); const report = store.review(task.id).report; const restarted = await new PerformanceStore(storage, { clock: () => NOW, capacity: 2 }).init();
  assert.deepEqual(restarted.review(task.id).report, report); assert.equal(restarted.review('old').report.evidence_level, 'legacy_metrics_only');
  assert.equal(restarted.reviewList({ limit: 1 }).items[0].task_id, task.id); assert.equal(restarted.reviewList({ offset: 1, limit: 1 }).items[0].task_id, 'old');
  assert.equal(restarted.reviewList({ outcome: 'FAILED' }).total, 0); assert.equal(restarted.reviewList({ offset: 999 }).items.length, 0);
  await restarted.append(legacy('new')); assert.throws(() => restarted.review('old'), /unavailable/); await restarted.close();
});

test('strict AAR schema rejects free-form text, invalid references, statuses and unbounded arrays', async (t) => {
  const { orchestrator, store } = await fixture(t); const task = await run(orchestrator); const record = store.records[0];
  const invalids = [
    (value) => { value.after_action.secret = 'forbidden'; }, (value) => { value.after_action.nodes[0].condition = { source: 'work', branch: 'if', outcome: 'selected', value: 'forbidden' }; },
    (value) => { value.after_action.stop = { code: 'invented', phase: 'mission', node_id: null, http_status: null }; },
    (value) => { value.after_action.nodes[0].execution_id = 'missing'; }, (value) => { value.after_action.nodes[0].depends_on = ['missing']; },
    (value) => { value.after_action.nodes.push(value.after_action.nodes[0]); }, (value) => { value.after_action.reviews = [{ id: 'review', agent: 'BYTE', node_id: 'missing', status: 'APPROVED', duration_ms: 0 }]; },
    (value) => { value.after_action.human_waits = [{ node_id: 'work', status: 'ANSWERED', duration_ms: 0 }]; },
    (value) => { value.after_action.execution_failures = [{ execution_id: 'missing', failure: { code: 'EXECUTION_FAILED', phase: 'execution', node_id: null, http_status: null } }]; },
    (value) => { value.after_action.nodes = Array(17).fill(value.after_action.nodes[0]); }, (value) => { value.after_action.archive = 'guaranteed'; },
  ];
  for (const invalidate of invalids) { const value = structuredClone(record); invalidate(value); assert.throws(() => validatePerformanceRecord(value)); }
  assert.equal(store.review(task.id).report.context.nodes.length, 1);
});

test('corrupt AAR startup fails without overwrite or leaked writer lock', async (t) => {
  const { orchestrator, store, storage, root } = await fixture(t); await run(orchestrator); await store.close(); await storage.close();
  const saved = JSON.parse(await readFile(store.path, 'utf8')); saved.records[0].after_action.nodes[0].raw_result = 'forbidden'; const text = JSON.stringify(saved); await writeFile(store.path, text);
  await assert.rejects(createApplication({ vaultDir: root })); assert.equal(await readFile(store.path, 'utf8'), text);
  const probe = await new StorageEngine(root).init(); await probe.close();
});

test('read-only REST AAR survives restart and telemetry rollover, strict routes reject mutation and malformed pagination', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-aar-api-')); let calls = 0;
  let app = await createApplication({ vaultDir: root, llmEngine: engine(async () => { calls += 1; return reply(); }) });
  t.after(() => app.close()); await app.listen(0); let base = `http://127.0.0.1:${app.server.address().port}`;
  const task = await run(app.orchestrator); const read = async (path) => { const response = await fetch(`${base}${path}`); return { status: response.status, body: await response.json() }; };
  const first = await read(`/api/reviews/${task.id}`); assert.equal(first.status, 200); assert.equal(first.body.report.mission.task_id, task.id);
  for (let i = 0; i < 510; i += 1) app.orchestrator.bus.publish({ event_type: 'AGENT_THINKING', source_agent: 'BYTE' });
  assert.deepEqual((await read(`/api/reviews/${task.id}`)).body, first.body); assert.equal(calls, 1);
  assert.equal((await read('/api/reviews')).body.items[0].task_id, task.id);
  for (const query of ['offset=-1', 'offset=1001', 'limit=0', 'limit=51', 'limit=2&limit=3', 'outcome=RUNNING', 'agent=BYTE', 'offset[x]=1']) assert.equal((await read(`/api/reviews?${query}`)).status, 400, query);
  assert.equal((await read(`/api/reviews/${task.id}?raw=true`)).status, 400); assert.equal((await read('/api/reviews/not-retained')).status, 404);
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await fetch(`${base}/api/reviews/${task.id}`, { method })).status, 404);
  assert.equal((await read('/api/storage/reviews')).status, 404);
  await app.close(); app = await createApplication({ vaultDir: root, llmEngine: engine() }); await app.listen(0); base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal(app.orchestrator.listTasks().length, 0); assert.deepEqual((await read(`/api/reviews/${task.id}`)).body.report, first.body.report);
});

test('shutdown drains terminal AAR write before releasing storage lock', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-aar-drain-'));
  const llm = engine(async (_, options) => { await delay(10000, undefined, { signal: options.signal }); return reply(); });
  const app = await createApplication({ vaultDir: root, llmEngine: llm }); t.after(() => app.close());
  const task = app.orchestrator.submitTask('[TEAM:TECH] Shutdown active', single()); await wait(() => task.observations[0]?.llm_calls);
  await app.close(); const saved = JSON.parse(await readFile(join(root, '.maoc/state/performance.json'), 'utf8'));
  assert.equal(saved.records[0].state, 'CANCELLED'); assert.equal(saved.records[0].after_action.stop.code, 'SERVER_SHUTDOWN');
  const probe = await new StorageEngine(root).init(); await probe.close();
});

test('known guard errors are categorical while unexpected error messages remain private', async (t) => {
  for (const [message, expected] of [['Token budget guard: exhausted', 'BUDGET_GUARD'], ['Loop breaker: repeated', 'LOOP_GUARD'], ['PRIVATE_ARBITRARY_ERROR', 'EXECUTION_FAILED']]) {
    const { orchestrator, store } = await fixture(t); orchestrator.executeAgent = async () => { throw new HttpError(409, message); };
    const task = await run(orchestrator); assert.equal(store.review(task.id).report.context.stop.code, expected); assert.doesNotMatch(await readFile(store.path, 'utf8'), /PRIVATE_ARBITRARY_ERROR/);
  }
});
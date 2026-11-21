import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { validateWorkflow, workflowLayers, workflowAncestors, createWorkflowExample } from '../../src/lib/workflowGraph.js';
import { Orchestrator } from '../src/orchestrator.js';
import { TelemetryBus } from '../src/eventBus.js';
import { LlmEngine } from '../src/llmEngine.js';
import { ToolExecutor } from '../src/toolExecutor.js';
import { StorageEngine } from '../src/storageEngine.js';
import { createApplication } from '../src/server.js';

const response = (text) => Response.json({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
const nodeName = (options) => JSON.parse(options.body).messages[1].content.match(/Workflow node: ([\w-]+)/)[1];
function engine(fetcher) {
  const llm = new LlmEngine({ settings: { providers: { openai: 'offline-test-key' } }, fetcher });
  llm.configure({ provider: 'openai', modelName: 'offline', rpm: 1000, autoFailover: false, maxTaskTokens: 500000 });
  return llm;
}
async function finish(orchestrator, workflow = createWorkflowExample(), description = '[TEAM:TECH] Test workflow') {
  const task = orchestrator.submitTask(description, workflow);
  await Promise.all([...orchestrator.running]);
  return task;
}
const node = (id, agent, dependsOn = []) => ({ id, agent, dependsOn });

test('workflow validation copies input and exposes topological layers and ancestors', () => {
  const input = createWorkflowExample();
  const graph = validateWorkflow(input);
  assert.deepEqual(workflowLayers(graph).map((layer) => layer.map((n) => n.id)), [['brief'], ['architecture', 'research'], ['report']]);
  assert.deepEqual([...workflowAncestors(graph, 'research')], ['brief']);
  input.nodes[0].agent = 'BYTE'; input.nodes[1].dependsOn.push('report');
  assert.equal(graph.nodes[0].agent, 'ARIA');
  assert.deepEqual(graph.nodes[1].dependsOn, ['brief']);
});

test('workflow rejects cycles, unsafe/duplicate IDs, unknown agents, missing edges and multiple sinks', () => {
  const invalid = [null, {}, { nodes: [] }, { nodes: [node('a', 'BYTE')], maxConcurrency: 5 },
    { nodes: [node('__proto__', 'BYTE')] }, { nodes: [node('a', 'BYTE'), node('a', 'NOVA')] },
    { nodes: [node('a', 'missing')] }, { nodes: [node('a', 'BYTE', ['missing'])] },
    { nodes: [node('a', 'BYTE', ['a'])] }, { nodes: [node('a', 'BYTE', ['b']), node('b', 'NOVA', ['a'])] },
    { nodes: [node('a', 'BYTE'), node('b', 'NOVA')] },
    { nodes: [node('a', 'BYTE', ['b', 'b']), node('b', 'NOVA')] },
    { nodes: [node('a', 'BYTE')], arbitrary: true },
    { nodes: [{ ...node('a', 'BYTE'), tools: ['secret-vault'] }] },
    { nodes: Array.from({ length: 17 }, (_, i) => node(`n${i}`, 'BYTE', i ? [`n${i - 1}`] : [])) }];
  for (const input of invalid) assert.throws(() => validateWorkflow(input));
});

test('independent branches overlap; context excludes siblings and final report joins in stable order', async (t) => {
  const prompts = new Map(); let active = 0; let peak = 0; const finished = [];
  const llm = engine(async (_, options) => {
    const id = nodeName(options);
    prompts.set(id, JSON.parse(options.body).messages[1].content);
    active += 1; peak = Math.max(peak, active);
    await delay(id === 'architecture' ? 25 : 5, undefined, { signal: options.signal });
    active -= 1; finished.push(id);
    return response(`deliverable-${id}`);
  });
  const bus = new TelemetryBus(); const events = []; bus.subscribe((event) => events.push(event));
  const orchestrator = new Orchestrator({ llmEngine: llm, bus }); t.after(() => orchestrator.shutdown());
  const task = await finish(orchestrator);
  assert.equal(task.state, 'COMPLETED'); assert.equal(peak, 2);
  assert.ok(finished.indexOf('research') < finished.indexOf('architecture'));
  assert.ok(!prompts.get('research').includes('deliverable-architecture'));
  assert.ok(!prompts.get('architecture').includes('deliverable-research'));
  assert.ok(prompts.get('architecture').includes('deliverable-brief'));
  assert.ok(prompts.get('report').includes('deliverable-research'));
  assert.ok(prompts.get('report').indexOf('deliverable-architecture') < prompts.get('report').indexOf('deliverable-research'));
  assert.deepEqual(task.outputs.map((output) => output.node_id), ['brief', 'architecture', 'research', 'report']);
  assert.equal(task.handoffs, 4); assert.equal(task.usage.total_tokens, 60);
  assert.ok(task.workflowNodes.every((n) => n.state === 'COMPLETED'));
  assert.ok(events.some((event) => event.node_id === 'research' && event.stage === 'node_started'));
  assert.equal(events.at(-1).workflow_nodes.length, 4);
  assert.deepEqual(task.snapshot.keys, {});
});

test('handoff context labels omitted and truncated deliverables without changing source output', async (t) => {
  const prompts = new Map();
  const prefix = 'LONG_SOURCE:'.padEnd(5999, 'x');
  const longReport = `${prefix}😀LONG_TAIL`;
  const exactReport = 'EXACT_SOURCE:'.padEnd(6000, 'y');
  const outputs = { source0: 'OLDEST_SOURCE', source2: exactReport, source6: longReport, side: 'UNRELATED_BRANCH' };
  const llm = engine(async (_, options) => {
    const id = nodeName(options);
    prompts.set(id, JSON.parse(options.body).messages[1].content);
    return response(outputs[id] ?? `deliverable-${id}`);
  });
  const orchestrator = new Orchestrator({ llmEngine: llm, bus: new TelemetryBus() });
  t.after(() => orchestrator.shutdown());
  const chain = Array.from({ length: 7 }, (_, i) => node(`source${i}`, 'BYTE', i ? [`source${i - 1}`] : []));
  const task = await finish(orchestrator, { nodes: [
    ...chain, node('side', 'NOVA'), node('handoff', 'NOVA', ['source6']), node('report', 'HERMES', ['handoff', 'side'])
  ] }, '[TEAM:TECH] Preserve handoff evidence');
  assert.equal(task.state, 'COMPLETED');
  assert.equal(prompts.size, 10);
  const handoff = prompts.get('handoff');
  assert.match(handoff, /Mission: \[TEAM:TECH\] Preserve handoff evidence/);
  assert.match(handoff, /Context limit: 1 earlier deliverable omitted\./);
  assert.doesNotMatch(handoff, /OLDEST_SOURCE|UNRELATED_BRANCH|LONG_TAIL|😀/);
  assert.equal(handoff.isWellFormed(), true);
  assert.deepEqual([...handoff.matchAll(/^\[(source\d)\] BYTE:/gm)].map((match) => match[1]),
    ['source1', 'source2', 'source3', 'source4', 'source5', 'source6']);
  assert.ok(handoff.includes(`[source2] BYTE: ${exactReport}\n\n[source3]`));
  assert.ok(handoff.endsWith(`[source6] BYTE: ${prefix}\n[Deliverable excerpt truncated]`));
  assert.doesNotMatch(prompts.get('source1'), /Context limit:|Deliverable excerpt truncated/);
  assert.equal(task.outputs.find(({ node_id }) => node_id === 'source6').text, longReport);
});

test('maxConcurrency one serializes branches and invalid graphs never start provider work', async (t) => {
  let active = 0; let peak = 0; let calls = 0;
  const llm = engine(async (_, options) => {
    calls += 1; active += 1; peak = Math.max(peak, active);
    await delay(2); active -= 1; return response(nodeName(options));
  });
  const orchestrator = new Orchestrator({ llmEngine: llm, bus: new TelemetryBus() }); t.after(() => orchestrator.shutdown());
  assert.throws(() => orchestrator.submitTask('test', { nodes: [node('a', 'BYTE', ['a'])] }), /dependency/);
  assert.equal(calls, 0); assert.equal(orchestrator.tasks.size, 0);
  const graph = createWorkflowExample(); graph.maxConcurrency = 1;
  assert.equal((await finish(orchestrator, graph)).state, 'COMPLETED'); assert.equal(peak, 1);
});

test('parallel failure aborts and drains siblings before terminal event; descendants never run or archive', async (t) => {
  let siblingStopped = false; const called = []; let archived = false;
  const llm = engine(async (_, options) => {
    const id = nodeName(options); called.push(id);
    if (id === 'architecture') { await delay(10); return new Response('', { status: 400 }); }
    if (id === 'research') {
      try { await delay(1000, undefined, { signal: options.signal }); }
      finally { siblingStopped = true; }
    }
    return response(id);
  });
  const tools = new ToolExecutor(); tools.archive = async () => { archived = true; };
  const bus = new TelemetryBus(); let drainedAtTerminal = false;
  bus.subscribe((event) => { if (event.event_type === 'TASK_COMPLETED') drainedAtTerminal = siblingStopped; });
  const orchestrator = new Orchestrator({ llmEngine: llm, toolExecutor: tools, bus }); t.after(() => orchestrator.shutdown());
  const task = await finish(orchestrator);
  assert.equal(task.state, 'FAILED'); assert.ok(drainedAtTerminal); assert.ok(!called.includes('report')); assert.ok(!archived);
  assert.equal(orchestrator.running.size, 0);
  assert.ok(!task.outputs.some((output) => output.node_id === 'research'));
  assert.equal(task.workflowNodes.find((n) => n.id === 'architecture').state, 'FAILED');
  assert.equal(task.workflowNodes.find((n) => n.id === 'report').state, 'CANCELLED');
});

test('parallel token reservations prevent overspending before requests yield', async (t) => {
  let calls = 0; let completions = 0;
  const llm = engine(async (_, options) => { calls += 1; await delay(5); return response(nodeName(options)); });
  const complete = llm.complete.bind(llm);
  llm.complete = (request) => { completions += 1; return complete(request); };
  const orchestrator = new Orchestrator({ llmEngine: llm, bus: new TelemetryBus() }); t.after(() => orchestrator.shutdown());
  const graph = { maxConcurrency: 2, nodes: [node('a', 'BYTE'), node('b', 'BYTE'), node('report', 'HERMES', ['a', 'b'])] };
  llm.configure({ maxTaskTokens: 3000, maxOutputTokens: 1600 });
  const task = await finish(orchestrator, graph);
  assert.equal(task.state, 'FAILED'); assert.equal(completions, 1); assert.ok(calls <= 1);
  assert.ok(task.accountedTokens > 0 && task.accountedTokens <= 3000);
});

test('HITL blocks downstream nodes until review and rejection prevents final report', async (t) => {
  for (const decision of ['approve', 'reject']) {
    const called = []; const llm = engine(async (_, options) => { const id = nodeName(options); called.push(id); return response(id); });
    const bus = new TelemetryBus(); const orchestrator = new Orchestrator({ llmEngine: llm, bus }); t.after(() => orchestrator.shutdown());
    let interrupt;
    const waiting = new Promise((resolve) => { bus.subscribe((event) => { if (event.event_type === 'HITL_INTERRUPT') { interrupt = event; resolve(); } }); });
    const graph = { nodes: [node('risk', 'SAGE'), node('report', 'HERMES', ['risk'])] };
    const task = orchestrator.submitTask('[TEAM:TRADE] Review only', graph);
    await waiting;
    assert.equal(task.state, 'AWAITING_HITL'); assert.deepEqual(called, ['risk']);
    assert.equal(orchestrator.resolveHitl(interrupt.approval_id, decision), true);
    await Promise.all([...orchestrator.running]);
    assert.equal(task.state, decision === 'approve' ? 'COMPLETED' : 'FAILED');
    assert.equal(called.includes('report'), decision === 'approve'); assert.equal(orchestrator.approvals.size, 0);
  }
});

test('workflow respects edge/handoff limits before submission', async (t) => {
  const llm = engine(() => { throw new Error('must not request'); }); llm.configure({ maxHandoffs: 1 });
  const orchestrator = new Orchestrator({ llmEngine: llm, bus: new TelemetryBus() }); t.after(() => orchestrator.shutdown());
  assert.throws(() => orchestrator.submitTask('test', createWorkflowExample()), /maximum handoffs/);
  assert.equal(orchestrator.tasks.size, 0);
});

test('deadline aborts parallel provider work and cancels descendants', async (t) => {
  let aborted = 0;
  const llm = engine(async (_, options) => {
    try { await delay(10000, undefined, { signal: options.signal }); }
    finally { aborted += 1; }
    return response('too late');
  });
  llm.configure({ taskTimeoutMs: 1000 });
  const bus = new TelemetryBus();
  const orchestrator = new Orchestrator({ llmEngine: llm, bus }); t.after(() => orchestrator.shutdown());
  const graph = { nodes: [node('a', 'BYTE'), node('b', 'NOVA'), node('final', 'HERMES', ['a', 'b'])] };
  const task = await finish(orchestrator, graph);
  assert.equal(task.state, 'FAILED'); assert.equal(aborted, 2); assert.equal(task.outputs.length, 0);
  assert.equal(task.workflowNodes.at(-1).state, 'CANCELLED');
  assert.match(bus.snapshot().at(-1).payload_summary, /deadline/i);
});

test('shutdown drains parallel work, clears keys and approvals without success artifacts', async () => {
  let entered; const started = new Promise((resolve) => { entered = resolve; });
  const llm = engine(async (_, options) => { entered(); await delay(10000, undefined, { signal: options.signal }); return response('late'); });
  const orchestrator = new Orchestrator({ llmEngine: llm, bus: new TelemetryBus() });
  const task = orchestrator.submitTask('[TEAM:TECH] Shutdown', createWorkflowExample());
  await started; await orchestrator.shutdown();
  assert.equal(task.state, 'CANCELLED'); assert.equal(orchestrator.running.size, 0); assert.equal(orchestrator.approvals.size, 0);
  assert.deepEqual(task.snapshot.keys, {}); assert.equal(task.outputs.length, 0);
});

test('workflow nodes still use scoped real tool/result loops', async (t) => {
  let turn = 0;
  const llm = engine(async (_, options) => {
    turn += 1;
    const messages = JSON.parse(options.body).messages;
    if (turn === 1) return Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: 'registry', type: 'function', function: { name: 'agent-registry', arguments: '{}' } }] } }] });
    assert.equal(messages.at(-1).role, 'tool'); assert.equal(JSON.parse(messages.at(-1).content).agents.length, 27);
    return response('Verified registry report');
  });
  const orchestrator = new Orchestrator({ llmEngine: llm, bus: new TelemetryBus() }); t.after(() => orchestrator.shutdown());
  const task = await finish(orchestrator, { nodes: [node('report', 'ARIA')] });
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.toolCalls, 1); assert.equal(turn, 2);
});

test('workflow archives ordered backend Markdown without a browser', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-workflow-'));
  const storage = await new StorageEngine(root).init();
  const llm = engine(async (_, options) => response(`artifact-${nodeName(options)}`));
  const orchestrator = new Orchestrator({ llmEngine: llm, toolExecutor: new ToolExecutor({ storage }), storage, bus: new TelemetryBus() });
  t.after(async () => { await orchestrator.shutdown(); await storage.close(); });
  const task = await finish(orchestrator);
  assert.equal(task.state, 'COMPLETED');
  const files = await readdir(join(root, 'deliverables', 'tech'));
  const markdown = await readFile(join(root, 'deliverables', 'tech', files[0]), 'utf8');
  assert.match(markdown, /artifact-report/); assert.ok(markdown.indexOf('artifact-architecture') < markdown.indexOf('artifact-research'));
});

test('REST and WebSocket accept validated workflows and expose node snapshots', async (t) => {
  const llm = engine(async (_, options) => response(nodeName(options)));
  const app = await createApplication({ port: 0, vaultDir: await mkdtemp(join(tmpdir(), 'maoc-workflow-api-')), llmEngine: llm });
  await app.listen(0); t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (body) => fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ description: 'test', workflow: { nodes: [] } })).status, 400);
  const result = await post({ description: '[TEAM:TECH] API test', workflow: createWorkflowExample() });
  assert.equal(result.status, 201); await Promise.all([...app.orchestrator.running]);
  const listed = await (await fetch(`${base}/api/tasks`)).json();
  assert.equal(listed.tasks[0].workflow_nodes.length, 4);
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws'); t.after(() => ws.close());
  const snapshot = once(ws, 'message'); await once(ws, 'open');
  assert.equal(JSON.parse((await snapshot)[0]).tasks[0].workflow_nodes.length, 4);
  const error = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'SUBMIT_TASK', description: 'test', workflow: { nodes: [] } }));
  assert.equal(JSON.parse((await error)[0]).type, 'ERROR');
  const event = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'SUBMIT_TASK', description: '[TEAM:TECH] WS test', workflow: createWorkflowExample() }));
  assert.equal(JSON.parse((await event)[0]).type, 'EVENT');
  await Promise.all([...app.orchestrator.running]);
  ws.close(); await once(ws, 'close');
});
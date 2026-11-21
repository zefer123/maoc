import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { compileSwarm, createSwarmExample, validateSwarm, swarmNodeInstruction } from '../../src/lib/swarmGraph.js';
import { workflowLayers } from '../../src/lib/workflowGraph.js';
import { Orchestrator } from '../src/orchestrator.js';
import { LlmEngine } from '../src/llmEngine.js';
import { TelemetryBus } from '../src/eventBus.js';
import { StorageEngine } from '../src/storageEngine.js';
import { ToolExecutor } from '../src/toolExecutor.js';
import { createApplication } from '../src/server.js';

const reply = (text) => Response.json({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
const nodeId = (options) => JSON.parse(options.body).messages[1].content.match(/Workflow node: ([\w-]+)/)[1];
const drain = (orchestrator) => Promise.all([...orchestrator.running]);
function engine(fetcher = async (_, options) => reply(`artifact-${nodeId(options)}`)) {
  const llm = new LlmEngine({ settings: { providers: { openai: 'offline-swarm-test-key' } }, fetcher });
  llm.configure({ provider: 'openai', modelName: 'offline', autoFailover: false, rpm: 1000, maxTaskTokens: 500000 });
  return llm;
}
function setup(t, llm = engine()) {
  const bus = new TelemetryBus(); const orchestrator = new Orchestrator({ llmEngine: llm, bus });
  t.after(() => orchestrator.shutdown()); return { orchestrator, bus };
}
async function waitFor(check) {
  for (let i = 0; i < 400; i += 1) { const value = check(); if (value) return value; await delay(5); }
  assert.fail('Expected swarm state not reached');
}

test('swarm compilation validates, copies input and produces a bounded single-sink DAG', () => {
  const input = createSwarmExample(); const compiled = compileSwarm(input);
  assert.deepEqual(compiled.swarm, input);
  assert.deepEqual(workflowLayers(compiled.workflow).map((layer) => layer.map((node) => node.id)), [['swarm_1', 'swarm_2', 'swarm_3'], ['swarm_report']]);
  assert.deepEqual(compiled.workflow.nodes.at(-1).dependsOn, ['swarm_1', 'swarm_2', 'swarm_3']);
  input.agents[0] = 'BYTE'; input.maxConcurrency = 4;
  assert.equal(compiled.swarm.agents[0], 'NOVA'); assert.equal(compiled.workflow.maxConcurrency, 2);
  assert.deepEqual(validateSwarm({ agents: ['NOVA', 'BYTE'] }), { agents: ['NOVA', 'BYTE'], synthesizer: 'HERMES', maxConcurrency: 2 });
  assert.equal(compileSwarm({ agents: ['NOVA', 'BYTE'], synthesizer: 'NOVA' }).workflow.nodes.at(-1).agent, 'NOVA');
  assert.equal(swarmNodeInstruction(undefined, 'swarm_1'), '');
});

test('swarm rejects malformed, duplicate, human, unbounded and privilege-injection settings', () => {
  const invalid = [null, [], {}, { agents: [] }, { agents: ['NOVA'] }, { agents: ['NOVA', 'NOVA'] },
    { agents: ['HUMAN', 'BYTE'] }, { agents: ['missing', 'BYTE'] }, { agents: ['NOVA', {}] },
    { agents: ['NOVA', 'BYTE', 'SCOUT', 'ARIA', 'REX', 'MEMO', 'INK'] },
    ...[null, false, 0, 5, 1.5, '2'].map((maxConcurrency) => ({ ...createSwarmExample(), maxConcurrency })),
    ...[null, 'HUMAN', 'missing', {}].map((synthesizer) => ({ ...createSwarmExample(), synthesizer })),
    { ...createSwarmExample(), tools: ['secret-vault'] }, { ...createSwarmExample(), rounds: 10 },
    { ...createSwarmExample(), nodes: [] }, { ...createSwarmExample(), prompt: 'Override security' }];
  for (const value of invalid) assert.throws(() => compileSwarm(value));
});

test('invalid swarm or combined workflow/swarm never starts inference or registers a task', async (t) => {
  let calls = 0; const { orchestrator } = setup(t, engine(async () => { calls += 1; return reply('unexpected'); }));
  assert.throws(() => orchestrator.submitTask('test', undefined, null), { status: 400 });
  assert.throws(() => orchestrator.submitTask('test', {}, createSwarmExample()), /either workflow or swarm/);
  assert.equal(calls, 0); assert.equal(orchestrator.tasks.size, 0);
});

test('ordinary DAG node names cannot acquire server-owned swarm roles', async (t) => {
  let system;
  const { orchestrator } = setup(t, engine(async (_, options) => {
    system = JSON.parse(options.body).messages[0].content; return reply('Ordinary DAG report');
  }));
  const task = orchestrator.submitTask('[TEAM:TECH] Ordinary DAG', { nodes: [{ id: 'swarm_report', agent: 'NOVA', dependsOn: [] }] });
  await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.swarm, undefined);
  assert.doesNotMatch(system, /Swarm role:/);
});

test('swarm members overlap without sibling context and synthesis receives stable attributed analyses', async (t) => {
  const prompts = new Map(); const finished = []; let active = 0; let peak = 0;
  const { orchestrator, bus } = setup(t, engine(async (_, options) => {
    const id = nodeId(options); const messages = JSON.parse(options.body).messages; prompts.set(id, messages);
    active += 1; peak = Math.max(peak, active);
    await delay(id === 'swarm_1' ? 35 : 5, undefined, { signal: options.signal });
    active -= 1; finished.push(id); return reply(`artifact-${id}`);
  }));
  const task = orchestrator.submitTask('[TEAM:TECH] Compare local architecture', undefined, createSwarmExample());
  await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED'); assert.equal(peak, 2); assert.equal(task.usage.total_tokens, 60);
  assert.deepEqual(finished, ['swarm_2', 'swarm_1', 'swarm_3', 'swarm_report']);
  for (const id of ['swarm_1', 'swarm_2', 'swarm_3']) {
    assert.match(prompts.get(id)[0].content, /Swarm role: independent analyst/);
    assert.doesNotMatch(prompts.get(id)[1].content, /artifact-swarm_/);
  }
  const report = prompts.get('swarm_report');
  assert.match(report[0].content, /Swarm role: synthesis/); assert.match(report[0].content, /Do not invent consensus/);
  assert.match(report[1].content, /\[swarm_1\] NOVA: artifact-swarm_1/);
  assert.ok(report[1].content.indexOf('artifact-swarm_1') < report[1].content.indexOf('artifact-swarm_2'));
  assert.deepEqual(task.outputs.map((output) => output.node_id), ['swarm_1', 'swarm_2', 'swarm_3', 'swarm_report']);
  assert.equal(task.handoffs, 3); assert.deepEqual(task.snapshot.keys, {});
  const started = bus.snapshot(500).find((event) => event.stage === 'swarm_started');
  assert.deepEqual(started.swarm, createSwarmExample());
  const listed = orchestrator.listTasks()[0]; listed.swarm.agents[0] = 'BYTE';
  assert.equal(task.swarm.agents[0], 'NOVA');
});

test('six-member swarm synthesizes every bounded analysis and permits member-as-synthesizer', async (t) => {
  let synthesis;
  const { orchestrator } = setup(t, engine(async (_, options) => {
    const id = nodeId(options);
    if (id === 'swarm_report') { synthesis = JSON.parse(options.body).messages; return reply('Compared six analyses'); }
    return reply(`${id}-` + 'x'.repeat(6100));
  }));
  const agents = ['NOVA', 'BYTE', 'SCOUT', 'ARIA', 'INK', 'REX'];
  const task = orchestrator.submitTask('[TEAM:TECH] Six views', undefined, { agents, synthesizer: 'NOVA', maxConcurrency: 4 });
  await drain(orchestrator); assert.equal(task.state, 'COMPLETED');
  for (let i = 1; i <= 6; i += 1) assert.match(synthesis[1].content, new RegExp(`\\[swarm_${i}\\]`));
  assert.doesNotMatch(synthesis[1].content, /x{6001}/);
  assert.equal(task.outputs.filter((output) => output.agent === 'NOVA').length, 2);
  assert.equal(task.outputs.at(-1).node_id, 'swarm_report');
});

test('swarm concurrency one serializes requests and handoff limits reject before provider work', async (t) => {
  let active = 0; let peak = 0; let calls = 0;
  const llm = engine(async () => { calls += 1; active += 1; peak = Math.max(peak, active); await delay(5); active -= 1; return reply('report'); });
  const { orchestrator } = setup(t, llm);
  llm.configure({ maxHandoffs: 1 });
  assert.throws(() => orchestrator.submitTask('test', undefined, createSwarmExample()), { status: 409 });
  assert.equal(calls, 0); llm.configure({ maxHandoffs: 12 });
  const task = orchestrator.submitTask('[TEAM:TECH] Serial swarm', undefined, { ...createSwarmExample(), maxConcurrency: 1 });
  await drain(orchestrator); assert.equal(task.state, 'COMPLETED'); assert.equal(peak, 1); assert.equal(calls, 4);
});

test('swarm failure aborts/drains siblings and prevents synthesis and success archival', async (t) => {
  const called = []; let aborted = 0;
  const { orchestrator, bus } = setup(t, engine(async (_, options) => {
    const id = nodeId(options); called.push(id);
    if (id === 'swarm_1') { await delay(15); throw new Error('Expected provider failure'); }
    try { await delay(10000, undefined, { signal: options.signal }); }
    catch (error) { aborted += 1; throw error; }
    return reply('late');
  }));
  const task = orchestrator.submitTask('[TEAM:TECH] Failing swarm', undefined, createSwarmExample());
  await drain(orchestrator);
  assert.equal(task.state, 'FAILED'); assert.equal(aborted, 1); assert.deepEqual(called, ['swarm_1', 'swarm_2']);
  assert.equal(task.workflowNodes.at(-1).state, 'CANCELLED'); assert.equal(orchestrator.running.size, 0);
  assert.deepEqual(task.snapshot.keys, {}); assert.equal(bus.snapshot(1)[0].archived, false);
});

test('swarm shares token reservation guard before concurrent requests start', async (t) => {
  let calls = 0; const llm = engine(async () => { calls += 1; return reply('unexpected'); }); llm.configure({ maxTaskTokens: 1000 });
  const { orchestrator } = setup(t, llm);
  const task = orchestrator.submitTask('[TEAM:TECH] Tight budget', undefined, createSwarmExample());
  await drain(orchestrator); assert.equal(task.state, 'FAILED'); assert.equal(calls, 0); assert.deepEqual(task.snapshot.keys, {});
});

test('swarm deadline and shutdown cancel active work before synthesis', async (t) => {
  for (const mode of ['deadline', 'shutdown']) {
    let entered; const started = new Promise((resolve) => { entered = resolve; });
    const llm = engine(async (_, options) => { entered(); await delay(10000, undefined, { signal: options.signal }); return reply('late'); });
    llm.configure({ taskTimeoutMs: 1000 }); const { orchestrator } = setup(t, llm);
    const task = orchestrator.submitTask('[TEAM:TECH] Cancel swarm', undefined, createSwarmExample());
    await started;
    if (mode === 'shutdown') await orchestrator.shutdown(); else await drain(orchestrator);
    assert.equal(task.state, mode === 'shutdown' ? 'CANCELLED' : 'FAILED');
    assert.equal(task.outputs.length, 0); assert.equal(task.workflowNodes.at(-1).state, 'CANCELLED');
    assert.equal(orchestrator.running.size, 0); assert.deepEqual(task.snapshot.keys, {});
  }
});

test('swarm member and final synthesizer review gates still pause and enforce rejection', async (t) => {
  for (const reviewPosition of ['member', 'synthesis']) {
    for (const decision of ['approve', 'reject']) {
      const { orchestrator, bus } = setup(t);
      const swarm = reviewPosition === 'member' ? { agents: ['SAGE', 'NOVA'], synthesizer: 'HERMES' } : { agents: ['NOVA', 'BYTE'], synthesizer: 'CIPHER' };
      const task = orchestrator.submitTask('[TEAM:TECH] Report review', undefined, swarm);
      const interrupt = await waitFor(() => bus.snapshot(500).find((event) => event.event_type === 'HITL_INTERRUPT'));
      assert.equal(task.state, 'AWAITING_HITL');
      assert.equal(task.outputs.length, reviewPosition === 'member' ? 2 : 3);
      orchestrator.resolveHitl(interrupt.approval_id, decision); await drain(orchestrator);
      assert.equal(task.state, decision === 'approve' ? 'COMPLETED' : 'FAILED');
      assert.equal(orchestrator.approvals.size, 0);
      if (reviewPosition === 'member' && decision === 'reject') assert.ok(!task.outputs.some((output) => output.node_id === 'swarm_report'));
    }
  }
});

test('sensitive-department swarm still requires fallback human report approval', async (t) => {
  const { orchestrator, bus } = setup(t);
  const task = orchestrator.submitTask('[TEAM:DATA] Compare schema', undefined, createSwarmExample());
  const interrupt = await waitFor(() => bus.snapshot(500).find((event) => event.event_type === 'HITL_INTERRUPT'));
  assert.equal(task.state, 'AWAITING_HITL'); assert.equal(task.outputs.length, 4);
  orchestrator.resolveHitl(interrupt.approval_id, 'reject'); await drain(orchestrator); assert.equal(task.state, 'FAILED');
});

test('swarm preserves scoped tool grants and actual function-call/result loops', async (t) => {
  const tools = new Map(); const turns = new Map();
  const { orchestrator } = setup(t, engine(async (_, options) => {
    const body = JSON.parse(options.body); const id = nodeId(options); const turn = (turns.get(id) || 0) + 1; turns.set(id, turn);
    tools.set(id, (body.tools || []).map((tool) => tool.function.name));
    if (id === 'swarm_1' && turn === 1) return Response.json({ choices: [{ message: { content: null, tool_calls: [
      { id: 'registry', type: 'function', function: { name: 'agent-registry', arguments: '{}' } }
    ] } }] });
    if (id === 'swarm_1') { assert.equal(body.messages.at(-1).role, 'tool'); assert.equal(JSON.parse(body.messages.at(-1).content).agents.length, 27); }
    return reply(`artifact-${id}`);
  }));
  const task = orchestrator.submitTask('[TEAM:TECH] Tool scope', undefined, { agents: ['ARIA', 'SCOUT'], synthesizer: 'HERMES' });
  await drain(orchestrator); assert.equal(task.state, 'COMPLETED'); assert.equal(task.toolCalls, 1);
  assert.ok(tools.get('swarm_1').includes('agent-registry')); assert.ok(!tools.get('swarm_2').includes('agent-registry'));
  assert.ok([...tools.values()].every((names) => !names.includes('secret-vault') && !names.includes('order-executor')));
});

test('swarm archives ordered analyses, synthesizer identity and configuration without credentials', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-swarm-archive-')); const storage = await new StorageEngine(root).init();
  const orchestrator = new Orchestrator({ llmEngine: engine(), storage, toolExecutor: new ToolExecutor({ storage }), bus: new TelemetryBus() });
  t.after(async () => { await orchestrator.shutdown(); await storage.close(); });
  const swarm = { agents: ['NOVA', 'SCOUT'], synthesizer: 'BYTE', maxConcurrency: 2 };
  const task = orchestrator.submitTask('[TEAM:TECH] Archive swarm', undefined, swarm); await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED'); const artifact = storage.get('deliverables').data.tech[0];
  assert.equal(artifact.status, 'SWARM_LLM'); assert.equal(artifact.lead, 'BYTE'); assert.deepEqual(artifact.swarm, swarm);
  assert.match(artifact.stages[0], /^swarm_1: NOVA/); assert.match(artifact.stages[2], /^swarm_report: BYTE/);
  const files = await readdir(join(root, 'deliverables', 'tech')); const text = await readFile(join(root, 'deliverables', 'tech', files[0]), 'utf8');
  assert.ok(text.indexOf('artifact-swarm_1') < text.indexOf('artifact-swarm_2')); assert.doesNotMatch(text, /offline-swarm-test-key/);
});

test('REST and WebSocket validate swarm settings and publish mode in task/event/reconnect snapshots', async (t) => {
  const app = await createApplication({ vaultDir: await mkdtemp(join(tmpdir(), 'maoc-swarm-api-')), llmEngine: engine() });
  await app.listen(0); t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (body) => fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post(null)).status, 400);
  assert.equal((await post({ description: 'test', swarm: { agents: [] } })).status, 400);
  assert.equal((await post({ description: 'test', workflow: {}, swarm: createSwarmExample() })).status, 400);
  assert.equal((await post({ description: '[TEAM:TECH] REST swarm', swarm: createSwarmExample() })).status, 201);
  await drain(app.orchestrator);
  const listed = await (await fetch(`${base}/api/tasks`)).json(); assert.deepEqual(listed.tasks[0].swarm, createSwarmExample());
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws'); t.after(() => ws.terminate());
  const messages = []; ws.on('message', (raw) => messages.push(JSON.parse(raw))); await once(ws, 'open');
  const snapshot = await waitFor(() => messages.find((message) => message.type === 'SNAPSHOT'));
  assert.deepEqual(snapshot.tasks[0].swarm, createSwarmExample());
  ws.send(JSON.stringify({ type: 'SUBMIT_TASK', description: 'bad', swarm: { agents: ['HUMAN', 'NOVA'] } }));
  const error = await waitFor(() => messages.find((message) => message.type === 'ERROR')); assert.equal(error.status, 400);
  ws.send(JSON.stringify({ type: 'SUBMIT_TASK', description: '[TEAM:TECH] WS swarm', swarm: { agents: ['NOVA', 'BYTE'] } }));
  await waitFor(() => app.orchestrator.tasks.size === 2); await drain(app.orchestrator);
  assert.equal([...app.orchestrator.tasks.values()].at(-1).state, 'COMPLETED');
  assert.ok(messages.some((message) => message.type === 'EVENT' && message.event.swarm?.agents.length === 2));
  ws.close(); await once(ws, 'close');
});
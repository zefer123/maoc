import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { Orchestrator } from '../src/orchestrator.js';
import { TelemetryBus } from '../src/eventBus.js';
import { LlmEngine } from '../src/llmEngine.js';
import { createApplication } from '../src/server.js';
import { ToolExecutor } from '../src/toolExecutor.js';
import { StorageEngine } from '../src/storageEngine.js';
import { validateHumanResponse } from '../src/validation.js';
import { validateWorkflow, createHumanWorkflowExample } from '../../src/lib/workflowGraph.js';
import { reduceHumanInputs, sendHumanResponse } from '../../src/lib/humanInputs.js';

const human = (id, dependsOn = []) => ({ id, agent: 'HUMAN', dependsOn, prompt: `Question for ${id}?` });
const agent = (id, dependsOn = [], name = 'HERMES') => ({ id, agent: name, dependsOn });
const reply = (text) => Response.json({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
function engine(fetcher = async () => reply('Offline report')) {
  const llm = new LlmEngine({ settings: { providers: { openai: 'offline-test-key' } }, fetcher });
  llm.configure({ provider: 'openai', modelName: 'offline', autoFailover: false, rpm: 1000, maxTaskTokens: 500000 });
  return llm;
}
async function waitFor(check) {
  for (let i = 0; i < 400; i += 1) { const result = check(); if (result) return result; await delay(5); }
  assert.fail('Expected state was not reached');
}
function setup(t, llm = engine()) {
  const bus = new TelemetryBus(); const orchestrator = new Orchestrator({ llmEngine: llm, bus });
  t.after(() => orchestrator.shutdown());
  return { bus, orchestrator };
}
const drain = (orchestrator) => Promise.all([...orchestrator.running]);

test('human workflow validation requires a bounded question and preserves agent contracts', () => {
  const source = createHumanWorkflowExample();
  assert.deepEqual(validateWorkflow(source), source);
  for (const prompt of [undefined, '', ' ', 1, 'x'.repeat(2001)]) assert.throws(() => validateWorkflow({ nodes: [{ ...human('h'), prompt }] }));
  assert.throws(() => validateWorkflow({ nodes: [{ ...agent('a'), prompt: 'Not allowed' }] }));
  const validated = validateWorkflow({ nodes: [{ ...human('h'), prompt: ' Question? ' }] });
  assert.equal(validated.nodes[0].prompt, 'Question?');
});

test('human response validation rejects invalid, empty, oversized and extra fields', () => {
  for (const input of [null, [], {}, { action: 'approve' }, { action: 'submit', text: ' ' }, { action: 'submit', text: 3 },
    { action: 'submit', text: 'x'.repeat(12001) }, { action: 'cancel', text: 'ignored' }, { action: 'submit', text: 'valid', tools: [] }]) {
    assert.throws(() => validateHumanResponse(input), { status: 400 });
  }
  assert.deepEqual(validateHumanResponse({ action: 'submit', text: ' ข้อกำหนด ' }), { action: 'submit', text: 'ข้อกำหนด' });
  assert.deepEqual(validateHumanResponse({ action: 'cancel' }), { action: 'cancel' });
});

test('human-only workflow works without any provider credential or inference', async (t) => {
  let calls = 0;
  const llm = new LlmEngine({ settings: { providers: {} }, fetcher: async () => { calls += 1; throw new Error('Must not call provider'); } });
  const { orchestrator } = setup(t, llm);
  const task = orchestrator.submitTask('[TEAM:TECH] Human only', { nodes: [human('h')] });
  orchestrator.resolveHumanInput(orchestrator.listHumanInputs()[0].input_id, { action: 'submit', text: 'Human artifact' });
  await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED'); assert.equal(calls, 0);
  assert.equal(task.accountedTokens, 0); assert.equal(task.usage.total_tokens, 0);
});

test('human context excludes parallel siblings and truncates ancestor deliverables', async (t) => {
  const { orchestrator } = setup(t, engine(async (_, options) => {
    const prompt = JSON.parse(options.body).messages[1].content;
    return reply(prompt.includes('Workflow node: brief') ? 'b'.repeat(6500) : 'Private sibling deliverable');
  }));
  const task = orchestrator.submitTask('[TEAM:TECH] Scoped context', { maxConcurrency: 2, nodes: [
    agent('brief'), human('h', ['brief']), agent('sibling', ['brief']), agent('report', ['h', 'sibling'])
  ] });
  const input = await waitFor(() => orchestrator.listHumanInputs()[0]);
  await waitFor(() => task.outputs.some((output) => output.node_id === 'sibling'));
  assert.deepEqual(input.context.map((item) => item.node_id), ['brief']);
  assert.equal(input.context[0].text.length, 6000);
  orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: 'Scoped answer' });
  await drain(orchestrator); assert.equal(task.state, 'COMPLETED');
});

test('human node blocks downstream, receives only ancestors, consumes no provider tokens and passes an artifact', async (t) => {
  const prompts = [];
  const { orchestrator, bus } = setup(t, engine(async (_, options) => {
    const prompt = JSON.parse(options.body).messages[1].content; prompts.push(prompt);
    return reply(prompt.includes('Workflow node: brief') ? 'Ancestor brief' : 'Final report');
  }));
  const task = orchestrator.submitTask('[TEAM:TECH] Human collaboration', createHumanWorkflowExample());
  const input = await waitFor(() => orchestrator.listHumanInputs()[0]);
  assert.equal(task.state, 'AWAITING_HITL'); assert.equal(prompts.length, 1);
  assert.equal(task.workflowNodes[1].state, 'WAITING_HUMAN');
  assert.deepEqual(input.context.map((item) => item.node_id), ['brief']);
  assert.equal(input.context[0].text, 'Ancestor brief');
  input.context[0].text = 'Cannot mutate server';
  assert.equal(orchestrator.listHumanInputs()[0].context[0].text, 'Ancestor brief');
  assert.equal(orchestrator.resolveHitl(input.input_id, 'approve'), false);
  assert.throws(() => orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: '' }));
  assert.equal(orchestrator.listHumanInputs().length, 1);
  assert.equal(orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: 'Use a local-only deployment.' }), true);
  assert.equal(orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: 'duplicate' }), false);
  await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.usage.total_tokens, 30);
  assert.match(prompts[1], /HUMAN: Use a local-only deployment\./);
  assert.deepEqual(task.outputs.map((item) => item.agent), ['ARIA', 'HUMAN', 'HERMES']);
  assert.equal(task.outputs[1].provider, 'human'); assert.deepEqual(task.snapshot.keys, {});
  assert.equal(orchestrator.humanInputs.size, 0);
  assert.equal(bus.snapshot(500).filter((event) => event.event_type === 'HUMAN_INPUT_RESOLVED').length, 1);
});

test('concurrent human requests stay independent and task waits until both contributions arrive', async (t) => {
  const { orchestrator } = setup(t);
  const task = orchestrator.submitTask('[TEAM:TECH] Parallel people', { nodes: [human('left'), human('right'), agent('report', ['left', 'right'])] });
  const inputs = await waitFor(() => { const values = orchestrator.listHumanInputs(); return values.length === 2 && values; });
  assert.ok(inputs.every((input) => input.context.length === 0));
  orchestrator.resolveHumanInput(inputs[1].input_id, { action: 'submit', text: 'right response' });
  await waitFor(() => task.outputs.length === 1);
  assert.equal(task.state, 'AWAITING_HITL'); assert.equal(orchestrator.listHumanInputs().length, 1);
  orchestrator.resolveHumanInput(inputs[0].input_id, { action: 'submit', text: 'left response' });
  await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED');
  assert.deepEqual(task.outputs.map((item) => item.node_id), ['left', 'right', 'report']);
});

test('human cancellation drains sibling waiters, never invokes descendants or archives', async (t) => {
  let calls = 0;
  const { orchestrator, bus } = setup(t, engine(async () => { calls += 1; return reply('Must not run'); }));
  const task = orchestrator.submitTask('[TEAM:TECH] Cancel collaboration', { nodes: [human('left'), human('right'), agent('report', ['left', 'right'])] });
  const inputs = orchestrator.listHumanInputs(); assert.equal(inputs.length, 2);
  orchestrator.resolveHumanInput(inputs[0].input_id, { action: 'cancel' });
  await drain(orchestrator);
  assert.equal(task.state, 'FAILED'); assert.equal(calls, 0); assert.equal(task.outputs.length, 0);
  assert.equal(task.workflowNodes.at(-1).state, 'CANCELLED'); assert.equal(orchestrator.humanInputs.size, 0);
  assert.equal(orchestrator.resolveHumanInput(inputs[1].input_id, { action: 'submit', text: 'too late' }), false);
  assert.equal(bus.snapshot(500).filter((event) => event.event_type === 'HUMAN_INPUT_RESOLVED').length, 2);
  assert.equal(bus.snapshot(1)[0].archived, false);
});

test('parallel provider failure cancels human waiter and clears pending requests', async (t) => {
  const { orchestrator } = setup(t, engine(async () => { throw new Error('Deterministic provider failure'); }));
  const task = orchestrator.submitTask('[TEAM:TECH] Failed branch', { nodes: [human('human'), agent('branch'), agent('report', ['human', 'branch'])] });
  await drain(orchestrator);
  assert.equal(task.state, 'FAILED'); assert.equal(orchestrator.humanInputs.size, 0);
  assert.equal(task.workflowNodes[0].state, 'CANCELLED'); assert.deepEqual(task.snapshot.keys, {});
});

test('mission deadline expires human wait and rejects late answers', async (t) => {
  const llm = engine(); llm.configure({ taskTimeoutMs: 1000 });
  const { orchestrator, bus } = setup(t, llm);
  const task = orchestrator.submitTask('[TEAM:TECH] Deadline', { nodes: [human('h')] });
  const input = orchestrator.listHumanInputs()[0];
  // Keep the event loop alive; AbortSignal.timeout itself is an unref'ed timer.
  await Promise.all([drain(orchestrator), delay(1050)]);
  assert.equal(task.state, 'FAILED'); assert.equal(task.workflowNodes[0].state, 'CANCELLED');
  assert.equal(orchestrator.humanInputs.size, 0); assert.equal(task.usage.total_tokens, 0);
  assert.equal(orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: 'late' }), false);
  assert.match(bus.snapshot(1)[0].payload_summary, /deadline/);
});

test('shutdown drains pending human work and clears memory-only credentials', async (t) => {
  const { orchestrator } = setup(t);
  const task = orchestrator.submitTask('[TEAM:TECH] Shutdown', { nodes: [human('h')] });
  await orchestrator.shutdown();
  assert.equal(task.state, 'CANCELLED'); assert.equal(orchestrator.running.size, 0);
  assert.equal(orchestrator.humanInputs.size, 0); assert.deepEqual(task.snapshot.keys, {});
});

test('human contribution does not bypass SAGE review; approval and rejection remain separate', async (t) => {
  for (const decision of ['approve', 'reject']) {
    const { orchestrator, bus } = setup(t);
    const task = orchestrator.submitTask('[TEAM:TECH] Human then review', { nodes: [human('h'), agent('review', ['h'], 'SAGE'), agent('report', ['review'])] });
    const input = orchestrator.listHumanInputs()[0];
    orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: 'Requirements only, not approval.' });
    const interrupt = await waitFor(() => bus.snapshot(500).find((event) => event.event_type === 'HITL_INTERRUPT'));
    assert.equal(task.state, 'AWAITING_HITL'); assert.equal(task.outputs.length, 2);
    assert.equal(orchestrator.resolveHumanInput(interrupt.approval_id, { action: 'submit', text: 'wrong channel' }), false);
    orchestrator.resolveHitl(interrupt.approval_id, decision);
    await drain(orchestrator);
    assert.equal(task.state, decision === 'approve' ? 'COMPLETED' : 'FAILED');
    assert.equal(task.outputs.length, decision === 'approve' ? 3 : 2);
    assert.equal(orchestrator.approvals.size, 0);
  }
});

test('human deliverables archive with human provenance and deterministic order', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-human-archive-'));
  const storage = await new StorageEngine(root).init();
  const orchestrator = new Orchestrator({ llmEngine: engine(), storage, toolExecutor: new ToolExecutor({ storage }), bus: new TelemetryBus() });
  t.after(async () => { await orchestrator.shutdown(); await storage.close(); });
  const task = orchestrator.submitTask('[TEAM:TECH] Archive collaboration', { nodes: [human('h'), agent('report', ['h'])] });
  orchestrator.resolveHumanInput(orchestrator.listHumanInputs()[0].input_id, { action: 'submit', text: 'Human-supplied acceptance criteria' });
  await drain(orchestrator);
  assert.equal(task.state, 'COMPLETED');
  const entry = storage.get('deliverables').data.tech[0];
  assert.equal(entry.status, 'HUMAN_AI');
  assert.equal(entry.paragraphs[0], 'HUMAN: Human-supplied acceptance criteria');
  assert.equal(entry.stages[0], 'HUMAN (human/human-input)');
  const files = await readdir(join(root, 'deliverables', 'tech'));
  const markdown = await readFile(join(root, 'deliverables', 'tech', files[0]), 'utf8');
  assert.ok(markdown.indexOf('Human-supplied acceptance criteria') < markdown.indexOf('HERMES: Offline report'));
});

test('REST and WebSocket recover pending inputs beyond event history, validate and acknowledge one response', async (t) => {
  const app = await createApplication({ vaultDir: await mkdtemp(join(tmpdir(), 'maoc-human-api-')), llmEngine: engine() });
  await app.listen(0); t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const task = app.orchestrator.submitTask('[TEAM:TECH] API collaboration', { nodes: [human('h')] });
  const input = await waitFor(() => app.orchestrator.listHumanInputs()[0]);
  for (let i = 0; i < 510; i += 1) app.orchestrator.bus.publish({ event_type: 'AGENT_THINKING', source_agent: 'ARIA' });
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
  const received = []; ws.on('message', (raw) => received.push(JSON.parse(raw)));
  t.after(() => ws.terminate()); await once(ws, 'open');
  const snapshot = await waitFor(() => received.find((message) => message.type === 'SNAPSHOT'));
  assert.equal(snapshot.human_inputs[0].input_id, input.input_id);
  assert.equal(snapshot.events.some((event) => event.event_type === 'HUMAN_INPUT_REQUESTED'), false);
  assert.equal((await (await fetch(`${base}/api/human-inputs`)).json()).inputs.length, 1);
  await assert.rejects(sendHumanResponse(base, input.input_id, { action: 'submit', text: '' }), /1–12000/);
  const errorCount = () => received.filter((message) => message.type === 'ERROR').length;
  ws.send(JSON.stringify({ type: 'HUMAN_INPUT_RESPONSE', input_id: input.input_id, response: { action: 'approve' } }));
  await waitFor(() => errorCount() === 1);
  assert.equal(app.orchestrator.listHumanInputs().length, 1);
  ws.send(JSON.stringify({ type: 'HUMAN_INPUT_RESPONSE', input_id: input.input_id, response: { action: 'submit', text: 'First answer wins' } }));
  const ack = await waitFor(() => received.find((message) => message.type === 'HUMAN_INPUT_ACK'));
  assert.equal(ack.accepted, true); assert.equal(ack.input_id, input.input_id);
  await drain(app.orchestrator); assert.equal(task.state, 'COMPLETED');
  await assert.rejects(sendHumanResponse(base, input.input_id, { action: 'submit', text: 'duplicate' }), /already resolved/);
  const second = app.orchestrator.submitTask('[TEAM:TECH] HTTP answer', { nodes: [human('h')] });
  const next = await waitFor(() => app.orchestrator.listHumanInputs().find((entry) => entry.task_id === second.id));
  assert.equal((await sendHumanResponse(base, next.input_id, { action: 'submit', text: 'HTTP answer' })).accepted, true);
  await drain(app.orchestrator); assert.equal(second.outputs[0].text, 'HTTP answer');
  const third = app.orchestrator.submitTask('[TEAM:TECH] HTTP cancel', { nodes: [human('h')] });
  const pending = await waitFor(() => app.orchestrator.listHumanInputs().find((entry) => entry.task_id === third.id));
  await sendHumanResponse(base, pending.input_id, { action: 'cancel' });
  await drain(app.orchestrator); assert.equal(third.state, 'FAILED');
  assert.deepEqual((await (await fetch(`${base}/api/human-inputs`)).json()).inputs, []);
  ws.close(); await once(ws, 'close');
});

test('frontend pending-input reducer handles independent requests, resolution and terminal cleanup', async () => {
  let state = {};
  const request = (id, task) => ({ event_type: 'HUMAN_INPUT_REQUESTED', human_input: { input_id: id, task_id: task } });
  state = reduceHumanInputs(state, request('a', 'one')); state = reduceHumanInputs(state, request('b', 'one'));
  state = reduceHumanInputs(state, request('c', 'two'));
  const unchanged = reduceHumanInputs(state, { event_type: 'AGENT_THINKING' }); assert.equal(unchanged, state);
  const resolved = reduceHumanInputs(state, { event_type: 'HUMAN_INPUT_RESOLVED', human_input: { input_id: 'a' } });
  assert.deepEqual(Object.keys(resolved), ['b', 'c']); assert.ok(state.a);
  assert.deepEqual(Object.keys(reduceHumanInputs(resolved, { event_type: 'TASK_COMPLETED', task_id: 'one' })), ['c']);
  await assert.rejects(sendHumanResponse('', 'id', { action: 'cancel' }, async () => { throw new Error('offline'); }), /offline/);
});
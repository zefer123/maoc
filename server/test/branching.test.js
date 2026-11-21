import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { validateWorkflow, evaluateWorkflowCondition, createConditionalWorkflowExample } from '../../src/lib/workflowGraph.js';
import { validateTaskTemplate, renderTaskTemplate } from '../../src/lib/taskTemplates.js';
import { validateSchedule } from '../../src/lib/schedule.js';
import { Orchestrator } from '../src/orchestrator.js';
import { LlmEngine } from '../src/llmEngine.js';
import { ToolExecutor } from '../src/toolExecutor.js';
import { TelemetryBus } from '../src/eventBus.js';
import { StorageEngine } from '../src/storageEngine.js';
import { createApplication } from '../src/server.js';

const reply = (content, calls = []) => Response.json({ choices: [{ message: { content, tool_calls: calls.map(({ name, args }, i) => ({ id: `call-${i}`, type: 'function', function: { name, arguments: JSON.stringify(args) } })) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
function transport({ missing = false, mail = false } = {}) {
  const prompts = new Map(); const calls = [];
  const llm = new LlmEngine({ settings: { providers: { openai: 'offline-branching-test' } }, fetcher: async (_, options) => {
    const { messages } = JSON.parse(options.body);
    const id = messages[1].content.match(/Workflow node: ([\w-]+)/)[1];
    calls.push(id); prompts.set(id, messages[1].content);
    if (id === 'inspect' && !missing && !messages.some((message) => message.role === 'tool')) return reply('', [
      { name: 'agent-registry', args: {} }, ...(mail ? [{ name: 'agent-message', args: { to: 'fallback', text: 'Forward reference, not approval' } }] : [])
    ]);
    return reply(`REPORT_${id}`);
  } });
  llm.configure({ provider: 'openai', modelName: 'offline', autoFailover: false, rpm: 1000, maxTaskTokens: 500000 });
  return { llm, prompts, calls };
}
async function setup(t, options = {}) {
  const tx = transport(options); const bus = new TelemetryBus();
  const orchestrator = new Orchestrator({ llmEngine: tx.llm, bus, ...options.dependencies });
  t.after(() => orchestrator.shutdown());
  return { ...tx, bus, orchestrator };
}
async function run(orchestrator, graph = createConditionalWorkflowExample(), description = '[TEAM:TECH] Branch test') {
  const task = orchestrator.submitTask(description, graph);
  await Promise.all([...orchestrator.running]);
  return task;
}

test('condition validation copies rules and preserves literal typed values', () => {
  const input = createConditionalWorkflowExample(); const graph = validateWorkflow(input);
  input.nodes[1].when.value = 'mutated';
  assert.equal(graph.nodes[1].when.value, 'TAEC');
  assert.equal(graph.nodes.at(-1).join, 'any');
});

test('condition validation rejects expressions, unsafe paths, invalid values and non-direct/HUMAN sources', () => {
  const invalid = [{ path: '__proto__.x' }, { path: 'agents.constructor' }, { path: 'x()' }, { path: '' }, { path: 'a.'.repeat(9) },
    { path: 'a'.repeat(201) }, { operator: 'eval' }, { operator: 'gt', value: '1' }, { value: NaN }, { value: null }, { value: {} }, { value: 'x'.repeat(201) },
    { branch: 'maybe' }, { source: 'matched' }, { source: 'missing' }, { tool: '../run' }, { extra: true }];
  for (const patch of invalid) {
    const graph = createConditionalWorkflowExample(); Object.assign(graph.nodes[1].when, patch);
    assert.throws(() => validateWorkflow(graph), JSON.stringify(patch));
  }
  const human = createConditionalWorkflowExample(); human.nodes[0] = { ...human.nodes[0], agent: 'HUMAN', prompt: 'Input?' };
  assert.throws(() => validateWorkflow(human), /direct AI/);
  const sink = createConditionalWorkflowExample(); sink.nodes.at(-1).when = { ...sink.nodes[1].when, source: 'matched' };
  assert.throws(() => validateWorkflow(sink), /Final report/);
  const join = createConditionalWorkflowExample(); join.nodes[1].join = 'race'; assert.throws(() => validateWorkflow(join), /Join/);
});

test('report review cannot be conditional or downstream of a conditional path', () => {
  for (const agent of ['SAGE', 'LEX', 'CIPHER']) {
    const branch = createConditionalWorkflowExample(); branch.nodes[1].agent = agent;
    assert.throws(() => validateWorkflow(branch), /Report reviewers/);
    const sink = createConditionalWorkflowExample(); sink.nodes.at(-1).agent = agent;
    assert.throws(() => validateWorkflow(sink), /Report reviewers/);
  }
});

test('typed comparisons support IF/ELSE, finite numeric ordering, arrays and own properties only', () => {
  for (const [operator, expected] of [['eq', false], ['neq', true], ['gt', true], ['gte', true], ['lt', false], ['lte', false]]) {
    for (const branch of ['if', 'else']) assert.equal(evaluateWorkflowCondition({ path: 'a.0.x', operator, value: 2, branch }, { a: [{ x: 3 }] }), branch === 'if' ? expected : !expected);
  }
  assert.equal(evaluateWorkflowCondition({ path: 'ok', operator: 'eq', value: false, branch: 'if' }, { ok: false }), true);
  const condition = { path: 'x', operator: 'eq', value: 1, branch: 'else' };
  for (const result of [{}, { x: '1' }, { x: Infinity }, Object.create({ x: 1 }), { x: null }]) assert.throws(() => evaluateWorkflowCondition(condition, result));
});

test('actual tool results select IF; skipped paths spend no calls, join has only executed context and retained telemetry', async (t) => {
  const { orchestrator, calls, prompts, bus } = await setup(t);
  const task = await run(orchestrator);
  assert.equal(task.state, 'COMPLETED');
  assert.deepEqual(task.workflowNodes.map((node) => node.state), ['COMPLETED', 'COMPLETED', 'SKIPPED', 'COMPLETED']);
  assert.equal(calls.includes('fallback'), false); assert.equal(task.handoffs, 2);
  assert.match(prompts.get('report'), /REPORT_matched/); assert.doesNotMatch(prompts.get('report'), /REPORT_fallback/);
  assert.ok(bus.history.some((event) => event.stage === 'node_skipped' && event.node_id === 'fallback'));
  assert.equal(task.branchResults.size, 0); assert.deepEqual(task.snapshot.keys, {});
  assert.equal(orchestrator.listTasks()[0].workflow_nodes[2].condition_result, false);
});

test('false comparison selects ELSE, not IF', async (t) => {
  const { orchestrator, calls } = await setup(t); const graph = createConditionalWorkflowExample();
  graph.nodes[1].when.value = 'NO_MATCH'; graph.nodes[2].when.value = 'NO_MATCH';
  const task = await run(orchestrator, graph);
  assert.equal(task.state, 'COMPLETED'); assert.equal(calls.includes('matched'), false); assert.ok(calls.includes('fallback'));
});

test('missing tool result stops both paths instead of treating unknown as ELSE', async (t) => {
  const { orchestrator, calls } = await setup(t, { missing: true }); const task = await run(orchestrator);
  assert.equal(task.state, 'FAILED'); assert.deepEqual(calls, ['inspect']);
  assert.match(task.workflowNodes[1].failure_reason, /required tool result unavailable/);
  assert.equal(task.outputs.some((output) => output.node_id === 'report'), false);
});

test('error, missing path and type mismatch fail closed before branch provider calls', async (t) => {
  for (const kind of ['error', 'path', 'type', 'unpermitted']) {
    const tools = new ToolExecutor(); if (kind === 'error') tools.registry.get('agent-registry').execute = () => { throw new Error('offline'); };
    if (kind === 'unpermitted') tools.registry.get('agent-registry').agents = [];
    const { orchestrator, calls } = await setup(t, { dependencies: { toolExecutor: tools } });
    const graph = createConditionalWorkflowExample();
    if (kind === 'path') graph.nodes[1].when.path = 'missing.field';
    if (kind === 'type') graph.nodes[1].when.value = 1;
    const task = await run(orchestrator, graph);
    assert.equal(task.state, 'FAILED'); assert.equal(calls.some((id) => id !== 'inspect'), false);
  }
});

test('skip cascades down all-joins; any-join merges active paths; empty final path fails', async (t) => {
  const { orchestrator, calls } = await setup(t); const graph = createConditionalWorkflowExample();
  graph.nodes.splice(3, 0, { id: 'child', agent: 'BYTE', dependsOn: ['fallback'] }); graph.nodes.at(-1).dependsOn = ['matched', 'child'];
  const task = await run(orchestrator, graph);
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.workflowNodes[3].state, 'SKIPPED'); assert.equal(calls.includes('child'), false);
  const blocked = createConditionalWorkflowExample(); blocked.nodes.at(-1).join = 'all';
  const failure = await run(orchestrator, blocked); assert.equal(failure.state, 'FAILED');
  assert.match(failure.workflowNodes.at(-1).failure_reason, /No active path/);
});

test('skipped HUMAN branch creates no request or contribution', async (t) => {
  const { orchestrator } = await setup(t); const graph = createConditionalWorkflowExample();
  graph.nodes[2] = { ...graph.nodes[2], agent: 'HUMAN', prompt: 'Should never be requested' };
  const task = await run(orchestrator, graph);
  assert.equal(task.state, 'COMPLETED'); assert.equal(orchestrator.listHumanInputs().length, 0);
  assert.equal(task.outputs.some((output) => output.agent === 'HUMAN'), false);
});

test('nested condition whose source was skipped does not read missing tool data or execute', async (t) => {
  const { orchestrator, calls } = await setup(t); const graph = createConditionalWorkflowExample();
  graph.nodes.splice(3, 0, { id: 'nested', agent: 'BYTE', dependsOn: ['fallback'], when: { source: 'fallback', tool: 'agent-registry', path: 'agents.0.id', operator: 'eq', value: 'TAEC', branch: 'else' } });
  graph.nodes.at(-1).dependsOn = ['matched', 'nested'];
  const task = await run(orchestrator, graph); assert.equal(task.state, 'COMPLETED');
  assert.equal(task.workflowNodes[3].state, 'SKIPPED'); assert.equal(task.workflowNodes[3].condition_result, undefined);
  assert.equal(calls.includes('nested'), false);
});

test('department fallback report gate still blocks successful conditional archival', async (t) => {
  const { orchestrator } = await setup(t); const task = orchestrator.submitTask('[TEAM:DATA] Conditional report review', createConditionalWorkflowExample());
  for (let i = 0; i < 200 && !orchestrator.approvals.size; i += 1) await delay(5);
  const [approval] = orchestrator.approvals.keys(); assert.ok(approval); assert.equal(task.state, 'AWAITING_HITL');
  assert.equal(task.workflowNodes.at(-1).state, 'COMPLETED');
  orchestrator.resolveHitl(approval, 'reject'); await Promise.all([...orchestrator.running]); assert.equal(task.state, 'FAILED');
});

test('selected HUMAN branch waits normally and resumes with user contribution', async (t) => {
  const { orchestrator } = await setup(t); const graph = createConditionalWorkflowExample();
  graph.nodes[1] = { ...graph.nodes[1], agent: 'HUMAN', prompt: 'Provide requirements' };
  const task = orchestrator.submitTask('[TEAM:TECH] HUMAN branch', graph);
  for (let i = 0; i < 200 && !orchestrator.listHumanInputs().length; i += 1) await delay(5);
  const [input] = orchestrator.listHumanInputs(); assert.ok(input); assert.equal(task.state, 'AWAITING_HITL');
  assert.equal(orchestrator.resolveHumanInput(input.input_id, { action: 'submit', text: 'Confirmed constraints' }), true);
  await Promise.all([...orchestrator.running]); assert.equal(task.state, 'COMPLETED');
  assert.ok(task.outputs.some((output) => output.agent === 'HUMAN'));
});

test('mail addressed to skipped branch is cancelled, never delivered', async (t) => {
  const { orchestrator } = await setup(t, { mail: true }); const graph = createConditionalWorkflowExample(); graph.messaging = true;
  const task = await run(orchestrator, graph);
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.agentMessages[0].status, 'CANCELLED');
  assert.equal(task.agentMessages[0].delivered_at, undefined);
});

test('conditional runs still enforce planned handoff limits before execution', async (t) => {
  const { orchestrator, llm, calls } = await setup(t); llm.configure({ maxHandoffs: 1 });
  assert.throws(() => orchestrator.submitTask('Guard test', createConditionalWorkflowExample()), /planned workflow/);
  assert.equal(calls.length, 0);
});

test('report review before branching still blocks execution and rejection prevents branch calls', async (t) => {
  const { orchestrator, calls } = await setup(t); const graph = createConditionalWorkflowExample();
  graph.nodes.unshift({ id: 'review', agent: 'SAGE', dependsOn: [] }); graph.nodes[1].dependsOn = ['review'];
  const task = orchestrator.submitTask('[TEAM:TECH] Required review before routing', graph);
  for (let i = 0; i < 200 && !orchestrator.approvals.size; i += 1) await delay(5);
  const [approval] = orchestrator.approvals.keys(); assert.ok(approval); assert.equal(task.state, 'AWAITING_HITL');
  assert.deepEqual(calls, ['review']); orchestrator.resolveHitl(approval, 'reject');
  await Promise.all([...orchestrator.running]); assert.equal(task.state, 'FAILED'); assert.deepEqual(calls, ['review']);
});

test('conditions do not bypass token budgets or task cancellation and clear private result state', async (t) => {
  const bounded = await setup(t); bounded.llm.configure({ maxTaskTokens: 1000 });
  const denied = await run(bounded.orchestrator); assert.equal(denied.state, 'FAILED'); assert.equal(bounded.calls.length, 0);
  const waiting = await setup(t); const graph = createConditionalWorkflowExample();
  graph.nodes[1] = { ...graph.nodes[1], agent: 'HUMAN', prompt: 'Wait for cancellation' };
  const task = waiting.orchestrator.submitTask('[TEAM:TECH] Cancel active branch', graph);
  for (let i = 0; i < 200 && !waiting.orchestrator.listHumanInputs().length; i += 1) await delay(5);
  assert.ok(waiting.orchestrator.listHumanInputs().length); await waiting.orchestrator.shutdown();
  assert.equal(task.state, 'CANCELLED'); assert.equal(task.branchResults.size, 0); assert.deepEqual(task.snapshot.keys, {});
  assert.equal(waiting.orchestrator.listHumanInputs().length, 0); assert.equal(waiting.calls.includes('report'), false);
});

test('repeated tool name uses last actual result, not first result or model prose', async (t) => {
  const tools = new ToolExecutor();
  tools.register({ name: 'branch-metric', description: 'Deterministic test adapter', inputSchema: { type: 'object', properties: { sample: { type: 'number' } }, required: ['sample'] }, agents: ['ARIA'], execute: ({ sample }) => ({ metric: sample }) });
  const llm = new LlmEngine({ settings: { providers: { openai: 'offline-last-result' } }, fetcher: async (_, options) => {
    const { messages } = JSON.parse(options.body); const id = messages[1].content.match(/Workflow node: ([\w-]+)/)[1];
    if (id === 'inspect' && !messages.some((message) => message.role === 'tool')) return reply('', [{ name: 'branch-metric', args: { sample: 1 } }, { name: 'branch-metric', args: { sample: 10 } }]);
    return reply('Prose says metric=0, not a routing input');
  } });
  llm.configure({ provider: 'openai', modelName: 'offline', rpm: 1000, autoFailover: false, maxTaskTokens: 500000 });
  const storage = { get: () => ({ data: { ARIA: { tools: ['branch-metric'] } } }) };
  const orchestrator = new Orchestrator({ llmEngine: llm, toolExecutor: tools, storage, bus: new TelemetryBus() });
  // This fake storage supplies overrides only; skip archival in this focused executor test.
  tools.archive = async () => ({ saved: true }); t.after(() => orchestrator.shutdown());
  const graph = createConditionalWorkflowExample();
  for (const node of graph.nodes.filter((node) => node.when)) Object.assign(node.when, { tool: 'branch-metric', path: 'metric', operator: 'gte', value: 5 });
  const task = await run(orchestrator, graph); assert.equal(task.state, 'COMPLETED');
  assert.equal(task.workflowNodes[1].state, 'COMPLETED'); assert.equal(task.workflowNodes[2].state, 'SKIPPED');
});

test('template resolves to a paused conditional schedule and explicit resume executes bounded branches', async (t) => {
  let now = Date.parse('2026-11-13T10:00:00Z'); const { llm } = transport();
  const app = await createApplication({ vaultDir: await mkdtemp(join(tmpdir(), 'maoc-scheduled-branches-')), llmEngine: llm, schedulerClock: () => now, schedulerAutoStart: false });
  t.after(() => app.close());
  const template = await app.templates.create({ name: 'Conditional schedule', description: '[TEAM:TECH] {{topic}}', workflow: createConditionalWorkflowExample() });
  const mission = app.templates.render(template.id, { parameters: { topic: 'Bounded routing' } });
  const schedule = await app.scheduler.create({ name: 'Conditional recurrence', ...mission, recurrence: { kind: 'interval', minutes: 5 }, maxRuns: 1 });
  await app.templates.remove(template.id, { action: 'delete' });
  now += 300000; await app.scheduler.tick(); assert.equal(app.orchestrator.tasks.size, 0);
  await app.scheduler.action(schedule.id, { action: 'resume' }); now += 300000; await app.scheduler.tick();
  await Promise.all([...app.orchestrator.running]); await app.scheduler.tick();
  const [task] = app.orchestrator.tasks.values(); assert.equal(task.state, 'COMPLETED');
  assert.equal(task.workflowNodes[2].state, 'SKIPPED'); assert.equal(task.scheduledRun.schedule_id, schedule.id);
  assert.equal(app.scheduler.list()[0].state, 'EXHAUSTED');
});

test('templates and paused schedule validation preserve conditions without parameterizing rules', () => {
  const config = validateTaskTemplate({ name: 'Conditional', description: '[TEAM:TECH] {{topic}}', workflow: createConditionalWorkflowExample() });
  const rendered = renderTaskTemplate(config, { topic: 'registry test' });
  assert.deepEqual(rendered.workflow, createConditionalWorkflowExample());
  const schedule = validateSchedule({ name: 'Branches', ...rendered, recurrence: { kind: 'interval', minutes: 60 }, maxRuns: 2 });
  assert.deepEqual(schedule.workflow, rendered.workflow);
});

test('archive retains branch decisions and Markdown skip reasons without raw result maps', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'maoc-branches-')); const storage = await new StorageEngine(root).init();
  t.after(() => storage.close());
  const { orchestrator } = await setup(t, { dependencies: { storage, toolExecutor: new ToolExecutor({ storage }) } });
  const task = await run(orchestrator); assert.equal(task.state, 'COMPLETED');
  const artifact = storage.get('deliverables').data.tech[0];
  assert.equal(artifact.workflow_nodes[2].state, 'SKIPPED'); assert.ok(artifact.paragraphs.some((text) => text.includes('Conditional workflow')));
  const [file] = await readdir(join(root, 'deliverables', 'tech')); const markdown = await readFile(join(root, 'deliverables', 'tech', file), 'utf8');
  assert.match(markdown, /Condition else not selected/); assert.equal(JSON.stringify(artifact).includes('branchResults'), false);
});

test('REST and WS validate rules and reconnect snapshots retain SKIPPED decisions', async (t) => {
  const { llm } = transport(); const app = await createApplication({ port: 0, vaultDir: await mkdtemp(join(tmpdir(), 'maoc-branch-api-')), llmEngine: llm });
  await app.listen(0); t.after(() => app.close()); const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (workflow) => fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: '[TEAM:TECH] API branches', workflow }) });
  const invalid = createConditionalWorkflowExample(); invalid.nodes[1].when.path = '__proto__.id'; assert.equal((await post(invalid)).status, 400);
  const accepted = await post(createConditionalWorkflowExample()); assert.equal(accepted.status, 201);
  await Promise.all([...app.orchestrator.running]);
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws'); t.after(() => ws.close());
  const snapshotPromise = once(ws, 'message'); await once(ws, 'open'); const snapshot = JSON.parse((await snapshotPromise)[0]);
  assert.equal(snapshot.tasks[0].workflow_nodes[2].state, 'SKIPPED');
  const error = once(ws, 'message'); ws.send(JSON.stringify({ type: 'SUBMIT_TASK', description: 'Invalid condition', workflow: invalid }));
  assert.equal(JSON.parse((await error)[0]).type, 'ERROR');
  const acceptedEvent = once(ws, 'message'); ws.send(JSON.stringify({ type: 'SUBMIT_TASK', description: '[TEAM:TECH] WS branches', workflow: createConditionalWorkflowExample() }));
  assert.equal(JSON.parse((await acceptedEvent)[0]).type, 'EVENT'); await Promise.all([...app.orchestrator.running]);
  assert.equal(app.orchestrator.listTasks().at(-1).workflow_nodes[2].state, 'SKIPPED');
  ws.close(); await once(ws, 'close');
});
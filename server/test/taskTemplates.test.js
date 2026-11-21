import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { validateTaskTemplate, templateParameters, renderTaskTemplate } from '../../src/lib/taskTemplates.js';
import { createWorkflowExample, createHumanWorkflowExample } from '../../src/lib/workflowGraph.js';
import { TaskTemplateStore } from '../src/taskTemplateStore.js';
import { StorageEngine } from '../src/storageEngine.js';
import { LlmEngine } from '../src/llmEngine.js';
import { createApplication } from '../src/server.js';

const config = (extra = {}) => ({ name: 'Research preset', description: '[TEAM:TECH] Research {{topic}} for {{audience}}.', workflow: createWorkflowExample(), ...extra });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'maoc-template-store-')); const storage = await new StorageEngine(root).init();
  const store = await new TaskTemplateStore(storage).init();
  t.after(async () => { await store.close(); await storage.close(); }); return { root, storage, store };
}
async function waitFor(check) {
  for (let i = 0; i < 500; i += 1) { const result = check(); if (result) return result; await delay(5); }
  assert.fail('Template execution state not reached');
}
async function application(t, settings = {}) {
  let now = Date.parse('2026-11-13T12:00:00Z'); const prompts = [];
  const llm = new LlmEngine({ settings: { providers: { openai: 'offline-template-key' } }, fetcher: async (_, options) => {
    prompts.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: { content: 'Deterministic template report.' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  } });
  llm.configure({ provider: 'openai', rpm: 1000, autoFailover: false, maxTaskTokens: 500000, ...settings });
  const root = await mkdtemp(join(tmpdir(), 'maoc-template-app-'));
  const app = await createApplication({ vaultDir: root, llmEngine: llm, schedulerClock: () => now, schedulerAutoStart: false });
  t.after(() => app.close()); return { app, prompts, llm, advance: (ms) => { now += ms; } };
}
const drain = (app) => Promise.all([...app.orchestrator.running]);

test('REST creates/lists/renders/deletes without execution and rejects forged fields, unsafe origins and raw sync writes', async (t) => {
  const { app, prompts } = await application(t); await app.listen(0); const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (path, body, method = 'POST') => fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/api/templates', config({ apiKey: 'no' }))).status, 400);
  const created = await post('/api/templates', config()); assert.equal(created.status, 201); const { template } = await created.json();
  assert.equal((await (await fetch(`${base}/api/templates`)).json()).templates.length, 1);
  assert.equal((await fetch(`${base}/api/templates`, { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
  assert.equal((await post('/api/storage/taskTemplates', { revision: 0, data: [] }, 'PUT')).status, 404);
  assert.equal((await post(`/api/templates/${template.id}/render`, { parameters: { topic: 'x' } })).status, 400);
  assert.equal((await post(`/api/templates/${template.id}/render`, { parameters: { topic: 'x', audience: 'y' }, execute: true })).status, 400);
  const rendered = await post(`/api/templates/${template.id}/render`, { parameters: { topic: 'DAG', audience: 'reviewers' } });
  assert.equal(rendered.status, 200); const { mission } = await rendered.json(); assert.match(mission.description, /Research DAG/);
  assert.equal(prompts.length, 0); assert.equal(app.orchestrator.tasks.size, 0); assert.equal(app.scheduler.list().length, 0);
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws'); t.after(() => ws.terminate()); const messages = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw))); await once(ws, 'open');
  ws.send(JSON.stringify({ type: 'RUN_TEMPLATE', template_id: template.id, parameters: {} }));
  assert.equal((await waitFor(() => messages.find((message) => message.type === 'ERROR'))).status, 400);
  assert.equal((await post('/api/tasks', mission)).status, 201); await drain(app);
  assert.equal([...app.orchestrator.tasks.values()][0].state, 'COMPLETED');
  assert.equal((await post(`/api/templates/${template.id}`, { action: 'delete' })).status, 200);
  assert.equal((await post(`/api/templates/${template.id}/render`, { parameters: {} })).status, 404);
  ws.close(); await once(ws, 'close');
});

test('rendered DAG/messaging and Swarm missions run through original provider context and archive expanded text', async (t) => {
  const { app, prompts } = await application(t);
  for (const extra of [{ workflow: { ...createWorkflowExample(), messaging: true } }, { workflow: undefined, swarm: { agents: ['NOVA', 'BYTE'] } }]) {
    const item = await app.templates.create(config(extra)); const mission = app.templates.render(item.id, { parameters: { topic: 'EXPANDED_TOPIC', audience: 'reviewers' } });
    assert.equal(prompts.length > 0, app.orchestrator.tasks.size > 0);
    const task = app.orchestrator.submitTask(mission.description, mission.workflow, mission.swarm); await drain(app);
    assert.equal(task.state, 'COMPLETED'); assert.ok(prompts.at(-1).messages[1].content.includes('EXPANDED_TOPIC'));
    assert.ok(!prompts.at(-1).messages[1].content.includes('{{topic}}'));
    const artifact = app.storage.get('deliverables').data.tech.at(-1); assert.match(artifact.title, /EXPANDED_TOPIC/);
    assert.deepEqual(task.snapshot.keys, {});
  }
});

test('expanded HUMAN questions still wait for real contribution and cannot auto-answer or approve', async (t) => {
  const { app } = await application(t); const workflow = createHumanWorkflowExample(); workflow.nodes[1].prompt = 'Review {{topic}} for {{audience}}';
  const item = await app.templates.create(config({ workflow })); const mission = app.templates.render(item.id, { parameters: { topic: 'scheduling', audience: 'engineers' } });
  const task = app.orchestrator.submitTask(mission.description, mission.workflow); const human = await waitFor(() => app.orchestrator.listHumanInputs()[0]);
  assert.equal(task.state, 'AWAITING_HITL'); assert.equal(human.prompt, 'Review scheduling for engineers');
  app.orchestrator.resolveHumanInput(human.input_id, { action: 'submit', text: 'Keep existing constraints.' }); await drain(app);
  assert.equal(task.state, 'COMPLETED'); assert.ok(task.outputs.some((output) => output.agent === 'HUMAN'));
});

test('rendered reviewer retains report approval and rejecting it prevents success archive', async (t) => {
  const { app } = await application(t);
  const item = await app.templates.create(config({ workflow: { nodes: [{ id: 'review', agent: 'SAGE', dependsOn: [] }] } }));
  const mission = app.templates.render(item.id, { parameters: { topic: 'review', audience: 'humans' } });
  const task = app.orchestrator.submitTask(mission.description, mission.workflow);
  const event = await waitFor(() => app.orchestrator.bus.snapshot().find((e) => e.task_id === task.id && e.event_type === 'HITL_INTERRUPT'));
  assert.equal(task.state, 'AWAITING_HITL'); assert.equal(app.orchestrator.resolveHitl(event.approval_id, 'reject'), true); await drain(app);
  assert.equal(task.state, 'FAILED'); assert.deepEqual(app.storage.get('deliverables').data, {});
});

test('rendering cannot bypass live handoff validation or token budgets and does not snapshot engine settings', async (t) => {
  const { app, llm } = await application(t); const item = await app.templates.create(config());
  const mission = app.templates.render(item.id, { parameters: { topic: 'bounded', audience: 'engineers' } });
  llm.configure({ maxHandoffs: 1 }); assert.throws(() => app.orchestrator.submitTask(mission.description, mission.workflow), /handoffs/);
  llm.configure({ maxHandoffs: 12, maxTaskTokens: 1000 });
  const task = app.orchestrator.submitTask(mission.description, mission.workflow); await drain(app); assert.equal(task.state, 'FAILED');
  assert.doesNotMatch(await readFile(app.templates.path, 'utf8'), /offline-template-key|apiKey|snapshot/);
});

test('resolved schedules are independent copies after template deletion and remain paused until explicit resume', async (t) => {
  const { app, advance } = await application(t); const item = await app.templates.create(config());
  const mission = app.templates.render(item.id, { parameters: { topic: 'SCHEDULE_TOPIC', audience: 'engineers' } });
  const schedule = await app.scheduler.create({ name: 'Resolved preset', ...mission, recurrence: { kind: 'interval', minutes: 5 }, maxRuns: 1 });
  await app.templates.remove(item.id, { action: 'delete' }); assert.equal(app.scheduler.list()[0].state, 'PAUSED');
  advance(300000); await app.scheduler.tick(); assert.equal(app.orchestrator.tasks.size, 0);
  await app.scheduler.action(schedule.id, { action: 'resume' }); advance(300000); await app.scheduler.tick(); await drain(app); await app.scheduler.tick();
  assert.equal([...app.orchestrator.tasks.values()][0].state, 'COMPLETED');
  assert.match(app.storage.get('deliverables').data.tech[0].title, /SCHEDULE_TOPIC/);
});

test('templates normalize/copy sequential, DAG messaging, Swarm and HUMAN configs without new permissions', () => {
  const input = config({ workflow: { ...createWorkflowExample(), messaging: true } }); const normalized = validateTaskTemplate(input);
  input.workflow.nodes[0].agent = 'BYTE'; assert.equal(normalized.workflow.nodes[0].agent, 'ARIA'); assert.equal(normalized.workflow.messaging, true);
  assert.equal(validateTaskTemplate({ name: 'Sequential', description: '[TEAM:TECH] {{topic}}' }).workflow, undefined);
  assert.deepEqual(validateTaskTemplate({ name: 'Swarm', description: '{{topic}}', swarm: { agents: ['NOVA', 'BYTE'] } }).swarm, { agents: ['NOVA', 'BYTE'], synthesizer: 'HERMES', maxConcurrency: 2 });
  assert.equal(validateTaskTemplate(config({ workflow: createHumanWorkflowExample() })).workflow.nodes[1].agent, 'HUMAN');
});

test('parameter discovery is stable, distinct and case-sensitive across mission and HUMAN questions', () => {
  const workflow = createHumanWorkflowExample(); workflow.nodes[1].prompt = 'Review {{topic}} for {{Topic}} and {{constraint_1}}';
  assert.deepEqual(templateParameters(config({ description: '{{topic}} {{topic}}', workflow })), ['topic', 'Topic', 'constraint_1']);
  assert.deepEqual(templateParameters(config({ description: 'No parameters' })), []);
});

test('zero-parameter presets render with empty object and legitimate Object prototype names require own values', () => {
  assert.equal(renderTaskTemplate(config({ description: 'No parameters' }), {}).description, 'No parameters');
  assert.throws(() => renderTaskTemplate(config({ description: '{{toString}}' }), {}), /requires/);
  assert.equal(renderTaskTemplate(config({ description: '{{toString}}' }), { toString: 'literal' }).description, 'literal');
});

test('sequential template render preserves literal route and uses existing non-DAG executor', async (t) => {
  const { app } = await application(t);
  const preset = await app.templates.create({ name: 'Sequential', description: '[TEAM:TECH] [COWORK:BYTE] Research {{topic}}' });
  const mission = app.templates.render(preset.id, { parameters: { topic: 'bounded sequence' } });
  const task = app.orchestrator.submitTask(mission.description, mission.workflow, mission.swarm); await drain(app);
  assert.equal(task.state, 'COMPLETED'); assert.equal(task.workflow, undefined);
  assert.deepEqual(task.outputs.map((output) => output.agent), ['ARIA', 'BYTE', 'HERMES']);
});

test('literal single-pass rendering preserves dollar sequences, HTML, unicode and nested-looking values', () => {
  const value = '$& $1 $$ ${process.exit()} {{audience}} <img src=x onerror=alert(1)> ภาษาไทย';
  const mission = renderTaskTemplate(config(), { topic: value, audience: 'engineers' });
  assert.equal(mission.description, `[TEAM:TECH] Research ${value} for engineers.`);
  assert.equal(mission.workflow.nodes.length, 4);
});

test('HUMAN substitution changes only question text and preserves graph, identities, messaging and bounds', () => {
  const workflow = { ...createHumanWorkflowExample(), messaging: true }; workflow.nodes[1].prompt = 'Review {{topic}}';
  const source = config({ workflow }); const result = renderTaskTemplate(source, { topic: 'scheduler', audience: 'reviewers' });
  assert.equal(result.workflow.nodes[1].prompt, 'Review scheduler');
  assert.deepEqual(result.workflow.nodes.map(({ prompt, ...node }) => node), workflow.nodes.map(({ prompt, ...node }) => node));
  assert.equal(source.workflow.nodes[1].prompt, 'Review {{topic}}'); assert.equal(result.workflow.messaging, true);
});

test('templates reject credentials, execution settings, schedule metadata and parameterized structure', () => {
  for (const input of [null, [], {}, config({ apiKey: 'secret' }), config({ parameters: {} }), config({ tools: ['shell'] }),
    config({ recurrence: { kind: 'daily', time: '10:00' } }), config({ maxRuns: 10 }), config({ provider: 'openai' }), config({ name: ' ' }), config({ name: 'x'.repeat(101) }),
    config({ description: ' ' }), config({ description: 'x'.repeat(12001) }), config({ workflow: { nodes: [] } }),
    config({ swarm: { agents: ['NOVA', 'BYTE'] } }), config({ workflow: { nodes: [{ id: '{{node}}', agent: 'BYTE', dependsOn: [] }] } }),
    config({ workflow: { nodes: [{ id: 'a', agent: '{{agent}}', dependsOn: [] }] } }),
    config({ workflow: { nodes: [{ id: 'a', agent: 'BYTE', dependsOn: [], prompt: '{{instruction}}' }] } })]) assert.throws(() => validateTaskTemplate(input));
});

test('template syntax rejects expressions, paths, whitespace, reserved names and malformed delimiters', () => {
  for (const description of ['{{ topic }}', '{{x.y}}', '{{x[0]}}', '{{x()}}', '{{1x}}', '{{_x}}', '{{constructor}}', '{{prototype}}', '{{__proto__}}', '{{x', 'x}}', '{{{x}}}', '{{' + 'a'.repeat(33) + '}}']) assert.throws(() => validateTaskTemplate(config({ description })));
  assert.doesNotThrow(() => validateTaskTemplate(config({ description: 'Ordinary { braces } are allowed.' })));
});

test('template parameter and occurrence limits are enforced before rendering', () => {
  assert.throws(() => validateTaskTemplate(config({ description: Array.from({ length: 17 }, (_, i) => `{{p${i}}}`).join(' ') })), /16 parameters/);
  assert.throws(() => validateTaskTemplate(config({ description: '{{x}}'.repeat(129) })), /128/);
  assert.equal(templateParameters(config({ description: '{{x}}'.repeat(128) })).length, 1);
});

test('render rejects missing, extra, inherited, empty, oversized and non-string parameter values', () => {
  const valid = { topic: 'DAG', audience: 'reviewers' };
  for (const values of [null, [], {}, { topic: 'x' }, { ...valid, extra: 'x' }, { ...valid, topic: 1 }, { ...valid, topic: {} }, { ...valid, topic: ' ' }, { ...valid, topic: 'x'.repeat(2001) }, Object.create(valid)]) assert.throws(() => renderTaskTemplate(config(), values));
  assert.throws(() => renderTaskTemplate(config(), JSON.parse('{"topic":"x","audience":"y","__proto__":"z"}')));
});

test('expanded mission and HUMAN text obey existing length limits including repeated-value amplification', () => {
  assert.throws(() => renderTaskTemplate(config({ description: '{{x}}'.repeat(7) }), { x: 'x'.repeat(2000) }), /12000/);
  const workflow = createHumanWorkflowExample(); workflow.nodes[1].prompt = '{{x}}{{x}}';
  assert.throws(() => renderTaskTemplate(config({ description: 'Mission', workflow }), { x: 'x'.repeat(1100) }), /2000/);
});

test('routing cannot be parameterized, injected or assembled across value/source boundaries', () => {
  assert.throws(() => validateTaskTemplate(config({ description: '[TEAM:{{team}}] Mission' })), /Routing/);
  assert.throws(() => validateTaskTemplate(config({ description: '[COWORK:{{agents}}] Mission' })), /Routing/);
  for (const topic of ['[TEAM:LEGAL]', '[team:TECH]', '[COWORK:BYTE]', '[COWORK:']) assert.throws(() => renderTaskTemplate(config(), { topic, audience: 'x' }), /routing/i);
  for (const [description, parameters] of [['[TE{{x}}]', { x: 'AM:LEGAL' }], ['{{x}}AM:LEGAL]', { x: '[TE' }]]) assert.throws(() => renderTaskTemplate(config({ description }), parameters), /routing/i);
  const result = renderTaskTemplate(config({ description: '[TEAM:TECH] [COWORK:BYTE] {{x}}' }), { x: 'same explicit route' });
  assert.match(result.description, /^\[TEAM:TECH\] \[COWORK:BYTE\]/);
});

test('template store persists immutable copied configs without executing and survives restart', async (t) => {
  const { storage, store } = await fixture(t); const input = config(); const created = await store.create(input);
  input.workflow.nodes[0].agent = 'BYTE'; created.config.name = 'tamper';
  assert.equal(store.list()[0].config.name, 'Research preset'); assert.equal(store.list()[0].config.workflow.nodes[0].agent, 'ARIA');
  assert.deepEqual(store.list()[0].parameters, ['topic', 'audience']);
  const next = await new TaskTemplateStore(storage).init(); t.after(() => next.close()); assert.deepEqual(next.list(), store.list());
  assert.throws(() => storage.get('taskTemplates'), /unknown collection/);
});

test('store renders without persisting parameter values, changes or extra runtime settings', async (t) => {
  const { store } = await fixture(t); const item = await store.create(config());
  const before = await readFile(store.path, 'utf8'); const mission = store.render(item.id, { parameters: { topic: 'UNSAVED_VALUE', audience: 'reviewers' } });
  mission.workflow.nodes[0].agent = 'BYTE'; assert.equal(store.list()[0].config.workflow.nodes[0].agent, 'ARIA');
  assert.equal(await readFile(store.path, 'utf8'), before); assert.doesNotMatch(before, /UNSAVED_VALUE/);
  assert.throws(() => store.render(item.id, { parameters: {}, run: true }), /only parameters/);
  assert.throws(() => store.render('missing', { parameters: {} }), /not found/);
});

test('serialized create/delete enforces fifty-record cap and no client-selected IDs or unsafe deletion', async (t) => {
  const { store } = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 53 }, () => store.create(config())));
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 50); assert.equal(store.list().length, 50);
  assert.throws(() => store.create(config({ id: 'chosen' })), /only/);
  const id = store.list()[0].id; assert.throws(() => store.remove(id, { action: 'delete', config: {} }));
  assert.throws(() => store.remove('../escape', { action: 'delete' }));
  await store.remove(id, { action: 'delete' }); await assert.rejects(store.remove(id, { action: 'delete' }), /not found/);
  await store.create(config()); assert.equal(store.list().length, 50);
});

test('failed atomic write keeps memory/disk unchanged and queued operations can recover safely', async (t) => {
  const { storage, store } = await fixture(t); await store.create(config()); const original = storage.atomicWrite.bind(storage);
  const before = await readFile(store.path, 'utf8'); storage.atomicWrite = async () => { throw new Error('disk unavailable'); };
  await assert.rejects(store.create(config()), /disk unavailable/); await assert.rejects(store.remove(store.list()[0].id, { action: 'delete' }));
  assert.equal(store.list().length, 1); assert.equal(await readFile(store.path, 'utf8'), before);
  storage.atomicWrite = original; await store.create(config()); assert.equal(store.list().length, 2);
});

test('corrupt persisted template envelopes/configs/duplicates fail startup without resetting disk or leaking lock', async (t) => {
  const { root, store, storage } = await fixture(t); await store.create(config()); const saved = JSON.parse(await readFile(store.path, 'utf8'));
  await store.close(); await storage.close();
  const invalids = ['{broken', JSON.stringify({ ...saved, apiKey: 'forbidden' }), JSON.stringify({ ...saved, templates: [saved.templates[0], saved.templates[0]] }), JSON.stringify({ schemaVersion: 1, templates: [{ ...saved.templates[0], config: config({ tools: ['shell'] }) }] })];
  for (const invalid of invalids) {
    await writeFile(store.path, invalid); await assert.rejects(createApplication({ vaultDir: root }));
    assert.equal(await readFile(store.path, 'utf8'), invalid); const probe = await new StorageEngine(root).init(); await probe.close();
  }
});

test('close drains accepted writes and rejects further creates/deletes/renders', async (t) => {
  const { store } = await fixture(t); const pending = store.create(config()); const close = store.close(); const item = await pending; await close;
  await assert.rejects(store.create(config()), /shutting down/); await assert.rejects(store.remove(item.id, { action: 'delete' }), /shutting down/);
  assert.throws(() => store.render(item.id, { parameters: { topic: 'x', audience: 'y' } }), /shutting down/);
  assert.equal(JSON.parse(await readFile(store.path, 'utf8')).templates.length, 1);
});
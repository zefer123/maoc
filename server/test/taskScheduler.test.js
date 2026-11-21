import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { validateSchedule, validateRecurrence, nextOccurrence, recurrenceLabel } from '../../src/lib/schedule.js';
import { createWorkflowExample, createHumanWorkflowExample } from '../../src/lib/workflowGraph.js';
import { TaskScheduler } from '../src/taskScheduler.js';
import { StorageEngine } from '../src/storageEngine.js';
import { TelemetryBus } from '../src/eventBus.js';
import { LlmEngine } from '../src/llmEngine.js';
import { createApplication } from '../src/server.js';

const START = Date.parse('2026-11-13T10:00:00Z');
const config = (extra = {}) => ({ name: 'Recurring test', description: '[TEAM:TECH] Read-only test report', recurrence: { kind: 'interval', minutes: 5 }, maxRuns: 3, ...extra });
const drain = (app) => Promise.all([...app.orchestrator.running]);
async function waitFor(check) {
  for (let i = 0; i < 500; i += 1) { const value = check(); if (value) return value; await delay(5); }
  assert.fail('Expected scheduling state not reached');
}
function engine(fetcher = async () => Response.json({ choices: [{ message: { content: 'Deterministic scheduled artifact' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })) {
  const llm = new LlmEngine({ settings: { providers: { openai: 'offline-scheduler-key' } }, fetcher });
  llm.configure({ provider: 'openai', modelName: 'offline', rpm: 1000, autoFailover: false, maxTaskTokens: 500000 }); return llm;
}
async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'maoc-scheduler-'));
  const storage = await new StorageEngine(root).init(); const bus = new TelemetryBus(); const tasks = [];
  let now = START;
  const orchestrator = { submitTask: (description, workflow, swarm, scheduledRun) => {
    const task = { id: `task-${tasks.length + 1}`, state: 'RUNNING', description, workflow, swarm, scheduledRun };
    tasks.push(task); return task;
  } };
  const scheduler = await new TaskScheduler({ storage, bus, orchestrator, clock: () => now, ...options }).init();
  t.after(async () => { await scheduler.close(); await storage.close(); });
  return { scheduler, storage, bus, tasks, orchestrator, root, setNow: (value) => { now = value; }, advance: (ms) => { now += ms; } };
}
async function enable(scheduler, extra) { const item = await scheduler.create(config(extra)); await scheduler.action(item.id, { action: 'resume' }); return item.id; }
async function application(t, llm = engine()) {
  let now = START;
  const app = await createApplication({ vaultDir: await mkdtemp(join(tmpdir(), 'maoc-scheduled-app-')), llmEngine: llm, schedulerClock: () => now, schedulerAutoStart: false });
  t.after(() => app.close()); return { app, advance: (ms) => { now += ms; } };
}

test('schedule validation copies only allowed configs and preserves sequential, DAG/messaging, HUMAN and Swarm', () => {
  const input = config({ workflow: { ...createWorkflowExample(), messaging: true } });
  const output = validateSchedule(input); input.workflow.nodes[0].agent = 'BYTE';
  assert.equal(output.workflow.nodes[0].agent, 'ARIA'); assert.equal(output.workflow.messaging, true);
  assert.equal(validateSchedule(config({ workflow: createHumanWorkflowExample() })).workflow.nodes[1].agent, 'HUMAN');
  assert.equal(validateSchedule(config({ swarm: { agents: ['NOVA', 'BYTE'] } })).swarm.synthesizer, 'HERMES');
  assert.equal(validateSchedule({ ...config(), maxRuns: undefined }).maxRuns, 10);
  assert.equal(validateSchedule(config({ name: ' Test ' })).name, 'Test');
  assert.equal(recurrenceLabel({ kind: 'weekly', time: '09:00', weekday: 1 }), 'Mon 09:00 UTC');
});

test('schedule validation rejects cron injection, credentials, malformed modes, invalid quotas and timings', () => {
  const invalid = [null, [], {}, config({ name: ' ' }), config({ name: 'x'.repeat(101) }), config({ description: ' ' }), config({ apiKey: 'secret' }),
    config({ enabled: true }), config({ next_run_at: START }), config({ runNow: true }), config({ systemPrompt: 'override' }),
    config({ workflow: createWorkflowExample(), swarm: { agents: ['NOVA', 'BYTE'] } }), config({ workflow: {} }), config({ swarm: { agents: ['HUMAN', 'BYTE'] } }),
    ...[0, -1, 101, 1.5, '2', null].map((maxRuns) => config({ maxRuns })),
    ...[null, {}, [], '*/5 * * * *', { kind: 'cron', expression: '* * * * *' }, { kind: 'interval', minutes: 4 }, { kind: 'interval', minutes: 43201 },
      { kind: 'interval', minutes: 5.5 }, { kind: 'interval', minutes: '5' }, { kind: 'daily', time: '24:00' }, { kind: 'daily', time: '9:00' },
      { kind: 'weekly', time: '09:00', weekday: 7 }, { kind: 'daily', time: '09:00', timezone: 'America/New_York' },
      { kind: 'interval', minutes: 5, command: 'shell' }].map((recurrence) => config({ recurrence }))];
  for (const value of invalid) assert.throws(() => validateSchedule(value));
  assert.throws(() => nextOccurrence({ kind: 'daily', time: '09:00' }, NaN), /clock/);
});

test('UTC next occurrence is strictly future across exact slots, week/month/year and leap boundaries', () => {
  const next = (rule, after) => new Date(nextOccurrence(rule, Date.parse(after))).toISOString();
  assert.equal(next({ kind: 'daily', time: '10:00' }, '2026-11-13T10:00:00Z'), '2026-11-14T10:00:00.000Z');
  assert.equal(next({ kind: 'daily', time: '10:01' }, '2026-11-13T10:00:59Z'), '2026-11-13T10:01:00.000Z');
  assert.equal(next({ kind: 'weekly', time: '10:00', weekday: 5 }, '2026-11-13T10:00:00Z'), '2026-11-20T10:00:00.000Z');
  assert.equal(next({ kind: 'weekly', time: '09:00', weekday: 0 }, '2026-12-31T10:00:00Z'), '2027-01-03T09:00:00.000Z');
  assert.equal(next({ kind: 'daily', time: '00:00' }, '2028-02-28T23:59:59Z'), '2028-02-29T00:00:00.000Z');
  assert.equal(next({ kind: 'daily', time: '00:00' }, '2026-12-31T23:59:59Z'), '2027-01-01T00:00:00.000Z');
  assert.equal(next({ kind: 'interval', minutes: 5 }, '2026-11-13T10:00:00Z'), '2026-11-13T10:05:00.000Z');
  assert.deepEqual(validateRecurrence({ kind: 'weekly', time: '10:00', weekday: 0 }), { kind: 'weekly', time: '10:00', weekday: 0 });
});

test('new schedules are durable paused configs, copied snapshots and never dispatch without resume', async (t) => {
  const { scheduler, storage, tasks, advance, bus } = await fixture(t);
  const item = await scheduler.create(config()); item.config.name = 'tampered';
  advance(86400000); await scheduler.tick(); assert.equal(tasks.length, 0);
  assert.equal(scheduler.list()[0].config.name, 'Recurring test'); assert.equal(scheduler.list()[0].state, 'PAUSED');
  const stored = JSON.parse(await readFile(join(storage.stateDir, 'schedules.json'), 'utf8'));
  assert.equal(stored.schedules[0].state, 'PAUSED'); assert.equal(bus.snapshot(50)[0].event_type, 'SCHEDULE_UPDATED');
  assert.throws(() => storage.get('schedules'), /unknown collection/); // Browser bulk sync cannot arm/overwrite.
});

test('resume/pause actions are serialized, validate identities and never execute on create or resume', async (t) => {
  const { scheduler, tasks, advance } = await fixture(t); const id = await enable(scheduler);
  const first = scheduler.list()[0].next_run_at;
  advance(1000); await scheduler.action(id, { action: 'resume' }); assert.equal(scheduler.list()[0].next_run_at, first);
  assert.equal(tasks.length, 0);
  await scheduler.action(id, { action: 'pause' }); advance(10000000); await scheduler.tick(); assert.equal(tasks.length, 0);
  await scheduler.action(id, { action: 'resume' }); assert.ok(scheduler.list()[0].next_run_at > first);
  await assert.rejects(scheduler.action('missing', { action: 'pause' }), /not found/);
  for (const input of [{ action: 'run' }, { action: 'resume', apiKey: 'secret' }, null, {}]) assert.throws(() => scheduler.action(id, input));
  assert.throws(() => scheduler.action('../escape', { action: 'pause' }), /identifier/);
});

test('concurrent ticks claim exactly once, persist before submission and carry schedule provenance', async (t) => {
  const { scheduler, tasks, advance, orchestrator, storage } = await fixture(t);
  const original = orchestrator.submitTask;
  orchestrator.submitTask = (...args) => {
    assert.equal(scheduler.items[0].last.status, 'CLAIMED'); assert.equal(scheduler.items[0].runs, 1);
    return original(...args);
  };
  const id = await enable(scheduler); advance(300000);
  await Promise.all(Array.from({ length: 8 }, () => scheduler.tick()));
  assert.equal(tasks.length, 1); assert.deepEqual(tasks[0].scheduledRun, { schedule_id: id, run: 1, due_at: '2026-11-13T10:05:00.000Z' });
  assert.equal(scheduler.list()[0].runs, 1); assert.equal(scheduler.list()[0].active_task_id, 'task-1');
  const saved = JSON.parse(await readFile(join(storage.stateDir, 'schedules.json'), 'utf8'));
  assert.equal(saved.schedules[0].last.task_id, 'task-1');
});

test('same-schedule overlap and approval waits skip a slot without using another attempt', async (t) => {
  const { scheduler, tasks, advance } = await fixture(t); await enable(scheduler);
  advance(300000); await scheduler.tick(); tasks[0].state = 'AWAITING_HITL';
  advance(300000); await scheduler.tick(); assert.equal(tasks.length, 1);
  assert.equal(scheduler.list()[0].last.status, 'SKIPPED_BUSY'); assert.equal(scheduler.list()[0].runs, 1);
  tasks[0].state = 'COMPLETED'; await scheduler.tick(); assert.equal(scheduler.list()[0].last.status, 'COMPLETED');
  advance(300000); await scheduler.tick(); assert.equal(tasks.length, 2);
});

test('scheduler caps active scheduled missions at two and skips third rather than backlogging', async (t) => {
  const { scheduler, tasks, advance } = await fixture(t);
  for (let i = 0; i < 3; i += 1) await enable(scheduler, { name: `Schedule ${i}` });
  advance(300000); await scheduler.tick(); assert.equal(tasks.length, 2);
  const third = scheduler.list()[2]; assert.equal(third.last.status, 'SKIPPED_BUSY'); assert.equal(third.runs, 0);
  tasks.forEach((task) => { task.state = 'COMPLETED'; }); await scheduler.tick(); assert.equal(tasks.length, 2);
});

test('late slots, sleep and forward/backward clock shifts never replay a catch-up burst', async (t) => {
  const { scheduler, tasks, advance, setNow } = await fixture(t); await enable(scheduler);
  advance(300000 + 60001); await scheduler.tick(); assert.equal(tasks.length, 0);
  assert.equal(scheduler.list()[0].last.status, 'SKIPPED_LATE'); assert.equal(scheduler.list()[0].runs, 0);
  const next = scheduler.list()[0].next_run_at;
  setNow(START - 86400000); await scheduler.tick(); assert.equal(scheduler.list()[0].next_run_at, next);
  setNow(START + 30 * 86400000); await scheduler.tick(); assert.equal(tasks.length, 0);
  assert.equal(scheduler.list()[0].next_run_at, START + 30 * 86400000 + 300000);
  advance(300000); await scheduler.tick(); assert.equal(tasks.length, 1);
});

test('bounded dispatch attempts exhaust permanently and cannot be rearmed without new config', async (t) => {
  const { scheduler, tasks, advance } = await fixture(t); const id = await enable(scheduler, { maxRuns: 1 });
  advance(300000); await scheduler.tick(); assert.equal(tasks.length, 1);
  assert.equal(scheduler.list()[0].state, 'EXHAUSTED'); assert.equal(scheduler.list()[0].next_run_at, null);
  tasks[0].state = 'COMPLETED'; advance(86400000); await scheduler.tick(); assert.equal(tasks.length, 1);
  await assert.rejects(scheduler.action(id, { action: 'resume' }), /attempt limit/);
});

test('pause does not cancel active mission; delete/resume wait until it drains', async (t) => {
  const { scheduler, tasks, advance } = await fixture(t); const id = await enable(scheduler);
  advance(300000); await scheduler.tick(); await scheduler.action(id, { action: 'pause' });
  assert.equal(tasks[0].state, 'RUNNING'); assert.equal(scheduler.list()[0].state, 'PAUSED');
  await assert.rejects(scheduler.action(id, { action: 'delete' }), /active mission/);
  await assert.rejects(scheduler.action(id, { action: 'resume' }), /active mission/);
  tasks[0].state = 'COMPLETED'; await scheduler.tick(); await scheduler.action(id, { action: 'delete' });
  assert.deepEqual(scheduler.list(), []);
});

test('dispatch rejection consumes a bounded attempt, pauses automatically and never retries', async (t) => {
  const { scheduler, advance, orchestrator } = await fixture(t);
  let calls = 0; orchestrator.submitTask = () => { calls += 1; const error = new Error('secret must not appear'); error.status = 429; throw error; };
  const id = await enable(scheduler); advance(300000); await scheduler.tick();
  const saved = scheduler.list()[0]; assert.equal(saved.state, 'PAUSED'); assert.equal(saved.runs, 1); assert.equal(saved.last.code, 429);
  assert.doesNotMatch(JSON.stringify(saved), /secret must not appear/);
  advance(3600000); await scheduler.tick(); assert.equal(calls, 1);
  await scheduler.action(id, { action: 'resume' }); advance(300000); await scheduler.tick(); assert.equal(calls, 2);
});

test('failed/cancelled mission outcomes pause future dispatch and retain status without false success', async (t) => {
  for (const state of ['FAILED', 'CANCELLED']) {
    const { scheduler, tasks, advance } = await fixture(t); await enable(scheduler);
    advance(300000); await scheduler.tick(); tasks[0].state = state; await scheduler.tick();
    const saved = scheduler.list()[0]; assert.equal(saved.state, 'PAUSED'); assert.equal(saved.last.status, state);
    advance(86400000); await scheduler.tick(); assert.equal(tasks.length, 1);
  }
});

test('schedule count cap and concurrent creates/deletes preserve atomic server-owned state', async (t) => {
  const { scheduler } = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 23 }, (_, i) => scheduler.create(config({ name: `Task ${i}` }))));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 20);
  assert.equal(scheduler.list().length, 20);
  await scheduler.action(scheduler.list()[0].id, { action: 'delete' }); await scheduler.create(config()); assert.equal(scheduler.list().length, 20);
});

test('restart pauses enabled and claimed schedules, preserves exhausted runs and never replays downtime', async (t) => {
  const { scheduler, storage, orchestrator, bus, tasks, advance } = await fixture(t);
  const id = await enable(scheduler); const exhausted = await enable(scheduler, { maxRuns: 1 });
  advance(300000); await scheduler.tick(); await scheduler.close();
  const reloaded = await new TaskScheduler({ storage, orchestrator, bus, clock: () => START + 86400000 }).init(); t.after(() => reloaded.close());
  assert.equal(reloaded.list().find((item) => item.id === id).state, 'PAUSED');
  assert.equal(reloaded.list().find((item) => item.id === exhausted).state, 'EXHAUSTED');
  assert.ok(reloaded.list().every((item) => item.next_run_at === null && item.active_task_id === null));
  await reloaded.tick(); assert.equal(tasks.length, 2); assert.equal(reloaded.list()[0].runs, 1);
  await reloaded.action(id, { action: 'resume' }); assert.equal(reloaded.list()[0].next_run_at, START + 86400000 + 300000);
});

test('corrupt scheduler persistence fails startup without overwrite or leaked Vault lock', async (t) => {
  const { root, scheduler, storage } = await fixture(t); await scheduler.create(config()); await scheduler.close(); await storage.close();
  const path = join(root, '.maoc', 'state', 'schedules.json');
  for (const invalid of ['{broken', JSON.stringify({ schemaVersion: 1, schedules: [{ id: 'x' }] })]) {
    await writeFile(path, invalid);
    await assert.rejects(createApplication({ vaultDir: root, llmEngine: engine() }));
    assert.equal(await readFile(path, 'utf8'), invalid);
    const probe = await new StorageEngine(root).init(); await probe.close();
  }
});

test('failed durable claim never submits and stops scheduler closed without automatic retry', async (t) => {
  const { scheduler, storage, tasks, advance } = await fixture(t); await enable(scheduler);
  storage.atomicWrite = async () => { throw new Error('disk unavailable'); };
  advance(300000); await assert.rejects(scheduler.tick(), /disk unavailable/);
  assert.equal(tasks.length, 0); assert.equal(scheduler.stopped, true);
  await assert.rejects(scheduler.tick(), /stopped/); await assert.rejects(scheduler.create(config()), /stopped/);
});

test('crash window after durable claim permits lost attempt but no automatic duplicate on restart', async (t) => {
  const { scheduler, storage, tasks, orchestrator, bus, advance } = await fixture(t); await enable(scheduler);
  const original = storage.atomicWrite.bind(storage); let writes = 0;
  storage.atomicWrite = async (...args) => { writes += 1; if (writes === 2) throw new Error('post-dispatch write failed'); return original(...args); };
  advance(300000); await assert.rejects(scheduler.tick(), /post-dispatch/); assert.equal(tasks.length, 1);
  storage.atomicWrite = original;
  const reloaded = await new TaskScheduler({ storage, orchestrator, bus, clock: () => START + 86400000 }).init(); t.after(() => reloaded.close());
  assert.equal(reloaded.list()[0].last.status, 'CLAIMED'); assert.equal(reloaded.list()[0].runs, 1); assert.equal(reloaded.list()[0].state, 'PAUSED');
  await reloaded.tick(); assert.equal(tasks.length, 1);
});

test('close prevents new dispatch even while claim persistence is in flight, and drains writes', async (t) => {
  const { scheduler, storage, tasks, advance } = await fixture(t); await enable(scheduler);
  const original = storage.atomicWrite.bind(storage); let entered; let release;
  const started = new Promise((resolve) => { entered = resolve; }); const gate = new Promise((resolve) => { release = resolve; });
  storage.atomicWrite = async (...args) => { entered(); await gate; return original(...args); };
  advance(300000); const tick = scheduler.tick(); await started;
  const closing = scheduler.close(); release(); await Promise.all([tick, closing]); assert.equal(tasks.length, 0);
  await assert.rejects(scheduler.tick(), /stopped/);
});

test('real scheduled DAG/messaging, HUMAN and Swarm preserve contexts, archive provenance and current settings', async (t) => {
  const { app, advance } = await application(t); const scheduler = app.scheduler;
  for (const input of [{ workflow: { ...createWorkflowExample(), messaging: true } }, { swarm: { agents: ['NOVA', 'BYTE'] } }, { workflow: createHumanWorkflowExample() }]) {
    const id = await enable(scheduler, { ...input, maxRuns: 1 }); advance(300000); await scheduler.tick();
    const task = [...app.orchestrator.tasks.values()].at(-1);
    if (input.workflow?.nodes.some((node) => node.agent === 'HUMAN')) {
      const human = await waitFor(() => app.orchestrator.listHumanInputs()[0]);
      assert.equal(task.state, 'AWAITING_HITL'); app.orchestrator.resolveHumanInput(human.input_id, { action: 'submit', text: 'Keep all schedules local.' });
    }
    await drain(app); await scheduler.tick(); assert.equal(task.state, 'COMPLETED');
    const artifact = app.storage.get('deliverables').data.tech.at(-1);
    assert.equal(task.scheduledRun.schedule_id, id); assert.equal(artifact.scheduled_run.schedule_id, id);
    const markdown = await readFile(join(app.storage.root, 'deliverables', 'tech', `${createHash('sha256').update(artifact.id).digest('hex').slice(0, 24)}.md`), 'utf8');
    assert.ok(markdown.includes(`schedule ${id}, run 1`));
    assert.deepEqual(task.snapshot.keys, {}); assert.doesNotMatch(JSON.stringify(scheduler.list()), /offline-scheduler-key/);
  }
});

test('scheduled reviewer cannot auto-approve HITL and rejection pauses recurring execution', async (t) => {
  const { app, advance } = await application(t);
  await enable(app.scheduler, { workflow: { nodes: [{ id: 'review', agent: 'SAGE', dependsOn: [] }, { id: 'report', agent: 'BYTE', dependsOn: ['review'] }] } });
  advance(300000); await app.scheduler.tick();
  const [approval] = await waitFor(() => [...app.orchestrator.approvals.entries()].find(([, item]) => item.ready && item.status === 'PENDING'));
  const task = [...app.orchestrator.tasks.values()].at(-1); assert.equal(task.state, 'AWAITING_HITL'); assert.equal(task.outputs.length, 1);
  advance(300000); await app.scheduler.tick(); assert.equal(app.orchestrator.tasks.size, 1);
  assert.equal(app.orchestrator.resolveHitl(approval, 'reject'), true); await drain(app); await app.scheduler.tick();
  assert.equal(app.scheduler.list()[0].state, 'PAUSED'); assert.equal(task.state, 'FAILED'); assert.deepEqual(app.storage.get('deliverables').data, {});
});

test('scheduled dispatch retains current handoff/token guards and no credential snapshots on disk', async (t) => {
  const llm = engine(); const { app, advance } = await application(t, llm);
  const id = await enable(app.scheduler, { workflow: createWorkflowExample() });
  llm.configure({ maxHandoffs: 1 }); advance(300000); await app.scheduler.tick();
  assert.equal(app.orchestrator.tasks.size, 0); assert.equal(app.scheduler.list()[0].last.status, 'REJECTED');
  llm.configure({ maxHandoffs: 12, maxTaskTokens: 1000 });
  await app.scheduler.action(id, { action: 'resume' }); advance(300000); await app.scheduler.tick(); await drain(app); await app.scheduler.tick();
  assert.equal([...app.orchestrator.tasks.values()].at(-1).state, 'FAILED'); assert.equal(app.scheduler.list()[0].state, 'PAUSED');
  assert.doesNotMatch(await readFile(join(app.storage.stateDir, 'schedules.json'), 'utf8'), /offline-scheduler-key|apiKey|snapshot/);
});

test('scheduled agents cannot call disabled tools and provider failure pauses without success archival', async (t) => {
  let advertised; let requests = 0; let returnedError;
  const llm = engine(async (_, options) => {
    requests += 1; const body = JSON.parse(options.body); advertised = body.tools || [];
    returnedError = body.messages.find((message) => message.role === 'tool')?.content;
    return Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: 'blocked', type: 'function', function: { name: 'repo-insight', arguments: JSON.stringify({ path: 'package.json' }) } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  });
  const { app, advance } = await application(t, llm);
  await app.storage.put('agentOverrides', { BYTE: { disabledTools: ['repo-insight'] } }, 0);
  await enable(app.scheduler, { workflow: { nodes: [{ id: 'only', agent: 'BYTE', dependsOn: [] }] } });
  advance(300000); await app.scheduler.tick(); await drain(app); await app.scheduler.tick();
  // Existing tool loop reports denial once, then breaks a repeated identical request.
  assert.equal(requests, 2); assert.match(returnedError, /not permitted/);
  assert.ok(!advertised.some((tool) => tool.function.name === 'repo-insight'));
  assert.equal([...app.orchestrator.tasks.values()][0].state, 'FAILED'); assert.equal(app.scheduler.list()[0].state, 'PAUSED');
  assert.deepEqual(app.storage.get('deliverables').data, {});
  const failing = await application(t, engine(async () => Response.json({ error: { message: 'Provider failure' } }, { status: 401 })));
  await enable(failing.app.scheduler, { workflow: { nodes: [{ id: 'only', agent: 'BYTE', dependsOn: [] }] } });
  failing.advance(300000); await failing.app.scheduler.tick(); await drain(failing.app); await failing.app.scheduler.tick();
  assert.equal(failing.app.scheduler.list()[0].last.status, 'FAILED'); assert.equal(failing.app.scheduler.list()[0].state, 'PAUSED');
  assert.deepEqual(failing.app.storage.get('deliverables').data, {});
});

test('scheduled dispatch cannot bypass orchestrator eight-active-mission capacity', async (t) => {
  const llm = engine(async (_, options) => { await delay(10000, undefined, { signal: options.signal }); return Response.json({}); });
  const { app, advance } = await application(t, llm);
  const workflow = { nodes: [{ id: 'only', agent: 'BYTE', dependsOn: [] }] };
  const admissions = Array.from({ length: 8 }, () => app.orchestrator.submitTask('[TEAM:TECH] Active manual mission', workflow).accepted);
  await enable(app.scheduler, { workflow }); advance(300000); await app.scheduler.tick();
  await Promise.all(admissions);
  assert.equal(app.orchestrator.tasks.size, 8); assert.equal(app.scheduler.list()[0].last.code, 429);
  assert.equal(app.scheduler.list()[0].state, 'PAUSED');
});

test('one-second polling timer dispatches due schedules without manual tick and close clears timer', { timeout: 5000 }, async (t) => {
  const { scheduler, tasks, advance } = await fixture(t); await enable(scheduler); scheduler.start(); advance(300000);
  await waitFor(() => tasks.length === 1); await scheduler.close(); assert.equal(scheduler.timer._destroyed, true);
});

test('scheduler timer starts only after listen and application shutdown cancels active execution without duplicate resume', async (t) => {
  const llm = engine(async (_, options) => { await delay(10000, undefined, { signal: options.signal }); return Response.json({}); });
  const { app, advance } = await application(t, llm); assert.equal(app.scheduler.timer, undefined);
  await app.listen(0); app.scheduler.start(); assert.ok(app.scheduler.timer);
  await enable(app.scheduler); advance(300000); await app.scheduler.tick();
  const task = [...app.orchestrator.tasks.values()].at(-1); await app.close();
  assert.equal(task.state, 'CANCELLED'); assert.equal(app.scheduler.stopped, true); assert.deepEqual(task.snapshot.keys, {});
});

test('REST actions and WS snapshot expose durable schedules but reject client-forged metadata and raw storage writes', async (t) => {
  const { app } = await application(t); await app.listen(0); const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (path, body, method = 'POST') => fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  for (const input of [null, config({ enabled: true }), config({ recurrence: { kind: 'interval', minutes: 1 } })]) assert.equal((await post('/api/schedules', input)).status, 400);
  const response = await post('/api/schedules', config()); assert.equal(response.status, 201);
  const { schedule } = await response.json(); assert.equal(schedule.state, 'PAUSED');
  assert.equal((await post(`/api/schedules/${schedule.id}`, { action: 'resume' })).status, 200);
  assert.equal((await post(`/api/schedules/${schedule.id}`, { action: 'resume', tools: ['shell'] })).status, 400);
  assert.equal((await post('/api/storage/schedules', { revision: 0, data: [] }, 'PUT')).status, 404);
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws'); const messages = []; t.after(() => ws.terminate());
  ws.on('message', (raw) => messages.push(JSON.parse(raw))); await once(ws, 'open');
  const snapshot = await waitFor(() => messages.find((m) => m.type === 'SNAPSHOT'));
  assert.equal(snapshot.schedules[0].state, 'ENABLED'); assert.equal(snapshot.schedules[0].runs, 0);
  ws.send(JSON.stringify({ type: 'SCHEDULE_RUN', schedule_id: schedule.id }));
  assert.equal((await waitFor(() => messages.find((m) => m.type === 'ERROR'))).status, 400);
  assert.equal((await post('/api/tasks', { description: '[TEAM:TECH] Unscheduled', scheduled_run: { schedule_id: schedule.id, run: 99 } })).status, 201);
  await drain(app); assert.equal([...app.orchestrator.tasks.values()].at(-1).scheduledRun, undefined);
  await post(`/api/schedules/${schedule.id}`, { action: 'pause' });
  assert.equal((await post(`/api/schedules/${schedule.id}`, { action: 'delete' })).status, 200);
  assert.deepEqual((await (await fetch(`${base}/api/schedules`)).json()).schedules, []);
  ws.close(); await once(ws, 'close');
});
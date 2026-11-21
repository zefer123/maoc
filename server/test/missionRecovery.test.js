import test from 'node:test';
import assert from 'node:assert/strict';
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createApplication } from '../src/server.js';
import { LlmEngine } from '../src/llmEngine.js';

const path = (root) => join(root, '.maoc', 'state', 'mission-history.json');
const temp = () => mkdtemp(join(tmpdir(), 'maoc-mission-recovery-'));
const graph = (agent, prompt) => ({ nodes: [{ id: 'work', agent, ...(agent === 'HUMAN' ? { prompt } : {}), dependsOn: [] }] });
const reply = () => Response.json({ choices: [{ message: { content: 'Fixture summary: Backups are verified before rollout.' } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });

async function start(vaultDir, storageDriver, fetcher) {
  const llmEngine = new LlmEngine({ settings: { providers: { openai: 'FIXTURE_KEY_DO_NOT_STORE' } }, fetcher });
  llmEngine.configure({ provider: 'openai', modelName: 'fixture', autoFailover: false, rpm: 1000 });
  const app = await createApplication({ vaultDir, storageDriver, schedulerAutoStart: false, webhookUrl: '', llmEngine });
  const { port } = await app.listen(0, '127.0.0.1');
  const request = (path, body) => fetch(`http://127.0.0.1:${port}/api${path}`, {
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(3000)
  });
  const get = async (path) => { const res = await request(path); assert.equal(res.status, 200, path); return res.json(); };
  return { app, request, get };
}

async function waitFor(read, condition) {
  for (let n = 0; n < 150; n++) {
    const value = await read();
    if (condition(value)) return value;
    await delay(20);
  }
  assert.fail('Expected lifecycle checkpoint was not recorded');
}

test('a recovered HUMAN checkpoint is historical, cannot be answered, and does not replay', { timeout: 12000 }, async () => {
  const source = await temp();
  const active = await start(source, 'sqlite', async () => { assert.fail('HUMAN-only mission called a provider'); });
  let recovered;
  try {
    const submitted = await active.request('/tasks', { description: '[TEAM:TECH] PRIVATE_MISSION_TEXT', workflow: graph('HUMAN', 'PRIVATE_HUMAN_PROMPT') });
    assert.equal(submitted.status, 201);
    const { task_id } = await submitted.json();
    const { inputs: [input] } = await waitFor(() => active.get('/human-inputs'), (x) => x.inputs.length === 1);
    const saved = await active.get('/mission-history');
    assert.equal(saved.missions.find((item) => item.task_id === task_id)?.last_state, 'WAITING_HUMAN');
    // Capture only the durable checkpoint, without a graceful shutdown updating it first.
    const crashed = await temp();
    await mkdir(join(crashed, '.maoc', 'state'), { recursive: true });
    await copyFile(path(source), path(crashed));
    assert.doesNotMatch(await readFile(path(crashed), 'utf8'), /PRIVATE_|FIXTURE_KEY|input_id/);
    let calls = 0;
    recovered = await start(crashed, 'sqlite', async () => { calls++; return reply(); });
    const history = await recovered.get('/mission-history');
    assert.deepEqual(history.missions.map(({ task_id, state, last_state }) => ({ task_id, state, last_state })), [
      { task_id, state: 'INTERRUPTED', last_state: 'WAITING_HUMAN' }
    ]);
    assert.deepEqual((await recovered.get('/tasks')).tasks, []);
    assert.deepEqual((await recovered.get('/human-inputs')).inputs, []);
    assert.equal((await recovered.request(`/human-inputs/${input.input_id}`, { action: 'submit', text: 'Late response' })).status, 409);
    assert.equal(calls, 0);
  } finally { await recovered?.app.close(); await active.app.close(); }
});

for (const driver of ['atomic-json', 'sqlite']) {
  test(`${driver}: summarize a fixture document, record HUMAN and approval separately, then reopen the archive and AAR without replay`, { timeout: 12000 }, async () => {
    const root = await temp();
    const sourceText = 'Release checklist: verify backup before rollout.';
    let calls = 0;
    const active = await start(root, driver, async (_url, options) => {
      calls++;
      assert.ok(JSON.parse(options.body).messages.some((m) => m.content.includes(sourceText)));
      return reply();
    });
    let restarted;
    try {
      const submitted = await active.request('/tasks', { description: `[TEAM:TECH] Summarize the fixture document: ${sourceText}`, workflow: { nodes: [
        { id: 'summary', agent: 'LEX', dependsOn: [] },
        { id: 'review', agent: 'HUMAN', prompt: 'Check the summary against the source', dependsOn: ['summary'] }
      ] } });
      assert.equal(submitted.status, 201);
      const { task_id } = await submitted.json();
      const { events } = await waitFor(() => active.get('/events'), (x) => x.events.some((e) => e.task_id === task_id && e.event_type === 'HITL_INTERRUPT'));
      const { approval_id } = events.find((e) => e.task_id === task_id && e.event_type === 'HITL_INTERRUPT');
      assert.deepEqual((await active.get('/human-inputs')).inputs, []);
      assert.deepEqual((await active.get('/storage/deliverables')).data, {});
      assert.equal((await active.request(`/hitl/${approval_id}`, { decision: 'approve' })).status, 200);
      const { inputs: [input] } = await waitFor(() => active.get('/human-inputs'), (x) => x.inputs.length === 1);
      assert.match(input.context[0].text, /Backups are verified before rollout/);
      assert.equal((await active.request(`/human-inputs/${input.input_id}`, { action: 'submit', text: 'Reviewed against the source.' })).status, 200);
      await waitFor(() => active.get('/mission-history'), (x) => x.missions.some((m) => m.task_id === task_id && m.state === 'COMPLETED'));
      const artifact = (await active.get('/storage/deliverables')).data.tech.find((item) => item.id === `task-${task_id}`);
      assert.ok(artifact.paragraphs.some((text) => text.includes('Backups are verified before rollout')));
      assert.ok(artifact.paragraphs.some((text) => text.includes('Reviewed against the source.')));
      const directory = join(root, 'deliverables', 'tech');
      const files = await readdir(directory);
      assert.equal(files.length, 1);
      assert.match(await readFile(join(directory, files[0]), 'utf8'), /Reviewed against the source\./);
      const aar = (await active.get(`/reviews/${task_id}`)).report;
      assert.equal(aar.mission.state, 'COMPLETED');
      assert.equal(aar.context.human_waits[0].status, 'ANSWERED');
      assert.equal(aar.context.reviews[0].status, 'APPROVED');
      assert.equal(calls, 1);
      await active.app.close();
      restarted = await start(root, driver, async () => { calls++; return reply(); });
      assert.equal((await restarted.get('/mission-history')).missions[0].state, 'COMPLETED');
      assert.deepEqual((await restarted.get('/storage/deliverables')).data.tech.find((item) => item.id === artifact.id), artifact);
      assert.deepEqual((await restarted.get(`/reviews/${task_id}`)).report, aar);
      assert.deepEqual((await restarted.get('/tasks')).tasks, []);
      assert.equal(calls, 1);
    } finally { await restarted?.app.close(); await active.app.close(); }
  });
}

test('checkpoint failure rejects mission admission without calling the provider', async () => {
  let calls = 0;
  const root = await temp();
  const active = await start(root, 'sqlite', async () => { calls++; return reply(); });
  try {
    const healthy = await active.get('/health?deep=false');
    assert.deepEqual(healthy.checks.missionHistory, { status: 'ok' });
    const write = active.app.storage.atomicWrite.bind(active.app.storage);
    active.app.storage.atomicWrite = (file, data) => {
      if (file === path(root)) throw new Error('Fixture disk failure');
      return write(file, data);
    };
    assert.equal((await active.request('/tasks', { description: 'Fixture', workflow: graph('BYTE', 'Test') })).status, 503);
    assert.deepEqual(await active.get('/mission-history'), { persistence: 'degraded', missions: [] });
    const health = await active.request('/health?deep=false');
    assert.equal(health.status, 503);
    const { status, checks } = await health.json();
    assert.equal(status, 'degraded');
    assert.equal(checks.storage.status, 'ok');
    assert.deepEqual(checks.missionHistory, { status: 'degraded' });
    assert.deepEqual((await active.get('/tasks')).tasks, []);
    assert.equal(calls, 0);
  } finally { await active.app.close(); }
});

test('a restarted approval checkpoint does not recreate a live approval or provider request', { timeout: 12000 }, async () => {
  const source = await temp();
  let calls = 0;
  const provider = async () => { calls++; return reply(); };
  const active = await start(source, 'atomic-json', provider);
  let recovered;
  try {
    const submitted = await active.request('/tasks', { description: '[TEAM:TECH] Review a fixture report', workflow: graph('LEX') });
    assert.equal(submitted.status, 201);
    const { task_id } = await submitted.json();
    const event = await waitFor(() => active.get('/events'), ({ events }) => events.some((x) => x.task_id === task_id && x.event_type === 'HITL_INTERRUPT'));
    const { approval_id } = event.events.find((x) => x.task_id === task_id && x.event_type === 'HITL_INTERRUPT');
    const crashCopy = await temp();
    await mkdir(join(crashCopy, '.maoc', 'state'), { recursive: true });
    await copyFile(path(source), path(crashCopy));
    assert.doesNotMatch(await readFile(path(crashCopy), 'utf8'), new RegExp(approval_id));
    recovered = await start(crashCopy, 'atomic-json', provider);
    const { missions: [row] } = await recovered.get('/mission-history');
    assert.equal(row.task_id, task_id);
    assert.equal(row.state, 'INTERRUPTED');
    assert.equal(row.last_state, 'WAITING_APPROVAL');
    assert.equal((await recovered.request(`/hitl/${approval_id}`, { decision: 'approve' })).status, 409);
    assert.equal(calls, 1);
  } finally { await recovered?.app.close(); await active.app.close(); }
});

test('corrupt mission history fails startup without resetting it or leaving a writer lock', async () => {
  const root = await temp();
  await mkdir(join(root, '.maoc', 'state'), { recursive: true });
  await writeFile(path(root), '{bad checkpoint');
  await assert.rejects(createApplication({ vaultDir: root, schedulerAutoStart: false }), SyntaxError);
  assert.equal(await readFile(path(root), 'utf8'), '{bad checkpoint');
  await assert.rejects(access(join(root, '.maoc', 'writer.lock')), { code: 'ENOENT' });
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { StorageEngine } from '../src/storageEngine.js';
import { TelemetryBus, telemetryBus } from '../src/eventBus.js';
import { createLogger } from '../src/logger.js';
import { validateCollection, validateDecision, validateDescription } from '../src/validation.js';
import { Orchestrator } from '../src/orchestrator.js';
import { createApplication } from '../src/server.js';
import { createDependencyChecks } from '../src/healthChecks.js';
import { LlmEngine } from '../src/llmEngine.js';
import { createPersistenceClient, PERSISTENCE_KEYS } from '../../src/lib/persistenceClient.js';

const directory = () => mkdtemp(join(tmpdir(), 'maoc-phase1-'));
const note = (id = 'note-1', content = 'Hello [[MEMO]]') => ({ id, title: 'Research', content, links: ['[[MEMO]]'], tags: ['#research'] });
const memoryStorage = () => {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};

test('atomic JSON and Markdown survive restart, including Thai text and safe filenames', async (t) => {
  const root = await directory();
  let engine = await new StorageEngine(root).init();
  t.after(() => engine.close());
  const notes = [note('../../outside', 'ภาษาไทย [[MEMO]]')];
  const saved = await engine.put('notes', notes, 0);
  assert.equal(saved.revision, 1);
  const files = await readdir(join(root, 'notes'));
  assert.equal(files.length, 1);
  assert.match(files[0], /^[a-f0-9]{24}\.md$/);
  assert.match(await readFile(join(root, 'notes', files[0]), 'utf8'), /ภาษาไทย \[\[MEMO\]\]/);
  await engine.put('deliverables', { tech: [{ id: 'report', title: 'API', artifactCode: '{"ok":true}', stages: ['BYTE -> ZETA'] }] }, 0);
  await engine.put('agentOverrides', { ARIA: { autonomyLevel: 80, systemPrompt: 'Route tasks' } }, 0);
  assert.equal((await readdir(join(root, 'deliverables', 'tech'))).length, 1);
  assert.match(await readFile(join(root, 'agents', 'overrides.json'), 'utf8'), /Route tasks/);
  await engine.close();
  engine = await new StorageEngine(root).init();
  assert.deepEqual(engine.get('notes').data, notes);
  assert.equal((await engine.health()).status, 'ok');
});

test('concurrent writes reject stale revisions instead of losing data', async (t) => {
  const engine = await new StorageEngine(await directory()).init();
  t.after(() => engine.close());
  const results = await Promise.allSettled([
    engine.put('notes', [note('a')], 0), engine.put('notes', [note('b')], 0)
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.status, 409);
  assert.equal(engine.get('notes').revision, 1);
});

test('vault lock refuses another writer and close releases it', async () => {
  const root = await directory();
  const engine = await new StorageEngine(root).init();
  await assert.rejects(new StorageEngine(root).init(), /active writer/);
  await engine.close();
  const replacement = await new StorageEngine(root).init();
  await replacement.close();
});

test('corrupt persistence fails startup without overwriting the original', async () => {
  const root = await directory();
  const engine = await new StorageEngine(root).init();
  await engine.put('notes', [note()], 0);
  await engine.close();
  const path = join(root, '.maoc', 'state', 'notes.json');
  await writeFile(path, '{broken');
  await assert.rejects(new StorageEngine(root).init());
  assert.equal(await readFile(path, 'utf8'), '{broken');
});

test('validation rejects malformed collections, dangerous keys and invalid commands', () => {
  for (const value of ['', '   ', null, 123, 'x'.repeat(12001)]) assert.throws(() => validateDescription(value));
  assert.equal(validateDescription(' task '), 'task');
  assert.throws(() => validateDecision('yes'));
  assert.throws(() => validateCollection('notes', {}));
  assert.throws(() => validateCollection('notes', [note(), note()]));
  assert.throws(() => validateCollection('agentOverrides', { ARIA: { autonomyLevel: 101 } }));
  assert.throws(() => validateCollection('chats', JSON.parse('{"__proto__":[]}')));
  assert.throws(() => validateCollection('../notes', []));
});

test('subscriber exceptions cannot interrupt other telemetry consumers; snapshots are isolated', async () => {
  const bus = new TelemetryBus();
  let received = 0;
  bus.subscribe(() => { throw new Error('consumer failed'); });
  bus.subscribe(async () => { throw new Error('async consumer failed'); });
  bus.subscribe(() => { received += 1; });
  bus.publish({ event_type: 'TOOL_CALL', source_agent: 'BYTE' });
  await Promise.resolve();
  assert.equal(received, 1);
  assert.deepEqual(bus.snapshot(0), []);
  bus.snapshot()[0].source_agent = 'changed';
  assert.equal(bus.snapshot()[0].source_agent, 'BYTE');
  bus.close();
  for (let i = 0; i < 501; i += 1) bus.publish({ event_type: 'TOOL_CALL', source_agent: 'BYTE' });
  assert.equal(bus.snapshot(500).length, 500);
  assert.equal(bus.health().subscribers, 0);
});

test('telemetry publishes only bounded execution summaries without changing previews', () => {
  const bus = new TelemetryBus();
  const received = [];
  bus.subscribe((event) => received.push(event));
  const publish = (reasoning_trace) => bus.publish({
    event_type: 'AGENT_THINKING', source_agent: 'BYTE', payload_summary: 'Fixture preview', reasoning_trace
  });

  const summary = 'BYTE: produced a deliverable.';
  const valid = { kind: 'execution_summary', summary, extra: 'FIXTURE_INTERNAL_FIELD' };
  const expected = { kind: 'execution_summary', summary };
  assert.deepEqual(publish(valid).reasoning_trace, expected);
  valid.summary = 'Changed after publication';
  const boundary = 'x'.repeat(510) + '😀';
  assert.equal(publish({ kind: 'execution_summary', summary: boundary }).reasoning_trace.summary, boundary);

  const invalid = [undefined, 'not an object', [], { kind: 'internal', summary },
    { kind: 'execution_summary', summary: { text: summary } },
    { kind: 'execution_summary', summary: '  ' },
    { kind: 'execution_summary', summary: boundary + 'x' }];
  for (const value of invalid) assert.equal(publish(value).reasoning_trace, null);

  assert.deepEqual(received, bus.snapshot());
  assert.deepEqual(received[0].reasoning_trace, expected);
  assert.ok(received.every((event) => event.payload_summary === 'Fixture preview'));
});

test('structured logs redact nested secrets and omit error messages', () => {
  let line;
  createLogger((value) => { line = value; }).info('test', {
    apiKey: 'sensitive', nested: { authorization: 'sensitive' }, error: new Error('sensitive')
  });
  const parsed = JSON.parse(line);
  assert.equal(parsed.event, 'test');
  assert.ok(!line.includes('sensitive'));
});

test('REST, WebSocket, persistence hydration and shutdown integration', { timeout: 15000 }, async (t) => {
  const root = await directory();
  const tasks = [];
  const fake = {
    listTasks: () => tasks,
    listHumanInputs: () => [],
    listPendingApprovals: () => [],
    resolveHumanInput: () => false,
    submitTask: (description) => { const task = { id: 'test-task', state: 'RUNNING', description }; tasks.push(task); return task; },
    resolveHitl: (id) => id === 'valid-approval',
    shutdown: async () => {}
  };
  const application = await createApplication({ vaultDir: root, orchestrator: fake, shutdownTimeoutMs: 500 });
  t.after(() => application.close());
  const address = await application.listen(0);
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = (path, body, method = 'POST') => fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(health.checks.storage.status, 'ok');
  assert.equal(health.checks.providers.openai.connectivity, 'not_checked');
  assert.equal((await request('/api/tasks', { description: ' ' })).status, 400);
  assert.equal((await request('/api/tasks', { description: 'valid' })).status, 201);
  assert.equal((await request('/api/hitl/valid-approval', { decision: 'approve' })).status, 200);
  assert.equal((await request('/api/hitl/valid-approval', { decision: 'yes' })).status, 400);
  assert.equal((await request('/api/hitl/missing', { decision: 'reject' })).status, 409);
  assert.equal((await fetch(`${baseUrl}/api/events?limit=-1`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/events?limit=501`)).status, 400);
  assert.deepEqual((await (await fetch(`${baseUrl}/api/events?limit=0`)).json()).events, []);
  assert.equal((await fetch(`${baseUrl}/api/storage/unknown`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/tasks`, { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
  assert.equal((await request('/api/storage/notes', { revision: 0, data: [note()] }, 'PUT')).status, 200);
  assert.equal((await request('/api/storage/notes', { revision: 0, data: [] }, 'PUT')).status, 409);

  const browser = createPersistenceClient({ storage: memoryStorage(), baseUrl });
  await browser.sync();
  assert.deepEqual(browser.read('notes', []), [note()]);
  const socket = new WebSocket(`${baseUrl.replace('http:', 'ws:')}/ws`);
  t.after(() => socket.terminate());
  const messages = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  await once(socket, 'open');
  const next = once(socket, 'message');
  socket.send('{broken');
  assert.equal(JSON.parse((await next)[0].toString()).type, 'ERROR');
  const eventMessage = once(socket, 'message');
  telemetryBus.publish({ event_type: 'TOOL_CALL', source_agent: 'BYTE' });
  assert.equal(JSON.parse((await eventMessage)[0].toString()).type, 'EVENT');
  assert.equal(messages[0].type, 'SNAPSHOT');
  assert.deepEqual(messages[0].pending_approvals, []);
  const disconnected = once(socket, 'close');
  await application.close();
  assert.equal((await disconnected)[0], 1001);
  assert.equal(telemetryBus.health().subscribers, 0);
  const rebound = createServer();
  await new Promise((resolve, reject) => rebound.once('error', reject).listen(address.port, '127.0.0.1', resolve));
  await new Promise((resolve) => rebound.close(resolve));
});

for (const storageDriver of ['atomic-json', 'sqlite']) {
  test(`${storageDriver}: shutdown holds the Vault lock until a disconnected storage probe settles`, { timeout: 5000 }, async () => {
    const vaultDir = await directory();
    const application = await createApplication({ vaultDir, storageDriver, schedulerAutoStart: false, shutdownTimeoutMs: 100 });
    const lock = join(vaultDir, '.maoc', 'writer.lock');
    const probe = application.storage.health.bind(application.storage);
    const releaseProbe = Promise.withResolvers();
    const probeStarted = Promise.withResolvers();
    const orchestratorStopped = Promise.withResolvers();
    const stop = application.orchestrator.shutdown.bind(application.orchestrator);
    application.storage.health = async () => {
      probeStarted.resolve();
      await releaseProbe.promise;
      return probe();
    };
    application.orchestrator.shutdown = async () => { await stop(); orchestratorStopped.resolve(); };
    try {
      const { port } = await application.listen(0, '127.0.0.1');
      const request = fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) }).then(() => 'response', () => 'disconnected');
      await probeStarted.promise;
      const closing = application.close();
      assert.equal(application.close(), closing);
      assert.equal(await request, 'disconnected');
      await orchestratorStopped.promise;
      // The HTTP socket is closed, but the route still owns work that can write to disk.
      assert.equal(await Promise.race([closing.then(() => true), delay(50, false)]), false);
      assert.equal(JSON.parse(await readFile(lock, 'utf8')).pid, process.pid);
      releaseProbe.resolve();
      await closing;
      await assert.rejects(access(lock), { code: 'ENOENT' });
    } finally {
      releaseProbe.resolve();
      await application.close();
    }
  });
}

test('shutdown starts mission cancellation while the scheduler queue drains', { timeout: 5000 }, async () => {
  const application = await createApplication({ vaultDir: await directory(), schedulerAutoStart: false });
  const releaseQueue = Promise.withResolvers();
  application.scheduler.queue = releaseQueue.promise;
  try {
    const closing = application.close();
    assert.equal(application.scheduler.stopped, true);
    assert.equal(application.orchestrator.controller.signal.aborted, true);
    releaseQueue.resolve();
    await closing;
  } finally {
    releaseQueue.resolve();
    await application.close();
  }
});

test('shutdown refuses a mission whose HTTP body finishes arriving after shutdown begins', { timeout: 5000 }, async () => {
  const application = await createApplication({ vaultDir: await directory(), schedulerAutoStart: false, shutdownTimeoutMs: 2000 });
  const body = JSON.stringify({ description: 'Fixture only' });
  let submitted = 0;
  application.orchestrator.submitTask = () => { submitted++; return { id: 'unexpected', state: 'RUNNING' }; };
  let request;
  try {
    const { port } = await application.listen(0, '127.0.0.1');
    const headersReceived = once(application.server, 'request');
    request = httpRequest({ host: '127.0.0.1', port, path: '/api/tasks', method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)
    } });
    const response = once(request, 'response');
    void response.catch(() => {});
    request.flushHeaders();
    await headersReceived;
    const closing = application.close();
    request.end(body);
    const [res] = await response;
    res.resume();
    assert.equal(res.statusCode, 503);
    assert.equal(submitted, 0);
    await closing;
  } finally {
    request?.destroy();
    await application.close();
  }
});

function remoteStore() {
  const collections = new Map();
  let offline = false;
  return {
    collections,
    setOffline: (value) => { offline = value; },
    async fetcher(url, options) {
      if (offline) throw new Error('offline');
      const name = url.split('/').at(-1);
      const current = collections.get(name) || { revision: 0, data: ['notes', 'savedCommands'].includes(name) ? [] : {} };
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body);
        if (body.revision !== current.revision) return { ok: false, status: 409 };
        collections.set(name, { revision: current.revision + 1, data: body.data });
      }
      return { ok: true, json: async () => structuredClone(collections.get(name) || current) };
    }
  };
}

test('browser migrates legacy localStorage and retries offline writes after page reload', async () => {
  const remote = remoteStore();
  const storage = memoryStorage();
  storage.setItem(PERSISTENCE_KEYS.notes, JSON.stringify([note()]));
  let browser = createPersistenceClient({ storage, fetcher: remote.fetcher });
  await browser.sync();
  assert.deepEqual(remote.collections.get('notes').data, [note()]);
  remote.setOffline(true);
  browser.write('notes', [note('offline')]);
  await browser.sync();
  browser = createPersistenceClient({ storage, fetcher: remote.fetcher });
  remote.setOffline(false);
  await browser.sync();
  assert.deepEqual(remote.collections.get('notes').data, [note('offline')]);
});

test('three-way merge preserves independent edits and retains conflicts locally', async () => {
  const remote = remoteStore();
  const notifications = [];
  const browser = createPersistenceClient({ storage: memoryStorage(), fetcher: remote.fetcher, notify: (event) => notifications.push(event) });
  browser.write('notes', [note('base')]);
  await browser.sync();
  browser.write('notes', [note('local'), note('base')]);
  remote.collections.set('notes', { revision: 2, data: [note('remote'), note('base')] });
  await browser.sync();
  assert.deepEqual(new Set(remote.collections.get('notes').data.map((item) => item.id)), new Set(['local', 'remote', 'base']));
  browser.write('notes', [note('base', 'local edit')]);
  remote.collections.set('notes', { revision: 4, data: [note('base', 'remote edit')] });
  await browser.sync();
  assert.equal(browser.read('notes', [])[0].content, 'local edit');
  assert.equal(remote.collections.get('notes').data[0].content, 'remote edit');
  assert.ok(notifications.some((event) => event.status === 'conflict'));
  await browser.resolveConflict('notes', 'local');
  assert.equal(remote.collections.get('notes').data[0].content, 'local edit');
});

test('untracked browser data cannot silently overwrite an existing backend vault', async () => {
  const remote = remoteStore();
  remote.collections.set('notes', { revision: 2, data: [note('server')] });
  const storage = memoryStorage();
  storage.setItem(PERSISTENCE_KEYS.notes, JSON.stringify([note('legacy')]));
  const events = [];
  const browser = createPersistenceClient({ storage, fetcher: remote.fetcher, notify: (event) => events.push(event) });
  await browser.sync();
  assert.equal(browser.read('notes', [])[0].id, 'legacy');
  assert.equal(remote.collections.get('notes').data[0].id, 'server');
  assert.ok(events.some((event) => event.status === 'conflict'));
});

test('localStorage unavailable still allows backend persistence through memory cache', async () => {
  const remote = remoteStore();
  const browser = createPersistenceClient({
    storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } }, fetcher: remote.fetcher
  });
  browser.write('notes', [note()]);
  await browser.sync();
  assert.deepEqual(remote.collections.get('notes').data, [note()]);
});

test('shutdown aborts active orchestrator timers and rejects pending HITL', { timeout: 3000 }, async () => {
  const orchestrator = new Orchestrator();
  orchestrator.execute = async function (task) { await this.sleep(60000); task.state = 'COMPLETED'; };
  const task = orchestrator.submitTask('shutdown test');
  let decision;
  orchestrator.approvals.set('pending', { status: 'PENDING', resolve: (value) => { decision = value; } });
  await orchestrator.shutdown();
  assert.equal(task.state, 'CANCELLED');
  assert.equal(decision, 'reject');
  assert.equal(orchestrator.running.size, 0);
  assert.throws(() => orchestrator.submitTask('after close'));
});

test('writes during an in-flight sync are rebased without losing concurrent remote additions', async () => {
  const remote = remoteStore();
  let entered;
  let release;
  const started = new Promise((resolve) => { entered = resolve; });
  const wait = new Promise((resolve) => { release = resolve; });
  let block = false;
  const browser = createPersistenceClient({ storage: memoryStorage(), fetcher: async (url, options) => {
    if (block && options.method === 'PUT' && url.endsWith('/notes')) {
      block = false;
      entered();
      await wait;
    }
    return remote.fetcher(url, options);
  } });
  await browser.sync();
  browser.write('notes', [note('local')]);
  remote.collections.set('notes', { revision: 1, data: [note('remote')] });
  block = true;
  const syncing = browser.sync();
  await started;
  browser.write('notes', [note('local', 'new edit')]);
  release();
  await syncing;
  await browser.sync();
  assert.deepEqual(new Set(remote.collections.get('notes').data.map((item) => item.id)), new Set(['local', 'remote']));
  assert.equal(remote.collections.get('notes').data.find((item) => item.id === 'local').content, 'new edit');
});

test('deep health dependency probes are read-only, bounded and cached', async () => {
  let calls = 0;
  const check = createDependencyChecks({ providers: { ollamaUrl: 'http://localhost:11434/v1/chat/completions' } }, async (url, options) => {
    calls += 1;
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.method, undefined);
    return { ok: !url.includes('binance'), status: url.includes('binance') ? 451 : 200 };
  });
  const result = await check();
  assert.equal(result.services.market.status, 'unavailable');
  assert.equal(result.services.ollama.status, 'ok');
  await check();
  assert.equal(calls, 4);
});

test('real orchestrator completes the HITL pipeline with deterministic LLM transport', { timeout: 5000 }, async () => {
  const llmEngine = new LlmEngine({ settings: { providers: { openai: 'test-only' } }, fetcher: async () => Response.json({ choices: [{ message: { content: 'Evidence-based test deliverable' } }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } }) });
  llmEngine.configure({ provider: 'openai', modelName: 'test-model', autoFailover: false, rpm: 1000 });
  const orchestrator = new Orchestrator({ llmEngine });
  const unsubscribe = telemetryBus.subscribe((event) => {
    if (event.event_type === 'HITL_INTERRUPT') orchestrator.resolveHitl(event.approval_id, 'approve');
  });
  try {
    const task = orchestrator.submitTask('[TEAM:TRADE] deterministic test');
    await Promise.all([...orchestrator.running]);
    assert.equal(task.state, 'COMPLETED');
    assert.equal(task.progress, 100);
  } finally {
    unsubscribe();
    await orchestrator.shutdown();
  }
});

test('standalone backend exits gracefully through local IPC and its port is reusable', { timeout: 15000 }, async (t) => {
  const root = await directory();
  const reserve = createServer();
  await new Promise((resolve) => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  const child = fork(fileURLToPath(new URL('../src/server.js', import.meta.url)), [], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', VAULT_DIR: root, MAOC_STORAGE_DRIVER: 'atomic-json' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  child.stderr.resume();
  let logs = '';
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      logs += chunk.toString();
      if (logs.includes('server.ready')) resolve();
    });
    child.once('error', reject);
    child.once('exit', (code) => { if (!logs.includes('server.ready')) reject(new Error(`backend exited before startup: ${code}`)); });
  });
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
  const exited = once(child, 'exit');
  child.send({ type: 'SHUTDOWN' });
  assert.equal((await exited)[0], 0);
  assert.match(logs, /server.shutdown_completed/);
  const rebound = createServer();
  await new Promise((resolve, reject) => rebound.once('error', reject).listen(port, '127.0.0.1', resolve));
  await new Promise((resolve) => rebound.close(resolve));
  const storage = await new StorageEngine(root).init();
  await storage.close();
});
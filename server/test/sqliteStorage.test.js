import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { StorageEngine } from '../src/storageEngine.js';
import { SqliteStorageEngine } from '../src/sqliteStorageEngine.js';
import { COLLECTIONS } from '../src/validation.js';
import { createApplication } from '../src/server.js';
import { createPersistenceClient } from '../../src/lib/persistenceClient.js';

const directory = () => mkdtemp(join(tmpdir(), 'maoc-sqlite-test-'));
const note = (id = 'note-1', content = 'ภาษาไทย [[MEMO]]') => ({ id, title: 'Research', content, tags: ['#research'], links: ['[[MEMO]]'] });
const values = {
  notes: [note()],
  deliverables: { tech: [{ id: 'report-1', title: 'Report', paragraphs: ['ภาษาไทย'], artifactCode: '{"ok":true}' }] },
  agentOverrides: { ARIA: { autonomyLevel: 80, systemPrompt: 'Route tasks' } },
  savedCommands: [{ id: 'command-1', agentId: 'BYTE', text: 'Inspect source' }],
  chats: { tech: [{ id: 'chat-1', role: 'user', text: 'Hello' }] }
};

test('SQLite preserves all five collection contracts, safe projections and durable revisions after restart', async (t) => {
  const root = await directory();
  let storage = await new SqliteStorageEngine(root).init();
  t.after(() => storage.close());
  assert.equal((await storage.health()).driver, 'sqlite');
  for (const name of COLLECTIONS) {
    const saved = await storage.put(name, values[name], 0);
    assert.equal(saved.revision, 1);
    assert.equal(saved.projectionStatus, 'ok');
    saved.data = null;
    assert.deepEqual(storage.get(name).data, values[name]);
  }
  const files = await readdir(join(root, 'notes'));
  assert.match(files[0], /^[a-f0-9]{24}\.md$/);
  assert.match(await readFile(join(root, 'notes', files[0]), 'utf8'), /ภาษาไทย/);
  assert.equal((await readdir(join(root, 'deliverables', 'tech'))).length, 1);
  const expected = COLLECTIONS.map((name) => storage.get(name));
  await storage.close();
  storage = await new SqliteStorageEngine(root).init();
  assert.deepEqual(COLLECTIONS.map((name) => storage.get(name)), expected);
  assert.equal((await storage.health()).status, 'ok');
});

test('SQLite imports JSON only explicitly, preserves exact envelopes and leaves source bytes untouched', async (t) => {
  const root = await directory();
  const legacy = await new StorageEngine(root).init();
  for (const name of COLLECTIONS) await legacy.put(name, values[name], 0);
  await legacy.put('notes', [note('updated')], 1);
  const expected = COLLECTIONS.map((name) => legacy.get(name));
  await legacy.close();
  const paths = COLLECTIONS.map((name) => join(root, '.maoc', 'state', `${name}.json`));
  const bytes = await Promise.all(paths.map((path) => readFile(path)));
  await assert.rejects(new SqliteStorageEngine(root).init(), /explicit SQLite import/);
  assert.ok(!(await readdir(join(root, '.maoc', 'state'))).includes('maoc.sqlite'));
  const storage = await new SqliteStorageEngine(root, { importJson: true }).init();
  t.after(() => storage.close());
  assert.deepEqual(COLLECTIONS.map((name) => storage.get(name)), expected);
  await storage.put('notes', [note('sqlite-only')], 2);
  assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), bytes);
  await storage.close();
  await assert.rejects(new StorageEngine(root).init(), /Vault uses SQLite/);
});

test('SQLite startup rejects a corrupt JSON import before creating a database', async () => {
  const root = await directory();
  const legacy = await new StorageEngine(root).init();
  await legacy.put('notes', [note()], 0);
  await legacy.close();
  const path = join(root, '.maoc', 'state', 'notes.json');
  await writeFile(path, '{broken');
  await assert.rejects(new SqliteStorageEngine(root, { importJson: true }).init());
  assert.equal(await readFile(path, 'utf8'), '{broken');
  assert.ok(!(await readdir(join(root, '.maoc', 'state'))).includes('maoc.sqlite'));
  assert.ok(!(await readdir(join(root, '.maoc'))).includes('writer.lock'));
});

test('SQLite validates import metadata before creation and reopens without reimporting stale JSON', async (t) => {
  const root = await directory();
  const legacy = await new StorageEngine(root).init();
  await legacy.put('notes', [note()], 0);
  await legacy.close();
  const path = join(root, '.maoc', 'state', 'notes.json');
  const value = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...value, updatedAt: 'invalid date' }));
  await assert.rejects(new SqliteStorageEngine(root, { importJson: true }).init(), /Invalid SQLite collection envelope/);
  assert.ok(!(await readdir(join(root, '.maoc', 'state'))).includes('maoc.sqlite'));
  await writeFile(path, JSON.stringify(value));
  let storage = await new SqliteStorageEngine(root, { importJson: true }).init();
  t.after(() => storage.close());
  await storage.put('notes', [note('database-wins')], 1);
  await storage.close();
  await writeFile(path, '{stale broken source');
  storage = await new SqliteStorageEngine(root, { importJson: true }).init();
  assert.deepEqual(storage.get('notes').data, [note('database-wins')]);
  assert.equal(storage.get('notes').revision, 2);
});

test('SQLite serializes concurrent writes and rejects stale revisions or malformed data', async (t) => {
  const storage = await new SqliteStorageEngine(await directory()).init();
  t.after(() => storage.close());
  const results = await Promise.allSettled([storage.put('notes', [note('a')], 0), storage.put('notes', [note('b')], 0)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.status, 409);
  assert.throws(() => storage.put('notes', [note(), note()], 1), /duplicate/);
  assert.throws(() => storage.get('unknown'), { status: 404 });
  assert.equal(storage.get('notes').revision, 1);
});

test('SQLite shares the Vault writer lock with JSON and releases it on close', async () => {
  const root = await directory();
  const storage = await new SqliteStorageEngine(root).init();
  await assert.rejects(new SqliteStorageEngine(root).init(), /active writer/);
  await assert.rejects(new StorageEngine(root).init(), /active writer/);
  await storage.close();
  const replacement = await new SqliteStorageEngine(root).init();
  await replacement.close();
});

test('SQLite startup never resets corrupt databases or silently falls back to JSON', async () => {
  const root = await directory();
  const storage = await new SqliteStorageEngine(root).init();
  await storage.close();
  await writeFile(storage.databasePath, 'not a sqlite database');
  await assert.rejects(new SqliteStorageEngine(root, { importJson: true }).init());
  assert.equal(await readFile(storage.databasePath, 'utf8'), 'not a sqlite database');
  await assert.rejects(new StorageEngine(root).init(), /Vault uses SQLite/);
  assert.ok(!(await readdir(join(root, '.maoc'))).includes('writer.lock'));
});

test('SQLite driver marker prevents recreating a missing database', async () => {
  const root = await directory();
  const storage = await new SqliteStorageEngine(root).init();
  await storage.close();
  await unlink(storage.databasePath);
  await assert.rejects(new SqliteStorageEngine(root, { importJson: true }).init(), /database is missing/);
  await assert.rejects(new StorageEngine(root).init(), /Vault uses SQLite/);
});

test('SQLite commit failure leaves cached state and durable data unchanged', async (t) => {
  const root = await directory();
  let storage = await new SqliteStorageEngine(root).init();
  t.after(() => storage.close());
  await storage.put('notes', [note()], 0);
  storage.database.exec("CREATE TRIGGER deny_notes BEFORE UPDATE ON collections WHEN NEW.name = 'notes' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
  await assert.rejects(storage.put('notes', [note('failed')], 1), /injected failure/);
  assert.deepEqual(storage.get('notes').data, [note()]);
  assert.equal(storage.get('notes').revision, 1);
  storage.database.exec('DROP TRIGGER deny_notes;');
  await storage.close();
  storage = await new SqliteStorageEngine(root).init();
  assert.deepEqual(storage.get('notes').data, [note()]);
});

test('SQLite retains committed data when Markdown projection fails and recovers on restart', async (t) => {
  const root = await directory();
  let storage = await new SqliteStorageEngine(root).init();
  t.after(() => storage.close());
  storage.project = async () => { throw new Error('projection failure'); };
  const saved = await storage.put('notes', [note()], 0);
  assert.equal(saved.revision, 1);
  assert.equal(saved.projectionStatus, 'degraded');
  assert.equal((await storage.health()).status, 'degraded');
  await storage.close();
  storage = await new SqliteStorageEngine(root).init();
  assert.deepEqual(storage.get('notes').data, [note()]);
  assert.equal((await storage.health()).status, 'ok');
  await storage.close();
  await assert.rejects(storage.put('notes', [], 1), { status: 503 });
  assert.equal((await storage.health()).status, 'error');
});

test('SQLite validates schema identity and incomplete databases without reimport', async () => {
  for (const command of ['PRAGMA user_version = 99', "DELETE FROM collections WHERE name = 'notes'"]) {
    const root = await directory();
    const storage = await new SqliteStorageEngine(root).init();
    storage.database.exec(command);
    await storage.close();
    const before = await readFile(storage.databasePath);
    await assert.rejects(new SqliteStorageEngine(root, { importJson: true }).init());
    assert.deepEqual(await readFile(storage.databasePath), before);
  }
});

test('SQLite REST, browser offline sync, WebSocket and separate server stores retain existing contracts', { timeout: 15000 }, async (t) => {
  const root = await directory();
  let app = await createApplication({ vaultDir: root, storageDriver: 'sqlite', schedulerAutoStart: false });
  t.after(() => app.close());
  await app.listen(0);
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const post = (path, body, method = 'POST') => fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await (await fetch(`${baseUrl}/api/health`)).json()).checks.storage.driver, 'sqlite');
  assert.equal((await post('/api/storage/notes', { revision: 0, data: [note()] }, 'PUT')).status, 200);
  assert.equal((await post('/api/storage/notes', { revision: 0, data: [] }, 'PUT')).status, 409);
  assert.equal((await post('/api/storage/notes', { revision: 1, data: {} }, 'PUT')).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/storage/performance`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/tasks`, { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
  const memory = new Map();
  let offline = false;
  const browser = createPersistenceClient({
    storage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) },
    baseUrl, fetcher: (...args) => { if (offline) throw new Error('offline'); return fetch(...args); }
  });
  await browser.sync();
  assert.deepEqual(browser.read('notes', []), [note()]);
  offline = true;
  browser.write('notes', [note('offline')]);
  await browser.sync();
  assert.equal(browser.inspect().notes.status, 'offline');
  offline = false;
  await browser.sync();
  assert.equal(browser.inspect().notes.dirty, false);
  assert.deepEqual(app.storage.get('notes').data, [note('offline')]);
  const template = await app.templates.create({ name: 'SQLite preset', description: 'Read {{topic}}', workflow: { nodes: [{ id: 'work', agent: 'BYTE', dependsOn: [] }] } });
  const schedule = await app.scheduler.create({ name: 'Paused SQLite schedule', description: 'Read source', recurrence: { kind: 'interval', minutes: 5 }, maxRuns: 2 });
  await app.scheduler.action(schedule.id, { action: 'resume' });
  assert.equal(JSON.parse(await readFile(join(app.storage.stateDir, 'taskTemplates.json'), 'utf8')).templates.length, 1);
  assert.equal(app.orchestrator.listTasks().length, 0);
  const socket = new WebSocket(`${baseUrl.replace('http:', 'ws:')}/ws`);
  t.after(() => socket.terminate());
  const snapshot = once(socket, 'message');
  await once(socket, 'open');
  assert.equal(JSON.parse((await snapshot)[0]).type, 'SNAPSHOT');
  socket.close(); await once(socket, 'close');
  await app.close();
  app = await createApplication({ vaultDir: root, storageDriver: 'sqlite', schedulerAutoStart: false });
  assert.deepEqual(app.storage.get('notes').data, [note('offline')]);
  assert.equal(app.templates.list()[0].id, template.id);
  assert.equal(app.scheduler.list().length, 1);
  assert.equal(app.scheduler.list()[0].state, 'PAUSED');
  assert.equal(app.scheduler.list()[0].runs, 0);
  assert.equal(app.orchestrator.listTasks().length, 0);
  await assert.rejects(createApplication({ vaultDir: await directory(), storageDriver: 'unknown' }), { status: 400 });
});

test('SQLite rollback rehearsal exports current envelopes to a separate JSON Vault without stale data', async (t) => {
  const storage = await new SqliteStorageEngine(await directory()).init();
  t.after(() => storage.close());
  for (const name of COLLECTIONS) await storage.put(name, values[name], 0);
  await storage.put('notes', [note('latest')], 1);
  const exported = COLLECTIONS.map((name) => storage.get(name));
  const target = await directory();
  const json = await new StorageEngine(target).init();
  await json.close();
  for (let i = 0; i < COLLECTIONS.length; i += 1) {
    await writeFile(join(target, '.maoc', 'state', `${COLLECTIONS[i]}.json`), `${JSON.stringify(exported[i])}\n`, { flag: 'wx' });
  }
  const restored = await new StorageEngine(target).init();
  t.after(() => restored.close());
  assert.deepEqual(COLLECTIONS.map((name) => restored.get(name)), exported);
  assert.deepEqual(restored.get('notes').data, [note('latest')]);
});
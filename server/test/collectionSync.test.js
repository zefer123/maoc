import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createApplication } from '../src/server.js';
import { storageSettings } from '../src/storageSettings.js';
import { telemetryBus } from '../src/eventBus.js';
import { ToolExecutor } from '../src/toolExecutor.js';
import { createPersistenceClient, PERSISTENCE_KEYS } from '../../src/lib/persistenceClient.js';
import { createTelemetryClient } from '../../src/lib/telemetryClient.js';

const testNote = { id: 'fixture-note', title: 'Shared note', content: 'Test data only', links: [], tags: [] };
const collections = Object.keys(PERSISTENCE_KEYS);
const waitFor = async (condition, message) => {
  const until = Date.now() + 2500;
  while (!condition()) {
    assert.ok(Date.now() < until, message);
    await delay(15);
  }
};

test('collection realtime is opt-in and rejects invalid launch settings', () => {
  assert.equal(storageSettings({}).collectionRealtime, false);
  assert.equal(storageSettings({ MAOC_COLLECTION_REALTIME: 'false' }).collectionRealtime, false);
  assert.equal(storageSettings({ MAOC_COLLECTION_REALTIME: 'true' }).collectionRealtime, true);
  assert.throws(() => storageSettings({ MAOC_COLLECTION_REALTIME: 'on' }), /MAOC_COLLECTION_REALTIME/);
});

for (const storageDriver of ['atomic-json', 'sqlite']) {
  test(`${storageDriver}: restarting in polling-only mode preserves the latest committed revision`, { timeout: 10000 }, async () => {
    const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-collection-rollback-'));
    let app;
    try {
      app = await createApplication({ vaultDir, storageDriver, collectionRealtime: true, schedulerAutoStart: false });
      const { port } = await app.listen(0, '127.0.0.1');
      const endpoint = `http://127.0.0.1:${port}/api/storage/notes`;
      const saved = await fetch(endpoint, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision: 0, data: [testNote] })
      });
      assert.equal(saved.status, 200);
      const latest = await (await fetch(endpoint)).json();
      assert.equal(latest.revision, 1);
      assert.deepEqual(latest.data, [testNote]);
      await app.close();
      app = await createApplication({ vaultDir, storageDriver, collectionRealtime: false, schedulerAutoStart: false });
      const restarted = await app.listen(0, '127.0.0.1');
      const actual = await fetch(`http://127.0.0.1:${restarted.port}/api/storage/notes`);
      assert.equal(actual.status, 200);
      assert.deepEqual(await actual.json(), latest);
    } finally {
      await app?.close();
    }
  });
  for (const collectionRealtime of [false, true]) {
    test(`${storageDriver}: collection realtime ${collectionRealtime ? 'on' : 'off'} preserves REST writes and task telemetry`, { timeout: 10000 }, async () => {
      const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-collection-rollout-'));
      const app = await createApplication({ vaultDir, storageDriver, collectionRealtime, schedulerAutoStart: false });
      let socket;
      try {
        const { port } = await app.listen(0, '127.0.0.1');
        const endpoint = `http://127.0.0.1:${port}/api/storage/notes`;
        const notices = [];
        let snapshot, event;
        let ready = 0;
        socket = createTelemetryClient(`ws://127.0.0.1:${port}/ws`, {
          onSnapshot(message) { snapshot = message; },
          onCollectionReady() { ready++; },
          onCollectionChanged(notice) { notices.push(notice); },
          onEvent(message) { event = message; }
        });
        await waitFor(() => Boolean(snapshot), 'Task snapshot did not arrive');
        assert.equal(snapshot.collection_realtime, collectionRealtime);
        assert.equal(ready, Number(collectionRealtime));
        assert.ok(Array.isArray(snapshot.tasks));
        const response = await fetch(endpoint, {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ revision: 0, data: [testNote] })
        });
        assert.equal(response.status, 200);
        const { projectionStatus, ...saved } = await response.json();
        assert.equal(projectionStatus, 'ok');
        assert.equal(saved.revision, 1);
        assert.deepEqual(await (await fetch(endpoint)).json(), saved);
        // WebSocket order makes this event a barrier for any earlier commit notice.
        const marker = telemetryBus.publish({ event_type: 'TASK_PROGRESS', source_agent: 'fixture' });
        await waitFor(() => event?.event_id === marker.event_id, 'Task telemetry did not arrive');
        assert.deepEqual(notices, collectionRealtime ? [{ type: 'COLLECTION_CHANGED', collection: 'notes', revision: 1 }] : []);
      } finally {
        socket?.close();
        await app.close();
      }
    });
  }
}

for (const storageDriver of ['atomic-json', 'sqlite']) {
  test(`${storageDriver}: concurrent drafts merge when independent and require an explicit choice when conflicting`, { timeout: 15000 }, async () => {
    const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-dirty-conflict-'));
    const app = await createApplication({ vaultDir, storageDriver, collectionRealtime: true, schedulerAutoStart: false });
    let client, socket, releasePut;
    try {
      const { port } = await app.listen(0, '127.0.0.1');
      const baseUrl = `http://127.0.0.1:${port}`;
      const envelope = async () => (await fetch(`${baseUrl}/api/storage/notes`)).json();
      const other = createPersistenceClient({ baseUrl });
      const secondNote = { ...testNote, id: 'other-note', title: 'Another note' };
      let blockPut = false;
      let writes = 0;
      client = createPersistenceClient({ baseUrl, async fetcher(url, options) {
        if (options.method === 'PUT' && url.endsWith('/notes')) {
          writes++;
          if (blockPut) {
            blockPut = false;
            await new Promise(resolve => { releasePut = resolve; });
          }
        }
        return fetch(url, options);
      } });
      const commit = async data => { other.write('notes', data); await other.flush(); };
      await commit([testNote, secondNote]);
      await client.sync();
      client.start();
      await client.sync();
      let snapshots = 0;
      let lastNotice = 0;
      const connect = () => createTelemetryClient(`ws://127.0.0.1:${port}/ws`, {
        onCollectionReady: client.reconcile,
        onSnapshot() { snapshots++; },
        onCollectionChanged(notice) { lastNotice = notice.revision; client.invalidate(notice); }
      });
      socket = connect();
      await waitFor(() => snapshots === 1, 'First socket did not connect');
      await client.flush();

      // Leave the local draft pending without letting a debounce race the fixture.
      client.stop();
      const own = { ...testNote, content: 'Local edit' };
      const independent = { ...secondNote, content: 'Remote edit on another note' };
      client.write('notes', [own, secondNote]);
      await commit([testNote, independent]);
      await waitFor(() => lastNotice === 2, 'Independent edit notice missing');
      blockPut = true;
      const pendingSave = client.flush();
      await waitFor(() => Boolean(releasePut), 'Merge write did not start');
      const followUp = { ...own, content: 'Local edit made while saving' };
      client.write('notes', [followUp, secondNote]);
      releasePut();
      await pendingSave;
      assert.equal(client.inspect().notes.dirty, true);
      assert.deepEqual(client.read('notes', []), [followUp, independent]);
      await client.flush();
      const merged = await envelope();
      assert.deepEqual(merged.data, [followUp, independent]);
      await waitFor(() => lastNotice === merged.revision, 'Own-write notice missing');
      assert.equal(writes, 2);
      assert.equal(client.inspect().notes.dirty, false);

      // Disconnect one clean copy, then keep a draft while the other changes the same field.
      await other.sync();
      socket.close();
      client.write('notes', [{ ...followUp, content: 'Keep my draft' }, independent]);
      const remoteEdit = { ...followUp, content: 'Conflicting remote edit' };
      await commit([remoteEdit, independent]);
      const conflicting = await envelope();
      // Start while the conflicting draft is present. Neither reconnect nor the full sync may upload it.
      client.start();
      socket = connect();
      await waitFor(() => snapshots === 2 && client.inspect().notes.status === 'conflict', 'Conflict not reported after reconnect');
      assert.equal(writes, 2);
      assert.equal(client.inspect().notes.dirty, true);
      assert.equal(client.read('notes', [])[0].content, 'Keep my draft');
      assert.deepEqual(await envelope(), conflicting);
      await client.resolveConflict('notes', 'remote');
      assert.deepEqual(client.read('notes', []), conflicting.data);
      assert.equal(writes, 2);

      client.stop();
      client.write('notes', [{ ...remoteEdit, content: 'Edited after remote deletion' }, independent]);
      await commit([independent]);
      const deleted = await envelope();
      await client.flush();
      assert.equal(client.inspect().notes.status, 'conflict');
      assert.equal(client.inspect().notes.dirty, true);
      assert.deepEqual(await envelope(), deleted);
      await client.resolveConflict('notes', 'local');
      assert.equal(writes, 3);
      assert.equal(client.inspect().notes.dirty, false);
      assert.deepEqual((await envelope()).data, [{ ...remoteEdit, content: 'Edited after remote deletion' }, independent]);
    } finally {
      releasePut?.();
      socket?.close();
      client?.stop();
      await app.close();
    }
  });
}

for (const storageDriver of ['atomic-json', 'sqlite']) {
  test(`${storageDriver}: identical pending edits settle without a second commit or echo`, { timeout: 10000 }, async () => {
    const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-dirty-sync-'));
    const app = await createApplication({ vaultDir, storageDriver, collectionRealtime: true, schedulerAutoStart: false });
    let socket;
    let client;
    try {
      const { port } = await app.listen(0, '127.0.0.1');
      const baseUrl = `http://127.0.0.1:${port}`;
      const other = createPersistenceClient({ baseUrl });
      let writes = 0;
      client = createPersistenceClient({ baseUrl, fetcher(url, options) {
        if (options.method === 'PUT') writes++;
        return fetch(url, options);
      } });
      other.write('notes', [testNote]);
      await other.flush();
      client.start();
      await waitFor(() => client.inspect().chats.status === 'ready', 'Initial sync did not settle');
      let connected = false;
      let revision = 0;
      socket = createTelemetryClient(`ws://127.0.0.1:${port}/ws`, {
        onSnapshot() { connected = true; },
        onCollectionChanged(notice) { revision = notice.revision; client.invalidate(notice); }
      });
      await waitFor(() => connected, 'WebSocket snapshot missing');
      const edited = [{ ...testNote, content: 'Same edit in both tabs' }];
      client.write('notes', edited);
      other.write('notes', edited);
      await other.flush();
      await waitFor(() => revision === 2, 'First commit notice missing');
      assert.equal(client.inspect().notes.dirty, true);
      await client.flush();
      assert.equal(writes, 0, 'An already committed edit should not be uploaded again');
      assert.equal(client.inspect().notes.dirty, false);
      assert.equal(client.inspect().notes.revision, 2);
      assert.deepEqual(client.read('notes', []), edited);
    } finally {
      socket?.close();
      client?.stop();
      await app.close();
    }
  });
}

for (const storageDriver of ['atomic-json', 'sqlite']) {
  test(`${storageDriver}: opening a socket after a missed update reconciles all collections with GET only`, { timeout: 10000 }, async () => {
    const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-collection-reconnect-'));
    const app = await createApplication({ vaultDir, storageDriver, collectionRealtime: true, schedulerAutoStart: false });
    let socket;
    let client;
    try {
      const { port } = await app.listen(0, '127.0.0.1');
      const baseUrl = `http://127.0.0.1:${port}`;
      const requests = [];
      client = createPersistenceClient({ baseUrl, fetcher(url, options) {
        requests.push([options.method, new URL(url).pathname.split('/').at(-1)]);
        return fetch(url, options);
      } });
      let snapshots = 0;
      const connect = () => createTelemetryClient(`ws://127.0.0.1:${port}/ws`, {
        onCollectionReady: client.reconcile,
        onSnapshot() { snapshots++; },
        onCollectionChanged: client.invalidate
      });
      client.start();
      await waitFor(() => client.inspect().chats.status === 'ready', 'Initial poll did not settle');
      socket = connect();
      await waitFor(() => snapshots === 1, 'Initial socket did not connect');
      await waitFor(() => requests.length >= 10, 'Initial connection reconciliation did not read all five collections');
      socket.close();
      const response = await fetch(`${baseUrl}/api/storage/notes`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision: 0, data: [testNote] })
      });
      assert.equal(response.status, 200);
      assert.equal(client.inspect().notes.revision, 0);
      const offset = requests.length;
      socket = connect();
      await waitFor(() => client.inspect().notes.revision === 1 && requests.length >= offset + 5, 'Reconnected client did not recover before polling');
      assert.deepEqual(client.read('notes', []), [testNote]);
      assert.deepEqual(requests.slice(offset), collections.map(name => ['GET', name]));
    } finally {
      socket?.close();
      client?.stop();
      await app.close();
    }
  });

  test(`${storageDriver}: connected clean client reads the saved revision without polling`, { timeout: 10000 }, async () => {
    const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-collection-sync-'));
    const app = await createApplication({ vaultDir, storageDriver, collectionRealtime: true, schedulerAutoStart: false });
    let socket;
    let sender;
    let receiver;
    try {
      const { port } = await app.listen(0, '127.0.0.1');
      const baseUrl = `http://127.0.0.1:${port}`;
      const receiverRequests = [];
      sender = createPersistenceClient({ baseUrl });
      receiver = createPersistenceClient({ baseUrl, fetcher(url, options) {
        receiverRequests.push({ method: options.method, path: new URL(url).pathname });
        return fetch(url, options);
      } });
      await Promise.all([sender.sync(), receiver.sync()]);
      receiver.start();
      await waitFor(() => receiverRequests.length >= 10, 'Initial scheduled sync did not run');
      await receiver.sync();
      receiverRequests.length = 0;
      const notices = [];
      let connected = false;
      socket = createTelemetryClient(`ws://127.0.0.1:${port}/ws`, {
        onSnapshot() { connected = true; },
        onCollectionChanged(notice) {
          notices.push(notice);
          receiver.invalidate(notice);
        }
      });
      await waitFor(() => connected, 'WebSocket snapshot not received');

      sender.write('notes', [testNote]);
      await sender.flush();
      await waitFor(() => receiver.inspect().notes.revision === 1, 'Receiver did not fetch the pushed revision before polling');

      assert.deepEqual(notices, [{ type: 'COLLECTION_CHANGED', collection: 'notes', revision: 1 }]);
      assert.deepEqual(receiver.read('notes', []), [testNote]);
      assert.deepEqual(receiverRequests, [{ method: 'GET', path: '/api/storage/notes' }]);
    } finally {
      socket?.close();
      sender?.stop();
      receiver?.stop();
      await app.close();
    }
  });
}

test('periodic polling recovers a commit without a WebSocket', { timeout: 25000 }, async () => {
  const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-collection-poll-'));
  const app = await createApplication({ vaultDir, schedulerAutoStart: false });
  let client;
  try {
    const { port } = await app.listen(0, '127.0.0.1');
    const baseUrl = `http://127.0.0.1:${port}`;
    let resolveUpdate;
    const updated = new Promise(resolve => { resolveUpdate = resolve; });
    client = createPersistenceClient({ baseUrl, notify(event) {
      if (event.collection === 'notes' && event.status === 'hydrated') resolveUpdate();
    } });
    client.start();
    await waitFor(() => client.inspect().chats.status === 'ready', 'Initial sync did not settle');
    const response = await fetch(`${baseUrl}/api/storage/notes`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: 0, data: [testNote] })
    });
    assert.equal(response.status, 200);
    assert.equal(client.inspect().notes.revision, 0);
    await updated;
    assert.equal(client.inspect().notes.revision, 1);
    assert.deepEqual(client.read('notes', []), [testNote]);
  } finally {
    client?.stop();
    await app.close();
  }
});

test('a full sync requested during a notification read still syncs the other collections', async () => {
  const requests = [];
  let release;
  let revision = 0;
  const client = createPersistenceClient({ async fetcher(url) {
    const name = url.split('/').at(-1);
    requests.push(name);
    if (release === undefined && name === 'notes' && revision === 1) {
      await new Promise(resolve => { release = resolve; });
    }
    return Response.json({ revision: name === 'notes' ? revision : 0, data: name === 'notes' || name === 'savedCommands' ? [] : {} });
  } });
  try {
    await client.sync();
    client.start();
    await client.sync();
    requests.length = 0;
    revision = 1;
    client.invalidate({ collection: 'notes', revision });
    const wholeSync = client.sync();
    assert.equal(typeof release, 'function');
    release();
    await wholeSync;
    assert.ok(requests.includes('deliverables'), 'full sync must not reuse a notes-only read');
  } finally { client.stop(); release?.(); }
});

test('notices arriving during a slow read coalesce without regressing the clean revision', async () => {
  let revision = 0;
  let noteReads = 0;
  let release;
  const client = createPersistenceClient({ async fetcher(url, options) {
    assert.equal(options.method, 'GET');
    const name = url.split('/').at(-1);
    if (name !== 'notes') return Response.json({ revision: 0, data: name === 'savedCommands' ? [] : {} });
    const snapshot = revision;
    noteReads++;
    if (snapshot === 1 && !release) await new Promise(resolve => { release = resolve; });
    return Response.json({ revision: snapshot, data: snapshot ? [{ ...testNote, content: `revision ${snapshot}` }] : [] });
  } });
  try {
    client.start();
    await waitFor(() => client.inspect().chats.status === 'ready', 'Initial sync did not settle');
    revision = 1;
    client.invalidate({ collection: 'notes', revision: 1 });
    assert.equal(typeof release, 'function');
    revision = 3;
    for (let i = 0; i < 100; i++) for (const value of [3, 1, 2, 3]) client.invalidate({ collection: 'notes', revision: value });
    release();
    await waitFor(() => client.inspect().notes.revision === 3, 'Latest revision was not fetched after the slow read');
    assert.equal(noteReads, 3, 'Expected one initial read, one slow read and one follow-up');
    revision = 2;
    client.invalidate({ collection: 'notes', revision: 2 });
    client.reconcile();
    await waitFor(() => noteReads === 4, 'Expected a reconnect read');
    await delay(15);
    assert.equal(client.inspect().notes.revision, 3);
    assert.equal(client.read('notes', [])[0].content, 'revision 3');
    assert.equal(noteReads, 4);
  } finally { client.stop(); release?.(); }
});

for (const storageDriver of ['atomic-json', 'sqlite']) {
  test(`${storageDriver}: broadcasts committed revisions only, including an archive with degraded projection`, { timeout: 10000 }, async () => {
    const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-collection-commit-'));
    const app = await createApplication({ vaultDir, storageDriver, collectionRealtime: true, schedulerAutoStart: false });
    let socket;
    try {
      const { port } = await app.listen(0, '127.0.0.1');
      const url = `http://127.0.0.1:${port}/api/storage`;
      const notices = [];
      const reads = [];
      let connected = false;
      socket = createTelemetryClient(`ws://127.0.0.1:${port}/ws`, {
        onSnapshot() { connected = true; },
        onCollectionChanged(notice) {
          notices.push(notice);
          reads.push(fetch(`${url}/${notice.collection}`).then(r => r.json()));
        }
      });
      await waitFor(() => connected, 'WebSocket snapshot not received');
      const put = (revision, data) => fetch(`${url}/notes`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision, data })
      });
      assert.equal((await put(0, [testNote])).status, 200);
      assert.equal((await put(1, {})).status, 400);
      assert.equal((await put(0, [])).status, 409);
      const persist = app.storage.persistCollection;
      app.storage.persistCollection = async () => { throw new Error('Fixture commit failure'); };
      try { assert.equal((await put(1, [])).status, 500); }
      finally { app.storage.persistCollection = persist; }
      app.storage.project = async () => { throw new Error('Fixture Markdown failure'); };
      const archive = await new ToolExecutor({ storage: app.storage }).archive({
        id: 'fixture', department: 'tech', description: 'Fixture archive', outputs: []
      });
      assert.equal(archive.projectionStatus, 'degraded');
      await waitFor(() => notices.some(x => x.collection === 'deliverables'), 'Archive revision was not broadcast');
      assert.deepEqual(notices, [
        { type: 'COLLECTION_CHANGED', collection: 'notes', revision: 1 },
        { type: 'COLLECTION_CHANGED', collection: 'deliverables', revision: 1 }
      ]);
      const [notes, deliverables] = await Promise.all(reads);
      assert.deepEqual(notes.data, [testNote]);
      assert.equal(notes.revision, 1);
      assert.equal(deliverables.revision, 1);
      assert.equal(deliverables.data.tech[0].id, 'task-fixture');
    } finally {
      socket?.close();
      await app.close();
    }
  });
}
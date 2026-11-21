import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../src/server.js';

const note = { id: 'fixture-note', title: 'Fixture note', content: 'Original data' };
const simulate = (code) => Object.assign(new Error('Private fixture path must not be returned'), { code });

const cases = [
  ['atomic-json', 'disk full (ENOSPC)', 507, 'STORAGE_FULL', (storage) => faultJson(storage, 'ENOSPC')],
  ['atomic-json', 'access denied (EACCES)', 503, 'STORAGE_NOT_WRITABLE', (storage) => faultJson(storage, 'EACCES')],
  ['sqlite', 'SQLite page limit reached', 507, 'STORAGE_FULL', (storage) => {
    const { page_count } = storage.database.prepare('PRAGMA page_count').get();
    const { max_page_count } = storage.database.prepare('PRAGMA max_page_count').get();
    storage.database.exec(`PRAGMA max_page_count = ${page_count}`);
    return () => storage.database.exec(`PRAGMA max_page_count = ${max_page_count}`);
  }],
  ['sqlite', 'SQLite query-only mode', 503, 'STORAGE_NOT_WRITABLE', (storage) => {
    storage.database.exec('PRAGMA query_only = ON');
    return () => storage.database.exec('PRAGMA query_only = OFF');
  }]
];

function faultJson(storage, code) {
  const original = storage.atomicWrite;
  storage.atomicWrite = function (path, contents) {
    if (path === join(this.stateDir, 'notes.json')) throw simulate(code);
    return original.call(this, path, contents);
  };
  return () => { storage.atomicWrite = original; };
}

for (const [storageDriver, cause, status, code, inject] of cases) {
  test(`${storageDriver}: ${cause} fails the write, preserves the revision and reports degradation`, { timeout: 10000 }, async () => {
    const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-storage-fault-'));
    const options = { vaultDir, storageDriver, schedulerAutoStart: false };
    const app = await createApplication(options);
    let reopened;
    try {
      const { port } = await app.listen(0, '127.0.0.1');
      const base = `http://127.0.0.1:${port}/api`;
      const get = (path) => fetch(base + path, { signal: AbortSignal.timeout(3000) });
      const put = (revision, data) => fetch(`${base}/storage/notes`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision, data }), signal: AbortSignal.timeout(3000)
      });
      assert.equal((await put(0, [note])).status, 200);
      const before = await (await get('/storage/notes')).json();
      const restore = inject(app.storage);
      const failed = await put(1, [{ ...note, content: 'x'.repeat(128 * 1024) }]);
      assert.equal(failed.status, status);
      const error = await failed.json();
      assert.equal(error.code, code);
      assert.ok(!JSON.stringify(error).includes('Private fixture path'));
      assert.deepEqual(await (await get('/storage/notes')).json(), before);
      const health = await get('/health?deep=false');
      assert.equal(health.status, 503);
      const { checks } = await health.json();
      assert.equal(checks.process.status, 'running');
      assert.equal(checks.backup.status, 'not_checked');
      assert.equal(checks.storage.status, 'degraded');
      assert.deepEqual(checks.storage.write_failures, { notes: code });
      restore();
      const recovered = await put(1, [{ ...note, content: 'Recovered' }]);
      assert.equal(recovered.status, 200);
      const { projectionStatus, ...committed } = await recovered.json();
      assert.equal(committed.revision, 2);
      assert.equal(projectionStatus, 'ok');
      const healthy = await get('/health?deep=false');
      assert.equal(healthy.status, 200);
      assert.deepEqual((await healthy.json()).checks.storage.write_failures, {});
      await app.close();
      reopened = await createApplication(options);
      const restarted = await reopened.listen(0, '127.0.0.1');
      const readback = await fetch(`http://127.0.0.1:${restarted.port}/api/storage/notes`, { signal: AbortSignal.timeout(3000) });
      assert.equal(readback.status, 200);
      assert.deepEqual(await readback.json(), committed);
    } finally {
      await app.close();
      await reopened?.close();
    }
  });
}
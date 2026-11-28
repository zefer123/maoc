import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../src/server.js';
import { backupVault, restoreVault, convertVault } from '../src/vaultMaintenance.js';

const data = { theme: 'realm-cyber', accent: '#ad95fe', tacticalGrid: true };
for (const storageDriver of ['atomic-json', 'sqlite']) {
  test(`${storageDriver}: HUD updates are revisioned, durable and broadcast without data`, { timeout: 12000 }, async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'maoc-hud-'));
    const vaultDir = join(root, 'vault');
    let app, ws;
    t.after(async () => { ws?.close(); await app?.close(); await rm(root, { recursive: true, force: true }); });
    app = await createApplication({ vaultDir, storageDriver, schedulerAutoStart: false });
    const { port } = await app.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${port}`;
    const url = `${base}/api/hud-preferences`;
    const initial = await fetch(url);
    assert.equal(initial.status, 200);
    assert.deepEqual(await initial.json(), { schemaVersion: 1, revision: 0, updatedAt: null, data: { theme: 'kali-cyber', accent: 'theme', tacticalGrid: false } });
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages = [];
    let ready, updated;
    const first = new Promise((resolve) => { ready = resolve; });
    const change = new Promise((resolve) => { updated = resolve; });
    ws.addEventListener('message', ({ data: raw }) => {
      const message = JSON.parse(raw); messages.push(message);
      if (message.type === 'SNAPSHOT') ready(message);
      if (message.type === 'HUD_PREFERENCES_UPDATED') updated(message);
    });
    assert.equal((await first).collection_realtime, false);
    const put = (body) => fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await put({ revision: 0, data: { ...data, apiKey: 'fixture-only' } })).status, 400);
    const saved = await put({ revision: 0, data });
    assert.equal(saved.status, 200);
    const envelope = await saved.json();
    assert.equal(envelope.revision, 1);
    assert.deepEqual(envelope.data, data);
    assert.deepEqual(await change, { type: 'HUD_PREFERENCES_UPDATED', revision: 1 });
    assert.equal((await put({ revision: 0, data })).status, 409);
    assert.equal((await fetch(`${base}/api/storage/hudPreferences`)).status, 404);
    assert.equal(messages.filter((message) => message.type === 'HUD_PREFERENCES_UPDATED').length, 1);
    await app.close(); app = null;
    const path = '.maoc/state/hud-preferences.json';
    const expected = await readFile(join(vaultDir, path));
    const backup = join(root, 'backup'), restored = join(root, 'restored'), converted = join(root, 'converted');
    const manifest = await backupVault(vaultDir, backup);
    assert.ok(manifest.inventory.files.find((file) => file.path === path)?.sha256);
    await restoreVault(backup, restored);
    const other = storageDriver === 'sqlite' ? 'atomic-json' : 'sqlite';
    await convertVault(restored, converted, other);
    assert.deepEqual(await readFile(join(converted, path)), expected);
    app = await createApplication({ vaultDir: converted, storageDriver: other, schedulerAutoStart: false });
    const address = await app.listen(0, '127.0.0.1');
    assert.deepEqual(await (await fetch(`http://127.0.0.1:${address.port}/api/hud-preferences`)).json(), envelope);
  });
}

test('malformed HUD state rejects startup without overwrite or a retained lock', async (t) => {
  const vaultDir = await mkdtemp(join(tmpdir(), 'maoc-hud-corrupt-'));
  t.after(() => rm(vaultDir, { recursive: true, force: true }));
  const state = join(vaultDir, '.maoc', 'state');
  await mkdir(state, { recursive: true });
  const file = join(state, 'hud-preferences.json');
  const corrupt = '{"schemaVersion":1,"revision":1,"updatedAt":null,"data":{"theme":"hack"}}';
  await writeFile(file, corrupt);
  await assert.rejects(async () => {
    const app = await createApplication({ vaultDir, schedulerAutoStart: false });
    await app.close();
  }, /HUD preferences/);
  assert.equal(await readFile(file, 'utf8'), corrupt);
  await assert.rejects(readFile(join(vaultDir, '.maoc', 'writer.lock')), { code: 'ENOENT' });
});
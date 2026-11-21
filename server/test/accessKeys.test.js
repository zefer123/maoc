import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get } from 'node:http';
import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createApplication } from '../src/server.js';
import { parseDashboardRoute, dashboardRouteHash } from '../../src/lib/dashboardRoute.js';

const adminKey = 'test_admin_only_not_a_real_credential_2026';
const vault = () => mkdtemp(join(tmpdir(), 'maoc-access-fixture-'));
const deadline = () => AbortSignal.timeout(4000);

async function start(t, settings = {}) {
  const vaultDir = settings.vaultDir || await vault();
  const app = await createApplication({ vaultDir, schedulerAutoStart: false, accessGate: true, adminKey, ...settings });
  t.after(() => app.close());
  const { port } = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${port}`;
  const call = (path, key, options = {}) => fetch(`${base}/api${path}`, {
    ...options, signal: deadline(), headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...options.headers }
  });
  const post = (path, key, data = {}) => call(path, key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const ws = (...args) => {
    const client = new WebSocket(base.replace('http:', 'ws:') + '/ws', ...args);
    t.after(() => { client.on('error', () => {}); client.terminate(); });
    return client;
  };
  return { app, base, call, post, ws, vaultDir };
}

test('admin issues, rotates and suspends keys; old HTTP/WS access is rejected and plaintext does not persist', async (t) => {
  const { call, post, ws, vaultDir } = await start(t);
  assert.deepEqual(await (await call('/access')).json(), { gateEnabled: true, role: null });
  assert.equal((await call('/storage/notes')).status, 401);
  assert.equal((await post('/admin/keys', adminKey, { label: 'Attempt', role: 'admin' })).status, 400);
  const issue = await post('/admin/keys', adminKey, { label: 'QA user', expiresAt: new Date(Date.now() + 3600000).toISOString() });
  assert.equal(issue.status, 201);
  const { key: { id }, activationKey: old } = await issue.json();
  assert.equal((await call('/storage/notes', old)).status, 200);
  assert.equal((await call('/admin/keys', old)).status, 403);
  assert.equal((await post(`/admin/keys/${id}/rekey`, old)).status, 403);
  assert.equal((await call('/llm/config', old, { method: 'PUT' })).status, 403);

  const client = ws('maoc-auth');
  const messages = [];
  client.on('message', (message) => messages.push(JSON.parse(message)));
  await once(client, 'open', { signal: deadline() });
  assert.deepEqual(messages, []);
  const snapshot = once(client, 'message', { signal: deadline() });
  client.send(JSON.stringify({ type: 'AUTH', key: old }));
  assert.equal(JSON.parse((await snapshot)[0]).type, 'SNAPSHOT');
  const listed = await (await call('/admin/keys', adminKey)).json();
  assert.equal(listed.keys[0].activeSessions, 1);
  assert.doesNotMatch(JSON.stringify(listed), /keyHash|activationKey/);
  assert.ok(listed.keys[0].lastUsedAt);

  const closed = once(client, 'close', { signal: deadline() });
  const rotate = await post(`/admin/keys/${id}/rekey`, adminKey);
  assert.equal(rotate.status, 200);
  const { activationKey: fresh, key } = await rotate.json();
  assert.notEqual(fresh, old);
  assert.equal(key.keyVersion, 2);
  const [code, reason] = await closed;
  assert.equal(code, 4401); assert.equal(reason.toString(), 'REKEYED');
  assert.equal((await call('/storage/notes', old)).status, 401);
  assert.equal((await call('/storage/notes', fresh)).status, 200);
  const rejectedSocket = ws({ headers: { Authorization: `Bearer ${old}` } });
  const [, rejectedUpgrade] = await once(rejectedSocket, 'unexpected-response', { signal: deadline() });
  assert.equal(rejectedUpgrade.statusCode, 401); rejectedUpgrade.resume();

  const direct = ws({ headers: { Authorization: `Bearer ${fresh}` } });
  assert.equal(JSON.parse((await once(direct, 'message', { signal: deadline() }))[0]).type, 'SNAPSHOT');
  const revoked = once(direct, 'close', { signal: deadline() });
  assert.equal((await post(`/admin/keys/${id}/revoke`, adminKey)).status, 200);
  const [revokedCode, revokedReason] = await revoked;
  assert.equal(revokedCode, 4401); assert.equal(revokedReason.toString(), 'REVOKED');
  assert.equal((await call('/tasks', fresh)).status, 401);
  assert.equal((await post(`/admin/keys/${id}/reactivate`, adminKey)).status, 200);
  assert.equal((await call('/tasks', fresh)).status, 200);
  const saved = await readFile(join(vaultDir, '.maoc', 'state', 'accessKeys.json'), 'utf8');
  assert.equal(saved.includes(old) || saved.includes(fresh) || saved.includes(adminKey), false);
  assert.match(JSON.parse(saved).keys[0].keyHash, /^[a-f0-9]{64}$/);
});

test('gate off keeps loopback owner behavior, but setting an admin secret never grants admin anonymously', async (t) => {
  const owner = await start(t, { accessGate: false, adminKey: '' });
  assert.deepEqual(await (await owner.call('/access')).json(), { gateEnabled: false, role: 'admin' });
  assert.equal((await owner.call('/admin/keys')).status, 200);
  const nonLocalStatus = await new Promise((resolve, reject) => {
    get(`${owner.base}/api/admin/keys`, { headers: { Host: 'not-local.example' }, signal: deadline() }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(nonLocalStatus, 403);
  const configured = await start(t, { accessGate: false });
  assert.equal((await configured.call('/admin/keys')).status, 403);
  assert.equal((await configured.call('/admin/keys', adminKey)).status, 200);
  assert.equal((await configured.call('/tasks')).status, 200);
});

test('gate refuses invalid startup, expiry and failed key writes; restart retains committed access only', async (t) => {
  const root = await vault();
  await assert.rejects(createApplication({ vaultDir: root, accessGate: true, adminKey: '' }), /MAOC_ADMIN_KEY/);
  await assert.rejects(access(join(root, '.maoc', 'writer.lock')), { code: 'ENOENT' });
  const initial = await start(t, { vaultDir: root, storageDriver: 'sqlite' });
  const expiry = new Date(Date.now() + 1000).toISOString();
  const { activationKey, key } = await (await initial.post('/admin/keys', adminKey, { label: 'Expiring', expiresAt: expiry })).json();
  await initial.app.close();
  const restarted = await start(t, { vaultDir: root, storageDriver: 'sqlite' });
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, Date.parse(expiry) - Date.now() + 10)));
  assert.equal((await restarted.call('/tasks', activationKey)).status, 401);
  assert.equal((await (await restarted.call('/admin/keys', adminKey)).json()).keys[0].status, 'EXPIRED');
  assert.equal((await restarted.post(`/admin/keys/${key.id}/reactivate`, adminKey)).status, 409);
  const write = restarted.app.storage.atomicWrite.bind(restarted.app.storage);
  restarted.app.storage.atomicWrite = (path, data) => path.endsWith('accessKeys.json') ? Promise.reject(new Error('fixture disk fault')) : write(path, data);
  assert.equal((await restarted.post(`/admin/keys/${key.id}/rekey`, adminKey, { expiresAt: null })).status, 503);
  assert.equal((await (await restarted.call('/admin/keys', adminKey)).json()).keys[0].keyVersion, 1);
});

test('admin hash route encodes only the Settings path', () => {
  const route = { section: 'settings', settingsTab: 'admin' };
  assert.deepEqual(parseDashboardRoute('#settings/admin'), route);
  assert.deepEqual(parseDashboardRoute(dashboardRouteHash({ ...route, key: 'not-in-the-link' })), route);
  assert.equal(dashboardRouteHash({ ...route, key: 'not-in-the-link' }), '#/settings/admin');
});
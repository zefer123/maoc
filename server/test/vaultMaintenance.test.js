import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, lstat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { fork, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createApplication } from '../src/server.js';
import { StorageEngine } from '../src/storageEngine.js';
import { SqliteStorageEngine } from '../src/sqliteStorageEngine.js';
import { backupVault, restoreVault, verifyBackup, convertVault, inventory } from '../src/vaultMaintenance.js';
import { storageSettings } from '../src/storageSettings.js';
import { COLLECTIONS } from '../src/validation.js';

const directory = () => mkdtemp(join(tmpdir(), 'maoc-vault-maintenance-'));
const note = (id) => ({ id, title: 'ภาษาไทย', content: 'Exact [[attachment]] content', tags: ['local'] });
async function fixture() {
  const parent = await directory(), source = join(parent, 'source');
  const storage = await new StorageEngine(source).init();
  const values = {
    notes: [note('first')], deliverables: { tech: [{ id: 'report', title: 'Report' }] },
    agentOverrides: { ARIA: { autonomyLevel: 70 } },
    savedCommands: [{ id: 'cmd', agentId: 'BYTE', text: 'Inspect' }],
    chats: { tech: [{ id: 'chat', role: 'user', text: 'Keep exactly' }] }
  };
  for (const name of COLLECTIONS) await storage.put(name, values[name], 0);
  await storage.put('notes', [note('latest')], 1);
  const expected = Object.fromEntries(COLLECTIONS.map((name) => [name, storage.get(name)]));
  await storage.close();
  await mkdir(join(source, 'attachments', 'empty'), { recursive: true });
  await writeFile(join(source, 'attachments', 'binary.bin'), Buffer.from([0, 1, 255, 128]));
  for (const name of ['schedules', 'taskTemplates', 'performance']) {
    await writeFile(join(source, '.maoc', 'state', `${name}.json`), `${JSON.stringify({ schemaVersion: 1, [name]: [] })}\n`);
  }
  return { parent, source, expected };
}
const envelopes = (storage) => Object.fromEntries(COLLECTIONS.map((name) => [name, storage.get(name)]));

test('stopped full-Vault backup and isolated restore preserve every byte and empty directory, never writer.lock', async () => {
  const { parent, source } = await fixture();
  const before = await inventory(source);
  const backup = join(parent, 'backup'), restored = join(parent, 'restored');
  const manifest = await backupVault(source, backup);
  assert.deepEqual(manifest.inventory, before);
  assert.deepEqual(await inventory(source), before);
  await restoreVault(backup, restored);
  assert.deepEqual(await inventory(restored), before);
  assert.ok((await lstat(join(restored, 'attachments', 'empty'))).isDirectory());
  await assert.rejects(lstat(join(restored, '.maoc', 'writer.lock')), { code: 'ENOENT' });
});

test('maintenance refuses an active writer and refuses stale locks without deleting them', async () => {
  const { parent, source } = await fixture();
  const storage = await new StorageEngine(source).init();
  try { await assert.rejects(backupVault(source, join(parent, 'active')), /Vault is locked/); }
  finally { await storage.close(); }
  const lock = join(source, '.maoc', 'writer.lock');
  await writeFile(lock, '{"pid":2147483647}');
  await assert.rejects(convertVault(source, join(parent, 'stale'), 'sqlite'), /Vault is locked/);
  assert.equal(await readFile(lock, 'utf8'), '{"pid":2147483647}');
  await assert.rejects(lstat(join(parent, 'stale')), { code: 'ENOENT' });
});

test('maintenance rejects overlapping/existing/relative destinations before altering anything', async () => {
  const { parent, source } = await fixture();
  const before = await inventory(source);
  for (const destination of [source, join(source, 'nested'), parent]) {
    await assert.rejects(backupVault(source, destination), /must not overlap/);
  }
  const existing = join(parent, 'exists'); await mkdir(existing);
  await assert.rejects(backupVault(source, existing), /must not exist/);
  await assert.rejects(backupVault(source, 'relative'), /absolute/);
  assert.deepEqual(await inventory(source), before);
});

test('tampered/incomplete backup fails closed and never creates restore destination', async () => {
  const { parent, source } = await fixture();
  const backup = join(parent, 'backup'); await backupVault(source, backup);
  await writeFile(join(backup, 'vault', 'attachments', 'binary.bin'), 'tampered');
  await assert.rejects(restoreVault(backup, join(parent, 'restore')), /inventory\/hash mismatch/);
  await assert.rejects(lstat(join(parent, 'restore')), { code: 'ENOENT' });
  const incomplete = join(parent, 'incomplete'); await mkdir(incomplete);
  await assert.rejects(restoreVault(incomplete, join(parent, 'other')), { code: 'ENOENT' });
});

test('restore refuses a copied live or stale writer.lock in the backup', async () => {
  const { parent, source } = await fixture();
  const backup = join(parent, 'backup'); await backupVault(source, backup);
  const lock = join(backup, 'vault', '.maoc', 'writer.lock');
  await writeFile(lock, '{"pid":1}');
  await assert.rejects(restoreVault(backup, join(parent, 'restore')), /Vault is locked/);
  assert.equal(await readFile(lock, 'utf8'), '{"pid":1}');
});

test('backup audit reports integrity and age without consulting the original Vault or changing the backup', async () => {
  const { parent, source } = await fixture();
  const backup = join(parent, 'backup');
  const manifest = await backupVault(source, backup);
  const before = await inventory(backup);
  await writeFile(join(source, 'attachments', 'binary.bin'), 'later edit');
  const created = Date.parse(manifest.createdAt);
  const day = 24 * 60 * 60 * 1000;
  const fresh = await verifyBackup(backup, { now: created + 7 * day });
  assert.equal(fresh.integrity, 'verified');
  assert.equal(fresh.freshness, 'fresh');
  assert.equal(fresh.ageHours, 168);
  assert.equal(fresh.files, manifest.inventory.files.length);
  assert.equal(fresh.bytes, manifest.inventory.files.reduce((total, f) => total + f.bytes, 0));
  assert.equal((await verifyBackup(backup, { now: created + 8 * day })).freshness, 'stale');
  assert.equal((await verifyBackup(backup, { now: created + day, maxAgeHours: 12 })).freshness, 'stale');
  await assert.rejects(verifyBackup(backup, { now: created - 1 }), /timestamp/);
  await assert.rejects(verifyBackup(backup, { maxAgeHours: 0 }), /positive integer/);
  assert.deepEqual(await inventory(backup), before);
  await assert.rejects(lstat(join(backup, 'vault', '.maoc', 'writer.lock')), { code: 'ENOENT' });
});

test('backup audit fails closed on missing manifests, unexpected files and copied writer locks', async () => {
  const { parent, source } = await fixture();
  const incomplete = join(parent, 'incomplete'); await mkdir(incomplete);
  await assert.rejects(verifyBackup(incomplete), { code: 'ENOENT' });
  const backup = join(parent, 'backup'); await backupVault(source, backup);
  const lock = join(backup, 'vault', '.maoc', 'writer.lock');
  await writeFile(lock, '{"pid":1}');
  await assert.rejects(verifyBackup(backup), /locked/);
  assert.equal(await readFile(lock, 'utf8'), '{"pid":1}');
  const extra = join(parent, 'extra'); await backupVault(source, extra);
  await writeFile(join(extra, 'vault', 'extra.txt'), 'unexpected');
  await assert.rejects(verifyBackup(extra), /inventory\/hash mismatch/);
  // Use a separate backup to prove same-size content corruption is rejected too.
  const changed = join(parent, 'changed'); await backupVault(source, changed);
  await writeFile(join(changed, 'vault', 'attachments', 'binary.bin'), Buffer.from([1, 0, 255, 128]));
  await assert.rejects(verifyBackup(changed), /inventory\/hash mismatch/);
});

for (const driver of ['atomic-json', 'sqlite']) {
  test(`${driver}: verified backup can restore and reopen all five envelopes in isolation`, async () => {
    const { parent, source, expected } = await fixture();
    const vault = driver === 'sqlite' ? join(parent, 'sqlite') : source;
    if (driver === 'sqlite') await convertVault(source, vault, 'sqlite');
    const backup = join(parent, 'backup'), destination = join(parent, 'restore-check');
    const manifest = await backupVault(vault, backup);
    const before = await inventory(backup);
    assert.equal((await verifyBackup(backup)).integrity, 'verified');
    await restoreVault(backup, destination);
    assert.deepEqual(await inventory(destination), manifest.inventory);
    const reopened = await new (driver === 'sqlite' ? SqliteStorageEngine : StorageEngine)(destination).init();
    try { assert.deepEqual(envelopes(reopened), expected); }
    finally { await reopened.close(); }
    assert.deepEqual(await inventory(backup), before);
    assert.deepEqual(await inventory(vault), manifest.inventory);
    await assert.rejects(lstat(join(destination, '.maoc', 'writer.lock')), { code: 'ENOENT' });
  });
}

test('CLI verify distinguishes fresh, stale and invalid backups and refuses a destination', async () => {
  const { parent, source } = await fixture();
  const cli = fileURLToPath(new URL('../scripts/vault-admin.mjs', import.meta.url));
  const backup = join(parent, 'backup');
  const manifest = await backupVault(source, backup);
  const run = (...args) => spawnSync(process.execPath, [cli, 'verify', '--source', backup, ...args], { encoding: 'utf8' });
  const fresh = run('--max-age-hours', '24');
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.equal(JSON.parse(fresh.stdout).freshness, 'fresh');
  const destination = join(parent, 'not-created');
  assert.equal(run('--destination', destination).status, 1);
  await assert.rejects(lstat(destination), { code: 'ENOENT' });
  const file = join(backup, 'manifest.json');
  await writeFile(file, JSON.stringify({ ...manifest, createdAt: '2000-01-01T00:00:00.000Z' }));
  const stale = run('--max-age-hours', '24');
  assert.equal(stale.status, 2, stale.stderr);
  assert.equal(JSON.parse(stale.stdout).integrity, 'verified');
  assert.equal(JSON.parse(stale.stdout).freshness, 'stale');
  await writeFile(file, JSON.stringify({ ...manifest, createdAt: 'invalid' }));
  const invalid = run();
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /timestamp/);
});

test('maintenance rejects junctions inside the Vault and releases its own lock', async () => {
  const { parent, source } = await fixture();
  const external = join(parent, 'external'); await mkdir(external);
  await symlink(external, join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(backupVault(source, join(parent, 'backup')), /Symbolic links\/junctions/);
  await assert.rejects(lstat(join(source, '.maoc', 'writer.lock')), { code: 'ENOENT' });
  await assert.rejects(lstat(join(parent, 'backup')), { code: 'ENOENT' });
});

test('full-Vault conversion preserves envelopes, attachments, server JSON and latest SQLite rollback after restart', async () => {
  const { parent, source, expected } = await fixture();
  const before = await inventory(source), sqlite = join(parent, 'sqlite');
  const report = await convertVault(source, sqlite, 'sqlite');
  assert.equal(report.restartVerified, true);
  assert.deepEqual(await inventory(source), before);
  let storage = await new SqliteStorageEngine(sqlite).init();
  assert.deepEqual(envelopes(storage), expected);
  await storage.put('notes', [note('sqlite-only')], 2);
  const latest = envelopes(storage); await storage.close();
  const sqliteBefore = await inventory(sqlite), json = join(parent, 'json');
  await convertVault(sqlite, json, 'atomic-json');
  assert.deepEqual(await inventory(sqlite), sqliteBefore);
  storage = await new StorageEngine(json).init();
  try {
    assert.deepEqual(envelopes(storage), latest);
    for (const name of ['schedules', 'taskTemplates', 'performance']) {
      assert.deepEqual(await readFile(join(json, '.maoc', 'state', `${name}.json`)), await readFile(join(source, '.maoc', 'state', `${name}.json`)));
    }
    assert.deepEqual(await readFile(join(json, 'attachments', 'binary.bin')), Buffer.from([0, 1, 255, 128]));
  } finally { await storage.close(); }
  await assert.rejects(lstat(join(json, '.maoc', 'state', 'maoc.sqlite')), { code: 'ENOENT' });
  await assert.rejects(new StorageEngine(sqlite).init(), /Vault uses SQLite/);
});

test('conversion refuses wrong source driver and corrupt source without modifying it', async () => {
  const { parent, source } = await fixture();
  await assert.rejects(convertVault(source, join(parent, 'wrong'), 'atomic-json'), /opposite source driver/);
  const file = join(source, '.maoc', 'state', 'notes.json'); await writeFile(file, '{broken');
  const before = await inventory(source);
  await assert.rejects(convertVault(source, join(parent, 'corrupt'), 'sqlite'));
  assert.deepEqual(await inventory(source), before);
  await assert.rejects(lstat(join(source, '.maoc', 'writer.lock')), { code: 'ENOENT' });
});

test('launcher selection preserves default JSON, rejects typo and accepts explicitly paused SQLite', () => {
  assert.deepEqual(storageSettings({}), { storageDriver: 'atomic-json', schedulerAutoStart: true, collectionRealtime: false });
  assert.deepEqual(storageSettings({ MAOC_STORAGE_DRIVER: 'sqlite', MAOC_SCHEDULER_AUTOSTART: 'false' }), { storageDriver: 'sqlite', schedulerAutoStart: false, collectionRealtime: false });
  assert.throws(() => storageSettings({ MAOC_STORAGE_DRIVER: 'sqllite' }), /Invalid/);
  assert.throws(() => storageSettings({ MAOC_SCHEDULER_AUTOSTART: '0' }), /Invalid/);
});

test('stopped SQLite backup restores and boots latest data; corrupt SQLite cannot be exported as stale JSON', async () => {
  const { parent, source } = await fixture(), sqlite = join(parent, 'sqlite');
  await convertVault(source, sqlite, 'sqlite');
  let storage = await new SqliteStorageEngine(sqlite).init();
  await storage.put('notes', [note('backup-latest')], 2);
  const expected = envelopes(storage); await storage.close();
  const backup = join(parent, 'backup'), restored = join(parent, 'restored');
  await backupVault(sqlite, backup); await restoreVault(backup, restored);
  storage = await new SqliteStorageEngine(restored).init();
  try { assert.deepEqual(envelopes(storage), expected); } finally { await storage.close(); }
  await writeFile(join(sqlite, '.maoc', 'state', 'maoc.sqlite'), 'corrupt');
  const before = await inventory(sqlite);
  await assert.rejects(convertVault(sqlite, join(parent, 'bad-export'), 'atomic-json'));
  assert.deepEqual(await inventory(sqlite), before);
  await assert.rejects(new StorageEngine(sqlite).init(), /Vault uses SQLite/);
});

test('CLI help and unknown commands are bounded without loading app secrets/config', () => {
  const cli = fileURLToPath(new URL('../scripts/vault-admin.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.match(result.stdout, /Stop the entire backend gracefully/);
  const invalid = spawnSync(process.execPath, [cli, 'bad'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /Unknown maintenance command/);
});

test('normal server entry serves selected SQLite Vault, pauses copied schedules and shuts down through IPC', { timeout: 15000 }, async (t) => {
  const { parent, source } = await fixture(), vault = join(parent, 'sqlite');
  // Valid server-owned fixture for the actual application boot.
  await writeFile(join(source, '.maoc', 'state', 'schedules.json'), '{"schemaVersion":1,"schedules":[]}\n');
  await writeFile(join(source, '.maoc', 'state', 'taskTemplates.json'), '{"schemaVersion":1,"templates":[]}\n');
  await writeFile(join(source, '.maoc', 'state', 'performance.json'), '{"schemaVersion":1,"started_at":"2026-11-14T00:00:00.000Z","records":[]}\n');
  await convertVault(source, vault, 'sqlite');
  const seeded = await createApplication({ vaultDir: vault, storageDriver: 'sqlite', schedulerAutoStart: false });
  const schedule = await seeded.scheduler.create({ name: 'Copied schedule', description: 'Do not execute in rehearsal', recurrence: { kind: 'interval', minutes: 5 }, maxRuns: 2 });
  await seeded.scheduler.action(schedule.id, { action: 'resume' });
  await seeded.close();
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
  const child = fork(fileURLToPath(new URL('../src/server.js', import.meta.url)), [], {
    env: { ...process.env, VAULT_DIR: vault, PORT: String(port), MAOC_STORAGE_DRIVER: 'sqlite', MAOC_SCHEDULER_AUTOSTART: 'false', LOG_LEVEL: 'info' },
    silent: true
  });
  t.after(async () => { if (child.connected) { child.send({ type: 'SHUTDOWN' }); await once(child, 'exit'); } });
  let output = '', errors = '';
  child.stderr.on('data', (chunk) => { errors += chunk; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server not ready: ${errors}`)), 8000);
    child.stdout.on('data', (chunk) => { output += chunk; if (output.includes('server.ready')) { clearTimeout(timer); resolve(); } });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${errors}`)); });
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/storage/notes`);
  assert.equal(response.status, 200); assert.equal((await response.json()).revision, 2);
  const schedules = await (await fetch(`http://127.0.0.1:${port}/api/schedules`)).json();
  assert.equal(schedules.schedules[0].state, 'PAUSED');
  assert.equal(schedules.schedules[0].runs, 0);
  const exit = once(child, 'exit'); child.send({ type: 'SHUTDOWN' });
  assert.equal((await exit)[0], 0);
  await assert.rejects(lstat(join(vault, '.maoc', 'writer.lock')), { code: 'ENOENT' });
});
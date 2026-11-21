import { createReadStream, constants } from 'node:fs';
import { copyFile, lstat, mkdir, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { StorageEngine } from './storageEngine.js';
import { COLLECTIONS } from './validation.js';

const lockName = '.maoc/writer.lock';
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const identical = (a, b) => {
  if (!isDeepStrictEqual(a, b)) throw new Error('Vault inventory/hash mismatch; keep the source and inspect the incomplete destination');
};

async function noLinks(path) {
  for (let current = resolve(path); ; current = dirname(current)) {
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error('Symbolic links/junctions are not supported in maintenance paths');
    if (dirname(current) === current) return;
  }
}

async function paths(source, destination) {
  if (!source || !destination || !isAbsolute(source) || !isAbsolute(destination)) throw new Error('Explicit absolute source and destination paths are required');
  const from = resolve(source), to = resolve(destination);
  await noLinks(from);
  await noLinks(dirname(to)); // Parent must exist; never create an ambiguous parent tree.
  const inside = (a, b) => {
    const value = relative(a, b);
    return value === '' || (!value.startsWith(`..${sep}`) && value !== '..' && !isAbsolute(value));
  };
  // relative() is case-insensitive for Windows paths, unlike string prefix checks.
  if (inside(from, to) || inside(to, from)) throw new Error('Source and destination must not overlap');
  try { await lstat(to); } catch (error) { if (error.code === 'ENOENT') return { from, to }; throw error; }
  throw new Error('Destination must not exist; use a fresh path');
}

async function hash(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

export async function inventory(root) {
  await noLinks(root);
  const files = [], directories = [];
  async function walk(directory, prefix = '') {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (name === lockName) continue;
      const path = join(directory, entry.name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links/junctions are not supported inside a Vault');
      if (stat.isDirectory()) { directories.push(name); await walk(path, name); }
      else if (stat.isFile()) files.push({ path: name, bytes: stat.size, sha256: await hash(path) });
      else throw new Error('Only regular files and directories are supported');
    }
  }
  await walk(root);
  return { directories, files };
}

async function stopped(root, action) {
  await noLinks(join(root, '.maoc'));
  const path = join(root, '.maoc', 'writer.lock');
  let lock;
  try { lock = await open(path, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Vault is locked; stop gracefully and inspect stale locks manually. No automatic lock removal.');
    throw error;
  }
  try {
    await lock.writeFile(json({ pid: process.pid, maintenance: true }));
    await lock.sync();
    return await action();
  } finally { await lock.close(); await unlink(path); }
}

async function copyVerified(from, to, before) {
  await mkdir(to); // Exclusive destination ownership; leave failed copies for inspection.
  for (const directory of before.directories) await mkdir(join(to, directory));
  for (const file of before.files) await copyFile(join(from, file.path), join(to, file.path), constants.COPYFILE_EXCL);
  identical(await inventory(from), before);
  identical(await inventory(to), before);
}

export async function backupVault(source, destination) {
  const { from, to } = await paths(source, destination);
  return stopped(from, async () => {
    const before = await inventory(from);
    await mkdir(to);
    await copyVerified(from, join(to, 'vault'), before);
    const manifest = { schemaVersion: 1, kind: 'maoc-stopped-vault', createdAt: new Date().toISOString(), source: from, inventory: before };
    // This is the completion marker; a partial directory without it is NOT a backup.
    await writeFile(join(to, 'manifest.json'), json(manifest), { flag: 'wx' });
    return manifest;
  });
}

async function readBackupManifest(from) {
  await noLinks(from);
  const path = join(from, 'manifest.json');
  if (!(await lstat(path)).isFile()) throw new Error('Backup manifest must be a regular file');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  if (manifest?.schemaVersion !== 1 || manifest.kind !== 'maoc-stopped-vault') throw new Error('Unsupported backup manifest');
  return manifest;
}

export async function verifyBackup(source, { now = Date.now(), maxAgeHours = 168 } = {}) {
  if (!source || !isAbsolute(source)) throw new Error('Explicit absolute backup source path is required');
  if (!Number.isSafeInteger(maxAgeHours) || maxAgeHours < 1) throw new Error('Backup age limit must be a positive integer in hours');
  const from = resolve(source), saved = join(from, 'vault');
  const manifest = await readBackupManifest(from);
  const created = Date.parse(manifest.createdAt);
  if (!Number.isFinite(now) || !Number.isFinite(created) || created > now || new Date(created).toISOString() !== manifest.createdAt) {
    throw new Error('Invalid or future backup timestamp');
  }
  // Audit a stopped backup only. No lock is created and manifest.source is never opened.
  await noLinks(join(saved, '.maoc'));
  const checkUnlocked = async () => {
    try { await lstat(join(saved, lockName)); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    throw new Error('Backup Vault is locked; audit requires an idle backup');
  };
  await checkUnlocked();
  const actual = await inventory(saved);
  identical(actual, manifest.inventory);
  await checkUnlocked();
  identical(await readBackupManifest(from), manifest);
  const ageHours = (now - created) / 3600000;
  return {
    integrity: 'verified', freshness: ageHours <= maxAgeHours ? 'fresh' : 'stale',
    createdAt: manifest.createdAt, ageHours, maxAgeHours,
    files: actual.files.length, directories: actual.directories.length,
    bytes: actual.files.reduce((total, file) => total + file.bytes, 0)
  };
}

export async function restoreVault(source, destination) {
  const { from, to } = await paths(source, destination);
  const manifest = await readBackupManifest(from);
  const saved = join(from, 'vault');
  // stopped() refuses any lock in the saved tree, including a stale/copied one.
  return stopped(saved, async () => {
    identical(await inventory(saved), manifest.inventory);
    await copyVerified(saved, to, manifest.inventory);
    return { restored: true, inventory: manifest.inventory };
  });
}

const snapshots = (storage) => Object.fromEntries(COLLECTIONS.map((name) => [name, storage.get(name)]));

export async function convertVault(source, destination, driver) {
  if (!['sqlite', 'atomic-json'].includes(driver)) throw new Error('Unsupported conversion driver');
  const { from, to } = await paths(source, destination);
  return stopped(from, async () => {
    const before = await inventory(from);
    const sqliteSource = before.files.some((file) => ['.maoc/state/maoc.sqlite', '.maoc/state/storage-driver.json'].includes(file.path));
    if (sqliteSource !== (driver === 'atomic-json')) throw new Error('Conversion requires the opposite source driver');
    await copyVerified(from, to, before);
    const { SqliteStorageEngine } = await import('./sqliteStorageEngine.js');
    // Engines only open the NEW copy; the source is never projected/imported.
    let engine = await new (sqliteSource ? SqliteStorageEngine : StorageEngine)(to).init();
    let expected;
    try { expected = snapshots(engine); } finally { await engine.close(); }
    const projection = (files) => files.filter((file) => file.path.startsWith('notes/') || file.path.startsWith('deliverables/') || file.path === 'agents/overrides.json');
    const projected = projection((await inventory(to)).files);
    if (driver === 'sqlite') {
      engine = await new SqliteStorageEngine(to, { importJson: true }).init();
    } else {
      for (const name of COLLECTIONS) await writeFile(join(to, '.maoc', 'state', `${name}.json`), json(expected[name]));
      for (const name of ['maoc.sqlite', 'maoc.sqlite-journal', 'maoc.sqlite-wal', 'maoc.sqlite-shm', 'storage-driver.json']) {
        try { await unlink(join(to, '.maoc', 'state', name)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      engine = await new StorageEngine(to).init();
    }
    try { identical(snapshots(engine), expected); } finally { await engine.close(); }
    // Prove restart with the serving adapter before reporting success.
    engine = await new (driver === 'sqlite' ? SqliteStorageEngine : StorageEngine)(to).init();
    try { identical(snapshots(engine), expected); } finally { await engine.close(); }
    identical(await inventory(from), before);
    const after = await inventory(to);
    identical(projection(after.files), projected);
    // Server-owned JSON, attachments and all non-projection files must be unchanged.
    for (const file of before.files) {
      if (file.path.startsWith('notes/') || file.path.startsWith('deliverables/') || file.path === 'agents/overrides.json' ||
          /^\.maoc\/state\/(?:maoc\.sqlite(?:-journal|-wal|-shm)?|storage-driver\.json)$/.test(file.path) ||
          (driver === 'atomic-json' && COLLECTIONS.some((name) => file.path === `.maoc/state/${name}.json`))) continue;
      identical(after.files.find((item) => item.path === file.path), file);
    }
    return { driver, destination: to, collections: Object.fromEntries(COLLECTIONS.map((name) => [name, {
      revision: expected[name].revision, updatedAt: expected[name].updatedAt,
      entries: Array.isArray(expected[name].data) ? expected[name].data.length :
        Object.values(expected[name].data).reduce((count, item) => count + (Array.isArray(item) ? item.length : 1), 0)
    }])), sourceUnchanged: true, restartVerified: true, projectionsVerified: true, inventory: after };
  });
}
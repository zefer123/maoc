import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError, record, requireValid } from './validation.js';

const keyPattern = /^maoc_[A-Za-z0-9_-]{43}$/;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
const expired = (row, now) => row.expiresAt !== null && Date.parse(row.expiresAt) <= now;
const isDate = (value) => typeof value === 'string' && value.length === 24 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const fields = ['id', 'keyHash', 'keyPrefix', 'label', 'role', 'status', 'keyVersion', 'expiresAt', 'createdAt', 'rotatedAt', 'lastUsedAt'];
const validId = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
const maxKeys = 500;

export function accessSettings(env = process.env) {
  const gate = env.MAOC_ACCESS_GATE ?? 'false';
  if (!['true', 'false'].includes(gate)) throw new Error('Invalid MAOC_ACCESS_GATE');
  return { accessGate: gate === 'true', adminKey: env.MAOC_ADMIN_KEY || '' };
}

export function validateAdminKey(gate, key) {
  if ((gate || key) && (typeof key !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(key))) {
    throw new Error('Configure MAOC_ADMIN_KEY with 32–128 URL-safe characters before using key-based access');
  }
}

export class AccessKeys {
  constructor(storage, settings) {
    this.storage = storage;
    this.path = join(storage.stateDir, 'accessKeys.json');
    this.enabled = settings.accessGate;
    this.adminHash = settings.adminKey ? hash(settings.adminKey) : null;
    this.rows = new Map();
    this.used = new Map();
    this.queue = Promise.resolve();
  }

  async init() {
    let state;
    try {
      const file = await lstat(this.path);
      if (!file.isFile() || file.size > 512 * 1024) throw new Error('Invalid access key state');
      state = JSON.parse(await readFile(this.path, 'utf8'));
    } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (!record(state) || Object.keys(state).length !== 2 || state.schemaVersion !== 1 || !Array.isArray(state.keys) || state.keys.length > maxKeys) throw new Error('Invalid access key state');
    for (const row of state.keys) {
      if (!record(row) || Object.keys(row).length !== fields.length || !fields.every((field) => Object.hasOwn(row, field)) ||
          !validId(row.id) || this.rows.has(row.id) || typeof row.keyHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.keyHash) ||
          typeof row.keyPrefix !== 'string' || !/^maoc_[A-Za-z0-9_-]{10}$/.test(row.keyPrefix) || !this.validLabel(row.label) ||
          row.role !== 'user' || !['ACTIVE', 'REVOKED'].includes(row.status) || !Number.isSafeInteger(row.keyVersion) || row.keyVersion < 1 ||
          !isDate(row.createdAt) || ![row.expiresAt, row.rotatedAt, row.lastUsedAt].every((date) => date === null || isDate(date))) throw new Error('Invalid access key record');
      this.rows.set(row.id, row);
    }
  }

  validLabel(label) { return typeof label === 'string' && label.trim().length > 0 && label.length <= 80 && !/[\u0000-\u001f\u007f]/.test(label); }

  authenticate(value, localOwner = false) {
    if (value === undefined) return this.enabled ? null : { role: localOwner && !this.adminHash ? 'admin' : 'local', id: null };
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) return null;
    const digest = hash(value);
    if (this.adminHash && same(digest, this.adminHash)) return { role: 'admin', id: null };
    if (!keyPattern.test(value)) return null;
    const prefix = value.slice(0, 15);
    for (const row of this.rows.values()) {
      if (row.keyPrefix !== prefix || !same(digest, row.keyHash) || row.status !== 'ACTIVE' || expired(row, Date.now())) continue;
      this.touch(row);
      return { role: 'user', id: row.id, keyVersion: row.keyVersion };
    }
    return null;
  }

  invalidReason(auth) {
    if (!auth) return 'INVALID_KEY';
    if (auth.role !== 'user') return null;
    const row = this.rows.get(auth.id);
    if (!row || row.keyVersion !== auth.keyVersion) return 'REKEYED';
    if (row.status === 'REVOKED') return 'REVOKED';
    return expired(row, Date.now()) ? 'EXPIRED' : null;
  }

  publicRecord(row) {
    const { keyHash, ...rest } = row;
    return { ...rest, status: row.status === 'ACTIVE' && expired(row, Date.now()) ? 'EXPIRED' : row.status,
      lastUsedAt: this.used.get(row.id) || row.lastUsedAt };
  }

  list() { return [...this.rows.values()].map((row) => this.publicRecord(row)); }

  serialize(operation) {
    const work = this.queue.then(operation);
    this.queue = work.catch(() => {});
    return work;
  }

  async save(next) {
    const rows = [...next.values()].map((row) => ({ ...row, lastUsedAt: this.used.get(row.id) || row.lastUsedAt }));
    try { await this.storage.atomicWrite(this.path, `${JSON.stringify({ schemaVersion: 1, keys: rows })}\n`); }
    catch { throw new HttpError(503, 'Access state could not be saved'); }
    this.rows = new Map(rows.map((row) => [row.id, row]));
  }

  touch(row) {
    const now = Date.now();
    const last = this.used.get(row.id) || row.lastUsedAt;
    if (last && now - Date.parse(last) < 5 * 60_000) return;
    this.used.set(row.id, new Date(now).toISOString());
    // Usage timestamps are best effort; failed metadata writes never authorize a revoked key.
    void this.serialize(() => this.save(this.rows)).catch(() => {});
  }

  change(action, id, body, onCommit = () => {}) {
    const allowed = action === 'create' ? ['label', 'expiresAt'] : action === 'rekey' ? ['expiresAt'] : [];
    requireValid(record(body) && Object.keys(body).every((key) => allowed.includes(key)), 'Invalid key operation fields');
    if (action === 'create') requireValid(this.validLabel(body.label), 'Label must contain 1–80 characters');
    else requireValid(validId(id), 'Invalid key ID');
    if (body.expiresAt !== undefined && body.expiresAt !== null) requireValid(isDate(body.expiresAt) && Date.parse(body.expiresAt) > Date.now(), 'Expiry must be a future ISO timestamp');
    return this.serialize(async () => {
      let row, plaintext;
      const now = Date.now();
      const at = new Date(now).toISOString();
      if (action === 'create') {
        if (this.rows.size >= maxKeys) throw new HttpError(409, 'Activation key limit reached');
        row = { id: randomUUID(), label: body.label.trim(), role: 'user', status: 'ACTIVE', keyVersion: 1, expiresAt: body.expiresAt ?? null, createdAt: at, rotatedAt: null, lastUsedAt: null };
      } else {
        const previous = this.rows.get(id);
        if (!previous) throw new HttpError(404, 'Activation key not found');
        row = { ...previous };
        if (action === 'revoke') row.status = 'REVOKED';
        if (action === 'reactivate') {
          if (expired(row, now)) throw new HttpError(409, 'Expired key needs Re-key with a new expiry');
          // Do not resurrect previously established sockets; they still need a fresh handshake.
          row.status = 'ACTIVE';
        }
        if (action === 'rekey') {
          if (row.keyVersion === Number.MAX_SAFE_INTEGER) throw new HttpError(409, 'Key version limit reached');
          row.keyVersion++;
          row.rotatedAt = at;
          if (body.expiresAt !== undefined) row.expiresAt = body.expiresAt;
          if (expired(row, now)) throw new HttpError(409, 'Choose a new expiry when re-keying an expired key');
        }
      }
      if (expired(row, now) && action === 'create') throw new HttpError(400, 'Expiry must still be in the future');
      if (['create', 'rekey'].includes(action)) {
        plaintext = `maoc_${randomBytes(32).toString('base64url')}`;
        row.keyPrefix = plaintext.slice(0, 15);
        row.keyHash = hash(plaintext);
      }
      const next = new Map(this.rows).set(row.id, row);
      await this.save(next);
      onCommit(row.id);
      return { key: this.publicRecord(this.rows.get(row.id)), ...(plaintext ? { activationKey: plaintext } : {}) };
    });
  }
}
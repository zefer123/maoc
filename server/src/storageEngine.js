import { access, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { COLLECTIONS, HttpError, record, validateCollection } from './validation.js';
import { logger } from './logger.js';

const empty = (name) => ['notes', 'savedCommands'].includes(name) ? [] : {};
const digest = (id) => createHash('sha256').update(id).digest('hex').slice(0, 24);
const heading = (text = '') => String(text).replace(/[\r\n]/g, ' ');

export class StorageWriteError extends HttpError {
  constructor(status, code, message) {
    super(status, message);
    this.code = code;
  }
}

function classifyWriteError(error) {
  const sqlite = error?.code === 'ERR_SQLITE_ERROR' && Number.isInteger(error.errcode) ? error.errcode & 255 : null;
  if (error?.code === 'ENOSPC' || error?.code === 'EDQUOT' || sqlite === 13) {
    return new StorageWriteError(507, 'STORAGE_FULL', 'Vault write failed: storage is full or over quota');
  }
  if (['EACCES', 'EPERM', 'EROFS'].includes(error?.code) || [3, 8, 23].includes(sqlite)) {
    return new StorageWriteError(503, 'STORAGE_NOT_WRITABLE', 'Vault write failed: storage is not writable');
  }
  return null;
}

export class StorageEngine {
  constructor(root, { onCommit } = {}) {
    this.root = root;
    this.stateDir = join(root, '.maoc', 'state');
    this.state = new Map();
    this.queue = Promise.resolve();
    this.accepting = false;
    this.projectionErrors = new Set();
    this.writeFailures = new Map();
    this.driver = 'atomic-json';
    this.onCommit = onCommit;
  }

  async init() {
    for (const dir of [this.stateDir, ...['notes', 'deliverables', 'agents'].map((name) => join(this.root, name))]) {
      await mkdir(dir, { recursive: true });
    }
    const lockPath = join(this.root, '.maoc', 'writer.lock');
    try {
      this.lock = await open(lockPath, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = JSON.parse(await readFile(lockPath, 'utf8'));
      if (!Number.isInteger(owner.pid) || owner.pid <= 0) throw new Error('Invalid vault lock; inspect writer.lock');
      try {
        process.kill(owner.pid, 0);
      } catch (probeError) {
        if (probeError.code !== 'ESRCH') throw probeError;
        await unlink(lockPath);
        this.lock = await open(lockPath, 'wx');
      }
      if (!this.lock) throw new Error('Vault already has an active writer');
    }
    await this.lock.writeFile(JSON.stringify({ pid: process.pid }));
    await this.lock.sync();
    try {
      await this.openBackend();
      for (const name of COLLECTIONS) {
        const envelope = await this.loadCollection(name);
        this.state.set(name, envelope);
        await this.project(name, envelope.data);
      }
      this.accepting = true;
      return this;
    } catch (error) {
      try { await this.closeBackend(); } finally { await this.releaseLock(); }
      throw error;
    }
  }

  async openBackend() {
    // Never silently select stale JSON after a Vault has used SQLite.
    for (const name of ['maoc.sqlite', 'storage-driver.json']) {
      try { await access(join(this.stateDir, name)); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      throw new Error('Vault uses SQLite; explicit storage driver and rollback export are required');
    }
  }

  async loadCollection(name) {
    let envelope;
    try {
      envelope = JSON.parse(await readFile(join(this.stateDir, `${name}.json`), 'utf8'));
      if (!record(envelope) || envelope.schemaVersion !== 1 || !Number.isInteger(envelope.revision) || envelope.revision < 0) {
        throw new Error(`Invalid persistence envelope: ${name}`);
      }
      validateCollection(name, envelope.data);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      envelope = { schemaVersion: 1, revision: 0, updatedAt: null, data: empty(name) };
    }
    return envelope;
  }

  async persistCollection(name, next) {
    await this.atomicWrite(join(this.stateDir, `${name}.json`), `${JSON.stringify(next, null, 2)}\n`);
  }

  async closeBackend() {}

  async atomicWrite(path, contents) {
    const temporary = `${path}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temporary, 'wx');
      await handle.writeFile(contents, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temporary, path);
    } finally {
      if (handle) await handle.close();
      await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
  }

  get(name) {
    if (!COLLECTIONS.includes(name)) throw new HttpError(404, 'unknown collection');
    return structuredClone(this.state.get(name));
  }

  put(name, data, expectedRevision) {
    if (!this.accepting) return Promise.reject(new HttpError(503, 'storage is shutting down'));
    validateCollection(name, data);
    const copy = structuredClone(data);
    const operation = this.queue.then(async () => {
      const current = this.get(name);
      if (expectedRevision !== current.revision) throw new HttpError(409, 'revision conflict; reload before writing');
      const next = { schemaVersion: 1, revision: current.revision + 1, updatedAt: new Date().toISOString(), data: copy };
      try { await this.persistCollection(name, next); }
      catch (error) {
        if (error instanceof HttpError) throw error;
        const failure = classifyWriteError(error);
        this.writeFailures.set(name, failure?.code ?? 'STORAGE_WRITE_FAILED');
        throw failure ?? error;
      }
      this.writeFailures.delete(name);
      this.state.set(name, next);
      // Notification delivery must not turn a durable commit into a failed write.
      try { this.onCommit?.(name, next.revision); }
      catch (error) { logger.warn('storage.commit_notification_failed', { collection: name, error }); }
      try {
        await this.project(name, copy);
        this.projectionErrors.delete(name);
      } catch (error) {
        this.projectionErrors.add(name);
        logger.error('storage.projection_failed', { collection: name, error });
      }
      return { ...structuredClone(next), projectionStatus: this.projectionErrors.has(name) ? 'degraded' : 'ok' };
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async project(name, data) {
    if (name === 'notes') {
      for (const note of data) {
        const metadata = { id: note.id, title: note.title, tags: note.tags || [], agents: note.agents || [] };
        const frontmatter = Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
        const sources = (note.sources || []).map((source) => `- ${heading(source.title)}: ${source.url || ''}`).join('\n');
        await this.atomicWrite(join(this.root, 'notes', `${digest(note.id)}.md`), `---\n${frontmatter}\n---\n\n# ${heading(note.title)}\n\n${note.content}\n\n${(note.links || []).join(' ')}\n\n${sources ? `## Sources\n${sources}\n` : ''}`);
      }
    }
    if (name === 'deliverables') {
      for (const [dept, items] of Object.entries(data)) {
        const directory = join(this.root, 'deliverables', dept);
        await mkdir(directory, { recursive: true });
        for (const item of items) {
          const body = [`# ${heading(item.title)}`, item.summary || '', ...(item.paragraphs || []), item.artifactCode ? `\`\`\`\n${item.artifactCode}\n\`\`\`` : '', ...(item.stages || []).map((stage) => `- ${stage}`)].join('\n\n');
          await this.atomicWrite(join(directory, `${digest(item.id)}.md`), `${body}\n`);
        }
      }
    }
    if (name === 'agentOverrides') {
      await this.atomicWrite(join(this.root, 'agents', 'overrides.json'), `${JSON.stringify(data, null, 2)}\n`);
    }
  }

  async health() {
    try {
      const probe = join(this.stateDir, `.health-${randomUUID()}`);
      await this.atomicWrite(probe, 'ok');
      const readable = await readFile(probe, 'utf8');
      await unlink(probe);
      const write_failures = Object.fromEntries(this.writeFailures);
      return { status: this.accepting && readable === 'ok' && !this.projectionErrors.size && !this.writeFailures.size ? 'ok' : 'degraded', driver: this.driver, markdown: this.projectionErrors.size ? 'degraded' : 'ok', collections: this.state.size, write_failures };
    } catch {
      return { status: 'error', driver: this.driver, markdown: 'unknown', write_failures: Object.fromEntries(this.writeFailures) };
    }
  }

  async releaseLock() {
    if (!this.lock) return;
    await this.lock.close();
    this.lock = null;
    await unlink(join(this.root, '.maoc', 'writer.lock'));
  }

  async close() {
    this.accepting = false;
    await this.queue;
    try { await this.closeBackend(); } finally { await this.releaseLock(); }
  }
}
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StorageEngine } from './storageEngine.js';
import { COLLECTIONS, HttpError, record, validateCollection } from './validation.js';

const APPLICATION_ID = 0x4d414f43;
const exists = async (path) => {
  try { await access(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};

// Compatibility-first adapter: the five existing API collection envelopes remain
// unchanged. Server-owned schedules/templates/performance still use atomic JSON.
export class SqliteStorageEngine extends StorageEngine {
  constructor(root, { importJson = false, onCommit } = {}) {
    super(root, { onCommit });
    this.driver = 'sqlite';
    this.databasePath = join(this.stateDir, 'maoc.sqlite');
    this.markerPath = join(this.stateDir, 'storage-driver.json');
    this.importJson = importJson;
    this.database = null;
  }

  async openBackend() {
    const present = await exists(this.databasePath);
    if (await exists(this.markerPath)) {
      const marker = JSON.parse(await readFile(this.markerPath, 'utf8'));
      if (!record(marker) || marker.schemaVersion !== 1 || marker.driver !== 'sqlite') throw new Error('Invalid storage driver marker');
      if (!present) throw new Error('SQLite database is missing; restore a verified backup, never recreate automatically');
    }

    let seed;
    if (!present) {
      const legacy = await Promise.all(COLLECTIONS.map((name) => exists(join(this.stateDir, `${name}.json`))));
      if (legacy.some(Boolean) && !this.importJson) throw new Error('Existing JSON requires explicit SQLite import after backup');
      // Validate ALL source envelopes before creating the database or projections.
      seed = await Promise.all(COLLECTIONS.map((name) => super.loadCollection(name)));
      for (const value of seed) this.validateEnvelope(value);
    }

    // Lazy import preserves the original JSON backend on older supported Node versions.
    const sqlite = await import('node:sqlite');
    const Database = sqlite.Database || sqlite.DatabaseSync;
    this.database = new Database(this.databasePath, { enableForeignKeyConstraints: true, enableDoubleQuotedStringLiterals: false });
    this.database.exec('PRAGMA busy_timeout = 1000;');
    if (present) {
      if (this.database.prepare('PRAGMA application_id').get().application_id !== APPLICATION_ID ||
          this.database.prepare('PRAGMA user_version').get().user_version !== 1) throw new Error('Unsupported SQLite database identity or schema');
      this.readAll(); // Corrupt/incomplete databases fail without reset or reimport.
    } else {
      this.database.exec('PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; BEGIN IMMEDIATE;');
      try {
        this.database.exec(`CREATE TABLE collections (
          name TEXT PRIMARY KEY CHECK (name IN ('notes','deliverables','agentOverrides','savedCommands','chats')),
          schema_version INTEGER NOT NULL CHECK (schema_version = 1),
          revision INTEGER NOT NULL CHECK (revision >= 0),
          updated_at TEXT,
          data_json TEXT NOT NULL CHECK (json_valid(data_json))
        ) STRICT;`);
        const insert = this.database.prepare('INSERT INTO collections VALUES (?, ?, ?, ?, ?)');
        for (let i = 0; i < COLLECTIONS.length; i += 1) {
          const value = seed[i];
          this.validateEnvelope(value);
          insert.run(COLLECTIONS[i], value.schemaVersion, value.revision, value.updatedAt, JSON.stringify(value.data));
        }
        this.database.exec(`PRAGMA application_id = ${APPLICATION_ID}; PRAGMA user_version = 1; COMMIT;`);
      } catch (error) {
        this.database.exec('ROLLBACK;');
        throw error;
      }
    }
    this.database.exec('PRAGMA synchronous = FULL;');
    await this.atomicWrite(this.markerPath, `${JSON.stringify({ schemaVersion: 1, driver: 'sqlite' })}\n`);
  }

  validateEnvelope(value) {
    if (!record(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
        !(value.updatedAt === null || (typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))))) {
      throw new Error('Invalid SQLite collection envelope');
    }
  }

  readAll() {
    const check = this.database.prepare('PRAGMA quick_check').get();
    if (check.quick_check !== 'ok') throw new Error('SQLite integrity check failed');
    const rows = this.database.prepare('SELECT * FROM collections').all();
    if (rows.length !== COLLECTIONS.length || rows.some((row) => !COLLECTIONS.includes(row.name))) throw new Error('Incomplete SQLite collections');
    const values = new Map();
    for (const row of rows) {
      const value = { schemaVersion: row.schema_version, revision: row.revision, updatedAt: row.updated_at, data: JSON.parse(row.data_json) };
      this.validateEnvelope(value);
      validateCollection(row.name, value.data);
      values.set(row.name, value);
    }
    return values;
  }

  async loadCollection(name) {
    return this.readAll().get(name);
  }

  async persistCollection(name, next) {
    this.validateEnvelope(next);
    const result = this.database.prepare('UPDATE collections SET revision = ?, updated_at = ?, data_json = ? WHERE name = ? AND revision = ?')
      .run(next.revision, next.updatedAt, JSON.stringify(next.data), name, next.revision - 1);
    if (result.changes !== 1) throw new HttpError(409, 'revision conflict; reload before writing');
  }

  async health() {
    try {
      if (!this.database) throw new Error('SQLite is closed');
      this.readAll();
      return await super.health();
    } catch { return { status: 'error', driver: this.driver, markdown: 'unknown', write_failures: Object.fromEntries(this.writeFailures) }; }
  }

  async closeBackend() {
    if (this.database) {
      this.database.close();
      this.database = null;
    }
  }
}
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError, record, requireValid, validateId } from './validation.js';

const limit = 200;
const active = new Set(['RUNNING', 'WAITING_HUMAN', 'WAITING_APPROVAL']);
const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
const fields = ['task_id', 'state', 'updated_at'];

// Server-owned metadata only. Historical checkpoints are never execution input.
export class MissionHistory {
  constructor(storage) {
    this.storage = storage;
    this.path = join(storage.stateDir, 'mission-history.json');
    this.rows = new Map();
    this.current = new Set();
    this.queue = Promise.resolve();
    this.degraded = false;
  }

  async init() {
    let saved;
    try {
      requireValid((await stat(this.path)).size <= 128 * 1024, 'Mission history exceeds size limit');
      saved = JSON.parse(await readFile(this.path, 'utf8'));
    } catch (error) { if (error.code === 'ENOENT') return this; throw error; }
    requireValid(record(saved) && Object.keys(saved).length === 2 && saved.schemaVersion === 1 &&
      Array.isArray(saved.missions) && saved.missions.length <= limit, 'Invalid mission history');
    for (const row of saved.missions) {
      requireValid(record(row) && Object.keys(row).length === fields.length && fields.every((key) => Object.hasOwn(row, key)) &&
        (active.has(row.state) || terminal.has(row.state)) && typeof row.updated_at === 'string' &&
        Number.isFinite(Date.parse(row.updated_at)), 'Invalid mission history entry');
      validateId(row.task_id);
      requireValid(!this.rows.has(row.task_id), 'Duplicate history mission');
      this.rows.set(row.task_id, row);
    }
    return this;
  }

  health() { return { status: this.degraded ? 'degraded' : 'ok' }; }

  list() {
    return { persistence: this.health().status, missions: [...this.rows.values()].reverse().map((row) => ({
      ...row, last_state: row.state, state: active.has(row.state) && !this.current.has(row.task_id) ? 'INTERRUPTED' : row.state
    })) };
  }

  save(taskId, state) {
    const operation = this.queue.then(async () => {
      const next = new Map(this.rows);
      next.delete(taskId);
      next.set(taskId, { task_id: taskId, state, updated_at: new Date().toISOString() });
      if (next.size > limit) {
        for (const id of next.keys()) {
          if (next.size <= limit) break;
          if (id !== taskId && !this.current.has(id)) next.delete(id);
        }
      }
      try {
        await this.storage.atomicWrite(this.path, `${JSON.stringify({ schemaVersion: 1, missions: [...next.values()] })}\n`);
      } catch {
        this.degraded = true;
        throw new HttpError(503, 'Mission checkpoint could not be saved');
      }
      this.rows = next;
      if (active.has(state)) this.current.add(taskId);
      else this.current.delete(taskId);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
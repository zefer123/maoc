import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HUD_DEFAULTS, hasExactFields, validHudData, validHudEnvelope, validHudRevision } from '../../src/lib/hudPreferenceSchema.js';
import { HttpError, requireValid } from './validation.js';
import { logger } from './logger.js';

// Server-owned state under the existing writer lock, outside the five collections.
export class HudPreferencesStore {
  constructor(storage, onCommit) {
    this.storage = storage;
    this.onCommit = onCommit;
    this.path = join(storage.stateDir, 'hud-preferences.json');
    this.current = { schemaVersion: 1, revision: 0, updatedAt: null, data: HUD_DEFAULTS };
    this.queue = Promise.resolve();
    this.stopped = false;
  }

  async init() {
    try {
      const raw = await readFile(this.path);
      if (raw.length > 2048) throw new Error();
      const saved = JSON.parse(raw.toString('utf8'));
      if (!validHudEnvelope(saved)) throw new Error();
      this.current = saved;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Invalid or unreadable HUD preferences');
    }
    return this;
  }

  get() { return structuredClone(this.current); }

  put(input) {
    requireValid(hasExactFields(input, ['revision', 'data']) && validHudRevision(input.revision) && validHudData(input.data), 'Invalid HUD preferences');
    if (this.stopped) throw new HttpError(503, 'HUD preferences are shutting down');
    const { revision, data } = structuredClone(input);
    const work = this.queue.then(async () => {
      if (revision !== this.current.revision) throw new HttpError(409, 'HUD preferences revision conflict');
      if (revision === Number.MAX_SAFE_INTEGER) throw new HttpError(409, 'HUD preferences revision limit reached');
      const next = { schemaVersion: 1, revision: revision + 1, updatedAt: new Date().toISOString(), data };
      try { await this.storage.atomicWrite(this.path, `${JSON.stringify(next)}\n`); }
      catch (error) {
        logger.warn('hud_preferences.write_failed', { code: error.code });
        throw new HttpError(['ENOSPC', 'EDQUOT'].includes(error.code) ? 507 : 503, 'HUD preferences could not be saved');
      }
      this.current = next;
      try { this.onCommit?.(next.revision); }
      catch { logger.warn('hud_preferences.notification_failed'); }
      return this.get();
    });
    this.queue = work.catch(() => {});
    return work;
  }

  async close() { this.stopped = true; await this.queue; }
}
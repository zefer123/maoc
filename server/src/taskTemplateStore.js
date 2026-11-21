import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TEMPLATE_LIMITS, validateTaskTemplate, templateParameters, renderTaskTemplate } from '../../src/lib/taskTemplates.js';
import { HttpError, record, requireValid, validateId } from './validation.js';

const parse = (value) => { try { return validateTaskTemplate(value); } catch (error) { throw new HttpError(400, error.message); } };

// User-owned immutable presets, not model tools. Uses the existing Vault writer lock.
export class TaskTemplateStore {
  constructor(storage) {
    this.storage = storage; this.path = join(storage.stateDir, 'taskTemplates.json');
    this.items = []; this.queue = Promise.resolve(); this.stopped = false;
  }
  async init() {
    let saved;
    try { saved = JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; return this; }
    requireValid(record(saved) && saved.schemaVersion === 1 && Object.keys(saved).every((key) => ['schemaVersion', 'templates'].includes(key)), 'Invalid task-template envelope');
    requireValid(Array.isArray(saved.templates) && saved.templates.length <= TEMPLATE_LIMITS.count, 'Invalid task-template count');
    const ids = new Set();
    this.items = saved.templates.map((item) => {
      requireValid(record(item) && Object.keys(item).length === 3 && Object.keys(item).every((key) => ['id', 'config', 'created_at'].includes(key)), 'Invalid persisted template fields');
      validateId(item.id); requireValid(!ids.has(item.id), 'Duplicate task-template ID'); ids.add(item.id);
      requireValid(typeof item.created_at === 'string' && Number.isFinite(Date.parse(item.created_at)), 'Invalid task-template creation time');
      return { id: item.id, config: parse(item.config), created_at: item.created_at };
    });
    return this;
  }
  list() { return structuredClone(this.items.map((item) => ({ ...item, parameters: templateParameters(item.config) }))); }
  enqueue(operation) {
    if (this.stopped) return Promise.reject(new HttpError(503, 'Template store is shutting down'));
    const result = this.queue.then(operation); this.queue = result.catch(() => {}); return result;
  }
  async commit(items) {
    await this.storage.atomicWrite(this.path, `${JSON.stringify({ schemaVersion: 1, templates: items }, null, 2)}\n`);
    this.items = items;
  }
  create(value) {
    const config = parse(value);
    return this.enqueue(async () => {
      if (this.items.length >= TEMPLATE_LIMITS.count) throw new HttpError(409, 'Maximum 50 task templates');
      const item = { id: randomUUID(), config, created_at: new Date().toISOString() };
      await this.commit([...this.items, item]); return { ...structuredClone(item), parameters: templateParameters(config) };
    });
  }
  remove(id, input) {
    validateId(id);
    requireValid(record(input) && Object.keys(input).length === 1 && input.action === 'delete', 'Template action must be delete');
    return this.enqueue(async () => {
      if (!this.items.some((item) => item.id === id)) throw new HttpError(404, 'Task template not found');
      await this.commit(this.items.filter((item) => item.id !== id)); return { accepted: true };
    });
  }
  render(id, input) {
    if (this.stopped) throw new HttpError(503, 'Template store is shutting down');
    validateId(id);
    requireValid(record(input) && Object.keys(input).length === 1 && Object.hasOwn(input, 'parameters'), 'Render accepts only parameters');
    const item = this.items.find((entry) => entry.id === id);
    if (!item) throw new HttpError(404, 'Task template not found');
    try { return renderTaskTemplate(item.config, input.parameters); }
    catch (error) { throw new HttpError(400, error.message); }
  }
  async close() { this.stopped = true; await this.queue; }
}
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SCHEDULE_LIMITS, validateSchedule, nextOccurrence } from '../../src/lib/schedule.js';
import { HttpError, record, requireValid, validateId } from './validation.js';
import { logger } from './logger.js';

const active = (task) => ['RUNNING', 'AWAITING_HITL'].includes(task.state);
const STATES = ['PAUSED', 'ENABLED', 'EXHAUSTED'];
const LAST = ['DISPATCHED', 'SKIPPED_LATE', 'SKIPPED_BUSY', 'FAILED', 'COMPLETED', 'CANCELLED', 'CLAIMED', 'REJECTED'];
const parse = (value) => { try { return validateSchedule(value); } catch (error) { throw new HttpError(400, error.message); } };

// Single-process scheduler under the Vault writer lock. Dispatch claims are durable first:
// crash may lose a claimed run, but cannot automatically replay it after restart.
export class TaskScheduler {
  constructor({ storage, orchestrator, bus, clock = () => Date.now() }) {
    this.storage = storage; this.orchestrator = orchestrator; this.bus = bus; this.clock = clock;
    this.path = join(storage.stateDir, 'schedules.json');
    this.items = []; this.active = new Map(); this.queue = Promise.resolve(); this.stopped = false;
  }
  async init() {
    let saved;
    try { saved = JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; return this; }
    requireValid(record(saved) && saved.schemaVersion === 1 && Object.keys(saved).every((key) => ['schemaVersion', 'schedules'].includes(key)), 'Invalid schedule storage envelope');
    requireValid(Array.isArray(saved.schedules) && saved.schedules.length <= SCHEDULE_LIMITS.count, 'Invalid persisted schedules');
    const ids = new Set();
    this.items = saved.schedules.map((item) => {
      requireValid(record(item) && Object.keys(item).every((key) => ['id', 'config', 'state', 'runs', 'next_run_at', 'last', 'created_at', 'pause_reason'].includes(key)), 'Invalid persisted schedule fields');
      validateId(item.id); requireValid(!ids.has(item.id), 'Duplicate persisted schedule'); ids.add(item.id);
      const config = parse(item.config);
      requireValid(STATES.includes(item.state) && Number.isInteger(item.runs) && item.runs >= 0 && item.runs <= config.maxRuns, 'Invalid persisted schedule state');
      requireValid(item.next_run_at === null || (Number.isFinite(item.next_run_at) && item.next_run_at >= 0 && item.next_run_at <= 8e15), 'Invalid persisted next run');
      requireValid(item.state !== 'ENABLED' || (item.next_run_at !== null && item.runs < config.maxRuns), 'Enabled schedule needs a future slot and remaining attempts');
      requireValid(typeof item.created_at === 'string' && Number.isFinite(Date.parse(item.created_at)), 'Invalid schedule creation date');
      requireValid(typeof item.pause_reason === 'string' && item.pause_reason.length <= 100, 'Invalid schedule pause reason');
      if (item.last !== null) {
        requireValid(record(item.last) && Object.keys(item.last).every((key) => ['status', 'at', 'task_id', 'code'].includes(key)) && LAST.includes(item.last.status) && Number.isFinite(item.last.at), 'Invalid schedule last outcome');
        if (item.last.task_id !== undefined) validateId(item.last.task_id);
        if (item.last.code !== undefined) requireValid(Number.isInteger(item.last.code), 'Invalid schedule failure code');
      }
      return { ...item, config, state: item.runs >= config.maxRuns ? 'EXHAUSTED' : 'PAUSED', next_run_at: null,
        pause_reason: 'Backend restarted; resume explicitly. Missed and claimed runs are not replayed.' };
    });
    await this.persist(this.items);
    return this;
  }
  list() { return structuredClone(this.items.map((item) => ({ ...item, active_task_id: this.active.get(item.id)?.id || null }))); }
  enqueue(operation) {
    if (this.stopped) return Promise.reject(new HttpError(503, 'Scheduler is stopped'));
    const result = this.queue.then(() => {
      if (this.stopped) throw new HttpError(503, 'Scheduler is stopped');
      return operation();
    });
    this.queue = result.catch(() => {});
    return result;
  }
  persist(items) { return this.storage.atomicWrite(this.path, `${JSON.stringify({ schemaVersion: 1, schedules: items }, null, 2)}\n`); }
  async commit(items) {
    try { await this.persist(items); this.items = items; }
    catch (error) {
      // Fail closed even when persistence cannot record the failure. No further auto-dispatch.
      this.stopped = true; clearInterval(this.timer);
      logger.error('scheduler.persistence_failed', { error }); throw error;
    }
  }
  emit(item, action) {
    this.bus.publish({ event_type: 'SCHEDULE_UPDATED', source_agent: 'ARIA', target_agent: 'HUMAN',
      payload_summary: `Schedule ${item.id}: ${action}; ${item.state}; attempts ${item.runs}/${item.config.maxRuns}`,
      stage: action, schedule: { schedule_id: item.id, state: item.state, runs: item.runs, next_run_at: item.next_run_at,
        last: item.last ? structuredClone(item.last) : null } });
  }
  create(value) {
    const config = parse(value);
    return this.enqueue(async () => {
      if (this.items.length >= SCHEDULE_LIMITS.count) throw new HttpError(409, 'Maximum 20 schedules');
      const item = { id: randomUUID(), config, state: 'PAUSED', runs: 0, next_run_at: null, last: null,
        created_at: new Date(this.clock()).toISOString(), pause_reason: 'New schedule; resume explicitly to authorize recurring provider use.' };
      await this.commit([...this.items, item]); this.emit(item, 'created'); return structuredClone(item);
    });
  }
  action(id, input) {
    validateId(id);
    requireValid(record(input) && Object.keys(input).length === 1 && ['pause', 'resume', 'delete'].includes(input.action), 'Schedule action must be pause, resume or delete');
    return this.enqueue(async () => {
      const index = this.items.findIndex((item) => item.id === id);
      if (index < 0) throw new HttpError(404, 'Schedule not found');
      const items = structuredClone(this.items); const item = items[index];
      if (input.action === 'delete') {
        if (this.active.has(id)) throw new HttpError(409, 'Pause and wait for the active mission before deleting');
        items.splice(index, 1);
      } else if (input.action === 'resume') {
        if (this.active.has(id)) throw new HttpError(409, 'Wait for the active mission before resuming');
        if (item.runs >= item.config.maxRuns) throw new HttpError(409, 'Schedule attempt limit reached; create a new schedule');
        if (item.state !== 'ENABLED') {
          item.state = 'ENABLED'; item.pause_reason = ''; item.next_run_at = nextOccurrence(item.config.recurrence, this.clock());
        }
      } else { item.state = item.runs >= item.config.maxRuns ? 'EXHAUSTED' : 'PAUSED'; item.next_run_at = null; item.pause_reason = 'Paused by user; active mission is not cancelled.'; }
      await this.commit(items); this.emit(item, input.action); return { accepted: true };
    });
  }
  tick() {
    return this.enqueue(async () => {
      const now = this.clock();
      for (const [id, task] of this.active) if (!active(task)) {
        const items = structuredClone(this.items); const item = items.find((entry) => entry.id === id);
        if (item) {
          item.last = { status: ['COMPLETED', 'CANCELLED'].includes(task.state) ? task.state : 'FAILED', at: now, task_id: task.id };
          if (task.state !== 'COMPLETED') { item.state = item.runs >= item.config.maxRuns ? 'EXHAUSTED' : 'PAUSED'; item.next_run_at = null; item.pause_reason = 'Mission failed or cancelled; inspect and resume explicitly.'; }
          await this.commit(items); this.emit(item, 'outcome');
        }
        this.active.delete(id);
      }
      for (const candidate of this.items) {
        if (this.stopped) return;
        if (candidate.state !== 'ENABLED' || candidate.next_run_at > now) continue;
        const items = structuredClone(this.items); const item = items.find((entry) => entry.id === candidate.id);
        const late = now - item.next_run_at > 60000;
        const busy = this.active.has(item.id) || this.active.size >= SCHEDULE_LIMITS.active;
        item.next_run_at = nextOccurrence(item.config.recurrence, now);
        if (late || busy) {
          item.last = { status: late ? 'SKIPPED_LATE' : 'SKIPPED_BUSY', at: now };
          await this.commit(items); this.emit(item, 'skipped'); continue;
        }
        const due = candidate.next_run_at;
        item.runs += 1; item.last = { status: 'CLAIMED', at: now };
        if (item.runs >= item.config.maxRuns) { item.state = 'EXHAUSTED'; item.next_run_at = null; }
        await this.commit(items); // Durable claim BEFORE provider work. Never replay a claim.
        if (this.stopped) return;
        try {
          const task = this.orchestrator.submitTask(item.config.description, item.config.workflow, item.config.swarm,
            { schedule_id: item.id, run: item.runs, due_at: new Date(due).toISOString() });
          if (task.accepted) await task.accepted;
          this.active.set(item.id, task);
          item.last = { status: 'DISPATCHED', at: now, task_id: task.id };
        } catch (error) {
          item.state = item.runs >= item.config.maxRuns ? 'EXHAUSTED' : 'PAUSED'; item.next_run_at = null;
          item.pause_reason = 'Dispatch rejected; inspect settings and resume explicitly.';
          item.last = { status: 'REJECTED', at: now, code: Number.isInteger(error.status) ? error.status : 500 };
        }
        await this.commit(items); this.emit(item, 'dispatch');
      }
    });
  }
  start() {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => {
      if (this.ticking) return;
      this.ticking = true;
      void this.tick().catch((error) => { if (!this.stopped) logger.error('scheduler.tick_failed', { error }); }).finally(() => { this.ticking = false; });
    }, 1000);
    this.timer.unref();
  }
  async close() { this.stopped = true; clearInterval(this.timer); await this.queue; }
}
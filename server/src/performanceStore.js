import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ANALYTICS_LIMIT, aggregatePerformance } from '../../src/lib/performanceAnalytics.js';
import { AGENT_DEFINITIONS } from './agentRegistry.js';
import { HttpError, record, requireValid, validateId } from './validation.js';
import { logger } from './logger.js';
import { validateAfterActionEvidence } from './afterActionEvidence.js';
import { buildAfterActionReview } from '../../src/lib/afterActionReview.js';

const states = ['COMPLETED', 'FAILED', 'CANCELLED'];
const counters = ['llm_calls', 'responses', 'request_errors', 'reported_calls', 'unreported_calls', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'tool_calls', 'tool_errors'];
const fields = ['id', 'agent', 'node_id', 'state', 'duration_ms', ...counters];
const keys = (value, allowed) => record(value) && Object.keys(value).length === allowed.length && Object.keys(value).every((key) => allowed.includes(key));
const duration = (value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function validatePerformanceRecord(value) {
  const missionFields = ['task_id', 'started_at', 'finished_at', 'duration_ms', 'department', 'mode', 'state', 'executions'];
  requireValid(keys(value, Object.hasOwn(value || {}, 'after_action') ? [...missionFields, 'after_action'] : missionFields), 'Invalid analytics mission fields');
  validateId(value.task_id);
  requireValid(timestamp(value.started_at) && timestamp(value.finished_at), 'Invalid analytics timestamps');
  requireValid(duration(value.duration_ms) && states.includes(value.state), 'Invalid analytics mission outcome');
  requireValid(['command', 'trade', 'tech', 'design', 'content', 'data', 'finance', 'legal'].includes(value.department) && ['sequential', 'dag', 'swarm'].includes(value.mode), 'Invalid analytics mission metadata');
  requireValid(Array.isArray(value.executions) && value.executions.length <= 64, 'Invalid analytics execution count');
  const ids = new Set();
  for (const execution of value.executions) {
    requireValid(keys(execution, fields), 'Invalid analytics execution fields');
    validateId(execution.id); requireValid(!ids.has(execution.id), 'Duplicate analytics execution'); ids.add(execution.id);
    requireValid(execution.node_id === null || (typeof execution.node_id === 'string' && /^[a-zA-Z][\w-]{0,39}$/.test(execution.node_id)), 'Invalid analytics node');
    requireValid(Object.hasOwn(AGENT_DEFINITIONS, execution.agent) || execution.agent === 'HUMAN', 'Invalid analytics agent');
    requireValid([...states, 'SKIPPED'].includes(execution.state) && duration(execution.duration_ms), 'Invalid analytics execution outcome');
    requireValid(counters.every((key) => Number.isSafeInteger(execution[key]) && execution[key] >= 0), 'Invalid analytics counters');
    requireValid(execution.responses + execution.request_errors === execution.llm_calls && execution.reported_calls + execution.unreported_calls === execution.responses && execution.tool_errors <= execution.tool_calls, 'Inconsistent analytics counters');
    if (execution.agent === 'HUMAN' || execution.state === 'SKIPPED') requireValid(counters.every((key) => execution[key] === 0), 'HUMAN/skipped execution cannot consume AI usage');
    if (execution.state === 'SKIPPED') requireValid(execution.duration_ms === 0, 'Skipped execution cannot have run duration');
  }
  if (Object.hasOwn(value, 'after_action')) validateAfterActionEvidence(value.after_action, value);
  return structuredClone(value);
}

// Separate from browser-writable collections and telemetry ring buffers. No mission text.
export class PerformanceStore {
  constructor(storage, { clock = () => Date.now(), capacity = ANALYTICS_LIMIT } = {}) {
    requireValid(Number.isInteger(capacity) && capacity > 0 && capacity <= ANALYTICS_LIMIT, 'Invalid analytics capacity');
    this.storage = storage; this.path = join(storage.stateDir, 'performance.json'); this.clock = clock; this.capacity = capacity;
    this.records = []; this.queue = Promise.resolve(); this.closed = false; this.dirty = false; this.writeFailures = 0;
    this.startedAt = new Date(this.clock()).toISOString();
  }
  async init() {
    let saved;
    try {
      requireValid((await stat(this.path)).size <= 64 * 1024 * 1024, 'Analytics storage exceeds size limit');
      saved = JSON.parse(await readFile(this.path, 'utf8'));
    } catch (error) { if (error.code !== 'ENOENT') throw error; return this; }
    requireValid(keys(saved, ['schemaVersion', 'started_at', 'records']) && saved.schemaVersion === 1 && timestamp(saved.started_at), 'Invalid analytics envelope');
    requireValid(Array.isArray(saved.records) && saved.records.length <= ANALYTICS_LIMIT, 'Invalid analytics retention');
    const ids = new Set();
    this.records = saved.records.map((item) => { const parsed = validatePerformanceRecord(item); requireValid(!ids.has(parsed.task_id), 'Duplicate analytics task'); ids.add(parsed.task_id); return parsed; }).slice(-this.capacity);
    this.startedAt = saved.started_at;
    return this;
  }
  append(value) {
    if (this.closed) return Promise.reject(new Error('Analytics store is closed'));
    const copy = validatePerformanceRecord(value);
    const operation = this.queue.then(async () => {
      // Idempotent terminal task observation, not replay of historical telemetry.
      if (this.records.some((item) => item.task_id === copy.task_id)) return;
      this.records = [...this.records, copy].slice(-this.capacity); this.dirty = true;
      await this.persist();
    });
    this.queue = operation.catch(() => {}); return operation;
  }
  async persist() {
    try {
      await this.storage.atomicWrite(this.path, `${JSON.stringify({ schemaVersion: 1, started_at: this.startedAt, records: this.records })}\n`);
      this.dirty = false;
    } catch (error) { this.writeFailures += 1; logger.error('analytics.write_failed', { error }); throw error; }
  }
  snapshot(filters = {}) {
    const now = this.clock();
    return { schema_version: 1, generated_at: new Date(now).toISOString(), observation_started_at: this.startedAt,
      retained_missions: this.records.length, retention_limit: this.capacity,
      oldest_finished_at: this.records.length ? this.records.reduce((oldest, item) => item.finished_at < oldest ? item.finished_at : oldest, this.records[0].finished_at) : null,
      persistence: this.dirty ? 'degraded' : 'ok', write_failures: this.writeFailures,
      scope: 'terminal_missions_only', ...aggregatePerformance(this.records, { ...filters, now }) };
  }
  health() { return { status: this.dirty ? 'degraded' : 'ok', retained: this.records.length, capacity: this.capacity, write_failures: this.writeFailures }; }
  reviewList({ offset = 0, limit = 25, outcome = 'all' } = {}) {
    requireValid(Number.isInteger(offset) && offset >= 0 && offset <= ANALYTICS_LIMIT && Number.isInteger(limit) && limit >= 1 && limit <= 50 && ['all', ...states].includes(outcome), 'Invalid AAR list filters');
    const items = [...this.records].reverse().filter((item) => outcome === 'all' || item.state === outcome);
    return { generated_at: new Date(this.clock()).toISOString(), observation_started_at: this.startedAt, retention_limit: this.capacity,
      retained_missions: this.records.length, persistence: this.dirty ? 'degraded' : 'ok', total: items.length, offset, limit,
      items: items.slice(offset, offset + limit).map((item) => ({ task_id: item.task_id, state: item.state, mode: item.mode,
        department: item.department, finished_at: item.finished_at, evidence_level: item.after_action ? 'recorded_context' : 'legacy_metrics_only' })) };
  }
  review(id) {
    validateId(id); const item = this.records.find((entry) => entry.task_id === id);
    if (!item) throw new HttpError(404, 'AAR unavailable: mission still active, predates observation, or is no longer retained');
    return { persistence: this.dirty ? 'degraded' : 'ok', retention_limit: this.capacity, report: buildAfterActionReview(item) };
  }
  async close() {
    this.closed = true; await this.queue;
    if (this.dirty) await this.persist().catch(() => {});
  }
}

export function createExecutionObservation(id, agent, nodeId = null) {
  return { id, agent, node_id: nodeId, state: 'RUNNING', duration_ms: 0, ...Object.fromEntries(counters.map((key) => [key, 0])) };
}
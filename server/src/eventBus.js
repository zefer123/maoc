import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';

const HISTORY_LIMIT = 500;
const TRACE_SUMMARY_LIMIT = 512;

function executionSummary(trace) {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace) || trace.kind !== 'execution_summary') return null;
  const { summary } = trace;
  if (typeof summary !== 'string' || summary.length > TRACE_SUMMARY_LIMIT || !summary.trim()) return null;
  return { kind: 'execution_summary', summary };
}

export class TelemetryBus {
  constructor() {
    this.subscribers = new Set();
    this.history = [];
  }

  subscribe(handler) {
    if (typeof handler !== 'function') throw new TypeError('subscriber must be a function');
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  publish(partial) {
    if (!partial || typeof partial.event_type !== 'string' || typeof partial.source_agent !== 'string') {
      throw new TypeError('event_type and source_agent are required');
    }
    const event = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      event_type: partial.event_type,
      source_agent: partial.source_agent,
      target_agent: partial.target_agent ?? null,
      model_used: partial.model_used ?? null,
      payload_summary: partial.payload_summary ?? '',
      progress_pct: partial.progress_pct ?? 0,
      task_id: partial.task_id ?? null,
      approval_id: partial.approval_id ?? null,
      provider: partial.provider ?? null,
      stage: partial.stage ?? null,
      reasoning_trace: executionSummary(partial.reasoning_trace),
      token_usage: partial.token_usage ? structuredClone(partial.token_usage) : null,
      tool_name: partial.tool_name ?? null,
      tool_status: partial.tool_status ?? null,
      outcome: partial.outcome ?? null,
      archived: partial.archived ?? false,
      task_state: partial.task_state ?? null,
      node_id: partial.node_id ?? null,
      schedule: partial.schedule ? structuredClone(partial.schedule) : null,
      scheduled_run: partial.scheduled_run ? structuredClone(partial.scheduled_run) : null,
      agent_message: partial.agent_message ? structuredClone(partial.agent_message) : null,
      swarm: partial.swarm ? structuredClone(partial.swarm) : null,
      human_input: partial.human_input ? structuredClone(partial.human_input) : null,
      workflow_nodes: partial.workflow_nodes ? structuredClone(partial.workflow_nodes) : null
    };

    this.history.push(event);
    if (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
    }

    for (const handler of this.subscribers) {
      try {
        const result = handler(structuredClone(event));
        if (result?.catch) result.catch((error) => logger.error('telemetry.subscriber_failed', { error }));
      } catch (error) {
        logger.error('telemetry.subscriber_failed', { error });
      }
    }

    return event;
  }

  snapshot(limit = 50) {
    if (!Number.isInteger(limit) || limit < 0 || limit > HISTORY_LIMIT) throw new RangeError('limit must be 0–500');
    return limit === 0 ? [] : structuredClone(this.history.slice(-limit));
  }

  health() {
    return { status: 'ok', history: this.history.length, capacity: HISTORY_LIMIT, subscribers: this.subscribers.size };
  }

  close() {
    this.subscribers.clear();
  }
}

export const telemetryBus = new TelemetryBus();
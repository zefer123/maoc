import { AGENTS } from '../data/agents.js';

export const ANALYTICS_LIMIT = 1000;
export const ANALYTICS_WINDOWS = Object.freeze({ '24h': 86400000, '7d': 604800000, '30d': 2592000000, all: Infinity });
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : null;
const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);

// Counts are computed from executor observations, never the decorative agent registry metrics.
export function aggregatePerformance(records, { window = '7d', team = 'all', agent = 'all', now = Date.now() } = {}) {
  if (!Object.hasOwn(ANALYTICS_WINDOWS, window)) throw new Error('Unknown analytics window');
  const selected = records.filter((record) => Date.parse(record.finished_at) >= now - ANALYTICS_WINDOWS[window] && Date.parse(record.finished_at) <= now);
  const agents = [...AGENTS.map(({ id, team: department }) => ({ id, team: department })), { id: 'HUMAN', team: 'human' }];
  const rows = agents.filter((item) => (team === 'all' || item.team === team) && (agent === 'all' || item.id === agent)).map((item) => {
    const executions = selected.flatMap((record) => record.executions.filter((execution) => execution.agent === item.id));
    const count = (state) => executions.filter((execution) => execution.state === state).length;
    const completed = count('COMPLETED'); const failed = count('FAILED');
    const durations = executions.filter((execution) => execution.state !== 'SKIPPED').map((execution) => execution.duration_ms);
    return { ...item, completed, failed, cancelled: count('CANCELLED'), skipped: count('SKIPPED'),
      executions: executions.length, duration_samples: durations.length,
      completion_rate: completed + failed ? completed / (completed + failed) : null,
      mean_ms: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      p50_ms: percentile(durations, 0.5), p95_ms: percentile(durations, 0.95),
      llm_calls: sum(executions, 'llm_calls'), responses: sum(executions, 'responses'), request_errors: sum(executions, 'request_errors'),
      reported_calls: sum(executions, 'reported_calls'), unreported_calls: sum(executions, 'unreported_calls'),
      prompt_tokens: sum(executions, 'prompt_tokens'), completion_tokens: sum(executions, 'completion_tokens'), total_tokens: sum(executions, 'total_tokens'),
      tool_calls: sum(executions, 'tool_calls'), tool_errors: sum(executions, 'tool_errors') };
  });
  const ids = new Set(rows.map((row) => row.id));
  const missions = team === 'all' && agent === 'all' ? selected : selected.filter((record) => record.executions.some((execution) => ids.has(execution.agent)));
  return { rows, mission_count: missions.length,
    mission_outcomes: Object.fromEntries(['COMPLETED', 'FAILED', 'CANCELLED'].map((state) => [state, missions.filter((record) => record.state === state).length])),
    recent: [...missions].sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at)).slice(0, 20).map((record) => ({
      task_id: record.task_id, finished_at: record.finished_at, state: record.state, mode: record.mode, department: record.department,
      duration_ms: record.duration_ms, participants: [...new Set(record.executions.map((execution) => execution.agent))]
    })) };
}
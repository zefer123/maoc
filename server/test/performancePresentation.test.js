import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregatePerformance } from '../../src/lib/performanceAnalytics.js';
import { summarizePerformance } from '../../src/lib/performancePresentation.js';
import { createExecutionObservation } from '../src/performanceStore.js';

const execution = (id, agent, state, duration_ms, counters = {}) => ({ ...createExecutionObservation(id, agent), state, duration_ms, ...counters });
const summary = (executions) => summarizePerformance(aggregatePerformance([{ task_id: 'measured', finished_at: new Date().toISOString(), state: 'COMPLETED', executions }], { window: 'all' }).rows);

test('empty presentation uses null rates, duration and usage coverage, not fabricated zero percent', () => {
  const result = summarizePerformance(aggregatePerformance([]).rows);
  assert.equal(result.completion_rate, null); assert.equal(result.mean_ms, null); assert.equal(result.usage_coverage, null);
  assert.equal(result.total_tokens, 0); assert.equal(result.human_mean_ms, null); assert.equal(result.human_samples, 0);
});

test('AI completion and mean are sample weighted and exclude HUMAN waits and skipped steps', () => {
  const result = summary([execution('a', 'BYTE', 'COMPLETED', 100), execution('b', 'BYTE', 'FAILED', 300), execution('c', 'BYTE', 'CANCELLED', 500), execution('d', 'CIPHER', 'COMPLETED', 900), execution('e', 'BYTE', 'SKIPPED', 0), execution('f', 'HUMAN', 'COMPLETED', 90000)]);
  assert.equal(result.completion_rate, 2 / 3); assert.equal(result.mean_ms, 450); assert.equal(result.duration_samples, 4);
  assert.equal(result.completed, 2); assert.equal(result.failed, 1); assert.equal(result.cancelled, 1); assert.equal(result.skipped, 1);
  assert.equal(result.human_samples, 1); assert.equal(result.human_mean_ms, 90000);
  assert.equal(Object.hasOwn(result, 'p95_ms'), false, 'Pooled percentile cannot be recovered from agent percentiles');
});

test('reported zero tokens remain distinct from absent usage; coverage excludes request errors', () => {
  const result = summary([execution('a', 'BYTE', 'COMPLETED', 10, { llm_calls: 3, responses: 2, request_errors: 1, reported_calls: 1, unreported_calls: 1, total_tokens: 0 })]);
  assert.equal(result.usage_coverage, 0.5); assert.equal(result.total_tokens, 0); assert.equal(result.reported_calls, 1); assert.equal(result.unreported_calls, 1); assert.equal(result.request_errors, 1);
});

test('HUMAN-only filter does not turn human contribution into AI success or AI latency', () => {
  const result = summary([execution('a', 'HUMAN', 'COMPLETED', 25000)]);
  assert.equal(result.completion_rate, null); assert.equal(result.mean_ms, null); assert.equal(result.completed, 0); assert.equal(result.human_mean_ms, 25000);
});
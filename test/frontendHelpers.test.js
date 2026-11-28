import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardRouteHash, parseDashboardRoute } from '../src/lib/dashboardRoute.js';
import { summarizePerformance } from '../src/lib/performancePresentation.js';
import { validateWorkflow, workflowLayers } from '../src/lib/workflowGraph.js';

test('root, Realm selector and legacy Command Deck keep distinct routes', () => {
  for (const hash of ['', '#', '#/']) {
    assert.deepEqual(parseDashboardRoute(hash), { section: 'home', homeView: 'opening' });
  }
  for (const [hash, route] of [
    ['#/home/realm', { section: 'home', homeView: 'realm' }],
    ['#/overview', { section: 'overview' }],
  ]) {
    assert.deepEqual(parseDashboardRoute(hash), route);
    assert.equal(dashboardRouteHash(route), hash);
  }
});

test('route parser rejects malformed IDs and preserves unknown resource IDs verbatim', () => {
  for (const hash of ['#/teams/%', '#/teams/%2F', '#/missions/', '#/missions/%00', '#/missions/a%5Cb', '#/library/a/b', `#/library/${'x'.repeat(257)}`]) {
    assert.deepEqual(parseDashboardRoute(hash), { section: 'not-found' }, hash);
  }
  const id = 'Unretained #47?';
  const encoded = 'Unretained%20%2347%3F';
  for (const [hash, idKey] of [
    [`#/teams/${encoded}/room`, 'teamId'],
    [`#/missions/${encoded}?tab=results`, 'taskId'],
    [`#/library/${encoded}`, 'artifactId'],
  ]) {
    const route = parseDashboardRoute(hash);
    assert.equal(route[idKey], id);
    assert.equal(dashboardRouteHash(route), hash);
  }
});

const row = (id, patch = {}) => ({
  id, completed: 0, failed: 0, cancelled: 0, skipped: 0, duration_samples: 0,
  llm_calls: 0, responses: 0, request_errors: 0, reported_calls: 0, unreported_calls: 0,
  total_tokens: 0, tool_calls: 0, tool_errors: 0, mean_ms: null, ...patch,
});

test('presentation preserves reported-zero usage separately from incomplete usage', () => {
  // The backend owns three-counter validation. These rows are its display contract, not provider payloads.
  const incomplete = row('BYTE', { llm_calls: 2, responses: 1, request_errors: 1, unreported_calls: 1 });
  const zero = row('CIPHER', { llm_calls: 1, responses: 1, reported_calls: 1 });
  assert.equal(summarizePerformance([incomplete]).usage_coverage, 0);
  assert.equal(summarizePerformance([zero]).usage_coverage, 1);
  const summary = summarizePerformance([incomplete, zero]);
  assert.equal(summary.usage_coverage, 0.5);
  assert.equal(summary.total_tokens, 0);
  assert.equal(summary.reported_calls, 1);
  assert.equal(summary.unreported_calls, 1);
  assert.equal(summarizePerformance([]).usage_coverage, null);
});

test('presentation weights AI latency by sample count and keeps HUMAN waits separate', () => {
  const human = row('HUMAN', { completed: 2, duration_samples: 2, mean_ms: 9_000 });
  const summary = summarizePerformance([
    row('BYTE', { completed: 2, failed: 1, duration_samples: 3, mean_ms: 100 }),
    row('CIPHER', { cancelled: 1, skipped: 2, duration_samples: 1, mean_ms: 500 }),
    human,
  ]);
  assert.equal(summary.mean_ms, 200);
  assert.equal(summary.duration_samples, 4);
  assert.equal(summary.completion_rate, 2 / 3);
  assert.equal(summary.human_samples, 2);
  assert.equal(summary.human_mean_ms, 9_000);
  assert.equal(summarizePerformance([human]).mean_ms, null);
});

const step = (id, ...dependsOn) => ({ id, agent: 'BYTE', dependsOn });
const chain = (size) => Array.from({ length: size }, (_, i) => step(`n${i}`, ...(i ? [`n${i - 1}`] : [])));

test('DAG accepts exactly 1–16 nodes and caps the total at 32 edges', () => {
  assert.equal(validateWorkflow({ nodes: chain(1) }).nodes.length, 1);
  assert.throws(() => validateWorkflow({ nodes: [] }), /1–16 nodes/);
  assert.throws(() => validateWorkflow({ nodes: chain(17) }), /1–16 nodes/);

  const nodes = chain(16); // 15 chain edges, plus 14 and 3 prior-node edges.
  nodes[15].dependsOn.push(...nodes.slice(0, 14).map(({ id }) => id));
  nodes[14].dependsOn.push('n0', 'n1', 'n2');
  const graph = validateWorkflow({ nodes });
  assert.equal(graph.nodes.reduce((total, node) => total + node.dependsOn.length, 0), 32);
  assert.equal(workflowLayers(graph).length, 16);
  nodes[14].dependsOn.push('n3');
  assert.throws(() => validateWorkflow({ nodes }), /exceeds 32 edges/);
});

test('DAG requires a single final sink and rejects invalid edges and cycles', () => {
  assert.throws(() => validateWorkflow({ nodes: [step('a'), step('b')] }), /exactly one final report/);
  assert.throws(() => validateWorkflow({ nodes: [step('a', 'a')] }), /self-referencing dependency/);
  assert.throws(() => validateWorkflow({ nodes: [step('a', 'missing')] }), /Missing.*dependency/);
  assert.throws(() => validateWorkflow({ nodes: [step('a'), step('b', 'a', 'a')] }), /unique ID list/);
  assert.throws(() => validateWorkflow({ nodes: [step('a', 'b'), step('b', 'a'), step('sink', 'b')] }), /cycle/);
  const graph = validateWorkflow({ nodes: [step('a'), step('b'), step('sink', 'a', 'b')] });
  assert.deepEqual(workflowLayers(graph).map((layer) => layer.map(({ id }) => id)), [['a', 'b'], ['sink']]);
});
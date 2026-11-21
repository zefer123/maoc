import { STOP_LABELS, REVIEW_PHASES, SKIP_LABELS } from '../../src/lib/afterActionReview.js';
import { AGENT_DEFINITIONS } from './agentRegistry.js';
import { record, requireValid, validateId } from './validation.js';

const exact = (value, fields) => record(value) && Object.keys(value).length === fields.length && Object.keys(value).every((key) => fields.includes(key));
const safeNode = (value) => typeof value === 'string' && /^[a-zA-Z][\w-]{0,39}$/.test(value);
const agent = (value) => Object.hasOwn(AGENT_DEFINITIONS, value) || value === 'HUMAN';
const duration = (value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const failure = (value) => exact(value, ['code', 'phase', 'node_id', 'http_status']) && Object.hasOwn(STOP_LABELS, value.code) && REVIEW_PHASES.includes(value.phase) && (value.node_id === null || safeNode(value.node_id)) && (value.http_status === null || Number.isInteger(value.http_status) && value.http_status >= 400 && value.http_status <= 599);

export function validateAfterActionEvidence(value, mission) {
  requireValid(exact(value, ['version', 'stop', 'archive', 'planned_sequence', 'nodes', 'reviews', 'human_waits', 'execution_failures', 'handoffs']) && value.version === 1, 'Invalid AAR evidence fields');
  requireValid(value.stop === null || failure(value.stop), 'Invalid AAR stop context');
  requireValid(mission.state !== 'COMPLETED' || value.stop === null, 'Completed mission cannot have stop failure');
  requireValid(mission.state === 'COMPLETED' || value.stop !== null, 'Unsuccessful mission requires observed stop context');
  requireValid(['not_configured', 'not_reached', 'completed', 'failed'].includes(value.archive), 'Invalid AAR archive state');
  requireValid(Number.isInteger(value.handoffs) && value.handoffs >= 0 && value.handoffs <= 41, 'Invalid AAR handoffs');
  requireValid(value.planned_sequence === null || Array.isArray(value.planned_sequence) && value.planned_sequence.length <= 41 && value.planned_sequence.every((id) => Object.hasOwn(AGENT_DEFINITIONS, id)), 'Invalid AAR sequence');
  const executions = new Map(mission.executions.map((execution) => [execution.id, execution]));
  requireValid(Array.isArray(value.execution_failures) && value.execution_failures.length <= 64, 'Invalid AAR execution failures');
  const failures = new Set();
  for (const item of value.execution_failures) {
    requireValid(exact(item, ['execution_id', 'failure']) && executions.has(item.execution_id) && !failures.has(item.execution_id) && ['FAILED', 'CANCELLED'].includes(executions.get(item.execution_id).state) && failure(item.failure), 'Invalid AAR execution failure');
    failures.add(item.execution_id);
  }
  requireValid(Array.isArray(value.nodes) && value.nodes.length <= 16, 'Invalid AAR nodes');
  const nodeIds = new Set();
  for (const node of value.nodes) {
    requireValid(exact(node, ['id', 'agent', 'depends_on', 'join', 'state', 'execution_id', 'condition', 'skip_code', 'failure_code']) && safeNode(node.id) && !nodeIds.has(node.id) && agent(node.agent), 'Invalid AAR node'); nodeIds.add(node.id);
    requireValid(['COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED'].includes(node.state) && ['all', 'any'].includes(node.join), 'Invalid AAR node state');
    requireValid(Array.isArray(node.depends_on) && node.depends_on.length <= 16 && new Set(node.depends_on).size === node.depends_on.length && node.depends_on.every(safeNode), 'Invalid AAR dependencies');
    requireValid(node.execution_id === null || executions.has(node.execution_id) && executions.get(node.execution_id).node_id === node.id && executions.get(node.execution_id).agent === node.agent, 'Invalid AAR execution link');
    requireValid(node.skip_code === null || Object.hasOwn(SKIP_LABELS, node.skip_code), 'Invalid AAR skip code');
    requireValid(node.failure_code === null || Object.hasOwn(STOP_LABELS, node.failure_code), 'Invalid AAR node failure');
    requireValid(node.condition === null || exact(node.condition, ['source', 'branch', 'outcome']) && safeNode(node.condition.source) && ['if', 'else'].includes(node.condition.branch) && ['selected', 'not_selected', 'not_evaluated', 'source_skipped', 'error'].includes(node.condition.outcome), 'Invalid AAR condition');
  }
  for (const node of value.nodes) requireValid(node.depends_on.every((id) => nodeIds.has(id) && id !== node.id) && (!node.condition || node.depends_on.includes(node.condition.source)), 'Invalid AAR node reference');
  const visiting = new Set(); const visited = new Set();
  const visit = (id) => {
    requireValid(!visiting.has(id), 'Cyclic AAR topology'); if (visited.has(id)) return;
    visiting.add(id); for (const parent of value.nodes.find((node) => node.id === id).depends_on) visit(parent);
    visiting.delete(id); visited.add(id);
  };
  for (const id of nodeIds) visit(id);
  requireValid((mission.mode === 'sequential' && value.nodes.length === 0) || (mission.mode !== 'sequential' && value.planned_sequence === null), 'Inconsistent AAR mission mode');
  if (value.stop && value.stop.node_id !== null) requireValid(nodeIds.has(value.stop.node_id), 'Unknown AAR stop node');
  for (const item of value.execution_failures) requireValid(item.failure.node_id === null || nodeIds.has(item.failure.node_id), 'Unknown AAR failure node');
  for (const node of value.nodes) {
    const execution = executions.get(node.execution_id);
    requireValid(node.state !== 'SKIPPED' || execution?.state === 'SKIPPED' && node.skip_code !== null, 'Skipped AAR node requires skip evidence');
    requireValid(node.skip_code === null || node.state === 'SKIPPED', 'AAR skip reason on active node');
    requireValid(node.condition?.outcome !== 'not_selected' || node.state === 'SKIPPED', 'Unselected AAR branch cannot execute');
    requireValid(node.condition?.outcome !== 'error' || ['CONDITION_UNAVAILABLE', 'CONDITION_INVALID'].includes(node.failure_code), 'AAR condition error requires routing evidence');
  }
  requireValid(Array.isArray(value.reviews) && value.reviews.length <= 41 && Array.isArray(value.human_waits) && value.human_waits.length <= 16, 'Invalid AAR waits');
  const reviewIds = new Set();
  for (const review of value.reviews) {
    requireValid(exact(review, ['id', 'agent', 'node_id', 'status', 'duration_ms']), 'Invalid AAR review fields'); validateId(review.id);
    requireValid(!reviewIds.has(review.id) && Object.hasOwn(AGENT_DEFINITIONS, review.agent) && (review.node_id === null || nodeIds.has(review.node_id)) && ['APPROVED', 'REJECTED', 'CANCELLED', 'TIMED_OUT'].includes(review.status) && duration(review.duration_ms), 'Invalid AAR review'); reviewIds.add(review.id);
  }
  const humanIds = new Set();
  for (const wait of value.human_waits) {
    requireValid(exact(wait, ['node_id', 'status', 'duration_ms']) && nodeIds.has(wait.node_id) && value.nodes.some((node) => node.id === wait.node_id && node.agent === 'HUMAN') && !humanIds.has(wait.node_id) && ['ANSWERED', 'CANCELLED', 'TIMED_OUT'].includes(wait.status) && duration(wait.duration_ms), 'Invalid AAR HUMAN wait'); humanIds.add(wait.node_id);
  }
  return structuredClone(value);
}

export function collectAfterActionEvidence(task) {
  const trace = task.reviewTrace;
  return { version: 1, stop: trace.stop, archive: trace.archive, planned_sequence: trace.sequence, handoffs: task.handoffs,
    execution_failures: trace.executionFailures, reviews: trace.reviews, human_waits: trace.humanWaits,
    nodes: (task.workflow?.nodes || []).map((node) => {
      const state = task.workflowNodes.find((item) => item.id === node.id);
      const execution = task.observations.find((item) => item.node_id === node.id);
      return { id: node.id, agent: node.agent, depends_on: [...node.dependsOn], join: node.join || 'all', state: state.state,
        execution_id: execution?.id || null, skip_code: trace.skips.get(node.id) || null, failure_code: trace.nodeFailures.get(node.id) || null,
        condition: node.when ? { source: node.when.source, branch: node.when.branch,
          outcome: ['CONDITION_UNAVAILABLE', 'CONDITION_INVALID'].includes(trace.nodeFailures.get(node.id)) ? 'error' : state.condition_result === true ? 'selected' : state.condition_result === false ? 'not_selected' : trace.skips.get(node.id) === 'SOURCE_SKIPPED' ? 'source_skipped' : 'not_evaluated' } : null };
    }) };
}
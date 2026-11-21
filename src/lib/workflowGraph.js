import { AGENTS } from '../data/agents.js';

const AGENT_IDS = new Set(AGENTS.map((agent) => agent.id));
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };
export const CONDITION_OPERATORS = Object.freeze(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);
const reviewers = new Set(['SAGE', 'LEX', 'CIPHER']);

function validateCondition(value) {
  check(record(value) && Object.keys(value).every((key) => ['source', 'tool', 'path', 'operator', 'value', 'branch'].includes(key)), 'Invalid condition fields');
  check(typeof value.source === 'string', 'Condition requires a source node');
  check(typeof value.tool === 'string' && /^[a-zA-Z][\w-]{0,63}$/.test(value.tool), 'Condition requires a tool name');
  check(typeof value.path === 'string' && value.path.length <= 200 && value.path.split('.').length <= 8 && value.path.split('.').every((part) => /^[a-zA-Z0-9_-]+$/.test(part) && !['__proto__', 'prototype', 'constructor'].includes(part)), 'Condition requires a safe dot-separated result path (maximum 8 segments)');
  check(CONDITION_OPERATORS.includes(value.operator), 'Unknown condition operator');
  check(['if', 'else'].includes(value.branch), 'Condition branch must be if or else');
  check(typeof value.value === 'boolean' || (typeof value.value === 'number' && Number.isFinite(value.value)) || (typeof value.value === 'string' && value.value.length <= 200), 'Condition value must be a boolean, finite number or string up to 200 characters');
  check(['eq', 'neq'].includes(value.operator) || typeof value.value === 'number', 'Ordered comparisons require a number');
  return { source: value.source, tool: value.tool, path: value.path, operator: value.operator, value: value.value, branch: value.branch };
}

// Own properties only; never evaluate expressions, coerce types or interpret model prose.
export function evaluateWorkflowCondition(condition, result) {
  let actual = result;
  for (const part of condition.path.split('.')) {
    check(actual !== null && typeof actual === 'object' && Object.hasOwn(actual, part), 'Condition result path is missing');
    actual = actual[part];
  }
  check(typeof actual === typeof condition.value && (typeof actual !== 'number' || Number.isFinite(actual)), 'Condition result type mismatch');
  const comparisons = { eq: () => actual === condition.value, neq: () => actual !== condition.value,
    gt: () => actual > condition.value, gte: () => actual >= condition.value, lt: () => actual < condition.value, lte: () => actual <= condition.value };
  check(Object.hasOwn(comparisons, condition.operator), 'Unknown condition operator');
  const matched = comparisons[condition.operator]();
  return condition.branch === 'if' ? matched : !matched;
}

// Shared by the editor and backend; the backend always validates again before execution.
export function validateWorkflow(value) {
  check(record(value) && Object.keys(value).every((key) => ['nodes', 'maxConcurrency', 'messaging'].includes(key)), 'Workflow accepts only nodes, maxConcurrency and messaging');
  check(value.messaging === undefined || typeof value.messaging === 'boolean', 'Workflow messaging must be a boolean');
  check(Array.isArray(value.nodes) && value.nodes.length > 0 && value.nodes.length <= 16, 'Workflow requires 1–16 nodes');
  const maxConcurrency = value.maxConcurrency ?? 2;
  check(Number.isInteger(maxConcurrency) && maxConcurrency >= 1 && maxConcurrency <= 4, 'Workflow concurrency must be 1–4');
  const ids = new Set();
  const nodes = value.nodes.map((node) => {
    check(record(node) && Object.keys(node).every((key) => ['id', 'agent', 'dependsOn', 'prompt', 'when', 'join'].includes(key)), 'Invalid workflow node fields');
    check(typeof node.id === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(node.id) && !ids.has(node.id), 'Node IDs must be unique safe identifiers (1–40 characters)');
    check(AGENT_IDS.has(node.agent) || node.agent === 'HUMAN', 'Unknown workflow agent');
    if (node.agent === 'HUMAN') check(typeof node.prompt === 'string' && node.prompt.trim().length > 0 && node.prompt.length <= 2000, 'Human nodes require a question of 1–2000 characters');
    else check(node.prompt === undefined, 'Only human nodes accept a question');
    check(Array.isArray(node.dependsOn) && node.dependsOn.length <= 16 && node.dependsOn.every((id) => typeof id === 'string') && new Set(node.dependsOn).size === node.dependsOn.length, 'Node dependencies must be a unique ID list');
    check(node.join === undefined || ['all', 'any'].includes(node.join), 'Join must be all or any');
    const when = node.when === undefined ? undefined : validateCondition(node.when);
    ids.add(node.id);
    return { id: node.id, agent: node.agent, dependsOn: [...node.dependsOn], ...(node.agent === 'HUMAN' ? { prompt: node.prompt.trim() } : {}), ...(when ? { when } : {}), ...(node.join === undefined ? {} : { join: node.join }) };
  });
  check(nodes.reduce((count, node) => count + node.dependsOn.length, 0) <= 32, 'Workflow exceeds 32 edges');
  for (const node of nodes) check(node.dependsOn.every((id) => ids.has(id) && id !== node.id), 'Missing or self-referencing dependency');
  const workflow = { nodes, maxConcurrency, ...(value.messaging === undefined ? {} : { messaging: value.messaging }) };
  workflowLayers(workflow);
  for (const node of nodes) {
    if (node.when) {
      check(node.dependsOn.includes(node.when.source) && nodes.some((source) => source.id === node.when.source && source.agent !== 'HUMAN'), 'Condition source must be a direct AI dependency');
    }
    if (reviewers.has(node.agent)) check(!node.when && !nodes.some((source) => source.when && workflowAncestors(workflow, node.id).has(source.id)), 'Report reviewers cannot be conditional or downstream of conditional nodes; place review before branching');
  }
  const parents = new Set(nodes.flatMap((node) => node.dependsOn));
  check(nodes.filter((node) => !parents.has(node.id)).length === 1, 'Workflow needs exactly one final report node; join all branches');
  check(!nodes.find((node) => !parents.has(node.id)).when, 'Final report node must be unconditional');
  return workflow;
}

export function workflowLayers(workflow) {
  const done = new Set();
  const layers = [];
  while (done.size < workflow.nodes.length) {
    const ready = workflow.nodes.filter((node) => !done.has(node.id) && node.dependsOn.every((id) => done.has(id)));
    check(ready.length > 0, 'Workflow contains a cycle or missing dependency');
    layers.push(ready);
    ready.forEach((node) => done.add(node.id));
  }
  return layers;
}

export function workflowAncestors(workflow, id) {
  const ancestors = new Set();
  const visit = (nodeId) => {
    for (const parent of workflow.nodes.find((node) => node.id === nodeId).dependsOn) {
      if (!ancestors.has(parent)) { ancestors.add(parent); visit(parent); }
    }
  };
  visit(id);
  return ancestors;
}

export function createWorkflowExample() {
  return { maxConcurrency: 2, nodes: [
    { id: 'brief', agent: 'ARIA', dependsOn: [] },
    { id: 'architecture', agent: 'NOVA', dependsOn: ['brief'] },
    { id: 'research', agent: 'SCOUT', dependsOn: ['brief'] },
    { id: 'report', agent: 'HERMES', dependsOn: ['architecture', 'research'] }
  ] };
}

export function createHumanWorkflowExample() {
  return { maxConcurrency: 2, nodes: [
    { id: 'brief', agent: 'ARIA', dependsOn: [] },
    { id: 'human', agent: 'HUMAN', prompt: 'Review the brief. What requirements, constraints or corrections should the final report use?', dependsOn: ['brief'] },
    { id: 'report', agent: 'HERMES', dependsOn: ['human'] }
  ] };
}

export function createConditionalWorkflowExample() {
  const condition = { source: 'inspect', tool: 'agent-registry', path: 'agents.0.id', operator: 'eq', value: 'TAEC' };
  return { maxConcurrency: 2, nodes: [
    { id: 'inspect', agent: 'ARIA', dependsOn: [] },
    { id: 'matched', agent: 'NOVA', dependsOn: ['inspect'], when: { ...condition, branch: 'if' } },
    { id: 'fallback', agent: 'BYTE', dependsOn: ['inspect'], when: { ...condition, branch: 'else' } },
    { id: 'report', agent: 'HERMES', dependsOn: ['matched', 'fallback'], join: 'any' }
  ] };
}
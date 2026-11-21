import { validateWorkflow } from './workflowGraph.js';
import { validateSwarm } from './swarmGraph.js';

export const TEMPLATE_LIMITS = Object.freeze({ count: 50, parameters: 16, occurrences: 128, valueLength: 2000 });
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const forbiddenNames = new Set(['__proto__', 'prototype', 'constructor']);
const token = /\{\{([a-zA-Z][a-zA-Z0-9_]{0,31})\}\}/g;

function parameterNames(texts) {
  const names = new Set(); let occurrences = 0;
  for (const text of texts) {
    const remainder = text.replace(token, (match, name, offset) => {
      check(text[offset - 1] !== '{' && text[offset + match.length] !== '}', 'Nested template delimiters are not supported');
      check(!forbiddenNames.has(name), 'Reserved template parameter name');
      names.add(name); occurrences += 1; return '';
    });
    check(!remainder.includes('{{') && !remainder.includes('}}'), 'Use only {{name}} placeholders (letters, digits, underscore; 1–32 characters, starting with a letter)');
  }
  check(names.size <= TEMPLATE_LIMITS.parameters, 'Template allows at most 16 parameters');
  check(occurrences <= TEMPLATE_LIMITS.occurrences, 'Template allows at most 128 placeholder occurrences');
  return [...names];
}

export function validateTaskTemplate(value) {
  check(record(value) && Object.keys(value).every((key) => ['name', 'description', 'workflow', 'swarm'].includes(key)), 'Template accepts only name, description, workflow and swarm');
  check(typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 100, 'Template name requires 1–100 characters');
  check(typeof value.description === 'string' && value.description.trim().length > 0 && value.description.length <= 12000, 'Template mission requires 1–12000 characters');
  check(value.workflow === undefined || value.swarm === undefined, 'Submit either workflow or swarm, not both');
  const workflow = value.workflow === undefined ? undefined : validateWorkflow(value.workflow);
  const swarm = value.swarm === undefined ? undefined : validateSwarm(value.swarm);
  const description = value.description.trim();
  parameterNames([description, ...(workflow?.nodes.filter((node) => node.agent === 'HUMAN').map((node) => node.prompt) || [])]);
  // Topology and routing are authored by the user, never parameterized.
  for (const marker of description.match(/\[(?:TEAM|COWORK):[^\]]*\]/gi) || []) {
    check(!marker.includes('{{') && !marker.includes('}}'), 'Routing directives cannot contain template parameters');
  }
  return { name: value.name.trim(), description, ...(workflow ? { workflow } : {}), ...(swarm ? { swarm } : {}) };
}

export function templateParameters(value) {
  const config = validateTaskTemplate(value);
  return parameterNames([config.description, ...(config.workflow?.nodes.filter((node) => node.agent === 'HUMAN').map((node) => node.prompt) || [])]);
}

// Literal, single-pass substitution only. Values are not evaluated or reparsed as placeholders.
export function renderTaskTemplate(value, parameters) {
  const config = validateTaskTemplate(value);
  const names = templateParameters(config);
  check(record(parameters) && Object.keys(parameters).every((key) => names.includes(key)), 'Parameters must be an object with only declared names');
  const values = Object.create(null);
  for (const name of names) {
    check(Object.hasOwn(parameters, name) && typeof parameters[name] === 'string' && parameters[name].trim().length > 0 && parameters[name].length <= TEMPLATE_LIMITS.valueLength, `Parameter ${name} requires 1–2000 characters`);
    check(!/\[(?:TEAM|COWORK):/i.test(parameters[name]), `Parameter ${name} cannot contain routing directives`);
    values[name] = parameters[name];
  }
  const substitute = (text) => text.replace(token, (_, name) => values[name]);
  const description = substitute(config.description);
  check(description.trim().length > 0 && description.length <= 12000, 'Expanded mission exceeds 12000 characters');
  // Prevent markers assembled across source/value boundaries, not just complete value markers.
  const directives = (text) => text.match(/\[(?:TEAM|COWORK):[^\]]*\]/gi) || [];
  check(JSON.stringify(directives(description)) === JSON.stringify(directives(config.description)), 'Parameters cannot create or alter routing directives');
  const workflow = config.workflow ? validateWorkflow({ ...config.workflow, nodes: config.workflow.nodes.map((node) => node.agent === 'HUMAN' ? { ...node, prompt: substitute(node.prompt) } : node) }) : undefined;
  return { description: description.trim(), ...(workflow ? { workflow } : {}), ...(config.swarm ? { swarm: config.swarm } : {}) };
}
import { validateWorkflow } from './workflowGraph.js';
import { validateSwarm } from './swarmGraph.js';

export const SCHEDULE_LIMITS = Object.freeze({ count: 20, minMinutes: 5, maxMinutes: 43200, maxRuns: 100, active: 2 });
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };

export function validateRecurrence(value) {
  check(object(value) && ['interval', 'daily', 'weekly'].includes(value.kind), 'Recurrence must be interval, daily or weekly');
  const keys = value.kind === 'interval' ? ['kind', 'minutes'] : value.kind === 'daily' ? ['kind', 'time'] : ['kind', 'time', 'weekday'];
  check(Object.keys(value).every((key) => keys.includes(key)), 'Unknown recurrence field');
  if (value.kind === 'interval') {
    check(Number.isInteger(value.minutes) && value.minutes >= SCHEDULE_LIMITS.minMinutes && value.minutes <= SCHEDULE_LIMITS.maxMinutes, 'Interval must be 5–43200 whole minutes');
    return { kind: value.kind, minutes: value.minutes };
  }
  check(typeof value.time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time), 'UTC time must be HH:mm');
  if (value.kind === 'weekly') check(Number.isInteger(value.weekday) && value.weekday >= 0 && value.weekday <= 6, 'Weekday must be 0–6 (Sunday–Saturday)');
  return { kind: value.kind, time: value.time, ...(value.kind === 'weekly' ? { weekday: value.weekday } : {}) };
}

export function validateSchedule(value) {
  check(object(value) && Object.keys(value).every((key) => ['name', 'description', 'workflow', 'swarm', 'recurrence', 'maxRuns'].includes(key)), 'Schedule accepts only name, description, workflow, swarm, recurrence and maxRuns');
  check(typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 100, 'Schedule name requires 1–100 characters');
  check(typeof value.description === 'string' && value.description.trim().length > 0 && value.description.length <= 12000, 'Mission requires 1–12000 characters');
  check(value.workflow === undefined || value.swarm === undefined, 'Submit either workflow or swarm, not both');
  const maxRuns = value.maxRuns === undefined ? 10 : value.maxRuns;
  check(Number.isInteger(maxRuns) && maxRuns >= 1 && maxRuns <= SCHEDULE_LIMITS.maxRuns, 'Maximum runs must be 1–100');
  return { name: value.name.trim(), description: value.description.trim(), recurrence: validateRecurrence(value.recurrence), maxRuns,
    ...(value.workflow === undefined ? {} : { workflow: validateWorkflow(value.workflow) }),
    ...(value.swarm === undefined ? {} : { swarm: validateSwarm(value.swarm) }) };
}

// Always strictly future, using UTC calendar arithmetic; missed slots are never replayed.
export function nextOccurrence(recurrence, after) {
  const rule = validateRecurrence(recurrence);
  check(Number.isFinite(after) && Math.abs(after) <= 8e15, 'Invalid scheduler clock');
  if (rule.kind === 'interval') return after + rule.minutes * 60000;
  const date = new Date(after);
  const [hour, minute] = rule.time.split(':').map(Number);
  date.setUTCHours(hour, minute, 0, 0);
  if (rule.kind === 'weekly') date.setUTCDate(date.getUTCDate() + (rule.weekday - date.getUTCDay() + 7) % 7);
  if (date.getTime() <= after) date.setUTCDate(date.getUTCDate() + (rule.kind === 'weekly' ? 7 : 1));
  return date.getTime();
}

export function recurrenceLabel(recurrence) {
  if (recurrence.kind === 'interval') return `Every ${recurrence.minutes} minutes`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${recurrence.kind === 'daily' ? 'Daily' : days[recurrence.weekday]} ${recurrence.time} UTC`;
}
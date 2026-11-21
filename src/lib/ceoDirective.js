import { TEAMS } from '../data/teams.js';
import { accessFetch } from './accessClient.js';
import { validateWorkflow } from './workflowGraph.js';

const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TECH = TEAMS.find(({ id }) => id === 'tech').agentIds;
const TASK_ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export function compileDirective({ teamId, mode, includeSenior = false, text }) {
  const team = TEAMS.find(({ id }) => id === teamId);
  if (!team || !['review', 'direct'].includes(mode)) throw new Error('Select a valid department and route.');
  const brief = text.trim();
  if (!brief) throw new Error('Enter a directive before reviewing.');
  const description = `[TEAM:${team.id.toUpperCase()}] ${brief}`;
  if (description.length > 12000) throw new Error('The directive exceeds the backend limit (12,000 characters with routing).');
  const nodes = [{ id: 'aria', agent: 'ARIA', dependsOn: [] }];
  if (mode === 'review') nodes.push({ id: 'ceo-review', agent: 'HUMAN', dependsOn: ['aria'], prompt: 'Review ARIA’s brief. Submit any constraints or corrections to continue, or cancel to stop before the department starts.' });
  const roster = [...new Set([...(includeSenior ? TECH : []), ...team.agentIds])];
  for (const agent of roster.filter((id) => id !== 'ARIA')) {
    nodes.push({ id: agent.toLowerCase(), agent, dependsOn: [nodes.at(-1).id] });
  }
  return { description, workflow: validateWorkflow({ maxConcurrency: 1, nodes }) };
}

// A missing receipt is not proof that the server failed to create the task. Never retry here.
export async function postDirective(mission, fetcher = accessFetch) {
  const unknown = () => Object.assign(new Error('ยืนยันผลการส่งไม่ได้ ให้ตรวจ Missions ก่อนส่งอีกครั้ง'), { outcomeUnknown: true });
  let response;
  try {
    response = await fetcher(`${API_BASE}/api/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mission), signal: AbortSignal.timeout(15000)
    });
  } catch { throw unknown(); }
  const data = await response.json().catch(() => null);
  if (response.status === 201 && TASK_ID.test(data?.task_id || '')) return data.task_id;
  if ([400, 409, 429, 503].includes(response.status) && typeof data?.error === 'string') {
    throw new Error(data.error);
  }
  throw unknown();
}
import { AGENTS } from '../data/agents.js';
import { TEAMS } from '../data/teams.js';
import { taskDepartment } from './dashboardModel.js';

// Relationships come from retained data, never static agent statuses or sample charts.
export function teamWorkspace(teamId, { tasks = [], events = [], artifacts = [] } = {}) {
  const team = TEAMS.find((entry) => entry.id === teamId);
  if (!team) return null;
  const agents = AGENTS.filter((agent) => agent.team === teamId);
  const ids = new Set(agents.map((agent) => agent.id));
  const teamEvents = events.filter((event) => ids.has(event.source_agent) || ids.has(event.target_agent));
  const eventTasks = new Set(teamEvents.map((event) => event.task_id).filter(Boolean));
  const related = tasks.filter((task) => task.department === teamId || taskDepartment(task) === teamId ||
    task.workflowNodes?.some((node) => ids.has(node.agent)) || task.swarm?.agents?.some((id) => ids.has(id)) ||
    ids.has(task.swarm?.synthesizer) || eventTasks.has(task.taskId));
  return { team, agents, tasks: related, events: teamEvents.slice(-8).reverse(),
    artifacts: artifacts.filter((item) => item.deptId === teamId),
    running: related.filter((task) => task.state === 'RUNNING').length,
    waiting: related.filter((task) => task.state === 'AWAITING_HITL').length };
}
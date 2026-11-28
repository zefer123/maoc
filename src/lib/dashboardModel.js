export const DASHBOARD_SECTIONS = Object.freeze([
  { id: 'overview', label: 'Overview', description: 'Start work and see what needs attention' },
  { id: 'missions', label: 'Missions', description: 'Track missions, templates and schedules' },
  { id: 'teams', label: 'Teams', description: 'Explore teams, Agents and their connections' },
  { id: 'library', label: 'Library', description: 'Deliverables and notes in the Local Vault' },
  { id: 'activity', label: 'Activity', description: 'Answer questions, review reports and inspect events' },
  { id: 'settings', label: 'Settings', description: 'AI providers, limits and workspace data' }
]);

export function taskCounts(tasks) {
  return tasks.reduce((counts, task) => {
    const key = task.state === 'RUNNING' ? 'running' : task.state === 'AWAITING_HITL' ? 'waiting'
      : task.state === 'COMPLETED' ? 'completed' : 'failed';
    counts[key] += 1; return counts;
  }, { running: 0, waiting: 0, completed: 0, failed: 0 });
}

export const cleanMission = (text = '') => text.replace(/\[TEAM:[A-Z]+\]\s*/gi, '').replace(/\[COWORK:[^\]]+\]\s*/gi, '').trim();
export function taskDepartment(task) {
  return task.description?.match(/\[TEAM:([a-z]+)\]/i)?.[1].toLowerCase() || null;
}
export function dashboardNotices(events, includeActionRequests = false) {
  return events.filter((event) => event.event_type === 'TASK_COMPLETED' ||
    (includeActionRequests && ['HUMAN_INPUT_REQUESTED', 'HITL_INTERRUPT'].includes(event.event_type)) ||
    (event.event_type === 'SCHEDULE_UPDATED' && ['FAILED', 'REJECTED', 'CANCELLED'].includes(event.schedule?.last?.status)))
    .slice(-60).reverse();
}

// Read-only projection of the existing runtime/feed, never provider health or approval.
export function overviewSnapshot({ tasks, actionCount, connectionState, notices, readIds }) {
  return {
    running: taskCounts(tasks).running,
    needsYou: actionCount,
    connected: connectionState === 'live',
    connectionLabel: connectionState === 'live' ? 'Connected' : connectionState === 'connecting' ? 'Connecting' : 'Offline',
    unread: notices.filter((notice) => !readIds.has(notice.event_id)).length,
    preview: notices.slice(0, 5)
  };
}
export const isSavedDeliverable = (item) => Boolean(item && !/^(seed-|art-\d+$)/.test(String(item.id)));

function archivedTaskId(item) {
  const explicit = [item.taskId, item.task_id].filter((value) => typeof value === 'string' && value.length > 0);
  if (explicit.length === 2 && explicit[0] !== explicit[1]) return null;
  return explicit[0] ?? (typeof item.id === 'string' && item.id.startsWith('task-') ? item.id.slice(5) || null : null);
}

export function realDeliverables(data) {
  // Historical sample artifacts are kept in storage, but are never presented as live results.
  return Object.entries(data || {}).flatMap(([deptId, items]) => (Array.isArray(items) ? items : [])
      .filter(isSavedDeliverable)
    .map((item) => ({ ...item, deptId, taskId: archivedTaskId(item) }))).reverse();
}

export const missionDeliverables = (items, taskId) => items.filter((item) => item.taskId === taskId);
export const deliverableReadState = (status) => status === 'pending' ? 'loading' : ['conflict', 'invalid', 'offline'].includes(status) ? 'unavailable' : 'ready';
export function pendingReviews(events, tasks) {
  const resolved = new Set(events.filter((event) => event.approval_id && event.event_type !== 'HITL_INTERRUPT').map((event) => event.approval_id));
  const terminal = new Set(tasks.filter((task) => !['RUNNING', 'AWAITING_HITL'].includes(task.state)).map((task) => task.taskId));
  const unique = new Map();
  for (const event of events) if (event.event_type === 'HITL_INTERRUPT' && event.approval_id && !resolved.has(event.approval_id) && !terminal.has(event.task_id)) unique.set(event.approval_id, event);
  return [...unique.values()];
}
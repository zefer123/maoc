import { accessFetch } from './accessClient.js';
import { cleanMission } from './dashboardModel.js';

const base = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
const failed = (state) => ['FAILED', 'REJECTED'].includes(state);
const row = (kind, id, taskId = id) => ({ kind, id, taskId });

export function noticeTarget(event) {
  if (event.event_type === 'HUMAN_INPUT_REQUESTED' && event.human_input?.input_id) return row('human', event.human_input.input_id, event.task_id);
  if (event.event_type === 'HITL_INTERRUPT' && event.approval_id) return row('report', event.approval_id, event.task_id);
  if (event.event_type === 'SCHEDULE_UPDATED') return { ...row('notice', event.event_id, event.task_id), event };
  return event.task_id ? row('mission', event.task_id) : null;
}

export function actionNotice(event) {
  if (event.event_type === 'HUMAN_INPUT_REQUESTED') return 'HUMAN · contribution requested';
  if (event.event_type === 'HITL_INTERRUPT') return `${event.source_agent} · report approval requested`;
  return null;
}

export function attentionSections(tasks, events, humans, reports, history) {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const label = (id) => cleanMission(byId.get(id)?.description) || id;
  const warnings = new Map();
  for (const event of events) {
    if (event.event_type !== 'TOOL_CALL' || !event.tool_name || !['RUNNING', 'AWAITING_HITL'].includes(byId.get(event.task_id)?.state)) continue;
    warnings.set(JSON.stringify([event.task_id, event.node_id, event.source_agent, event.tool_name]), event);
  }
  return [
    { id: 'blocked', label: 'Blocked', items: tasks.filter((task) => failed(task.state)).slice(-8).reverse().map(({ taskId, state }) => ({ ...row('mission', taskId), label: label(taskId), status: state })) },
    { id: 'degraded', label: 'Degraded', items: [...(history?.persistence === 'degraded' ? [{ ...row('history-health', 'history-health', null), label: 'Mission history persistence', status: 'DEGRADED' }] : []), ...[...warnings.values()].filter((event) => event.tool_status === 'error').slice(-5).reverse().map((event) => ({ ...row('notice', event.event_id, event.task_id), event, label: label(event.task_id), status: `${event.tool_name} · Tool error` }))] },
    { id: 'report', label: 'Report Approval', items: reports.map(({ approval_id, task_id, source_agent }) => ({ ...row('report', approval_id, task_id), label: label(task_id), status: source_agent })) },
    { id: 'waiting', label: 'Waiting', items: [
      ...humans.map(({ input_id, task_id, mission }) => ({ ...row('human', input_id, task_id), label: cleanMission(mission) || label(task_id), status: 'HUMAN' })),
      ...(history?.missions || []).filter((mission) => mission.state === 'INTERRUPTED').slice(0, 8).map((mission) => ({ ...row('interrupted', mission.task_id), history: mission, label: mission.task_id, status: 'INTERRUPTED' }))
    ] }
  ];
}

export async function fetchMissionHistory(signal) {
  const response = await accessFetch(`${base}/api/mission-history`, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
  if (!response.ok) throw new Error('Mission history unavailable');
  return response.json();
}
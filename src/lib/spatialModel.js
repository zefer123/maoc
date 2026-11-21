import { AGENTS } from '../data/agents.js';
import { taskDepartment } from './dashboardModel.js';

const teamsByAgent = Object.fromEntries(AGENTS.map((agent) => [agent.id, agent.team]));
const active = (task) => ['RUNNING', 'AWAITING_HITL'].includes(task.state);
const labels = { running: 'กำลังทำงาน', thinking: 'กำลังคิด', queued: 'รอคิว Provider', tool: 'กำลังเรียก Tool', human: 'รอ HUMAN', review: 'รอตรวจรายงาน' };
const rank = { running: 1, queued: 2, thinking: 3, tool: 4, human: 5, review: 6 };
const teamOf = (agent) => agent === 'HUMAN' ? 'command' : Object.hasOwn(teamsByAgent, agent) ? teamsByAgent[agent] : undefined;
export const spatialLabel = (signal) => signal?.label || 'ไม่มีงานที่ยืนยัน';

export function spatialActivity(tasks, events, inputs, approvals, connected) {
  const agents = {}, teams = {};
  if (!connected) return { agents, teams };
  const set = (group, id, kind, taskId, label = labels[kind]) => {
    if (id && (!group[id] || rank[kind] >= rank[group[id].kind])) group[id] = { kind, taskId, label };
  };
  const latest = new Map();
  const humanHandoffs = new Map();
  for (const e of events) {
    if (e.task_id && e.event_type === 'HANDOFF' && e.target_agent === 'HUMAN') humanHandoffs.set(e.task_id, e.source_agent);
    const key = `${e.task_id}/${e.node_id || e.source_agent}`;
    if (e.task_id && e.event_type === 'TOOL_CALL') latest.set(key, 'tool_finished');
    if (e.task_id && e.event_type === 'AGENT_THINKING' && ['node_started', 'request', 'queued', 'failover', 'response', 'tool_started', 'completed', 'node_completed'].includes(e.stage)) {
      latest.set(key, e.stage);
    }
  }
  for (const task of tasks.filter(active)) {
    const id = task.taskId;
    const team = task.department || taskDepartment(task);
    set(teams, team, 'running', id, 'ภารกิจกำลังดำเนินการ');
    for (const agent of AGENTS) {
      const keys = task.workflowNodes ? task.workflowNodes.filter((n) => n.agent === agent.id && n.state === 'RUNNING').map((n) => n.id) : [agent.id];
      for (const key of keys) {
        const stage = latest.get(`${id}/${key}`);
        if (!task.workflowNodes && (!stage || stage === 'completed')) continue;
        const kind = stage === 'tool_started' ? 'tool' : stage === 'request' ? 'thinking' : stage === 'queued' ? 'queued' : 'running';
        set(agents, agent.id, kind, id);
        set(teams, agent.team, kind, id);
      }
    }
    if (inputs.some((entry) => entry.task_id === id)) {
      set(teams, team || 'command', 'human', id);
      set(teams, 'command', 'human', id);
      // The Quick Directive has one HUMAN gate. Do not guess a desk in other graphs.
      if (task.workflowNodes?.filter((node) => node.agent === 'HUMAN').length === 1) {
        const sender = humanHandoffs.get(id);
        if (sender !== 'HUMAN' && teamOf(sender)) set(agents, sender, 'human', id, 'ส่งต่อแล้ว · รอ HUMAN');
      }
    }
    for (const approval of approvals.filter((event) => event.task_id === id)) {
      const reviewer = approval.source_agent;
      const label = `${labels.review} · ${reviewer}`;
      set(agents, reviewer, 'review', id, label);
      set(teams, teamOf(reviewer), 'review', id, label);
      set(teams, team, 'review', id, label);
    }
  }
  return { agents, teams };
}

// A bounded retained-event history, not throughput over the lifetime of the server.
export function teamEventHistory(events, teamId, now, buckets = 16, intervalMs = 5000) {
  const values = Array(buckets).fill(0);
  const end = Math.floor(now / intervalMs) * intervalMs + intervalMs;
  const start = end - buckets * intervalMs;
  for (const event of events) {
    const at = Date.parse(event.timestamp);
    if (!Number.isFinite(at) || at < start || at > now || at >= end) continue;
    if (teamsByAgent[event.source_agent] !== teamId && teamsByAgent[event.target_agent] !== teamId) continue;
    values[Math.floor((at - start) / intervalMs)] += 1;
  }
  return values;
}

// Directed, expiring links, independent of decorative causeways.
export function recentHandoffs(events, now, windowMs = 3000) {
  const links = new Map();
  for (const event of events) {
    if (event.event_type !== 'HANDOFF' || !event.task_id) continue;
    const at = Date.parse(event.timestamp);
    if (!Number.isFinite(at) || at > now || now - at > windowMs) continue;
    const fromTeam = teamOf(event.source_agent), toTeam = teamOf(event.target_agent);
    if (!fromTeam || !toTeam || event.source_agent === event.target_agent) continue;
    links.set(`${event.source_agent}:${event.target_agent}`, { from: event.source_agent, to: event.target_agent, fromTeam, toTeam });
  }
  return [...links.values()];
}

export function fitSpatialScale(width, height, worldWidth = 1200, worldHeight = 850) {
  return Math.max(0.2, Math.min(1, (width - 32) / worldWidth, (height - 112) / worldHeight));
}
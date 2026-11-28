import { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AGENTS } from '../../data/agents.js';
import { cleanMission, missionDeliverables } from '../../lib/dashboardModel.js';
import { actionNotice } from '../../lib/workspaceAttention.js';
import { ReportReview } from './DashboardActivity.jsx';
import HumanInputCard from './HumanInputCard.jsx';
import WorkflowNodeStatus from './WorkflowNodeStatus.jsx';

function MissionPreview({ id, task, events, artifacts, humans, reports, onOpen }) {
  const related = events.filter((event) => event.task_id === id).slice(-20).reverse();
  const results = missionDeliverables(artifacts, id);
  return <div className="i47-overlay-mission">
    <p className="dash-caption">Task ID: {id}</p>
    {task ? <><h3>{cleanMission(task.description) || 'Mission'}</h3><p className="dash-state">{task.state} · {task.progress || 0}%</p></> : <p>Mission is not in the retained runtime. Only matching evidence is shown.</p>}
    {(humans.length > 0 || reports.length > 0) && <section><h3>Pending actions for this mission</h3><div className="i47-actions">
      {humans.map((input) => <button key={input.input_id} className="dash-button" type="button" onClick={() => onOpen({ kind: 'human', id: input.input_id, taskId: id })}>Respond to HUMAN · {input.node_id}</button>)}
      {reports.map((review) => <button key={review.approval_id} className="dash-button" type="button" onClick={() => onOpen({ kind: 'report', id: review.approval_id, taskId: id })}>Review report · {review.source_agent}</button>)}
    </div></section>}
    {task?.workflowNodes?.length > 0 && <details><summary>Workflow steps</summary><ul>{task.workflowNodes.map((node) => <li key={node.id}><strong>{node.id} · {node.agent} · {node.state}</strong><WorkflowNodeStatus node={node} /></li>)}</ul></details>}
    {results.length > 0 && <details><summary>Saved results ({results.length})</summary>{results.map((item) => <details key={item.id}><summary>{item.title || 'Saved result'}</summary>{(Array.isArray(item.paragraphs) && item.paragraphs.length ? item.paragraphs : [item.summary]).map((text, index) => <p key={index}>{text}</p>)}</details>)}</details>}
    {related.length > 0 && <details><summary>Recent mission events ({related.length})</summary><ul>{related.map((event) => <li key={event.event_id}><strong>{event.event_type}</strong><p>{actionNotice(event) || event.payload_summary}</p></li>)}</ul></details>}
  </div>;
}

export default function WorkspaceOverlay({ target, tasks, events, artifacts, humans, reports, signals, connectionState, onClose, onOpen, onRespond, onResolve }) {
  const dialog = useRef(null), title = useRef(null), body = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const ownDecision = useRef(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  useLayoutEffect(() => {
    title.current?.focus({ preventScroll: true }); body.current?.scrollTo(0, 0);
  }, [target.kind, target.id]);
  const live = connectionState === 'live';
  const task = tasks.find((item) => item.taskId === target.taskId);
  const input = target.kind === 'human' && humans.find((item) => item.input_id === target.id);
  const report = target.kind === 'report' && reports.find((item) => item.approval_id === target.id);
  const crew = target.kind === 'crew' && AGENTS.find((item) => item.id === target.id);
  const signal = crew && live && signals[crew.id];
  const mission = (id) => onOpen({ kind: 'mission', id, taskId: id });
  const pending = target.kind === 'human' || target.kind === 'report';
  useLayoutEffect(() => {
    if (pending && !input && !report && !dialog.current.contains(document.activeElement)) title.current?.focus({ preventScroll: true });
  }, [pending, input, report]);
  const act = async (handler, ...args) => {
    setSubmitting(true);
    try {
      const result = await handler(...args);
      ownDecision.current = target.id;
      return result;
    } finally { setSubmitting(false); }
  };
  const labels = { human: 'HUMAN contribution', report: 'Report Approval', mission: 'Mission details', interrupted: 'Interrupted mission', notice: 'Notification details', crew: 'Crew member', 'history-health': 'Mission history persistence' };
  return <dialog ref={dialog} className="i47-action-overlay" aria-labelledby="i47-overlay-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const items = [...dialog.current.querySelectorAll('button:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')].filter((item) => item.getClientRects().length);
    if (document.activeElement === (event.shiftKey ? items[0] : items.at(-1)) || (event.shiftKey && document.activeElement === title.current)) {
      event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus();
    }
  }}>
    <header><h2 id="i47-overlay-title" ref={title} tabIndex={-1}>{labels[target.kind]}</h2><button type="button" className="dash-icon-button" aria-label="Close workspace popup" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
    <div ref={body} className="i47-overlay-body">
      {!live && <p className="dash-callout warning" role="status">Backend offline or reconnecting. Actions are unavailable until the workspace is live.</p>}
      {input && <ul className="i47-human-card"><HumanInputCard key={input.input_id} input={input} onRespond={(...args) => act(onRespond, ...args)} disabled={!live} /></ul>}
      {report && <ReportReview key={report.approval_id} review={report} task={task} onResolve={(...args) => act(onResolve, ...args)} disabled={!live} />}
      {pending && !input && !report && <p role="status" tabIndex={0}>{submitting ? 'Waiting for confirmation…' : ownDecision.current === target.id ? 'Backend accepted your action. This item is no longer pending.' : live ? 'This item is no longer pending. It may have been handled elsewhere or expired.' : 'The current status of this item is unavailable.'}</p>}
      {pending && target.taskId && <button className="dash-button" type="button" onClick={() => mission(target.taskId)}>View mission details</button>}
      {target.kind === 'mission' && <MissionPreview id={target.id} task={task} events={events} artifacts={artifacts} humans={humans.filter((item) => item.task_id === target.id)} reports={reports.filter((item) => item.task_id === target.id)} onOpen={onOpen} />}
      {target.kind === 'notice' && <><h3>{target.event.event_type === 'SCHEDULE_UPDATED' ? 'Schedule update' : 'Tool update'}</h3><p>{target.event.payload_summary}</p>{target.taskId && <button type="button" className="dash-button" onClick={() => mission(target.taskId)}>View mission details</button>}</>}
      {target.kind === 'interrupted' && <><p>Task ID: {target.id}</p><p>Last recorded state: {target.history.last_state}</p><p>Recorded: <time dateTime={target.history.updated_at}>{new Date(target.history.updated_at).toLocaleString()}</time></p><p>This is recovery history, not a live request. No answer, approval or replay is available.</p></>}
      {target.kind === 'history-health' && <p>Mission history reported degraded persistence when last checked. This is not a provider health check.</p>}
      {crew && <><h3>{crew.id} · {crew.role}</h3><p>{crew.team} · {signal?.label || (live ? 'No confirmed activity' : 'Live status unavailable')}</p>{signal?.taskId && <button className="dash-button" type="button" onClick={() => mission(signal.taskId)}>View current mission</button>}</>}
    </div>
  </dialog>;
}
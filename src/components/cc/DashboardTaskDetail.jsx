import { lazy } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cleanMission, missionDeliverables, taskDepartment } from '../../lib/dashboardModel.js';
import { dashboardRouteHash } from '../../lib/dashboardRoute.js';
import { EmptyState, TabBar } from './DashboardPanels.jsx';
import WorkflowNodeStatus from './WorkflowNodeStatus.jsx';
import LazyPanel from './LazyPanel.jsx';

const Review = lazy(() => import('./AfterActionReview.jsx'));
function AfterActionReview(props) { return <LazyPanel key={props.taskId} label="รายงาน AAR"><Review {...props} /></LazyPanel>; }

function MissionResults({ items, state }) {
  return <section aria-labelledby="mission-results-heading" className="space-y-3" data-mission-results>
    <h3 id="mission-results-heading" className="font-semibold">ผลงานของภารกิจนี้</h3>
    {state === 'loading' && <p className="dash-callout" role="status">กำลังตรวจผลงานจาก Vault…</p>}
    {state === 'unavailable' && <p className="dash-callout warning" role="alert">ตรวจผลงานจาก Vault ไม่สำเร็จ{items.length > 0 && ' · กำลังแสดงข้อมูลที่เก็บไว้ในเบราว์เซอร์'}</p>}
    {items.map((item) => <a key={item.id} className="dash-result-card block w-full" href={dashboardRouteHash({ section: 'library', artifactId: item.id })}><h4 className="break-words font-semibold">{item.title}</h4><p className="my-2">{item.summary}</p><span className="break-all text-xs text-slate-400">Deliverable ID: {item.id}</span><span className="mt-2 block text-cyan-200">อ่านรายงาน →</span></a>)}
    {state === 'ready' && !items.length && <EmptyState title="ยังไม่มีผลงานที่เชื่อมกับงานนี้">ไม่พบผลงานที่บันทึกด้วย Task ID นี้ ไม่มีการนำผลงานของภารกิจอื่นมาแสดงแทน</EmptyState>}
  </section>;
}

export default function DashboardTaskDetail({ id, task, events, artifacts, archiveState, tab, onTab, onBack, onActions, onAgent, onRoom, connectionState }) {
  const results = <MissionResults items={missionDeliverables(artifacts, id)} state={archiveState} />;
  if (!task) return <div className="dash-page"><button className="dash-button mb-5" onClick={onBack}><ArrowLeft size={16} />กลับไปภารกิจ</button><p className="mb-3 break-all text-xs text-slate-400">Task ID: {id}</p>
    {connectionState === 'connecting' ? <p className="dash-callout" role="status">กำลังโหลดรายละเอียดภารกิจ…</p> : connectionState !== 'live' ? <p className="dash-callout warning" role="alert">ตรวจภารกิจนี้ไม่ได้: ขาดการเชื่อมต่อกับ Backend</p> : <EmptyState title="ภารกิจนี้ไม่อยู่ใน runtime แล้ว">ไม่พบ Task ID นี้ในข้อมูล runtime ที่ยังเก็บอยู่ ไม่มีการเปิดงานอื่นแทน</EmptyState>}
    <div className="mt-5">{results}</div><div className="mt-5"><AfterActionReview taskId={id} connectionState={connectionState} /></div></div>;
  const related = events.filter((event) => event.task_id === id).slice(-50).reverse();
  return <div className="dash-page"><button className="dash-button mb-5" onClick={onBack}><ArrowLeft size={16} />กลับไปภารกิจ</button><div className="dash-surface mb-5"><span className={`dash-state state-${task.state}`}>{task.state}</span><h2 className="mt-4 break-words text-xl font-semibold">{cleanMission(task.description) || id}</h2><p className="mt-2 break-all text-xs text-slate-400">Task ID: {id}</p><div className="dash-progress"><span style={{ width: `${task.progress || 0}%` }} /></div><div className="mt-4 flex flex-wrap gap-2">{task.state === 'AWAITING_HITL' && <button className="dash-button primary" onClick={onActions}>เปิดรายการรอคุณ</button>}{taskDepartment(task) && <button className="dash-button" onClick={() => onRoom(taskDepartment(task))}>เปิดทีมที่เกี่ยวข้อง <ArrowRight size={15} /></button>}</div>{task.scheduledRun && <p className="mt-4 break-all text-sm text-amber-200">SCHEDULED // run {task.scheduledRun.run} · {task.scheduledRun.schedule_id}</p>}</div><TabBar label="task-detail" value={tab} onChange={onTab} items={[{ id: 'steps', label: 'ขั้นตอน' }, { id: 'results', label: 'ผลงาน' }, { id: 'events', label: 'กิจกรรมของงาน' }, { id: 'review', label: 'After Action Review' }]} />
    {tab === 'review' && <AfterActionReview taskId={id} connectionState={connectionState} taskState={task.state} />}
    {tab === 'steps' && <div className="dash-surface">{task.swarm && <p className="mb-4 text-purple-200">Swarm · {task.swarm.agents.length} analysts → {task.swarm.synthesizer}</p>}{task.workflowNodes ? <ol aria-label="Workflow node status" className="space-y-3">{task.workflowNodes.map((node) => <li key={node.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div className="min-w-0"><p className="font-medium">{node.id}</p><button className="mt-1 text-sm text-cyan-200" disabled={node.agent === 'HUMAN'} onClick={() => onAgent(node.agent)}>{node.agent}</button><WorkflowNodeStatus node={node} /></div><span className="dash-state">{node.state}</span></li>)}</ol> : <p className="text-sm text-slate-400">Sequential ใช้ลำดับของ router เดิม เปิดกิจกรรมของงานเพื่อดูการส่งต่อระหว่าง Agent</p>}<p className="mt-5 text-xs text-slate-400">เปอร์เซ็นต์เป็น checkpoint ของระบบ ไม่ใช่เวลาที่เหลือ งานรอ HUMAN/รายงานยังมี deadline</p></div>}
    {tab === 'results' && results}
    {tab === 'events' && <div className="dash-surface space-y-4">{related.map((event) => <article key={event.event_id} className="border-b border-white/10 pb-4"><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{event.event_type}</span><time>{new Date(event.timestamp).toLocaleTimeString('th-TH')}</time></div>{event.source_agent && <button className="my-2 text-sm text-cyan-200" onClick={() => onAgent(event.source_agent)}>{event.source_agent}</button>}<p className="whitespace-pre-wrap break-words text-sm text-slate-300">{event.payload_summary}</p></article>)}{!related.length && <p className="text-sm text-slate-400">ไม่มี event ของงานนี้ใน history ที่ยังเก็บไว้</p>}</div>}
  </div>;
}
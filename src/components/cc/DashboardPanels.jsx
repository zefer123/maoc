import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock, Compass, Layers, Plus, ShieldAlert, Users } from 'lucide-react';
import { AGENTS } from '../../data/agents.js';
import { TEAMS } from '../../data/teams.js';
import { cleanMission, taskCounts, taskDepartment } from '../../lib/dashboardModel.js';
import { teamWorkspace } from '../../lib/teamWorkspace.js';
import { guildPalette } from '../../data/cozyGuild.js';
import PixelAgent from './iso/PixelAgent.jsx';

export function SectionHeading({ eyebrow, title, children, action }) {
  return <div className="dash-page-heading"><div><p className="dash-eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p className="dash-description">{children}</p>}</div>{action}</div>;
}
export function EmptyState({ title, children, action }) {
  return <div className="dash-empty"><Layers size={26} className="text-cyan-300/70" /><h3>{title}</h3><p>{children}</p>{action}</div>;
}
export function TabBar({ label, items, value, onChange }) {
  return <div className="dash-tabs" role="tablist" aria-label={label}>{items.map((item) => <button type="button" role="tab" aria-selected={value === item.id} id={`${label}-${item.id}`} key={item.id} tabIndex={value === item.id ? 0 : -1} className={value === item.id ? 'is-active' : ''} onClick={() => onChange(item.id)} onKeyDown={(event) => {
    const index = items.findIndex((entry) => entry.id === value); let next;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0; if (event.key === 'End') next = items.length - 1;
    if (next !== undefined) { event.preventDefault(); onChange(items[next].id); event.currentTarget.parentElement.children[next].focus(); }
  }}>{item.label}{item.count > 0 && <span className="dash-badge">{item.count}</span>}</button>)}</div>;
}
const stateLabels = { RUNNING: 'กำลังทำงาน', AWAITING_HITL: 'รอคุณดำเนินการ', COMPLETED: 'เสร็จแล้ว', FAILED: 'ล้มเหลว', REJECTED: 'ถูกปฏิเสธ', CANCELLED: 'ยกเลิกแล้ว' };
export function TaskCard({ task, onSelect }) {
  return <button type="button" className="dash-task-card" onClick={() => onSelect(task.taskId)}><div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-100">{cleanMission(task.description) || task.taskId}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>{task.swarm ? 'Swarm' : task.workflowNodes ? 'Workflow' : 'Sequential'}</span><span>·</span><span>{taskDepartment(task)?.toUpperCase() || 'ดูรายละเอียดทีม'}</span>{task.scheduledRun && <span className="text-amber-200">SCHEDULED // run {task.scheduledRun.run}</span>}</div><div className="dash-progress"><span style={{ width: `${Math.max(0, Math.min(100, task.progress || 0))}%` }} /></div></div><div className="flex shrink-0 flex-col items-end gap-3"><span className={`dash-state state-${task.state}`}>{stateLabels[task.state] || task.state}</span><span className="flex items-center gap-1 text-xs text-slate-400">{task.progress || 0}% <ArrowRight size={14} /></span></div></button>;
}
export function OverviewPanel({ tasks, actionCount, connectionState, deliverables, onNavigate, onMissionFilter, onTeamView, onCreate, onSelect, onArtifact, onSettings, directiveAction, world }) {
  const orderedTasks = [...tasks].reverse().sort((left, right) => {
    const priority = (task) => task.state === 'AWAITING_HITL' ? 0 : task.state === 'RUNNING' ? 1 : 2;
    return priority(left) - priority(right);
  });
  const counts = taskCounts(tasks);
  return <div className="dash-page command-bridge">
    <div className="guild-bridge-intro">
      <div className="guild-bridge-title"><span className="guild-page-seal" aria-hidden="true"><Compass size={27} /></span><div><p className="dash-eyebrow">YOUR GUILD · YOUR NEXT CHAPTER</p><h1>Command Deck<span>ฐานบัญชาการของคุณ</span></h1></div></div>
      <div className="guild-bridge-actions"><span className="guild-local-label"><span aria-hidden="true" /> LOCAL WORKSPACE</span><button type="button" className="dash-button" onClick={() => onTeamView('analytics')}>Performance <ArrowRight size={15} /></button></div>
    </div>
    {connectionState !== 'live' && <div role="status" className="dash-callout warning"><ShieldAlert size={19} /><div><strong>ยังไม่เชื่อมต่อ backend</strong><p>ดูข้อมูลที่บันทึกไว้ได้ แต่ยังเริ่มงานหรือส่งคำตอบไม่ได้ ตรวจ backend และการตั้งค่าการเชื่อมต่อก่อน</p></div><button className="dash-button" onClick={onSettings}>Check settings</button></div>}
    <div className="dash-metrics overview-summary" role="group" aria-label="Mission summary">{[
      ['Running', counts.running, Clock, 'RUNNING', 'ภารกิจที่กำลังเดินหน้า', 'running'], ['Needs You', actionCount, ShieldAlert, null, 'คำถามและรายงานรอคุณ', 'attention'],
      ['Completed', counts.completed, CheckCircle2, 'COMPLETED', 'ภารกิจสำเร็จใน runtime', 'completed'], ['Failed / Cancelled', counts.failed, Layers, 'FAILED', 'เปิดตรวจรายละเอียด', 'failed']
    ].map(([label, value, Icon, filter, description, tone]) => <button key={label} type="button" className="dash-metric" data-metric={tone} onClick={() => filter ? onMissionFilter(filter) : onNavigate('activity')}><span className="guild-metric-label"><Icon size={18} aria-hidden="true" />{label}</span><strong>{value}</strong><span className="guild-metric-detail">{description}<ArrowRight size={14} aria-hidden="true" /></span></button>)}</div>
    <p className="dash-caption overview-summary-caption">นับงานที่แสดง ไม่ใช่สถิติตลอดอายุ · Needs You รวมคำถาม HUMAN และรายงานรอคุณทั้งหมด</p>
    {actionCount > 0 && <button type="button" className="dash-attention" onClick={() => onNavigate('activity')}><span className="flex items-center gap-3"><ShieldAlert size={23} /><span><strong>มี {actionCount} รายการรอคุณดำเนินการ</strong><small>ตอบคำถาม HUMAN หรือตรวจรายงานเพื่อให้งานดำเนินต่อ</small></span></span><ArrowRight size={20} /></button>}
    <div className="guild-operations-grid">
      {world && <section className="bridge-realm"><div className="bridge-realm-heading"><span><i aria-hidden="true">✦</i> THE REALM <small>คลิกอาคารเพื่อเข้าห้อง · คลิกตัวละครเพื่อดู Agent</small></span><button type="button" className="dash-button" onClick={() => onTeamView('directory')}>รายชื่อทีม <ArrowRight size={14} /></button></div><div className="bridge-world-host">{world}</div><div className="guild-realm-footer"><span>8 departments · 27 agent identities</span><span>ฉากกิลด์ · ไม่ใช่สถานะ provider</span></div></section>}
      <section className="dash-surface guild-mission-board"><div className="dash-card-heading"><div><p className="dash-eyebrow">MISSION BOARD</p><h2>ภารกิจล่าสุด</h2></div><button type="button" onClick={() => onMissionFilter('all')}>ดูทั้งหมด <ArrowRight size={14} /></button></div><p className="guild-board-caption">งานรอคุณและงานที่กำลังรันขึ้นก่อน</p><div>{directiveAction}</div><div className="guild-mission-list">{orderedTasks.length ? orderedTasks.slice(0, 3).map((task) => <TaskCard key={task.taskId} task={task} onSelect={onSelect} />) : <EmptyState title="เริ่มจากภารกิจแรกของคุณ" action={<button type="button" className="dash-button primary" onClick={onCreate}><Plus size={16} />สร้างภารกิจ</button>}>เขียนเป้าหมาย เลือกวิธีทำงาน แล้วตรวจทานก่อนเริ่ม ไม่ต้องตั้งค่า workflow หากยังไม่จำเป็น</EmptyState>}</div><button type="button" className="guild-board-inbox" onClick={() => onNavigate('activity')}><ShieldAlert size={19} /><span><strong>{actionCount ? `${actionCount} รายการรอคุณ` : 'ไม่มีรายการรอดำเนินการ'}</strong><small>เปิด Action inbox</small></span><ArrowRight size={16} /></button></section>
    </div>
    <nav className="guild-workbench" aria-label="Workspace shortcuts"><div><p className="dash-eyebrow">YOUR WORKBENCH</p><h2>เลือกก้าวถัดไป</h2></div>{[
      [Users, 'Explore the guild', 'สมาชิกและพื้นที่ของแต่ละทีม', () => onTeamView('directory')],
      [BookOpen, 'Open the archive', 'ผลงานที่บันทึกไว้จริง', () => onNavigate('library')],
      [Compass, 'Performance', 'วิเคราะห์ภารกิจที่จบแล้ว', () => onTeamView('analytics')]
    ].map(([Icon, title, description, action]) => <button type="button" key={title} onClick={action}><span className="guild-shortcut-icon"><Icon size={21} aria-hidden="true" /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</nav>
    <section className="dash-surface guild-deliverables"><div className="dash-card-heading"><div><p className="dash-eyebrow">FROM YOUR ARCHIVE</p><h2>ผลงานล่าสุด</h2></div><button type="button" onClick={() => onNavigate('library')}>เปิดคลังความรู้ <ArrowRight size={14} /></button></div>{deliverables.length ? <div className="dash-artifact-grid">{deliverables.slice(0, 3).map((item) => <button type="button" key={item.id} className="dash-result-card" onClick={() => onArtifact(item.id)}><BookOpen size={19} className="text-purple-300" /><h3>{item.title}</h3><p>{item.deptLabel || item.deptId} · {item.lead}</p><span className="guild-result-link">อ่านผลงาน <ArrowRight size={14} /></span></button>)}</div> : <div className="guild-archive-empty"><BookOpen size={27} aria-hidden="true" /><div><h3>พื้นที่สำหรับผลงานชิ้นต่อไป</h3><p>เมื่อภารกิจสำเร็จ ผลงานที่บันทึกจริงจะแสดงที่นี่ ไม่มีการเติมผลลัพธ์ตัวอย่างแทนงานจริง</p></div></div>}</section>
    <details className="guild-field-guide"><summary><BookOpen size={18} />คู่มือเริ่มต้น<span>เริ่มจากเป้าหมาย ไม่จำเป็นต้องสร้าง workflow</span></summary><ol className="dash-guide">{[['1', 'เชื่อมต่อ AI', 'เลือก provider และ model ในตั้งค่า การทดสอบจริงอาจมีค่าใช้จ่าย'], ['2', 'สร้างภารกิจ', 'เริ่มด้วย Sequential หรือใช้ template เมื่อต้องทำโจทย์เดิมซ้ำ'], ['3', 'ติดตามและรับผลงาน', 'ตอบรายการรอคุณในกิจกรรม แล้วเปิดรายงานในคลังความรู้']].map(([n, title, text]) => <li key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol><button type="button" className="dash-button" onClick={onSettings}>AI provider settings</button></details>
  </div>;
}
export function MissionsPanel({ tasks, filter, onFilter, search, onSearch, onSelect, onCreate, onTemplates, onSchedules }) {
  const visible = [...tasks].reverse().filter((task) => (filter === 'all' || (filter === 'active' ? ['RUNNING', 'AWAITING_HITL'].includes(task.state) : filter === 'FAILED' ? ['FAILED', 'REJECTED', 'CANCELLED'].includes(task.state) : task.state === filter)) && `${task.description} ${task.taskId}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="dash-page"><SectionHeading eyebrow="WORKSPACE / MISSIONS" title="ภารกิจ" action={<button className="dash-button primary" onClick={onCreate}><Plus size={17} />สร้างภารกิจ</button>}>ติดตามงานทีละรายการ คลิกงานเพื่อดูขั้นตอน รายงาน และกิจกรรมที่เกี่ยวข้อง</SectionHeading>
    <div className="dash-quick-links"><button onClick={onTemplates}><Layers size={19} /><span><strong>Templates</strong><small>เริ่มจากแม่แบบและเติมพารามิเตอร์</small></span><ArrowRight size={17} /></button><button onClick={onSchedules}><Clock size={19} /><span><strong>Schedules</strong><small>ตั้งเวลาซ้ำ · เริ่ม paused เสมอ</small></span><ArrowRight size={17} /></button></div>
    <TabBar label="mission-filter" value={filter} onChange={onFilter} items={[{ id: 'all', label: 'ทั้งหมด' }, { id: 'active', label: 'กำลังดำเนินการ' }, { id: 'RUNNING', label: 'กำลังรัน' }, { id: 'COMPLETED', label: 'เสร็จแล้ว' }, { id: 'FAILED', label: 'ล้มเหลว' }]} />
    <label className="dash-filter-label">ค้นหาในภารกิจ<input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="ชื่อภารกิจ หรือ Task ID" /></label><p className="dash-caption">{visible.length} รายการ · ข้อมูล runtime ไม่ใช่ประวัติถาวรหลัง backend restart; ผลงานสำเร็จอยู่ในคลัง</p>
    <div className="space-y-3">{visible.map((task) => <TaskCard key={task.taskId} task={task} onSelect={onSelect} />)}{!visible.length && <EmptyState title="ยังไม่มีภารกิจที่ตรงกับตัวกรอง" action={<button className="dash-button" onClick={onCreate}>สร้างภารกิจ</button>}>เปลี่ยนตัวกรองหรือเริ่มงานใหม่ ข้อมูลตัวอย่างจะไม่ถูกนับเป็นภารกิจจริง</EmptyState>}</div>
  </div>;
}
export function TeamsDirectory({ activity, search, onFocusAgent, onRoom, onTeam, tasks, artifacts, events }) {
  const [teamFilter, setTeamFilter] = useState('all');
  const teams = useMemo(() => TEAMS.filter((team) => teamFilter === 'all' || team.id === teamFilter), [teamFilter]);
  const visible = teams.filter((team) => !search || `${team.label} ${team.sub} ${AGENTS.filter((agent) => agent.team === team.id).map((agent) => `${agent.id} ${agent.role}`).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="dash-page team-directory">
    <div className="team-directory-toolbar"><div><p className="dash-eyebrow">GUILD ROSTER / {visible.length} DEPARTMENTS</p><p>เลือกทีมเพื่อดูงาน สมาชิก และผลงานที่เชื่อมกัน หรือเข้าห้องทำงานโดยตรง</p></div><label className="dash-filter-label">แผนก<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">ทุกแผนก</option>{TEAMS.map((team) => <option key={team.id} value={team.id}>{team.label}</option>)}</select></label></div>
    <p className="dash-caption">สถานะ “มี activity ล่าสุด” มาจาก telemetry ไม่ใช่การยืนยันว่า provider ออนไลน์หรือ agent กำลังรันตลอดเวลา</p>
    <div className="dash-team-grid">{visible.map((team) => {
      const workspace = teamWorkspace(team.id, { tasks, artifacts, events });
      const members = workspace.agents.filter((agent) => !search || `${team.label} ${team.sub}`.toLowerCase().includes(search.toLowerCase()) || `${agent.id} ${agent.role}`.toLowerCase().includes(search.toLowerCase()));
      return <section className="dash-surface team-directory-card" data-team-card={team.id} key={team.id} style={{ '--team-accent': guildPalette(team.id).accent }}>
        <div className="team-directory-card-heading"><span className="team-department-id">{team.id.toUpperCase()} / {workspace.agents.length} AGENTS</span><h2>{team.label}</h2><p>{team.sub}</p></div>
        <dl className="team-card-counts"><div><dt>Running</dt><dd>{workspace.running}</dd></div><div><dt>Waiting</dt><dd>{workspace.waiting}</dd></div><div><dt>Archived</dt><dd>{workspace.artifacts.length}</dd></div></dl>
        <div className="space-y-2">{members.map((agent) => <button type="button" key={agent.id} className="dash-agent-row" onClick={() => onFocusAgent(agent.id)}><PixelAgent agent={agent} /><span className="min-w-0 flex-1"><strong>{agent.codename}</strong><small>{agent.role}</small></span><span className="team-agent-signal">{activity[agent.id] ? 'Recent event' : 'Profile'}</span></button>)}</div>
        <div className="team-card-actions"><button type="button" className="dash-button primary" data-team-open={team.id} onClick={() => onTeam(team.id)}>Team workspace <ArrowRight size={15} /></button><button type="button" className="dash-button" onClick={() => onRoom(team.id)}>ห้อง <ArrowRight size={14} /></button></div>
      </section>;
    })}</div>{!visible.length && <EmptyState title="ไม่พบทีมที่ตรงกับการค้นหา">ลองชื่อทีม Agent หรือบทบาทอื่น ไม่มีการแสดงทีมอื่นแทนผลการค้นหา</EmptyState>}
  </div>;
}
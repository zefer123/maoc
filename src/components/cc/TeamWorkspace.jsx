import { ArrowLeft, ArrowRight, BookOpen, Building2, Radio, ShieldCheck, Users } from 'lucide-react';
import { guildPalette } from '../../data/cozyGuild.js';
import { teamWorkspace } from '../../lib/teamWorkspace.js';
import { EmptyState, TaskCard } from './DashboardPanels.jsx';
import PixelAgent from './iso/PixelAgent.jsx';

export default function TeamWorkspace({ id, tasks, events, artifacts, activity, connectionState, teamSignal, onBack, onRoom, onAgent, onTask, onArtifact, onDirective }) {
  const workspace = teamWorkspace(id, { tasks, events, artifacts });
  if (!workspace) return <div className="dash-page"><button type="button" className="dash-button" onClick={onBack}><ArrowLeft size={16} />All teams</button><EmptyState title="ไม่พบทีมนี้">Team ID: {id} · ไม่มีการเปิดทีมอื่นแทนลิงก์นี้</EmptyState></div>;
  const { team, agents, running, waiting } = workspace;
  return <div className="dash-page team-workspace" data-team-workspace={id} style={{ '--team-accent': guildPalette(id).accent }}>
    <nav aria-label="Team breadcrumb" className="team-breadcrumb"><button type="button" onClick={onBack}><ArrowLeft size={16} />All teams</button><span aria-hidden="true">/</span><span aria-current="page">{team.label}</span></nav>
    <header className="team-workspace-hero">
      <div className="team-workspace-identity"><div className="team-crest" aria-hidden="true"><Building2 size={32} /></div><div><p className="dash-eyebrow">DEPARTMENT DOSSIER / {id.toUpperCase()}</p><h1>{team.label}</h1><p>{team.sub}</p></div></div>
      <div className="team-workspace-actions"><button type="button" className="dash-button primary" onClick={() => onRoom(id)}><Building2 size={17} />Enter workspace <ArrowRight size={16} /></button><button type="button" className="dash-button min-h-11" data-ceo-entry="team" onClick={() => onDirective(id)}>Assign via ARIA</button><span><Radio size={13} />{connectionState === 'live' ? 'Backend connected' : 'Backend offline / reconnecting'}</span></div>
    </header>
    <dl className="team-workspace-stats" aria-label="Team work summary">{[['Members', agents.length, 'Registered identities'], ['Running', running, 'Related retained missions'], ['Waiting', waiting, 'Missions awaiting input / review'], ['Archived', workspace.artifacts.length, 'Saved deliverables']].map(([label, count, caption]) => <div key={label}><dt>{label}</dt><dd>{count}</dd><p>{caption}</p></div>)}</dl>
    {teamSignal && <p className="team-data-note" data-spatial-state={teamSignal.kind}>Telemetry: {teamSignal.label}</p>}
    <p className="team-data-note">{connectionState !== 'live' && 'ออฟไลน์: runtime ที่แสดงอาจไม่เป็นปัจจุบัน · '}งานเชื่อมจากแผนก สมาชิกใน workflow/swarm และ event ที่ยังเก็บไว้ ไม่ใช่ประวัติทั้งหมดหรือการยืนยัน provider</p>
    <div className="team-workspace-columns">
      <div className="team-workspace-main">
        <section className="dash-surface team-workspace-section" aria-labelledby="team-missions-heading"><div className="dash-card-heading"><h2 id="team-missions-heading">Mission ledger</h2><span className="team-section-count">{workspace.tasks.length} retained</span></div><p className="team-section-description">เปิดแต่ละงานเพื่อดูขั้นตอน กิจกรรม ผลงาน และหลักฐานของ Task ID นั้น</p><div className="space-y-3">{workspace.tasks.length ? [...workspace.tasks].reverse().map((task) => <TaskCard key={task.taskId} task={task} onSelect={onTask} />) : <EmptyState title="ยังไม่มีภารกิจที่เชื่อมกับทีมนี้">เริ่มงานผ่าน Create mission และเลือก workflow ตามต้องการ การเปิดหน้านี้ไม่สั่งงาน Agent</EmptyState>}</div></section>
        <section className="dash-surface team-workspace-section" aria-labelledby="team-artifacts-heading"><div className="dash-card-heading"><h2 id="team-artifacts-heading">Deliverable archive</h2><BookOpen size={18} /></div><div className="team-linked-artifacts">{workspace.artifacts.length ? workspace.artifacts.map((item) => <button type="button" key={item.id} data-team-artifact={item.id} onClick={() => onArtifact(item.id)}><BookOpen size={19} /><span><strong>{item.title}</strong><small>{item.lead || 'Unspecified lead'} · {item.taskId ? 'Mission-linked report' : 'Saved archive'}</small><p>{item.summary}</p></span><ArrowRight size={16} /></button>) : <p className="team-empty-copy">ยังไม่มีผลงานจริงของแผนกนี้ ไม่รวม seed/demo และไม่หยิบผลงานทีมอื่นมาเติม</p>}</div></section>
      </div>
      <aside className="team-workspace-aside" aria-label="Team members and retained signals">
        <section className="dash-surface team-workspace-section" aria-labelledby="team-roster-heading"><div className="dash-card-heading"><h2 id="team-roster-heading">Agent roster</h2><Users size={18} /></div><p className="team-section-description">เลือกดูโปรไฟล์และการตั้งค่าเดิม · recent event ไม่ได้แปลว่ากำลังรัน</p><div className="space-y-2">{agents.map((agent) => <button type="button" className="dash-agent-row" key={agent.id} onClick={() => onAgent(agent.id)}><PixelAgent agent={agent} /><span className="min-w-0 flex-1"><strong>{agent.codename}</strong><small>{agent.role}</small></span><span className="team-agent-signal">{activity[agent.id] ? 'Recent event' : 'Profile'}</span></button>)}</div></section>
        <section className="dash-surface team-workspace-section" aria-labelledby="team-signals-heading"><div className="dash-card-heading"><h2 id="team-signals-heading">Retained signals</h2><Radio size={18} /></div>{workspace.events.length ? <ol className="team-signals">{workspace.events.map((event, index) => <li key={event.event_id || index}><span>{event.event_type}</span><p>{event.payload_summary || 'No summary retained'}</p>{event.task_id && <button type="button" onClick={() => onTask(event.task_id)}>Open mission <ArrowRight size={14} /></button>}</li>)}</ol> : <p className="team-empty-copy">ยังไม่มี event ของสมาชิกทีมใน history ที่เก็บไว้ ไม่เติม activity จำลอง</p>}</section>
        <div className="team-scope-note"><ShieldCheck size={18} /><p>ข้อมูลและลิงก์ในหน้านี้ไม่เพิ่มสิทธิ์ tools ไม่สั่งซื้อขาย และไม่ deploy โดยอัตโนมัติ</p></div>
      </aside>
    </div>
  </div>;
}
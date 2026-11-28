import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Download } from 'lucide-react';
import { exportDepartmentMarkdown } from '../../lib/departmentVault.js';
import { dashboardRouteHash } from '../../lib/dashboardRoute.js';
import { TEAMS } from '../../data/teams.js';
import { EmptyState } from './DashboardPanels.jsx';

export default function DashboardLibrary({ items, archiveState, search, selectedId, onSelect, onAgent }) {
  const [team, setTeam] = useState('all');
  const visible = useMemo(() => items.filter((item) => (team === 'all' || item.deptId === team) && `${item.title} ${item.summary} ${item.lead}`.toLowerCase().includes(search.toLowerCase())), [items, team, search]);
  const selected = items.find((item) => item.id === selectedId);
  if (selectedId) return <div className="dash-page">
    <button className="dash-button mb-5" onClick={() => onSelect(null)}><ArrowLeft size={16} />กลับไปผลงาน</button>
    <div data-deliverable-detail>
      <p className="mb-3 break-all text-xs text-slate-400">Deliverable ID: {selectedId}</p>
      {archiveState === 'loading' && <p className="dash-callout" role="status">กำลังตรวจผลงานจาก Vault…</p>}
      {archiveState === 'unavailable' && <p className="dash-callout warning" role="alert">ตรวจผลงานจาก Vault ไม่สำเร็จ{selected && ' · กำลังแสดงข้อมูลที่เก็บไว้ในเบราว์เซอร์'}</p>}
      {selected ? <article className="dash-surface">
        <p className="dash-eyebrow">{selected.deptLabel || selected.deptId} · {selected.status}</p>
        <h2 className="mt-3 break-words text-xl font-semibold leading-relaxed">{selected.title}</h2>
        <p className="mt-2 break-all text-xs text-slate-400">{selected.taskId ? `Task ID: ${selected.taskId}` : 'ไม่มี Task ID ที่ยืนยันได้สำหรับผลงานนี้'}</p>
        <div className="my-5 flex flex-wrap gap-2">
          <button className="dash-button" onClick={() => onAgent(selected.lead)}>Agent: {selected.lead}</button>
          {selected.taskId && <a className="dash-button" href={dashboardRouteHash({ section: 'missions', taskId: selected.taskId })}>เปิดภารกิจ <ArrowRight size={15} /></a>}
          <button className="dash-button" onClick={() => exportDepartmentMarkdown(selected.deptLabel || 'MAOC', [selected])}><Download size={16} />Export Markdown</button>
        </div>
        <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-300">{selected.summary}</p>{selected.paragraphs?.map((text, index) => <p key={index} className="mt-5 whitespace-pre-wrap break-words leading-relaxed text-slate-300">{text}</p>)}{selected.artifactCode && <details className="dash-details mt-6"><summary>Artifact / ข้อมูลประกอบ</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{selected.artifactCode}</pre></details>}{selected.stages?.length > 0 && <details className="dash-details mt-4"><summary>ขั้นตอนการทำงาน ({selected.stages.length})</summary><ol className="mt-3 space-y-2 text-sm text-slate-300">{selected.stages.map((stage, index) => <li key={index} className="break-words">{stage}</li>)}</ol></details>}
      </article> : archiveState === 'ready' && <EmptyState title="ไม่พบผลงานนี้">ไม่พบ Deliverable ID นี้ใน Vault ไม่มีการเปิดรายการอื่นแทน</EmptyState>}
    </div>
  </div>;
  return <div className="dash-page"><label className="dash-filter-label">แผนก<select value={team} onChange={(event) => setTeam(event.target.value)}><option value="all">ทุกแผนก</option>{TEAMS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label><p className="dash-caption">{visible.length} ผลงานที่บันทึกจริง · ไม่รวม historical seed/demo · ค้นหาจากช่องด้านบน</p><div className="dash-artifact-grid">{visible.map((item) => <button key={item.id} className="dash-result-card" onClick={() => onSelect(item.id)}><BookOpen size={21} className="text-purple-300" /><h3>{item.title}</h3><p className="line-clamp-3">{item.summary}</p><span className="mt-3 block text-xs text-cyan-200">{item.deptLabel || item.deptId} · {item.lead} →</span></button>)}</div>{!visible.length && <EmptyState title="ยังไม่มีผลงานที่ตรงกับการค้นหา">ผลงานจะบันทึกเมื่อภารกิจสำเร็จ ข้อมูล demo เดิมยังอยู่ใน storage แต่ไม่แสดงเป็นผลงานจริงที่นี่</EmptyState>}</div>;
}
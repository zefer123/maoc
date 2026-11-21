import { accessFetch } from '../../lib/accessClient.js';

import { lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AGENTS } from '../../data/agents.js';
import { TEAMS } from '../../data/teams.js';
import { summarizePerformance } from '../../lib/performancePresentation.js';
import { EmptyState } from './DashboardPanels.jsx';
import LazyPanel from './LazyPanel.jsx';

const AfterActionReviewHistory = lazy(() => import('./AfterActionReview.jsx').then((module) => ({ default: module.AfterActionReviewHistory })));

const BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
const number = (value) => value.toLocaleString('th-TH');
const milliseconds = (value) => value === null ? '—' : `${(value / 1000).toLocaleString('th-TH', { maximumFractionDigits: 2 })} s`;
const percent = (value) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;

const columns = ['Agent', 'สำเร็จ', 'ล้มเหลว', 'ยกเลิก', 'ข้าม', 'Completion*', 'เฉลี่ย', 'p50 / p95', 'LLM calls', 'Tools / errors', 'Reported tokens', 'Usage coverage'];
function PerformanceRow({ row, onAgent }) {
  const values = [row.completed, row.failed, row.cancelled, row.skipped,
    row.id === 'HUMAN' ? '— (HUMAN)' : percent(row.completion_rate), milliseconds(row.mean_ms),
    `${milliseconds(row.p50_ms)} / ${milliseconds(row.p95_ms)}`, row.llm_calls,
    `${row.tool_calls} / ${row.tool_errors}`, row.reported_calls ? number(row.total_tokens) : '—',
    `${row.reported_calls}/${row.responses}${row.request_errors ? ` · errors ${row.request_errors}` : ''}`];
  return <tr role="row" data-agent={row.id}>
    <th scope="row" role="rowheader">{row.id === 'HUMAN' ? 'HUMAN (เวลารอ)' : <button type="button" onClick={() => onAgent(row.id)}>{row.id}</button>}<small>n={row.duration_samples}</small></th>
    {values.map((value, index) => <td key={columns[index + 1]} role="cell"><span className="performance-cell-label" aria-hidden="true">{columns[index + 1]}</span><span>{value}</span></td>)}
  </tr>;
}

export default function PerformanceDashboard({ connectionState, onAgent, onTask, onReview }) {
  const [window, setWindow] = useState('7d'); const [team, setTeam] = useState('all'); const [agent, setAgent] = useState('all');
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const request = useRef(null); const serial = useRef(0);
  const refresh = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller; const current = ++serial.current;
    if (connectionState !== 'live') { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const response = await accessFetch(`${BASE}/api/analytics?${new URLSearchParams({ window, team, agent })}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 404 ? 'Backend นี้ไม่มี Analytics endpoint · ตรวจเวอร์ชัน backend และ API proxy ไม่ใช่ข้อมูลว่าง' : result.error || `Analytics request failed (${response.status})`);
      if (current === serial.current && !controller.signal.aborted) setData(result);
    } catch (reason) { if (!controller.signal.aborted && current === serial.current) setError(reason.message); }
    finally { if (current === serial.current) setLoading(false); }
  }, [window, team, agent, connectionState]);
  useEffect(() => {
    setData(null); void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    return () => { clearInterval(timer); request.current?.abort(); serial.current += 1; };
  }, [refresh]);
  const totals = data ? summarizePerformance(data.rows) : null;
  return <section className="dash-page performance-dashboard" aria-labelledby="analytics-title" aria-busy={loading}>
    <div className="dash-card-heading"><h2 id="analytics-title" className="text-lg font-semibold">Agent Performance Analytics</h2><button type="button" className="dash-button" disabled={loading || connectionState !== 'live'} onClick={refresh}>รีเฟรชสถิติ</button></div>
    <p className="my-4 text-sm leading-relaxed text-slate-400">วัดจาก executor โดยตรง เฉพาะภารกิจที่จบแล้วหลังเริ่มเก็บข้อมูล ไม่อ้างอิง demo หรือ event ring buffer · อัปเดตทุก 15 วินาทีขณะเปิดแท็บ ไม่มีการเรียก AI provider</p>
    <div className="performance-filters" role="group" aria-label="Analytics filters">
      <label className="dash-filter-label">ช่วงเวลา Analytics<select aria-label="Analytics window" value={window} onChange={(event) => setWindow(event.target.value)}><option value="24h">24 ชั่วโมง</option><option value="7d">7 วัน</option><option value="30d">30 วัน</option><option value="all">ทั้งหมดที่ยังเก็บไว้</option></select></label>
      <label className="dash-filter-label">ทีม Analytics<select aria-label="Analytics team" value={team} onChange={(event) => { setTeam(event.target.value); setAgent('all'); }}><option value="all">ทุกทีม</option>{TEAMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}<option value="human">HUMAN</option></select></label>
      <label className="dash-filter-label">Agent Analytics<select aria-label="Analytics agent" value={agent} onChange={(event) => setAgent(event.target.value)}><option value="all">ทุก Agent ในทีม</option>{AGENTS.filter((item) => team === 'all' || item.team === team).map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}{['all', 'human'].includes(team) && <option value="HUMAN">HUMAN</option>}</select></label>
    </div>
    {connectionState !== 'live' && <p role="status" className="dash-callout warning">Backend ออฟไลน์ · ไม่สามารถรับสถิติล่าสุดได้</p>}
    {error && <p role="alert" className="dash-callout warning">รับสถิติไม่สำเร็จ: {error} · ข้อมูลด้านล่างถ้ามีเป็น snapshot ก่อนหน้า</p>}
    {loading && !data && <p role="status">กำลังโหลดสถิติ…</p>}
    {loading && data && <p role="status" className="dash-caption">กำลังอัปเดต · ยังแสดง snapshot ก่อนหน้า</p>}
    {data && <>
      <p className="dash-caption">Snapshot: {new Date(data.generated_at).toLocaleString('th-TH')} · เริ่มเก็บ: {new Date(data.observation_started_at).toLocaleString('th-TH')} · เก็บ {data.retained_missions}/{data.retention_limit} ภารกิจล่าสุด{data.oldest_finished_at ? ` · เก่าสุดที่ยังมี: ${new Date(data.oldest_finished_at).toLocaleString('th-TH')}` : ''} · ไม่ใช่ประวัติครบตลอดอายุระบบ</p>
      {data.persistence !== 'ok' && <p role="alert" className="dash-callout warning">บันทึก analytics ลงดิสก์ไม่สำเร็จ มีข้อมูลในหน่วยความจำที่อาจสูญหายหลัง restart · ตรวจสุขภาพ backend/พื้นที่ดิสก์</p>}
      <div className="performance-summary" aria-label="Analytics summary">
        {[
          ['ภารกิจที่ตรงตัวกรอง', number(data.mission_count), `สำเร็จ ${data.mission_outcomes.COMPLETED} · ล้มเหลว ${data.mission_outcomes.FAILED} · ยกเลิก ${data.mission_outcomes.CANCELLED}`],
          ['AI step completion', percent(totals.completion_rate), `สำเร็จ ${totals.completed} / ล้มเหลว ${totals.failed} · ยกเลิก ${totals.cancelled} / ข้าม ${totals.skipped} ไม่นับในอัตรา`],
          ['เวลาเฉลี่ยต่อขั้นตอน AI', milliseconds(totals.mean_ms), `n=${totals.duration_samples} ขั้นตอนที่เริ่มจริง · รวม failed/cancelled ไม่รวมเวลารอ HUMAN`],
          ['Reported tokens (ไม่ใช่ค่าใช้จ่าย)', totals.reported_calls ? number(totals.total_tokens) : '—', `Usage coverage ${totals.reported_calls}/${totals.responses} responses · ${percent(totals.usage_coverage)} · ไม่เติม usage ที่ขาด`],
        ].map(([label, value, detail]) => <div key={label} className="dash-surface performance-metric"><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>)}
      </div>
      <section className="dash-surface performance-coverage" aria-labelledby="analytics-coverage-title">
        <h3 id="analytics-coverage-title">ขอบเขตหลักฐานและทรัพยากร</h3>
        <p>Provider usage coverage: {totals.reported_calls}/{totals.responses} responses · ไม่รายงาน usage {totals.unreported_calls} responses · {totals.request_errors} LLM call errors ไม่มี usage ที่ยืนยัน</p>
        <p>LLM calls {number(totals.llm_calls)} เป็น logical engine calls ไม่ใช่จำนวน HTTP retries/failovers หรือใบเรียกเก็บเงินจริง · Tools {totals.tool_calls} / errors {totals.tool_errors}</p>
        <p data-human-wait>HUMAN contribution wait: เฉลี่ย {milliseconds(totals.human_mean_ms)} · n={totals.human_samples} · แยกจาก AI และไม่ใช่เวลา report approval</p>
        <p>ตัวกรองทีม/Agent เลือกขั้นตอนของผู้เข้าร่วม ส่วนผลภารกิจยังเป็นผลทั้งงาน · ไม่มีคะแนนคุณภาพ ยอดเงิน หรือกราฟแนวโน้มที่อนุมานจากข้อมูลไม่ครบ</p>
      </section>
      {!data.mission_count && <EmptyState title="ยังไม่มีข้อมูลที่ตรงตัวกรอง">ภารกิจที่ยังรันอยู่ไม่รวมในสถิติ ไม่มีการเติมตัวเลขตัวอย่าง เปลี่ยนตัวกรองหรือรอภารกิจจบแล้วรีเฟรช</EmptyState>}
      <h3 className="performance-table-title" id="analytics-agents-title">หลักฐานราย Agent / HUMAN</h3>
      <p className="dash-caption" id="analytics-table-help">มือถือแสดงเป็นบัตรราย Agent · จอใหญ่เลื่อนตารางแนวนอนได้ · n คือจำนวนขั้นตอนที่เริ่มจริง ไม่ใช่จำนวนภารกิจ</p>
      <div className="performance-table" tabIndex={0} role="region" aria-label="Agent performance table" aria-describedby="analytics-table-help">
        <table role="table"><caption className="sr-only">ผลรันแต่ละ Agent จากภารกิจที่จบแล้ว; ไม่ใช่คะแนนคุณภาพ</caption><thead role="rowgroup"><tr role="row">{columns.map((label) => <th scope="col" role="columnheader" key={label}>{label}</th>)}</tr></thead><tbody role="rowgroup">{data.rows.map((row) => <PerformanceRow key={row.id} row={row} onAgent={onAgent} />)}</tbody></table>
      </div>
      <p className="my-4 text-xs leading-relaxed text-slate-400">* Completion = completed ÷ (completed + failed); ไม่รวม cancelled/skipped และไม่ใช่คะแนนคุณภาพหรือ mission approval · ระยะเวลา AI เป็นเวลารันขั้นตอนรวม queue/provider/tool ไม่รวม report approval; HUMAN คือเวลารอ contribution · p50/p95 ใช้ nearest-rank จากขั้นตอนที่เริ่มจริง รวม failed/cancelled ไม่รวม skipped; sample น้อยยังสรุปแนวโน้มไม่ได้ · ภารกิจ: สำเร็จ {data.mission_outcomes.COMPLETED}, ล้มเหลว {data.mission_outcomes.FAILED}, ยกเลิก {data.mission_outcomes.CANCELLED}</p>
      <section className="dash-surface performance-recent" aria-labelledby="analytics-recent-title"><h3 id="analytics-recent-title" className="mb-3 font-semibold">ภารกิจอ้างอิงล่าสุด (สูงสุด 20)</h3><ul className="space-y-3">{data.recent.map((item) => <li key={item.task_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3"><div className="min-w-0"><p className="break-all font-mono text-xs">{item.task_id}</p><p className="text-xs text-slate-400">{item.state} · {item.mode} · {milliseconds(item.duration_ms)} รวมเวลารอ · {new Date(item.finished_at).toLocaleString('th-TH')}</p></div><div className="performance-evidence-actions"><button type="button" className="dash-button" onClick={() => onTask(item.task_id)}>เปิดภารกิจ</button><button type="button" className="dash-button" onClick={() => onReview(item.task_id)}>อ่าน AAR ของภารกิจ</button></div></li>)}</ul>{!data.recent.length && <p className="dash-caption">ยังไม่มีภารกิจอ้างอิงที่ตรงตัวกรองนี้</p>}<p className="mt-3 text-xs text-slate-400">ประวัติสถิติอยู่ได้หลัง restart แต่ runtime ภารกิจไม่กู้คืน ลิงก์เก่าอาจแสดง “ไม่อยู่ใน runtime” อย่างชัดเจน ไม่มีการเปิดภารกิจอื่นแทน · AAR อ่านจากข้อมูลที่ยังเก็บไว้ได้โดยไม่ต้องมี active runtime</p></section>
    </>}
    <LazyPanel label="ประวัติ AAR"><AfterActionReviewHistory connectionState={connectionState} onReview={onReview} /></LazyPanel>
  </section>;
}
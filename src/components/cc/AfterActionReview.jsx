import { accessFetch } from '../../lib/accessClient.js';

import { useCallback, useEffect, useRef, useState } from 'react';
import { STOP_LABELS, SKIP_LABELS } from '../../lib/afterActionReview.js';

const BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
const seconds = (value) => `${(value / 1000).toLocaleString('th-TH', { maximumFractionDigits: 2 })} s`;

export function useReviewResource(path, connectionState) {
  const [state, setState] = useState({ path, data: null, loading: false, error: '', status: null });
  const sequence = useRef(0); const controller = useRef(null);
  const refresh = useCallback(async () => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort; const serial = ++sequence.current;
    if (connectionState !== 'live') { setState({ path, data: null, loading: false, error: '', status: null }); return; }
    setState((previous) => ({ path, data: previous.path === path ? previous.data : null, loading: true, error: '', status: null }));
    try {
      const response = await accessFetch(`${BASE}/api/reviews${path}`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]) });
      const value = await response.json();
      if (!response.ok) throw Object.assign(new Error(value.error || `AAR request failed (${response.status})`), { status: response.status });
      if (!abort.signal.aborted && sequence.current === serial) setState({ path, data: value, loading: false, error: '', status: response.status });
    } catch (error) {
      if (!abort.signal.aborted && sequence.current === serial) setState((previous) => ({ path, data: previous.path === path ? previous.data : null, loading: false, error: error.message, status: error.status || null }));
    }
  }, [path, connectionState]);
  useEffect(() => {
    void refresh();
    return () => { sequence.current += 1; controller.current?.abort(); };
  }, [refresh]);
  return { ...(state.path === path ? state : { data: null, loading: true, error: '', status: null }), path, refresh };
}

function ResourceStatus({ connectionState, resource }) {
  const unavailableReport = resource.status === 404 && resource.path.startsWith('/') && resource.error !== 'endpoint not found';
  return <>{connectionState !== 'live' && <p role="status" className="dash-callout warning">Backend ออฟไลน์ · เปิดรายงาน AAR ที่เก็บใน backend ไม่ได้ ไม่มีการสร้างข้อมูลทดแทน</p>}
    {resource.loading && <p role="status">กำลังโหลด After Action Review…</p>}
    {resource.error && <p role={unavailableReport ? 'status' : 'alert'} className="dash-callout warning">{unavailableReport ? 'ยังไม่มี AAR สำหรับ Task ID นี้: งานอาจยังไม่จบ อยู่ก่อนเริ่มเก็บข้อมูล หรือพ้น retention แล้ว' : resource.status === 404 ? 'โหลด AAR ไม่สำเร็จ: Backend นี้ไม่มี Reviews endpoint · ตรวจเวอร์ชัน backend และ API proxy ไม่ใช่ประวัติว่าง' : `โหลด AAR ไม่สำเร็จ: ${resource.error}`}{resource.data && ' · ข้อมูลที่ยังแสดงเป็น snapshot ก่อนหน้า'}</p>}
    {resource.data?.persistence === 'degraded' && <p role="alert" className="dash-callout warning">AAR persistence degraded · มีข้อมูลในหน่วยความจำที่ยังไม่บันทึกลงดิสก์ อาจสูญหายหลัง restart ตรวจสุขภาพ backend/ดิสก์</p>}</>;
}

export default function AfterActionReview({ taskId, connectionState, taskState }) {
  const resource = useReviewResource(`/${encodeURIComponent(taskId)}`, connectionState);
  const report = resource.data?.report;
  const previousTaskState = useRef(taskState);
  useEffect(() => {
    if (previousTaskState.current !== taskState && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(taskState)) void resource.refresh();
    previousTaskState.current = taskState;
  }, [taskState, resource.refresh]);
  return <section aria-labelledby="aar-title" aria-busy={resource.loading} className="min-w-0 space-y-4">
    <div className="dash-card-heading"><h2 id="aar-title" className="text-lg font-semibold">After Action Review</h2><button type="button" className="dash-button" disabled={resource.loading || connectionState !== 'live'} onClick={resource.refresh}>รีเฟรช AAR</button></div>
    <p className="break-all font-mono text-xs text-slate-400">Task ID: {taskId}</p>
    <p className="text-sm leading-relaxed text-slate-400">รายงานอัตโนมัติจากหลักฐาน executor แบบ deterministic ไม่ใช้ AI สรุปข้อความ ไม่ retry/แก้ workflow/เพิ่มสิทธิ์หรือสั่ง external action · หากเพิ่งจบงานและยังไม่มีรายงาน ให้รีเฟรชหลัง terminal commit</p>
    <ResourceStatus connectionState={connectionState} resource={resource} />
    {report && <>
      <section className="dash-surface"><h3 className="mb-3 font-semibold">ผลภารกิจที่บันทึก</h3><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-400">Outcome / mode</dt><dd>{report.mission.state} · {report.mission.mode} · {report.mission.department}</dd></div><div><dt className="text-slate-400">Evidence level</dt><dd>{report.evidence_level}</dd></div><div><dt className="text-slate-400">เริ่ม / จบ</dt><dd>{new Date(report.mission.started_at).toLocaleString('th-TH')} / {new Date(report.mission.finished_at).toLocaleString('th-TH')}</dd></div><div><dt className="text-slate-400">เวลารวม (รวม waits)</dt><dd>{seconds(report.mission.duration_ms)}</dd></div></dl><p className="mt-4 text-xs text-slate-400">Generator: {report.generator} · Report v{report.report_version} · เก็บสูงสุด {resource.data.retention_limit} ภารกิจล่าสุด ไม่ใช่ประวัติครบตลอดอายุระบบ</p></section>
      <section className="dash-surface"><h3 className="mb-3 font-semibold">ข้อเท็จจริงจากหลักฐาน</h3><ul className="space-y-3">{report.findings.map((finding) => <li key={finding.id}><p className="text-sm leading-relaxed">{finding.text}</p><small className="break-all text-cyan-300/80">Evidence: {finding.evidence.join(', ')}</small></li>)}</ul>
        {report.context?.stop && <p className="mt-4 break-words text-sm text-amber-200">Stop: {report.context.stop.code} · phase {report.context.stop.phase} · node {report.context.stop.node_id || '—'} · HTTP status {report.context.stop.http_status ?? '—'}</p>}
        {report.context && <p className="mt-3 text-xs text-slate-400">Archive observation: {report.context.archive} · Handoffs: {report.context.handoffs}{report.context.planned_sequence && ` · Planned sequence: ${report.context.planned_sequence.join(' → ')}`}</p>}
      </section>
      <div role="region" aria-label="AAR execution evidence" tabIndex={0} className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[850px] text-left text-xs"><caption className="p-3 text-left text-slate-400">Execution observations — cancelled/skipped ไม่ใช่ failed และ node ที่ไม่เริ่มไม่มี latency sample</caption><thead><tr>{['Execution / node', 'Agent', 'Outcome', 'Duration', 'LLM / errors', 'Tools / errors', 'Reported tokens', 'Coverage'].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{report.executions.map((execution) => <tr key={execution.id} className="border-t border-white/10"><th scope="row" className="break-all p-3">{execution.id}<small className="block text-slate-500">{execution.node_id || 'sequential'}</small></th><td className="p-3">{execution.agent}</td><td className="p-3">{execution.state}</td><td className="p-3">{execution.state === 'SKIPPED' ? '—' : seconds(execution.duration_ms)}{execution.agent === 'HUMAN' && ' (รวมเวลารอ)'}</td><td className="p-3">{execution.llm_calls} / {execution.request_errors}</td><td className="p-3">{execution.tool_calls} / {execution.tool_errors}</td><td className="p-3">{execution.reported_calls ? execution.total_tokens : '—'}</td><td className="p-3">{execution.reported_calls}/{execution.responses}</td></tr>)}</tbody></table></div>
      <p className="text-xs leading-relaxed text-slate-400">Reported tokens รวม: {report.totals.total_tokens.toLocaleString('th-TH')} · usage coverage {report.totals.reported_calls}/{report.totals.responses} responses · logical call errors {report.totals.request_errors} · ไม่ใช่ billing totals/HTTP retry count · ระยะเวลา AI รวม queue/tools ไม่รวม report review; ช่วงเวลาขนานห้ามนำมาบวกเป็นเวลา mission</p>
      {report.context && <>
        {!!report.context.execution_failures.length && <section className="dash-surface"><h3 className="mb-3 font-semibold">Execution stop observations</h3><ul className="space-y-2 text-sm">{report.context.execution_failures.map((item) => <li key={item.execution_id} className="break-words">{item.execution_id} · {item.failure.code} · phase {item.failure.phase} · originating node {item.failure.node_id || '—'} · HTTP {item.failure.http_status ?? '—'}</li>)}</ul><p className="mt-3 text-xs text-slate-400">Sibling ที่ถูก abort อาจอ้างถึง originating failure เดียวกัน ไม่ใช่หลักฐานว่า sibling เป็นสาเหตุ</p></section>}
        <section className="dash-surface"><h3 className="mb-3 font-semibold">Workflow routing evidence</h3>{report.context.nodes.length ? <ol className="space-y-3" aria-label="AAR routing evidence">{report.context.nodes.map((node) => <li key={node.id} className="rounded-xl border border-white/10 p-3 text-sm"><p className="break-all font-semibold">{node.id} · {node.agent} · {node.state}</p><p className="mt-1 break-words text-slate-400">Depends on: {node.depends_on.join(', ') || 'root'} · join {node.join} · execution {node.execution_id || 'ไม่เริ่ม / ไม่มี execution sample'}</p>{node.condition && <p className="mt-1 break-words text-cyan-200">Condition: {node.condition.branch.toUpperCase()} จาก {node.condition.source} → {node.condition.outcome} (ไม่เก็บ comparison value/raw result)</p>}{node.skip_code && <p className="mt-1 text-slate-300">Skip: {SKIP_LABELS[node.skip_code]}</p>}{node.failure_code && <p className="mt-1 text-amber-200">Stop observation: {STOP_LABELS[node.failure_code]}</p>}</li>)}</ol> : <p className="text-sm text-slate-400">Sequential ไม่มี DAG topology; planned sequence ถ้าวางแผนสำเร็จแสดงด้านบน</p>}</section>
        <section className="dash-surface"><h3 className="mb-3 font-semibold">HUMAN และ report review waits</h3><p className="mb-3 text-xs text-slate-400">HUMAN contribution ไม่ใช่ report approval; approval ไม่ใช่ execution authority · duration HUMAN wait รวมอยู่ใน HUMAN execution แล้ว ไม่บวกซ้ำ</p><ul className="space-y-2 text-sm" aria-label="AAR wait evidence">{report.context.human_waits.map((wait) => <li key={wait.node_id} className="break-words">HUMAN · {wait.node_id} · {wait.status} · {seconds(wait.duration_ms)}</li>)}{report.context.reviews.map((review) => <li key={review.id} className="break-words">Report review · {review.agent} · node {review.node_id || 'mission/sequential'} · {review.status} · {seconds(review.duration_ms)}</li>)}</ul>{!report.context.human_waits.length && !report.context.reviews.length && <p className="text-sm text-slate-400">ไม่พบ wait ที่บันทึกไว้สำหรับภารกิจนี้ ไม่ได้แปลว่าผู้ใช้อนุมัติแล้ว</p>}</section>
      </>}
      <section className="dash-surface"><h3 className="mb-3 font-semibold">ข้อมูลที่ขาด / ข้อจำกัด</h3><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-400">{report.missing.map((text) => <li key={text}>{text}</li>)}</ul></section>
      <section className="dash-surface"><h3 className="mb-3 font-semibold">คำแนะนำสำหรับผู้ตรวจ — ไม่มีการดำเนินการอัตโนมัติ</h3><ul className="space-y-3">{report.recommendations.map((item) => <li key={item.id}><p className="text-sm leading-relaxed">{item.text}</p><small className="break-all text-cyan-300/80">Evidence: {item.evidence.join(', ')}</small></li>)}</ul></section>
    </>}
  </section>;
}

export function AfterActionReviewHistory({ connectionState, onReview }) {
  const [outcome, setOutcome] = useState('all'); const [offset, setOffset] = useState(0);
  const resource = useReviewResource(`?${new URLSearchParams({ offset: String(offset), limit: '25', outcome })}`, connectionState);
  const data = resource.data;
  return <section className="dash-surface mt-5" aria-labelledby="aar-history-title" aria-busy={resource.loading}>
    <div className="dash-card-heading"><h3 id="aar-history-title" className="font-semibold">After Action Review — ประวัติที่ยังเก็บไว้</h3><button type="button" className="dash-button" disabled={resource.loading || connectionState !== 'live'} onClick={resource.refresh}>รีเฟรชประวัติ AAR</button></div>
    <label className="dash-filter-label my-4">ผลภารกิจ AAR<select aria-label="AAR outcome" value={outcome} onChange={(event) => { setOutcome(event.target.value); setOffset(0); }}><option value="all">ทั้งหมด</option><option value="COMPLETED">สำเร็จ</option><option value="FAILED">ล้มเหลว</option><option value="CANCELLED">ยกเลิก</option></select></label>
    <p className="mb-3 text-xs leading-relaxed text-slate-400">ตัวกรองนี้แยกจาก Analytics ด้านบน · เก็บสูงสุด 1,000 terminal missions รวม legacy metrics ไม่มีข้อมูลตัวอย่างและไม่กู้ active runtime</p>
    <ResourceStatus connectionState={connectionState} resource={resource} />
    {data && <><p className="dash-caption">{data.total} รายการตรงตัวกรอง · เก็บ {data.retained_missions}/{data.retention_limit} · Snapshot {new Date(data.generated_at).toLocaleString('th-TH')}</p><ul className="space-y-3">{data.items.map((item) => <li key={item.task_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3"><div className="min-w-0"><p className="break-all font-mono text-xs">{item.task_id}</p><p className="text-xs text-slate-400">{item.state} · {item.mode} · {item.evidence_level} · {new Date(item.finished_at).toLocaleString('th-TH')}</p></div><button type="button" className="dash-button" onClick={() => onReview(item.task_id)}>อ่าน AAR</button></li>)}</ul>{!data.items.length && <p className="my-4 text-sm text-slate-400">ยังไม่มี AAR ที่ตรงตัวกรอง</p>}<div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" className="dash-button" disabled={resource.loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>AAR ก่อนหน้า</button><span className="text-xs text-slate-400">{data.total ? `${offset + 1}–${Math.min(offset + 25, data.total)}` : '0'} / {data.total}</span><button type="button" className="dash-button" disabled={resource.loading || offset + 25 >= data.total} onClick={() => setOffset(offset + 25)}>AAR ถัดไป</button></div></>}
  </section>;
}
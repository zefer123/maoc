import { useEffect, useRef, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { compileDirective } from '../../lib/ceoDirective.js';

export default function CeoDirectivePanel({ teamId, initialText, connectionState, onDispatch, onCheckMissions }) {
  const [team, setTeam] = useState(teamId);
  const [mode, setMode] = useState('review');
  const [includeSenior, setIncludeSenior] = useState(false);
  const [text, setText] = useState(initialText);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false);
  const sending = useRef(false);
  const heading = useRef(null);
  useEffect(() => { if (review) heading.current?.focus(); }, [review]);
  const field = 'block w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-sm';
  const reviewDraft = () => {
    setError('');
    try { setReview(compileDirective({ teamId: team, mode, includeSenior, text })); }
    catch (err) { setError(err.message); }
  };
  const dispatch = async () => {
    if (!review || sending.current || unknown || connectionState !== 'live') return;
    sending.current = true;
    setBusy(true);
    setError('');
    try { await onDispatch(review); }
    catch (err) { setError(err.message); setUnknown(err.outcomeUnknown === true); }
    finally { sending.current = false; setBusy(false); }
  };
  return <div className="space-y-4 overflow-y-auto p-4" data-ceo-directive>
    {review ? <div className="space-y-3">
      <h3 className="font-semibold" tabIndex={-1} ref={heading}>Review directive</h3>
      <p className="break-words text-sm text-cyan-200" data-directive-route>CEO (HUMAN) → {review.workflow.nodes.map(({ agent }) => agent === 'HUMAN' ? 'HUMAN Review' : agent).join(' → ')}</p>
      <p className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 p-3 text-sm">{review.description}</p>
      <p className="text-sm text-slate-300">กดยืนยันแล้ว Backend จะเริ่มภารกิจจริงและอาจมีค่าใช้จ่ายจาก Provider โหมด Direct ข้ามแค่ HUMAN Review หลัง ARIA ไม่ข้ามการอนุมัติรายงานเดิม</p>
      {connectionState !== 'live' && <p role="status" className="text-sm text-amber-200">Backend ยังไม่เชื่อมต่อ จึงยังส่งไม่ได้</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="dash-button min-h-11" disabled={busy || unknown} onClick={() => { setReview(null); setError(''); }}>Edit directive</button>
        <button type="button" className="dash-button primary min-h-11" disabled={busy || unknown || connectionState !== 'live'} onClick={dispatch}>{busy ? 'Sending…' : 'Confirm & dispatch'}</button>
        {unknown && <button type="button" className="dash-button min-h-11" onClick={onCheckMissions}>Check Missions</button>}
      </div>
    </div> : <div className="space-y-4">
      <p className="text-sm text-slate-300">ส่งคำสั่ง CEO ผ่าน ARIA ให้ทีมที่เลือก การเปิดแผงหรือทบทวนร่างจะไม่รันงาน</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Target department<select className={field} value={team} onChange={(event) => setTeam(event.target.value)}>{TEAMS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="text-sm">Execution route<select className={field} value={mode} onChange={(event) => setMode(event.target.value)}><option value="review">ARIA → HUMAN Review → Department</option><option value="direct">ARIA → Department (direct)</option></select></label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={team === 'tech' || includeSenior} disabled={team === 'tech'} onChange={(event) => setIncludeSenior(event.target.checked)} />Include Senior Dev before target department (REX / NOVA / BYTE / ZETA / FORGE)</label>
      <label className="block text-sm">CEO directive<textarea className={field} rows={5} maxLength={11980} value={text} onChange={(event) => setText(event.target.value)} placeholder="ระบุเป้าหมาย ผลลัพธ์ และข้อจำกัด — ไม่ใส่คีย์หรือรหัสผ่าน" /></label>
      <button type="button" className="dash-button primary min-h-11" disabled={!text.trim()} onClick={reviewDraft}>Review directive</button>
    </div>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div>;
}
import { useCallback, useEffect, useRef, useState } from 'react';
import { scheduleRequest } from '../../lib/scheduleClient.js';
import { recurrenceLabel } from '../../lib/schedule.js';
import { persistence } from '../../lib/persistenceClient.js';
import { loadEngineConfig, syncEngineConfig } from '../../lib/llmConnector.js';

const button = 'rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/20 disabled:opacity-40';
const date = (value) => value ? new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : '—';

export default function SchedulesModal({ open, onClose, connectionState, onOpenTask }) {
  const [items, setItems] = useState([]); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [stopped, setStopped] = useState(false);
  const dialog = useRef(null); const generation = useRef(0); const fetching = useRef(false);
  const reload = useCallback(async () => {
    if (fetching.current) return;
    const current = generation.current; fetching.current = true;
    try {
      const data = await scheduleRequest();
      if (current === generation.current) { setItems(data.schedules); setStopped(data.stopped); setError(''); }
    } catch (reason) { if (current === generation.current) setError(reason.message); }
    finally { fetching.current = false; }
  }, []);
  useEffect(() => {
    if (!open) return;
    generation.current += 1;
    void reload(); const timer = setInterval(() => { void reload(); }, 5000);
    const previous = document.activeElement; dialog.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled)')];
      if (event.shiftKey && [controls[0], dialog.current].includes(document.activeElement)) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { generation.current += 1; clearInterval(timer); document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open, onClose, reload]);
  if (!open) return null;
  const act = async (item, action) => {
    if (action === 'delete' && !window.confirm(`Delete schedule "${item.config.name}"? This cannot be undone.`)) return;
    setBusy(true); setError('');
    try {
      if (action === 'resume') {
        if (!window.confirm('Resume recurring missions using current settings? Provider charges may apply. Each mission still requires any HUMAN/report approvals.')) return;
        await persistence.sync(); await syncEngineConfig(loadEngineConfig());
      }
      await scheduleRequest(`/${encodeURIComponent(item.id)}`, { action }); await reload();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="schedules-title" tabIndex={-1} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-slate-950 text-slate-200">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4"><h2 id="schedules-title" className="text-sm font-bold tracking-wider text-amber-200">SCHEDULES // RECURRING MISSIONS ({items.length}/20)</h2><button type="button" onClick={onClose} className={button}>Close</button></header>
      <div className="space-y-3 overflow-y-auto p-4">
        <p className="text-xs leading-relaxed text-slate-400">Create schedules from Workflow Builder. UTC only; configs cannot be edited—delete/recreate instead. New/restarted schedules are paused. No catch-up, automatic retries or auto-approval. Failed runs pause future dispatch. Pause is not mission cancellation. Schedules are server-owned and excluded from browser backup/import/reset.</p>
        <button type="button" className={button} onClick={reload} disabled={busy}>Refresh schedules</button>
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        {stopped && <p role="alert" className="text-xs text-red-300">Scheduler stopped. Inspect backend logs/storage; restart after resolving the problem. No further dispatch is allowed.</p>}
        {items.length === 0 && <p className="text-sm text-slate-400">No schedules saved.</p>}
        <ul aria-label="Saved mission schedules" className="space-y-3">{items.map((item) => <li key={item.id} className="rounded-xl border border-white/15 bg-slate-900/60 p-3 text-xs">
          <h3 className="font-bold text-amber-100">{item.config.name} · {item.state}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-slate-300">{item.config.description}</p>
          <p className="mt-2 text-slate-400">{item.config.swarm ? 'Swarm' : item.config.workflow ? 'Custom DAG' : 'Sequential'} · {recurrenceLabel(item.config.recurrence)} · attempts {item.runs}/{item.config.maxRuns}</p>
          <p className="mt-1 text-slate-400">Next: {date(item.next_run_at)} · Last: {item.last?.status || 'Not run'} {item.last ? date(item.last.at) : ''}{item.last?.code ? ` · HTTP ${item.last.code}` : ''}</p>
          {item.last?.task_id && <p className="mt-1 break-all text-slate-400">Last task: {item.last.task_id} {onOpenTask && <button type="button" className="ml-2 text-cyan-200 underline" onClick={() => onOpenTask(item.last.task_id)}>เปิดภารกิจ / ผลงาน</button>}</p>}
          {item.active_task_id && <p className="mt-1 break-all text-cyan-200">Active task: {item.active_task_id} (including approval waits)</p>}
          {item.pause_reason && <p className="mt-1 text-amber-200">{item.pause_reason}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy || stopped || connectionState !== 'live' || item.state === 'EXHAUSTED' || Boolean(item.active_task_id)} onClick={() => act(item, item.state === 'ENABLED' ? 'pause' : 'resume')}>{item.state === 'ENABLED' ? 'Pause schedule' : 'Resume schedule'}</button>
            {item.active_task_id && item.state === 'ENABLED' && <button type="button" className={button} disabled={busy || stopped} onClick={() => act(item, 'pause')}>Pause future runs</button>}
            <button type="button" className={button} disabled={busy || stopped || Boolean(item.active_task_id)} onClick={() => act(item, 'delete')}>Delete schedule</button>
          </div>
        </li>)}</ul>
      </div>
    </section>
  </div>;
}
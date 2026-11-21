import { useState } from 'react';

export default function HumanInputCard({ input, onRespond, disabled = false }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const respond = async (action) => {
    if (busy || disabled) return;
    if (action === 'cancel' && !window.confirm('Cancel this mission? Your pending contribution will not be submitted.')) return;
    setBusy(true); setError('');
    try { await onRespond(input.input_id, action === 'submit' ? { action, text } : { action }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return (
    <li className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-xs">
      <h3 className="font-bold tracking-wider text-amber-200">HUMAN NODE // {input.node_id}</h3>
      <p className="mt-1 break-words text-[10px] text-slate-400">{input.mission}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-slate-100">{input.prompt}</p>
      <details className="mt-2 text-slate-300">
        <summary className="cursor-pointer">Ancestor context ({input.context?.length || 0})</summary>
        {(input.context || []).map((output) => <div key={output.node_id} className="mt-2 rounded border border-white/10 p-2"><p className="font-bold">{output.node_id} / {output.agent}</p><p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words">{output.text}</p></div>)}
      </details>
      <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); void respond('submit'); }}>
        <label className="block">Your contribution
          <textarea required disabled={busy || disabled} maxLength={12000} value={text} onChange={(event) => setText(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-amber-400/30 bg-slate-950 p-2 text-slate-100" />
        </label>
        <p className="text-[10px] text-amber-200/80">Saved in mission artifacts and may be sent to the configured LLM provider. Do not enter passwords or API keys. This is input, not execution approval.</p>
        {error && <p role="alert" className="break-words text-red-300">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={disabled || busy || !text.trim()} className="flex-1 rounded border border-emerald-400/40 bg-emerald-500/15 p-2 text-emerald-200 disabled:opacity-40">{busy ? 'Sending…' : 'Submit & continue'}</button>
          <button type="button" disabled={disabled || busy} onClick={() => void respond('cancel')} className="rounded border border-red-400/40 p-2 text-red-200 disabled:opacity-40">Cancel mission</button>
        </div>
      </form>
    </li>
  );
}
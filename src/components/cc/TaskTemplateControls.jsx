import { useEffect, useMemo, useRef, useState } from 'react';
import { templateRequest } from '../../lib/templateClient.js';
import { renderTaskTemplate, validateTaskTemplate } from '../../lib/taskTemplates.js';

const field = 'mt-1 w-full rounded border border-white/20 bg-slate-950 p-2';
const button = 'rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-2 text-xs text-purple-100 hover:bg-purple-500/20 disabled:opacity-40';

export default function TaskTemplateControls({ mission, onApply, onBusyChange, connectionState, disabled }) {
  const [items, setItems] = useState([]); const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('Mission template'); const [parameters, setParameters] = useState({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const mounted = useRef(false);
  const selected = items.find((item) => item.id === selectedId);
  const preview = useMemo(() => {
    if (!selected) return {};
    try { return { mission: renderTaskTemplate(selected.config, parameters) }; }
    catch (reason) { return { error: reason.message }; }
  }, [selected, parameters]);
  const saveValidation = useMemo(() => {
    try { return { config: validateTaskTemplate({ ...mission, name }) }; }
    catch (reason) { return { error: reason.message }; }
  }, [mission, name]);
  const reload = async () => {
    const data = await templateRequest();
    if (mounted.current) setItems(data.templates);
    return data.templates;
  };
  useEffect(() => {
    mounted.current = true;
    void reload().catch((reason) => { if (mounted.current) setError(reason.message); });
    return () => { mounted.current = false; onBusyChange(false); };
  }, [onBusyChange]);
  const perform = async (operation) => {
    if (busy) return;
    setBusy(true); onBusyChange(true); setError(''); setNotice('');
    try { await operation(); }
    catch (reason) { if (mounted.current) setError(reason.message); }
    finally { if (mounted.current) { setBusy(false); onBusyChange(false); } }
  };
  const unavailable = disabled || busy || connectionState !== 'live';
  return <fieldset disabled={disabled || busy} onKeyDown={(event) => {
    // Enter in a template-name/select input must not implicitly dispatch the outer form.
    if (event.key === 'Enter' && ['INPUT', 'SELECT'].includes(event.target.tagName)) event.preventDefault();
  }} className="space-y-3 rounded-xl border border-purple-400/30 bg-purple-500/5 p-3 text-xs">
    <legend className="px-1 font-bold text-purple-200">TASK TEMPLATES // TEXT PARAMETERS</legend>
    <p className="leading-relaxed text-slate-400">Use {'{{topic}}'} in Mission or HUMAN questions, then save the current draft. Names are case-sensitive, begin with a letter and use letters/digits/underscore (max 32 characters). Up to 16 parameters, 128 occurrences, 2000 characters/value. Values are inserted once as text, never code or workflow permissions; routing directives cannot be parameters. Treat supplied text as untrusted. No secrets: saved draft text is persisted verbatim, including any values already expanded into it; loaded values may be sent to providers and archived. Loading only replaces the draft and resets timing to Run now—you must dispatch or save a paused schedule separately. Templates are excluded from browser backup/import/reset. Parameter inputs are not saved separately; engine settings/keys are never captured.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Template name<input maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={field} /></label>
      <div className="flex items-end gap-2"><button type="button" className={button} disabled={unavailable || !saveValidation.config || items.length >= 50} onClick={() => perform(async () => {
        const { template } = await templateRequest('', saveValidation.config);
        await reload();
        if (mounted.current) { setSelectedId(template.id); setParameters({}); setNotice('Template saved. No mission was started.'); }
      })}>Save draft as template</button><button type="button" className={button} disabled={unavailable} onClick={() => perform(reload)}>Refresh templates</button></div>
    </div>
    {saveValidation.error && <p className="text-amber-200">Cannot save draft: {saveValidation.error}</p>}
    <label className="block">Saved template ({items.length}/50)<select disabled={busy || disabled} value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setParameters({}); setError(''); setNotice(''); }} className={field}><option value="">Select a template</option>{items.map((item) => <option key={item.id} value={item.id}>{item.config.name}</option>)}</select></label>
    {selected && <div className="space-y-3">
      <p className="text-slate-400">{selected.config.swarm ? 'Swarm' : selected.config.workflow ? 'Custom DAG' : 'Sequential'} · immutable preset; delete/recreate to change. Values below are not saved to this preset.</p>
      {selected.parameters.length === 0 && <p className="text-slate-400">No parameters required.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{selected.parameters.map((parameter) => <label key={parameter}>Parameter: {parameter}<textarea maxLength={2000} value={Object.hasOwn(parameters, parameter) ? parameters[parameter] : ''} onChange={(event) => setParameters((current) => ({ ...current, [parameter]: event.target.value }))} className={`${field} min-h-16`} /></label>)}</div>
      {preview.error && <p role="status" className="text-amber-200">{preview.error}</p>}
      {preview.mission && <details><summary className="cursor-pointer text-purple-200">Preview expanded mission</summary><pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-2 text-slate-300">{preview.mission.description}{preview.mission.workflow?.nodes.filter((node) => node.agent === 'HUMAN').map((node) => `\n\nHUMAN ${node.id}: ${node.prompt}`).join('')}</pre></details>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={unavailable || !preview.mission} onClick={() => {
          if (!window.confirm('Replace the current draft with the expanded template? This does not start a mission or schedule.')) return;
          void perform(async () => {
            const data = await templateRequest(`/${encodeURIComponent(selected.id)}/render`, { parameters });
            if (mounted.current) { onApply(data.mission); setNotice('Expanded template loaded into draft. Review it before dispatching.'); }
          });
        }}>Load expanded draft</button>
        <button type="button" className={button} disabled={unavailable} onClick={() => {
          if (!window.confirm(`Delete template "${selected.config.name}"? Existing drafts, schedules and archives are unchanged.`)) return;
          void perform(async () => {
            await templateRequest(`/${encodeURIComponent(selected.id)}`, { action: 'delete' }); await reload();
            if (mounted.current) { setSelectedId(''); setParameters({}); setNotice('Template deleted. Existing drafts and schedules are unchanged.'); }
          });
        }}>Delete template</button>
      </div>
    </div>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {notice && <p role="status" className="text-emerald-200">{notice}</p>}
  </fieldset>;
}
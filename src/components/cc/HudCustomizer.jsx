import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { HUD_ACCENTS, HUD_THEMES, validHudData } from '../../lib/hudPreferenceSchema.js';
import useDialogFocus from '../../hooks/useDialogFocus.js';

export default function HudCustomizer({ hud, onClose, atmosphere, onAtmosphere, motion, onMotion, reduceMotion }) {
  const ref = useRef(null);
  const [draft, setDraft] = useState(hud.data);
  const [baseline, setBaseline] = useState(hud.remote);
  const [name, setName] = useState(hud.operatorName);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const stale = hud.remote && (!baseline || hud.remote.revision !== baseline.revision || hud.remote.updatedAt !== baseline.updatedAt);
  useEffect(() => {
    if (!dirty && !baseline && hud.remote) { setDraft(hud.remote.data); setBaseline(hud.remote); }
  }, [dirty, baseline, hud.remote]);
  const reload = () => { setDraft(hud.data); setBaseline(hud.remote); setDirty(false); setMessage('Current Workspace settings loaded.'); };
  const update = (key, value) => { setDirty(true); setDraft((previous) => ({ ...previous, [key]: value })); };
  useDialogFocus(true, ref, onClose);
  const submit = async (event) => {
    event.preventDefault();
    if (!validHudData(draft) || busy || stale || hud.status === 'checking') return;
    setBusy(true);
    const result = await hud.save(draft, hud.remote && baseline ? baseline.revision : null);
    setBusy(false);
    if (result === 'saved' || result === 'local') { hud.saveName(name); onClose(); }
    else setMessage(result === 'conflict' ? 'Another tab changed the HUD. Load the Workspace settings before saving again.' : 'The Workspace save could not be confirmed. Check the connection or save on this browser only.');
  };
  return <div className="i47-dialog-backdrop"><section className="dash-surface i47-dialog" role="dialog" aria-modal="true" aria-labelledby="i47-hud-title" ref={ref} tabIndex={-1}>
    <header><div><p className="i47-kicker">ARMORY / WORKSPACE DISPLAY</p><h2 id="i47-hud-title">Customize HUD</h2></div><button type="button" className="dash-icon-button" aria-label="Close HUD customizer" onClick={onClose}><X size={19} /></button></header>
    <fieldset className="i47-appearance">
      <legend>Appearance · this session</legend>
      <label>Atmosphere<select value={atmosphere} onChange={(event) => onAtmosphere(event.target.value)}><option value="stars">Parallax Stars</option><option value="cyber-link">Cyber-Link</option><option value="meteor">Meteor</option><option value="minimal">Minimal</option></select></label>
      <label className="i47-checkbox"><input type="checkbox" checked={motion} onChange={(event) => onMotion(event.target.checked)} /> Background motion</label>
      {reduceMotion && <p>Motion is paused by your system’s Reduce Motion setting.</p>}
    </fieldset>
    <form onSubmit={submit} className="i47-hud-form">
      <label>Theme<select value={draft.theme} onChange={(event) => update('theme', event.target.value)}>{Object.entries(HUD_THEMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Accent<select value={Object.hasOwn(HUD_ACCENTS, draft.accent) ? draft.accent : 'custom'} onChange={(event) => update('accent', event.target.value === 'custom' ? '#ffffff' : event.target.value)}>{Object.entries(HUD_ACCENTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="custom">Custom HEX</option></select></label>
      {!Object.hasOwn(HUD_ACCENTS, draft.accent) && <label>Custom accent HEX<input value={draft.accent} onChange={(event) => update('accent', event.target.value)} maxLength={7} pattern="#[0-9a-fA-F]{6}" required /></label>}
      <label className="i47-checkbox"><input type="checkbox" checked={draft.tacticalGrid} onChange={(event) => update('tacticalGrid', event.target.checked)} /> Tactical grid</label>
      <label>Operator name (this browser only)<input maxLength={48} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" /></label>
      <p role="status">{hud.status === 'local' ? 'Offline or unavailable · browser-only changes are not uploaded on reconnect.' : hud.status === 'checking' ? 'Checking Workspace settings…' : 'Shared display settings apply to open Workspace tabs. The operator name stays on this browser.'}</p>
      {stale && <p role="status">The Workspace settings changed. Reload them before saving.</p>}{message && <p role="status">{message}</p>}
      <div className="i47-actions">{stale && <button type="button" className="dash-button" onClick={reload}>Load Workspace settings</button>}<button type="submit" className="dash-button primary" disabled={!validHudData(draft) || busy || stale || hud.status === 'checking'}>{hud.remote ? 'Save to Workspace' : 'Save on this browser'}</button></div>
    </form>
  </section></div>;
}
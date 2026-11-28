import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AGENTS } from '../../data/agents.js';

export default function WorkspaceDrawer({ panel, setPanel, sections, signals, connectionState, approvalSnapshot, historyStatus, onOpen }) {
  const host = useRef(null), heading = useRef(null), trigger = useRef(null);
  const close = (restore) => { setPanel(null); if (restore) trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!panel) return;
    heading.current?.focus({ preventScroll: true });
    const outside = (event) => { if (!host.current?.contains(event.target)) setPanel(null); };
    const escape = (event) => {
      if (event.defaultPrevented || event.key !== 'Escape' || !host.current?.contains(document.activeElement)) return;
      event.preventDefault(); setPanel(null); trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [panel, setPanel]);
  const count = sections.reduce((sum, section) => sum + section.items.length, 0);
  return <div className="i47-drawers" ref={host}>
    {['CREW', 'ATTENTION'].map((id) => <button key={id} id={`i47-drawer-${id.toLowerCase()}`} className="dash-button" type="button" aria-expanded={panel === id} aria-controls={panel === id ? 'i47-drawer' : undefined} onClick={(event) => {
      trigger.current = event.currentTarget; setPanel(panel === id ? null : id);
    }}>{id}{id === 'ATTENTION' && count > 0 && <span className="dash-badge">{count}</span>}<ChevronDown size={12} aria-hidden="true" /></button>)}
    {panel && <section id="i47-drawer" className="i47-drawer" aria-labelledby="i47-drawer-heading">
      <header><h2 ref={heading} tabIndex={-1} id="i47-drawer-heading">{panel}</h2><button className="dash-icon-button" type="button" aria-label={`Close ${panel} drawer`} onClick={() => close(true)}><X size={17} aria-hidden="true" /></button></header>
      <div className="i47-drawer-body">
        {connectionState !== 'live' && <p className="dash-caption">Backend not live. Retained items may be out of date.</p>}
        {panel === 'CREW' ? <ul className="i47-crew-list" aria-label="Workspace roster">{AGENTS.map(({ id, role }) => {
          const signal = connectionState === 'live' ? signals[id] : null;
          return <li key={id}><button type="button" onClick={() => onOpen({ kind: 'crew', id })}><span><strong>{id}</strong> · {role}<small>{signal?.label || (connectionState === 'live' ? 'No confirmed activity' : 'Live status unavailable')}</small></span><ChevronRight size={14} aria-hidden="true" /></button></li>;
        })}</ul> : <>
          {!approvalSnapshot && connectionState === 'live' && <p className="dash-caption">This backend only exposes retained approval events. Older pending reports may be missing.</p>}
          {historyStatus !== 'ready' && <p role="status" className="dash-caption">{historyStatus === 'loading' ? 'Checking mission history…' : 'Current mission history unavailable.'}</p>}
          {sections.map(({ id, label, items }) => <section key={id} data-attention={id} className="i47-attention-section">
            <h3>{label} <small>{items.length}</small></h3>
            {items.length ? <ul>{items.map((item) => <li key={item.id}><button type="button" onClick={() => onOpen(item)}><span><strong>{item.status}</strong><small>{item.label}</small></span><ChevronRight size={14} aria-hidden="true" /></button></li>)}</ul> : <p className="dash-caption">No items in this view.</p>}
          </section>)}
        </>}
      </div>
    </section>}
  </div>;
}
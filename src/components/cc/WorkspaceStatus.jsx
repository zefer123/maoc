import { useEffect, useRef, useState } from 'react';

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export default function WorkspaceStatus({ connectionState }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [now, setNow] = useState(() => new Date());
  const dialog = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(t); window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  const backend = { live: 'Linked', connecting: 'Connecting', offline: 'Offline' }[connectionState] ?? 'Unknown';
  return <footer className="i47-copyright i47-web-status">
    <button type="button" ref={trigger} onClick={() => dialog.current.showModal()} aria-haspopup="dialog" aria-controls="i47-session"><span className="i47-status-dot" data-online={online} /> WEB / {online ? 'ONLINE' : 'OFFLINE'}</button>
    <dialog ref={dialog} id="i47-session" className="dash-surface i47-session" aria-labelledby="i47-session-title" onClose={() => trigger.current?.focus()}>
      <h2 id="i47-session-title">Connection details</h2><dl><div><dt>Browser connection</dt><dd>{online ? 'Online' : 'Offline'}</dd></div><div><dt>Workspace WebSocket</dt><dd>{backend}</dd></div><div><dt>Local time</dt><dd><time dateTime={now.toISOString()}>{clock.format(now)}</time></dd></div><div><dt>Weather</dt><dd>Sample forecast · no weather provider</dd></div></dl><p>Neither browser connectivity nor a WebSocket link verifies an AI provider.</p>
      <form method="dialog"><button type="submit" className="dash-button" autoFocus>Close connection details</button></form>
    </dialog>
  </footer>;
}
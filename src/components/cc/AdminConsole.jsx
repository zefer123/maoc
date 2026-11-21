import { useEffect, useRef, useState } from 'react';
import { adminKeyRequest } from '../../lib/accessClient.js';

const expiryValue = (value) => value ? new Date(value).toISOString() : null;
const displayDate = (value) => value ? new Date(value).toLocaleString() : '—';

export default function AdminConsole({ onBack }) {
  const [rows, setRows] = useState(null);
  const [label, setLabel] = useState('');
  const [expiry, setExpiry] = useState('');
  const [rotation, setRotation] = useState(null);
  const [rotationExpiry, setRotationExpiry] = useState('');
  const [issued, setIssued] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const readVersion = useRef(0);
  const refresh = async () => {
    const version = ++readVersion.current;
    const data = await adminKeyRequest();
    if (version === readVersion.current) setRows(data.keys);
  };
  useEffect(() => {
    let alive = true;
    refresh().catch((err) => { if (alive) setError(err.message); });
    const timer = setInterval(() => { if (!running.current && !document.hidden) void refresh().catch(() => {}); }, 5000);
    return () => { alive = false; clearInterval(timer); readVersion.current++; };
  }, []);
  const run = async (action) => {
    if (running.current || issued) return;
    running.current = true; setBusy(true); setError(''); setCopied(false);
    try {
      const data = await action();
      if (data?.activationKey) setIssued(data.activationKey);
      await refresh();
    } catch (err) { setError(err.message); }
    finally { running.current = false; setBusy(false); }
  };
  const action = (id, name, body = {}) => adminKeyRequest(`/${encodeURIComponent(id)}/${name}`, body);
  return <div className="dash-page"><section className="access-console space-y-4" aria-labelledby="admin-console-title">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="dash-eyebrow">SETTINGS / ACCESS CONTROL</p><h1 id="admin-console-title" className="text-xl font-semibold">Admin Console</h1></div><button className="access-action" onClick={onBack}>Back to Settings</button></div>
    <p className="text-sm">คีย์ User ใช้เข้าพื้นที่ทำงานร่วมกัน ไม่ได้แยก Vault รายคน การเปลี่ยนคีย์ไม่ยกเลิกภารกิจที่รับไว้แล้ว · จำนวน WebSocket อัปเดตทุก 5 วินาทีขณะเปิดหน้านี้</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void run(async () => {
      const result = await adminKeyRequest('', { label, expiresAt: expiryValue(expiry) }); setLabel(''); setExpiry(''); return result;
    }); }}>
      <label>User label<input required maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <label>Expires at (optional)<input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></label>
      <button type="submit" className="access-action primary" disabled={busy || !!issued}>+ Issue key</button>
    </form>
    {rotation && !issued && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void run(async () => {
      const result = await action(rotation.id, 'rekey', rotationExpiry ? { expiresAt: expiryValue(rotationExpiry) } : {}); setRotation(null); return result;
    }); }}>
      <p className="w-full">Re-key: {rotation.label} — คีย์เดิมและการเชื่อมต่อเดิมจะใช้ไม่ได้ทันที</p>
      <label>New expiry (blank keeps current)<input type="datetime-local" value={rotationExpiry} onChange={(e) => setRotationExpiry(e.target.value)} /></label>
      <button type="submit" className="access-action primary" disabled={busy}>Confirm Re-key</button><button type="button" className="access-action" disabled={busy} onClick={() => setRotation(null)}>Cancel</button>
    </form>}
    {issued && <div className="space-y-2 rounded border border-amber-300/50 p-3" aria-label="One-time activation key"><p>คัดลอกเก็บไว้ตอนนี้ ระบบจะไม่แสดงคีย์นี้อีก</p><code className="block break-all select-all">{issued}</code><div className="flex flex-wrap gap-2"><button type="button" className="access-action primary" onClick={async () => {
      try { await navigator.clipboard.writeText(issued); setIssued(''); setCopied(true); }
      catch { setError('คัดลอกอัตโนมัติไม่ได้ ให้เลือกข้อความแล้วคัดลอกเอง'); }
    }}>Copy Key</button><button type="button" className="access-action" onClick={() => setIssued('')}>Hide key</button></div></div>}
    {copied && <p role="status">คัดลอกแล้วและซ่อนคีย์จากหน้าจอ</p>}
    {error && <p role="alert">{error} — หากไม่แน่ใจว่าคำสั่งสำเร็จหรือไม่ ให้ Refresh ก่อนทำซ้ำ</p>}
    <button type="button" className="access-action" disabled={busy || !!issued} onClick={() => run(async () => {})}>Refresh sessions</button>
    {rows === null ? <p>{error ? 'ยังไม่มีข้อมูลที่ยืนยันได้' : 'กำลังอ่านข้อมูล…'}</p> : <div className="access-table-scroll" tabIndex={0} role="region" aria-label="Activation key table"><table><thead><tr>{['User / Prefix', 'Status', 'Version', 'Expiry / Last used', 'Active WS sessions', 'Actions'].map((title) => <th key={title} scope="col">{title}</th>)}</tr></thead><tbody>
      {!rows.length && <tr><td colSpan={6}>ยังไม่มี Activation Key</td></tr>}
      {rows.map((row) => <tr key={row.id}><th scope="row"><p className="break-all">{row.label}</p><code>{row.keyPrefix}…</code></th><td>{row.status}</td><td>{row.keyVersion}</td><td>{displayDate(row.expiresAt)}<br />{displayDate(row.lastUsedAt)}</td><td className="access-sessions">{row.activeSessions}</td><td><div className="flex flex-wrap gap-2"><button className="access-action primary" disabled={busy || !!issued} onClick={() => { setRotation(row); setRotationExpiry(''); }}>Re-key</button>{row.status === 'ACTIVE' ? <button className="access-action" disabled={busy || !!issued} onClick={() => { if (window.confirm(`ระงับสิทธิ์ ${row.label}?`)) void run(() => action(row.id, 'revoke')); }}>Revoke</button> : row.status === 'REVOKED' && <button className="access-action" disabled={busy || !!issued} onClick={() => run(() => action(row.id, 'reactivate'))}>Reactivate</button>}</div></td></tr>)}
    </tbody></table></div>}
  </section></div>;
}
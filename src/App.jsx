import { useEffect, useRef, useState } from 'react';
import CommandCenterView from './components/CommandCenterView.jsx';
import { checkAccess, setAccessIdentity } from './lib/accessClient.js';
import './components/cc/access.css';

const messages = { REKEYED: 'ผู้ดูแลเปลี่ยนคีย์แล้ว กรุณาใช้คีย์ใหม่', REVOKED: 'สิทธิ์นี้ถูกระงับ กรุณาติดต่อผู้ดูแล', EXPIRED: 'คีย์หมดอายุ กรุณาขอคีย์ใหม่' };

export default function App() {
  const [identity, setIdentity] = useState(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const activating = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const lost = (event) => { setIdentity(null); setKey(''); setMessage(messages[event.detail] || 'สิทธิ์เดิมใช้ไม่ได้แล้ว กรุณายืนยันคีย์อีกครั้ง'); };
    window.addEventListener('maoc-access-lost', lost);
    checkAccess().then((result) => {
      if (cancelled || activating.current) return;
      setAccessIdentity(result.role);
      setIdentity(result);
    }).catch(() => { if (!cancelled && !activating.current) setMessage('ตรวจสิทธิ์ไม่ได้ ตรวจว่า Backend ทำงานอยู่ แล้วลองใหม่'); });
    return () => { cancelled = true; window.removeEventListener('maoc-access-lost', lost); };
  }, []);
  const activate = async (event) => {
    event.preventDefault();
    if (busy) return;
    activating.current = true;
    const credential = key.trim();
    setBusy(true); setKey(''); setMessage('');
    try {
      const result = await checkAccess(credential);
      setAccessIdentity(result.role, result.role ? credential : '');
      setIdentity(result);
      if (!result.role) setMessage('กรอก Activation Key หรือ Admin Key เพื่อเข้าใช้งาน');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  if (identity?.role) return <CommandCenterView role={identity.role} gateEnabled={identity.gateEnabled} onLock={() => { setAccessIdentity(null); setIdentity(null); setMessage('กรอกคีย์เพื่อเปลี่ยนสิทธิ์ในหน้าต่างนี้'); }} />;
  return <main className="access-gate" aria-labelledby="activation-title">
    <form role="dialog" aria-modal="true" aria-labelledby="activation-title" className="access-card" onSubmit={activate}>
      <p className="dash-eyebrow">MAOC · GUILD ACCESS</p><h1 id="activation-title">Activate workspace</h1>
      <p>กรอกคีย์จากผู้ดูแล หรือ Admin Key เพื่อเข้าสู่ระบบ คีย์จะไม่ถูกเก็บในเบราว์เซอร์หลังรีโหลด</p>
      <label>Access key<input type="password" autoFocus autoComplete="off" maxLength={128} value={key} onChange={(event) => setKey(event.target.value)} /></label>
      {message && <p role="alert">{message}</p>}
      <button className="access-action primary" type="submit" disabled={busy}>{busy ? 'กำลังตรวจสิทธิ์…' : key.trim() ? 'Activate' : 'ตรวจการเชื่อมต่อ / ลองใหม่'}</button>
    </form>
  </main>;
}
import { Component, Suspense, useRef } from 'react';
import useDialogFocus from '../../hooks/useDialogFocus.js';

class LoadBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function LoadNotice({ label, modal, open, onClose, failed = false }) {
  const dialog = useRef(null);
  useDialogFocus(modal && open, dialog, onClose);
  if (!open) return null;
  const notice = <div className="dash-surface flex min-h-80 w-full flex-col items-start justify-center gap-4" role={failed ? 'alert' : 'status'} aria-live="polite" data-lazy-state={failed ? 'error' : 'loading'}>
    <h2 className="text-lg font-semibold text-cyan-200">{failed ? `เปิด${label}ไม่สำเร็จ` : `กำลังเปิด${label}…`}</h2>
    <p className="text-sm leading-relaxed text-slate-400">{failed ? 'โหลดส่วนนี้ไม่ได้ คุณยังใช้เมนูอื่นได้ ลองตรวจการเชื่อมต่อแล้วโหลดหน้าใหม่ โดยร่างงานที่ยังไม่บันทึกจะหาย' : 'กำลังโหลดส่วนที่ต้องใช้ ไม่มีการส่งงานหรือเรียก AI provider'}</p>
    {failed && <button type="button" className="dash-button" onClick={() => { if (window.confirm('โหลดหน้าใหม่หรือไม่? ร่างงานที่ยังไม่บันทึกจะหาย ไม่มีการส่งภารกิจใหม่อัตโนมัติ')) window.location.reload(); }}>โหลดหน้าใหม่</button>}
    {modal && <button type="button" className="dash-button" onClick={onClose}>Close</button>}
  </div>;
  return modal ? <div className="dash-builder-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><section ref={dialog} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="dash-builder flex w-full max-w-5xl flex-col overflow-auto rounded-2xl border border-cyan-400/40 bg-slate-950 text-slate-200">{notice}</section></div> : notice;
}

export default function LazyPanel({ children, label, modal = false, open = true, onClose }) {
  const props = { label, modal, open, onClose };
  return <LoadBoundary fallback={<LoadNotice {...props} failed />}><Suspense fallback={<LoadNotice {...props} />}>{children}</Suspense></LoadBoundary>;
}
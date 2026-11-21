import { useEffect, useRef } from 'react';
import { ArrowRight, Check, CircleHelp, Radio, X } from 'lucide-react';
import { cleanMission, overviewSnapshot } from '../../lib/dashboardModel.js';

export default function OverviewDock({ tasks, actionCount, connectionState, notices, readIds, onRead, onTask, onActivity, onMissions, suspended, toast, panel, setPanel, triggerRef, isOverview }) {
  const headingRef = useRef(null);
  const snapshot = overviewSnapshot({ tasks, actionCount, connectionState, notices, readIds });
  const close = () => {
    setPanel(null);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (suspended) setPanel(null);
  }, [suspended, setPanel]);
  useEffect(() => {
    if (!panel || suspended) return undefined;
    headingRef.current?.focus({ preventScroll: true });
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setPanel(null);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [panel, suspended, setPanel, triggerRef]);

  const toggle = (next, event) => {
    triggerRef.current = event.currentTarget;
    setPanel((previous) => previous === next ? null : next);
  };
  const connection = <span className={`overview-backend ${snapshot.connected ? 'is-connected' : ''}`}><i aria-hidden="true" />{snapshot.connectionLabel}</span>;
  const stackToast = isOverview || panel === 'notices';

  // Overview alone reserves the Status footer. The single topbar Bell controls
  // the same shared read-only preview across sections, without remounting read state.
  return <>
    {!isOverview && (suspended || !stackToast) && toast}
    <div className={isOverview ? 'overview-dock-slot' : 'dashboard-feedback-slot'} data-suspended={suspended ? 'true' : 'false'}>
    {!suspended && <>
      <div className={`overview-feedback-stack ${panel === 'notices' ? 'dashboard-notices-stack' : ''}`}>
        {stackToast && toast}
        {panel && <section id={`overview-${panel}-panel`} className="overview-dock-panel" aria-labelledby="overview-dock-heading">
          <header><h2 id="overview-dock-heading" ref={headingRef} tabIndex={-1}>{panel === 'status' ? 'Status' : 'Notices'}</h2><button type="button" className="dash-icon-button" title={panel === 'status' ? 'Close status' : 'Close notices'} aria-label={panel === 'status' ? 'Close status' : 'Close notices'} onClick={close}><X size={17} /></button></header>
          {panel === 'status' ? <div className="overview-status-body">
            <div className="overview-backend-row"><span>Backend</span>{connection}</div>
            <p className="overview-dock-caption">สถานะ WebSocket ของ backend เท่านั้น ไม่ใช่การยืนยัน AI provider</p>
            <div className="overview-status-counts">
              <button type="button" onClick={onMissions}><Radio size={16} aria-hidden="true" /><span>Running</span><strong>{snapshot.running}</strong></button>
              <button type="button" onClick={() => onActivity('actions')}><CircleHelp size={16} aria-hidden="true" /><span>Needs You</span><strong>{snapshot.needsYou}</strong></button>
            </div>
            <p className="overview-dock-caption">นับงาน runtime ที่ยังเก็บไว้ ไม่ใช่สถิติตลอดอายุ · Needs You รวมคำถาม HUMAN และรายงานรอคุณตรวจ</p>
            {!snapshot.connected && <p className="overview-dock-warning">เชื่อมต่อ backend ก่อนส่งคำตอบหรืออนุมัติ ข้อมูลที่แสดงอาจไม่ใช่สถานะล่าสุด</p>}
          </div> : <div className="overview-notices-body">
            <p className="overview-dock-caption">ยังไม่อ่าน {snapshot.unread} · แสดงล่าสุด 5 จากไม่เกิน 60 รายการ · สถานะอ่านเฉพาะหน้าแอปนี้ รีโหลดแล้วเริ่มใหม่ การอ่านไม่ใช่การอนุมัติ</p>
            {snapshot.preview.length ? <ul className="overview-notice-list">{snapshot.preview.map((notice) => {
              const read = readIds.has(notice.event_id);
              const failed = ['FAILED', 'REJECTED', 'CANCELLED'].includes(notice.outcome || notice.schedule?.last?.status);
              return <li key={notice.event_id} data-notice-id={notice.event_id} data-read={read ? 'true' : 'false'}>
                <div className="overview-notice-meta"><span>{failed ? 'Needs attention' : 'Mission update'}{!read && <b>New</b>}</span><time dateTime={notice.timestamp}>{new Date(notice.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time></div>
                <p>{cleanMission(notice.payload_summary) || 'มีการอัปเดตสถานะภารกิจ'}</p>
                <div className="overview-notice-actions">
                  {notice.task_id && <button type="button" onClick={() => { onRead(notice.event_id); onTask(notice.task_id); }}>Open mission <ArrowRight size={14} aria-hidden="true" /></button>}
                  <button type="button" disabled={read} aria-label={`Mark notice ${notice.event_id} as read`} onClick={() => onRead(notice.event_id)}><Check size={14} aria-hidden="true" />{read ? 'Read' : 'Mark read'}</button>
                </div>
              </li>;
            })}</ul> : <p className="overview-dock-empty">ยังไม่มีแจ้งเตือน</p>}
            <button type="button" className="overview-view-all" onClick={() => onActivity('notices')}>View All <ArrowRight size={15} aria-hidden="true" /></button>
          </div>}
        </section>}
      </div>
      {isOverview && <div className="overview-dock" role="group" aria-label="Overview status">
        <span className="overview-dock-connection" title="Backend WebSocket connection, not AI provider health">{connection}</span>
        <button type="button" id="overview-status-trigger" title="Status" aria-expanded={panel === 'status'} aria-controls={panel === 'status' ? 'overview-status-panel' : undefined} onClick={(event) => toggle('status', event)}><Radio size={15} aria-hidden="true" />Status</button>
      </div>}
    </>}
    </div>
  </>;
}
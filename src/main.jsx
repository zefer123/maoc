import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './components/cc/iso/cozyGuild.css';
import './components/cc/overview.css';

class AppErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100">
        <div className="dash-surface w-full max-w-lg">
          <div role="alert">
            <h1 className="text-xl font-semibold">เปิด Dashboard ไม่สำเร็จ</h1>
            <p className="my-4 text-sm leading-relaxed text-slate-300">ลองโหลดหน้าใหม่ ร่างงานที่ยังไม่บันทึกอาจหาย และระบบจะไม่ส่งภารกิจใหม่อัตโนมัติ</p>
          </div>
          <button type="button" className="dash-button min-h-11" onClick={() => {
            if (window.confirm('โหลดหน้าใหม่หรือไม่? ร่างงานที่ยังไม่บันทึกอาจหาย')) window.location.reload();
          }}>โหลดหน้าใหม่</button>
        </div>
      </main>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>
);
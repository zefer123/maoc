import { useEffect, useRef, useState } from 'react';
import { persistence, PERSISTENCE_KEYS } from '../../lib/persistenceClient.js';
import { TabBar } from './DashboardPanels.jsx';
import useDialogFocus from '../../hooks/useDialogFocus.js';
import {
  Cpu,
  Download,
  Globe,
  KeyRound,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Upload,
  X,
  Zap
} from 'lucide-react';
import {
  PROVIDER_PRESETS,
  callRealLlm,
  exportFullWorkspaceBackup,
  importFullWorkspaceBackup,
  loadEngineConfig,
  saveEngineConfig,
  syncEngineConfig,
  sendHermesRealWebhook
} from '../../lib/llmConnector.js';

export default function EngineSettingsModal({ open, onClose }) {
  const [config, setConfig] = useState(() => loadEngineConfig());
  const [testStatus, setTestStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);
  const [tab, setTab] = useState('provider');
  useDialogFocus(open, dialogRef, onClose);
  const [syncState, setSyncState] = useState(() => persistence.inspect());
  useEffect(() => {
    const refresh = () => setSyncState(persistence.inspect());
    window.addEventListener('maoc-persistence-status', refresh);
    return () => window.removeEventListener('maoc-persistence-status', refresh);
  }, []);

  const handleResolveSync = async (collection, choice) => {
    setTesting(true);
    try {
      await persistence.resolveConflict(collection, choice);
      setSyncState(persistence.inspect());
      setTestStatus('✓ ตรวจสอบการซิงค์แล้ว — ดูสถานะ Local Vault ด้านล่าง');
    } catch {
      setTestStatus('⚠️ Backend ยังไม่พร้อม — เก็บข้อมูลใน browser ไว้แล้ว กรุณาลองใหม่');
    } finally { setTesting(false); }
  };

  if (!open) return null;

  const preset = PROVIDER_PRESETS[config.provider] || PROVIDER_PRESETS.gemini;

  const handleSave = async () => {
    const saved = saveEngineConfig(config);
    setConfig(saved);
    try {
      await syncEngineConfig(saved);
      setTestStatus('✓ บันทึกแล้ว และซิงค์ Backend LLM สำเร็จ (API key อยู่ในหน่วยความจำ backend เท่านั้น)');
    } catch (error) { setTestStatus(`⚠️ บันทึกใน browser แล้ว แต่ซิงค์ backend ไม่สำเร็จ: ${error.message}`); }
  };

  const handleTestLlm = async () => {
    if (!window.confirm('ทดสอบเรียก provider จริงด้วยการตั้งค่านี้? อาจมีค่าใช้จ่าย API')) return;
    saveEngineConfig(config);
    setTesting(true);
    setTestStatus('กำลังทดสอบเรียก AI จริง...');
    try {
      const reply = await callRealLlm({
        systemPrompt: 'You are ARIA & HERMES in the Multi-Agent Command Center.',
        userPrompt: 'ตอบสั้นๆ 1 ประโยคว่าระบบ AI Engine เชื่อมต่อสำเร็จพร้อมทำงานแล้ว'
      });
      setTestStatus(`✓ เชื่อมต่อ AI สำเร็จ: "${reply.slice(0, 120)}"`);
    } catch (err) {
      setTestStatus(`⚠️ ${err.message} — ภารกิจ backend จะไม่รายงานผลจำลองว่าเป็น AI จริง`);
    } finally {
      setTesting(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!window.confirm('ส่งข้อความทดสอบออกไปยัง Webhook URL ที่ระบุจริง?')) return;
    saveEngineConfig(config);
    if (!config.webhookUrl.trim()) {
      setTestStatus('⚠️ กรุณาวาง Discord หรือ Custom Webhook URL ก่อนกดทดสอบครับ');
      return;
    }
    setTesting(true);
    setTestStatus('กำลังยิงสัญญาณทดสอบผ่าน HERMES...');
    const res = await sendHermesRealWebhook({
      title: 'HERMES Live Webhook Verification',
      summary: 'Outbound relay test from Spatial Multi-Agent Command Center (200 OK)',
      department: 'COMMAND CORE',
      agent: 'HERMES'
    });
    setTesting(false);
    if (res.sent) {
      setTestStatus('✓ ส่งข้อความเข้า Webhook (Discord/Endpoint) สำเร็จแล้ว!');
    } else {
      setTestStatus(`⚠️ ส่งไม่สำเร็จ: ${res.reason || res.status}`);
    }
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!window.confirm('นำเข้าและแทนที่ข้อมูล Workspace จากไฟล์นี้? สำรองข้อมูลเดิมก่อน Templates และ schedules จะไม่ถูกแก้ไข')) { event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        importFullWorkspaceBackup(String(e.target?.result || '{}'));
        const sync = await persistence.flush();
        setTestStatus(Object.values(sync).some((item) => item.dirty)
          ? '⚠️ นำเข้าใน browser แล้ว — ยังรอซิงค์ Backend ข้อมูลจะถูก retry อัตโนมัติ'
          : '✓ นำเข้าข้อมูล Workspace สำเร็จ! กำลังรีเฟรชสถานะระบบ...');
        setTimeout(() => window.location.reload(), 900);
      } catch (err) {
        setTestStatus(`⚠️ ไฟล์ JSON ไม่ถูกต้อง: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = async () => {
    const keys = [
      'maoc_agent_overrides_v1',
      'maoc_saved_commands_v1',
      'maoc_dept_chats_v1',
      'maoc_dept_deliverables_v1',
      'maoc_obsidian_vault_v1'
    ];
    for (const k of keys) {
      const collection = Object.keys(PERSISTENCE_KEYS).find((name) => PERSISTENCE_KEYS[name] === k);
      persistence.write(collection, ['notes', 'savedCommands'].includes(collection) ? [] : {});
    }
    const sync = await persistence.flush();
    setTestStatus(Object.values(sync).some((item) => item.dirty)
      ? '⚠️ รีเซ็ตใน browser แล้ว — ยังรอซิงค์ Backend'
      : '✓ รีเซ็ตข้อมูลคลังกลับสู่ค่าเริ่มต้นแล้ว กำลังรีโหลด...');
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="engine-settings-title" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="dash-settings-dialog flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-neon-cyan/50 bg-obsidian/95 shadow-2xl"
      >
        <div className="h-1 w-full bg-gradient-to-r from-neon-cyan via-purple-500 to-gold" />

        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neon-cyan/50 bg-cyan-500/10 text-cyan-300 shadow-glow-cyan">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <p className="section-label">Enterprise Integration &amp; Backup Studio</p>
              <h2 id="engine-settings-title" className="mt-0.5 text-sm font-bold tracking-[0.1em] text-slate-100">
                AI & Workspace Settings
              </h2>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close settings"
            title="Close settings"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-400 hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5 text-xs">
          <TabBar label="settings-tabs" value={tab} onChange={setTab} items={[{ id: 'provider', label: 'AI Provider' }, { id: 'limits', label: 'ขีดจำกัด' }, { id: 'webhook', label: 'Webhook' }, { id: 'data', label: 'ข้อมูล / Backup' }]} />
          <section hidden={tab !== 'data'} className="glass-panel rounded-2xl p-4" aria-label="Local vault persistence">
            <p className="section-label">Local Vault · Atomic JSON + Markdown</p>
            <p className="mt-2 text-[10px] text-slate-400">บันทึกลงเครื่องอัตโนมัติ · localStorage fallback · เลือกแหล่งข้อมูลเมื่อมี conflict</p>
            <div className="mt-3 space-y-2" aria-live="polite">
              {Object.entries(syncState).map(([name, state]) => (
                <div key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/70 p-2">
                  <span className="font-mono text-[10px] text-cyan-200">{name}</span>
                  <span className={`text-[10px] ${state.status === 'conflict' ? 'text-amber-300' : 'text-slate-400'}`}>{state.status}{state.dirty ? ' · pending write' : ''}</span>
                  {state.status === 'conflict' && (
                    <div className="flex gap-2">
                      <button type="button" disabled={testing} onClick={() => handleResolveSync(name, 'local')} className="rounded border border-amber-400/50 px-2 py-1 text-[10px] text-amber-200 disabled:opacity-50">ใช้ Browser</button>
                      <button type="button" disabled={testing} onClick={() => handleResolveSync(name, 'remote')} className="rounded border border-cyan-400/50 px-2 py-1 text-[10px] text-cyan-200 disabled:opacity-50">ใช้ Local Vault</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
          {/* 1. Provider Selection */}
          <section hidden={tab !== 'provider'} className="glass-panel rounded-2xl p-4">
            <p className="section-label">1. Select AI LLM Provider</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(PROVIDER_PRESETS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      provider: key,
                      apiKey: prev.provider === key ? prev.apiKey : prev.providerKeys?.[key] || '',
                      providerKeys: { ...prev.providerKeys, ...(prev.apiKey?.trim() ? { [prev.provider]: prev.apiKey.trim() } : {}) },
                      modelName: item.defaultModel
                    }))
                  }
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    config.provider === key
                      ? 'border-neon-cyan bg-cyan-500/20 text-cyan-200 shadow-glow-cyan'
                      : 'border-white/10 bg-slate-950/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider">
                    {key}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] opacity-80">
                    {item.defaultModel}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <KeyRound className="h-3 w-3 text-cyan-300" />
                  <span>API Key ({preset.label})</span>
                </label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder={preset.placeholderKey}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-neon-cyan"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <Sparkles className="h-3 w-3 text-purple-300" />
                  <span>Model ID</span>
                </label>
                <input
                  value={config.modelName}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, modelName: e.target.value }))
                  }
                  placeholder={preset.defaultModel}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-neon-cyan"
                />
              </div>
            </div>
          </section>

          {/* 2. HERMES Outbound Webhook URL */}
          <section hidden={tab !== 'webhook'} className="glass-panel rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <Globe className="h-3.5 w-3.5" />
                <span>2. HERMES Outbound Discord / Custom Webhook URL</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-300">
                <input
                  type="checkbox"
                  checked={config.autoWebhookOnComplete}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      autoWebhookOnComplete: e.target.checked
                    }))
                  }
                />
                <span>Auto-send when mission completes</span>
              </label>
            </div>

            <input
              value={config.webhookUrl}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))
              }
              placeholder="https://discord.com/api/webhooks/... หรือ URL ปลายทาง"
              className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-400"
            />
          </section>

          {/* 3. Full Workspace Backup & Restore */}
          <section hidden={tab !== 'data'} className="glass-panel rounded-2xl p-4">
            <p className="section-label">
              3. Full Workspace Snapshot (Skills, Saved Commands, Deliverables &amp; Galaxy Vault)
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportFullWorkspaceBackup}
                className="flex items-center gap-1.5 rounded-xl border border-neon-cyan/50 bg-cyan-500/15 px-3 py-2 text-[10px] font-bold tracking-wider text-cyan-200 hover:bg-cyan-500/25"
              >
                <Download className="h-3.5 w-3.5" />
                <span>EXPORT FULL BACKUP (.JSON)</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl border border-purple-400/50 bg-purple-500/15 px-3 py-2 text-[10px] font-bold tracking-wider text-purple-200 hover:bg-purple-500/25"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>IMPORT / RESTORE (.JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleFactoryReset}
                className="ml-auto flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[10px] font-bold tracking-wider text-red-300 hover:bg-red-500/20"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>FACTORY RESET</span>
              </button>
            </div>
          </section>

          <section hidden={tab !== 'limits'} className="rounded-xl border border-cyan-400/30 bg-slate-950/70 p-4">
            <p className="text-xs font-bold text-cyan-200">BACKEND GUARDRAILS &amp; FAILOVER</p>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={config.autoFailover} onChange={(e) => setConfig({ ...config, autoFailover: e.target.checked })} />
              Auto-failover on 429 / temporary provider failures
            </label>
            <p className="mt-2 text-[10px] text-slate-400">Fallback ใช้ key จาก .env หรือ provider ที่เคยบันทึกใน session; อาจมีค่าใช้จ่ายและส่ง context ไปอีก provider</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300">
              {Object.keys(PROVIDER_PRESETS).filter((name) => name !== config.provider).map((name) => (
                <label key={name} className="flex items-center gap-1">
                  <input type="checkbox" checked={config.fallbackProviders.includes(name)} onChange={(e) => setConfig({ ...config, fallbackProviders: e.target.checked ? [...config.fallbackProviders, name] : config.fallbackProviders.filter((p) => p !== name) })} />{name}
                </label>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
              {[['rpm', 'Requests/min/provider', 1, 1000], ['maxHandoffs', 'Max handoffs', 1, 40], ['maxTaskTokens', 'Mission budget (conservative)', 1000, 500000], ['maxOutputTokens', 'Max output tokens/call', 64, 8192]].map(([key, label, min, max]) => (
                <label key={key}>{label}<input aria-label={label} type="number" min={min} max={max} value={config[key]} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-slate-900 p-2" /></label>
              ))}
            </div>
            <label className="mt-3 block text-xs text-slate-300">Model tier mapping (JSON per provider; empty uses selected model)
              <textarea rows={3} defaultValue={JSON.stringify(config.providerModels, null, 2)} key={config.provider} onBlur={(e) => {
                try { const models = JSON.parse(e.target.value); if (!models || Array.isArray(models) || typeof models !== 'object') throw new Error('Expected object'); setConfig((old) => ({ ...old, providerModels: models })); }
                catch { setTestStatus('⚠️ Model tier mapping ต้องเป็น JSON object ที่ถูกต้อง'); }
              }} className="mt-1 w-full rounded border border-white/10 bg-slate-900 p-2 font-mono" />
            </label>
          </section>
          {testStatus && (
            <div className="rounded-xl border border-neon-cyan/40 bg-cyan-950/30 p-3 text-xs text-cyan-200">
              {testStatus}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-slate-950/90 p-4">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={testing || tab !== 'provider'}
              onClick={handleTestLlm}
              className="flex items-center gap-1.5 rounded-xl border border-purple-400/50 bg-purple-500/15 px-3 py-2 text-[10px] font-bold tracking-wider text-purple-200 hover:bg-purple-500/25"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>TEST AI CONNECTION</span>
            </button>

            <button
              type="button"
              disabled={testing || tab !== 'webhook'}
              onClick={handleTestWebhook}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-[10px] font-bold tracking-wider text-amber-200 hover:bg-amber-500/25"
            >
              <Send className="h-3.5 w-3.5" />
              <span>TEST WEBHOOK PING</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-[10px] font-bold tracking-widest text-emerald-200 shadow-glow-green hover:bg-emerald-500/30"
          >
            <Save className="h-3.5 w-3.5" />
            <span>SAVE SETTINGS</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
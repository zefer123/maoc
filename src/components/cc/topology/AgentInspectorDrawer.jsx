import { useEffect, useMemo, useRef, useState } from 'react';
import useDialogFocus from '../../../hooks/useDialogFocus.js';
import {
  Activity,
  Binary,
  Bookmark,
  Bot,
  Briefcase,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Cpu,
  Crown,
  Database,
  FileCheck2,
  FileText,
  Globe,
  Hammer,
  KeyRound,
  MapPin,
  MessageSquare,
  Moon,
  Music,
  Network,
  Palette,
  PenLine,
  Play,
  Plus,
  Radar,
  Radio,
  Rocket,
  RotateCcw,
  Save,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sword,
  Terminal,
  Trash2,
  Users,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import { AGENTS } from '../../../data/agents.js';
import { TEAMS } from '../../../data/teams.js';
import {
  AVAILABLE_MODELS,
  addSavedCommand,
  loadSavedCommands,
  removeSavedCommand
} from '../../../lib/hudEngine.js';
import StatusDot from '../../StatusDot.jsx';
import ModelBadge from '../../ModelBadge.jsx';

const ICON_MAP = {
  Crown,
  Sparkles,
  Radar,
  Sword,
  ShieldCheck,
  Bot,
  Cpu,
  Binary,
  Zap,
  Hammer,
  Moon,
  Palette,
  Search,
  PenLine,
  FileText,
  Music,
  Database,
  StickyNote,
  KeyRound,
  Coins,
  Briefcase,
  Rocket,
  Scale,
  Network,
  Radio
};

const INITIAL_WEBHOOKS = [
  {
    id: 'wh-tg',
    name: 'Telegram Alpha Signal Bot',
    endpoint: 'https://api.telegram.org/bot<token>/sendMessage',
    enabled: true,
    latency: '11ms'
  },
  {
    id: 'wh-dc',
    name: 'Discord Command Bridge Webhook',
    endpoint: 'https://discord.com/api/webhooks/maoc-relay',
    enabled: true,
    latency: '9ms'
  },
  {
    id: 'wh-tv',
    name: 'TradingView Execution Relay',
    endpoint: 'https://hooks.maoc.internal/v1/trade-exec',
    enabled: true,
    latency: '6ms'
  }
];

function formatNum(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function AgentInspectorDrawer({
  agentId,
  agentOverrides = {},
  onUpdateAgentOverride,
  onResetAgentOverride,
  events = [],
  activity = {},
  onClose,
  onDispatchTask,
  onLocateOnMap
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const drawerRef = useRef(null);
  useDialogFocus(Boolean(agentId), drawerRef, onClose);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const [newSkillInput, setNewSkillInput] = useState('');
  const [customDirective, setCustomDirective] = useState('');
  const [directChats, setDirectChats] = useState({});
  const [savedCommands, setSavedCommands] = useState(() => loadSavedCommands());
  const [webhooks, setWebhooks] = useState(INITIAL_WEBHOOKS);
  const [lastPingStatus, setLastPingStatus] = useState('');

  const baseAgent = useMemo(
    () => AGENTS.find((item) => item.id === agentId) || null,
    [agentId]
  );

  const agent = useMemo(() => {
    if (!baseAgent) return null;
    const override = agentOverrides[baseAgent.id] || {};
    return {
      ...baseAgent,
      ...override,
      tools: override.tools && override.tools.length > 0 ? override.tools : baseAgent.tools,
      disabledTools: override.disabledTools || [],
      coWorkPartner:
        override.coWorkPartner || baseAgent.coWorkPartner || 'HERMES',
      autonomyLevel: override.autonomyLevel ?? 90
    };
  }, [baseAgent, agentOverrides]);

  useEffect(() => {
    if (agent) {
      setPromptDraft(agent.systemPrompt);
    }
  }, [agent?.id, agent?.systemPrompt]);

  const team = useMemo(() => {
    if (!agent) return null;
    return TEAMS.find((item) => item.id === agent.team) || null;
  }, [agent]);

  const agentEvents = useMemo(() => {
    if (!agent) return [];
    return events
      .filter((ev) => ev.source_agent === agent.id || ev.target_agent === agent.id)
      .slice(-25)
      .reverse();
  }, [agent, events]);

  const tokenMetrics = useMemo(() => {
    if (!agent) {
      return { prompt: 0, completion: 0, total: 0, contextPct: 0, cost: '0.00' };
    }
    const reported = events.filter((event) => event.source_agent === agent.id && event.stage === 'response' && event.token_usage);
    const prompt = reported.reduce((sum, event) => sum + event.token_usage.prompt_tokens, 0);
    const completion = reported.reduce((sum, event) => sum + event.token_usage.completion_tokens, 0);
    const total = reported.reduce((sum, event) => sum + event.token_usage.total_tokens, 0);
    return { prompt, completion, total };
  }, [agent, events]);

  const invokedTools = useMemo(() => {
    const activeSet = new Set();
    for (const ev of agentEvents) {
      if (ev.event_type === 'TOOL_CALL' && ev.payload_summary) {
        const toolPrefix = ev.payload_summary.split(':')[0]?.trim();
        if (toolPrefix) activeSet.add(toolPrefix);
      }
    }
    return activeSet;
  }, [agentEvents]);

  if (!agent) return null;

  const IconComponent = ICON_MAP[agent.icon] || Cpu;
  const liveState = activity[agent.id];

  const effectiveStatus = liveState
    ? liveState.type === 'HITL_INTERRUPT'
      ? 'EXECUTING'
      : liveState.type === 'AGENT_THINKING'
        ? 'THINKING'
        : 'EXECUTING'
    : agent.status;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleSavePrompt = () => {
    onUpdateAgentOverride?.(agent.id, { systemPrompt: promptDraft });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1500);
  };

  const handleSelectModel = (newModel) => {
    onUpdateAgentOverride?.(agent.id, { model: newModel });
  };

  const handleAddCustomSkill = () => {
    const cleanSkill = newSkillInput
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (!cleanSkill) return;
    const nextTools = [...new Set([...agent.tools, cleanSkill])];
    onUpdateAgentOverride?.(agent.id, { tools: nextTools });
    setNewSkillInput('');
  };

  const handleToggleSkill = (toolName) => {
    const disabledSet = new Set(agent.disabledTools || []);
    if (disabledSet.has(toolName)) {
      disabledSet.delete(toolName);
    } else {
      disabledSet.add(toolName);
    }
    onUpdateAgentOverride?.(agent.id, {
      disabledTools: [...disabledSet]
    });
  };

  const handleChangeCoWorkPartner = (partnerId) => {
    onUpdateAgentOverride?.(agent.id, { coWorkPartner: partnerId });
  };

  const handleResetProfile = () => {
    onResetAgentOverride?.(agent.id);
    if (baseAgent) {
      setPromptDraft(baseAgent.systemPrompt);
    }
  };

  const handleSendDirectMessage = async (textOverride) => {
    const text =
      (textOverride ?? customDirective).trim() ||
      `สั่งการ ${agent.codename} Co-Work ร่วมกับ ${agent.coWorkPartner}: วิเคราะห์และสรุปรายงานส่งเข้าคลัง`;

    if (!window.confirm('เริ่มภารกิจใหม่สำหรับ Agent นี้? อาจมีค่าใช้จ่าย provider การส่งไม่เพิ่มสิทธิ์ tools หรืออนุมัติรายงาน')) return;
    const timeStr = new Date().toLocaleTimeString('en-GB');
    const tagTeam = agent.id === 'HERMES' ? 'HERMES' : agent.team.toUpperCase();
    const updatedCmds = addSavedCommand({
      agentId: agent.id,
      team: tagTeam,
      text,
      coWorkWith: agent.coWorkPartner
    });
    setSavedCommands(updatedCmds);

    setDirectChats((prev) => {
      const list = prev[agent.id] || [];
      return {
        ...prev,
        [agent.id]: [
          ...list,
          {
            id: `u-${Date.now()}`,
            sender: 'COMMANDER (YOU)',
            time: timeStr,
            text,
            isUser: true
          },
          {
            id: `a-${Date.now() + 1}`,
            sender: `${agent.codename} [${agent.model}] + CO-WORK: ${agent.coWorkPartner}`,
            time: timeStr,
            text: 'บันทึกคำสั่งไว้แล้ว สถานะการส่งและผลลัพธ์ต้องตรวจจากรายการภารกิจและ telemetry ข้อความนี้ไม่ใช่คำตอบ AI หรือหลักฐานว่างานสำเร็จ',
            isUser: false
          }
        ]
      };
    });

    onDispatchTask?.(
      `[TEAM:${tagTeam}] [COWORK:${agent.id},${agent.coWorkPartner},HERMES] ${agent.codename}: ${text}`
    );
    if (!textOverride) {
      setCustomDirective('');
    }
  };

  const handleDeleteSavedCommand = (cmdId) => {
    setSavedCommands(removeSavedCommand(cmdId));
  };

  const handleToggleWebhook = (whId) => {
    setWebhooks((prev) =>
      prev.map((item) =>
        item.id === whId ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleTriggerHermesPing = () => {
    setLastPingStatus(
      'DEMO ONLY — ยังไม่ได้ส่ง HTTP ไป endpoint ใด ทดสอบ Webhook จริงที่ ตั้งค่า → Webhook'
    );
  };

  const chatHistory = directChats[agent.id] || [];
  const agentSavedCommands = savedCommands.filter(
    (c) => c.agentId === agent.id || c.coWorkWith === agent.id
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="flex-1" onClick={onClose} />

      <aside ref={drawerRef} role="dialog" aria-modal="true" aria-label={`Agent ${agent.codename}`} tabIndex={-1} className="cc-drawer-enter relative z-10 flex h-full w-full max-w-[490px] flex-col border-l border-neon-cyan/40 bg-obsidian/95 shadow-2xl backdrop-blur-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-neon-cyan via-purple-500 to-gold" />

        {/* Drawer Header */}
        <header className="border-b border-white/10 p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/50 bg-cyan-500/10 text-cyan-300 shadow-glow-cyan">
                <IconComponent className="h-6 w-6" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold tracking-[0.22em] text-slate-100">
                    {agent.codename}
                  </h2>
                  <ModelBadge model={agent.model} />
                  <span className="rounded-md border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.14em] text-amber-300">
                    CO-WORK: {agent.coWorkPartner}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  {agent.role} •{' '}
                  <span className="font-semibold text-cyan-300">
                    {team?.label || agent.team.toUpperCase()}
                  </span>
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <StatusDot status={effectiveStatus} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                    {liveState ? `ACTIVITY: ${liveState.type}` : 'ไม่มี activity ล่าสุด · ไม่ใช่ provider health'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-slate-400 transition-colors hover:border-red-400/50 hover:text-red-300"
            >
              <span>ESC</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-bold tracking-[0.12em] transition-all ${
                activeTab === 'overview'
                  ? 'border border-neon-cyan/50 bg-cyan-500/20 text-cyan-200 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench className="h-3 w-3" />
              <span>SKILLS &amp; MODEL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-bold tracking-[0.12em] transition-all ${
                activeTab === 'chat'
                  ? 'border border-purple-400/50 bg-purple-500/20 text-purple-200 shadow-glow-purple'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              <span>CO-WORK &amp; CMDS ({agentSavedCommands.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('outputs')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-bold tracking-[0.12em] transition-all ${
                activeTab === 'outputs'
                  ? 'border border-amber-400/50 bg-amber-500/20 text-amber-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCheck2 className="h-3 w-3" />
              <span>{agent.id === 'HERMES' ? 'WEBHOOK HUB' : 'OUTPUTS'}</span>
            </button>
          </div>
        </header>

        {/* TAB 1: INDIVIDUAL AGENT SKILL SETTINGS, CO-WORK PAIRING & MODEL STUDIO */}
        {activeTab === 'overview' && (
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {/* 1. AI MODEL & CO-WORK PARTNER SELECTOR */}
            <section className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-amber-300" />
                  <p className="section-label">AI Model &amp; Co-Work Pairing</p>
                </div>
                <button
                  type="button"
                  onClick={handleResetProfile}
                  className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold tracking-wider text-slate-400 hover:border-neon-cyan/50 hover:text-cyan-300"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>RESET DEFAULT</span>
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {AVAILABLE_MODELS.map((mdl) => {
                  const isCurrent = agent.model === mdl;
                  return (
                    <button
                      key={mdl}
                      type="button"
                      onClick={() => handleSelectModel(mdl)}
                      className={`rounded-lg border px-2.5 py-1 text-[9px] font-bold tracking-[0.16em] transition-all ${
                        isCurrent
                          ? 'border-neon-cyan bg-cyan-500/20 text-cyan-200 shadow-glow-cyan'
                          : 'border-white/10 bg-slate-950/80 text-slate-400 hover:border-white/25 hover:text-slate-200'
                      }`}
                    >
                      {mdl}
                    </button>
                  );
                })}
              </div>

              {/* Co-Work Partner Selector */}
              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 font-semibold text-purple-300">
                    <Users className="h-3.5 w-3.5" />
                    Co-Work Partner Agent (ทำงานร่วมกัน):
                  </span>
                  <select
                    value={agent.coWorkPartner}
                    onChange={(e) => handleChangeCoWorkPartner(e.target.value)}
                    className="rounded-lg border border-purple-400/40 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-purple-200 outline-none focus:border-neon-cyan"
                  >
                    {AGENTS.filter((a) => a.id !== agent.id).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codename} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* 2. INDIVIDUAL AGENT SKILL & MCP TOOL BUILDER */}
            <section className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-cyan-300" />
                  <p className="section-label">
                    {agent.codename} // Individual Skill Matrix
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-cyan-300">
                  {agent.tools.length - (agent.disabledTools?.length || 0)} /{' '}
                  {agent.tools.length} ENABLED
                </span>
              </div>

              {/* Add New Custom Skill Input */}
              <div className="mt-2.5 flex gap-1.5">
                <input
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSkill();
                    }
                  }}
                  placeholder={`เพิ่ม Skill ใหม่ให้ ${agent.codename} (เช่น live-gold-scanner)...`}
                  className="flex-1 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 outline-none focus:border-neon-cyan"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSkill}
                  className="flex items-center gap-1 rounded-xl border border-neon-cyan/50 bg-cyan-500/15 px-3 py-1.5 text-[9px] font-bold tracking-wider text-cyan-200 hover:bg-cyan-500/25"
                >
                  <Plus className="h-3 w-3" />
                  <span>ADD SKILL</span>
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {agent.tools.map((toolName) => {
                  const isDisabled = (agent.disabledTools || []).includes(toolName);
                  const wasInvoked = invokedTools.has(toolName);
                  return (
                    <button
                      key={toolName}
                      type="button"
                      onClick={() => handleToggleSkill(toolName)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all ${
                        isDisabled
                          ? 'border-white/5 bg-slate-950/40 text-slate-600 opacity-60'
                          : wasInvoked
                            ? 'border-amber-400/50 bg-amber-500/10 text-amber-200'
                            : 'border-emerald-400/30 bg-slate-950/80 text-slate-200 hover:border-neon-cyan/50'
                      }`}
                    >
                      <span className="truncate text-[11px] font-semibold">
                        {toolName}
                      </span>
                      <span
                        className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${
                          isDisabled
                            ? 'bg-slate-800 text-slate-500'
                            : wasInvoked
                              ? 'bg-amber-400/20 text-amber-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {isDisabled ? 'OFF' : wasInvoked ? 'INVOKED' : 'ON'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. EDITABLE SYSTEM PROMPT STUDIO */}
            <section className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-cyan-300" />
                  <p className="section-label">System Prompt Studio</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSavePrompt}
                    className="flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] text-emerald-200 transition-colors hover:bg-emerald-500/25"
                  >
                    <Save className="h-3 w-3" />
                    <span>{savedNotice ? 'SAVED!' : 'SAVE PROMPT'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1 text-[9px] font-bold tracking-[0.14em] text-slate-300 transition-colors hover:border-neon-cyan/50 hover:text-cyan-300"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-300">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <textarea
                rows={3}
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                className="mt-2.5 w-full resize-none rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs leading-relaxed text-slate-200 outline-none focus:border-neon-cyan/60"
              />
            </section>

            {/* 4. TOKEN USAGE */}
            <section className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-emerald-300" />
                  <p className="section-label">Token Usage &amp; Context</p>
                </div>
                <span className="text-[10px] font-bold text-gold">
                  PROVIDER-REPORTED · VISIBLE EVENT WINDOW
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/5 bg-slate-950/75 p-2">
                  <p className="text-[9px] uppercase text-slate-500">Prompt</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-200">
                    {formatNum(tokenMetrics.prompt)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/75 p-2">
                  <p className="text-[9px] uppercase text-slate-500">Completion</p>
                  <p className="mt-0.5 text-xs font-bold text-cyan-300">
                    {formatNum(tokenMetrics.completion)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/75 p-2">
                  <p className="text-[9px] uppercase text-slate-500">Total</p>
                  <p className="mt-0.5 text-xs font-bold text-purple-300">
                    {formatNum(tokenMetrics.total)}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: CO-WORK CHAT & SAVED COMMANDS MEMORY */}
        {activeTab === 'chat' && (
          <div className="flex flex-1 flex-col overflow-hidden p-5">
            {/* SAVED COMMANDS MEMORY (คำสั่งที่เคยกำหนดไว้) */}
            <div className="mb-3 rounded-2xl border border-amber-400/30 bg-slate-950/85 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                  <Bookmark className="h-3 w-3" />
                  Saved Commands &amp; Co-Work Presets ({agentSavedCommands.length})
                </span>
                <span className="text-[8px] text-slate-500">CLICK TO RUN</span>
              </div>

              <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto pr-1">
                {agentSavedCommands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-[10px]"
                  >
                    <button
                      type="button"
                      onClick={() => handleSendDirectMessage(cmd.text)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-slate-200 hover:text-cyan-300"
                    >
                      <Play className="h-3 w-3 shrink-0 text-cyan-400" />
                      <span className="truncate">{cmd.text}</span>
                    </button>
                    <span className="shrink-0 rounded bg-purple-500/15 px-1.5 py-0.5 text-[8px] font-bold text-purple-300">
                      +{cmd.coWorkWith}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedCommand(cmd.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Chat Stream */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-xs">
              <div className="rounded-2xl border border-neon-cyan/30 bg-cyan-950/20 p-3">
                <div className="flex items-center justify-between text-[10px] text-cyan-300">
                  <span className="font-bold">
                    {agent.codename} [{agent.model}] &harr; CO-WORK: {agent.coWorkPartner}
                  </span>
                  <span>READY</span>
                </div>
                <p className="mt-1 leading-relaxed text-slate-200">
                  ทุกคำสั่งที่คุณพิมพ์ด้านล่างจะถูกบันทึกไว้ใน <strong>Saved Commands</strong> ด้านบนอัตโนมัติ และรันแบบ Co-Work ร่วมกับ{' '}
                  <span className="font-bold text-purple-300">{agent.coWorkPartner}</span> ครับ
                </p>
              </div>

              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-2xl border p-3 ${
                    msg.isUser
                      ? 'ml-6 border-purple-400/40 bg-purple-950/30 text-purple-100'
                      : 'mr-4 border-white/10 bg-slate-900/90 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span className="font-bold text-cyan-300">{msg.sender}</span>
                    <span>{msg.time}</span>
                  </div>
                  <p className="mt-1 leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: HERMES WEBHOOK HUB OR AGENT DELIVERABLES */}
        {activeTab === 'outputs' && (
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {agent.id === 'HERMES' ? (
              <section className="glass-panel rounded-2xl border border-amber-400/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-amber-300" />
                    <p className="section-label text-amber-300">
                      HERMES Webhook Mockup · ไม่เชื่อม endpoint จริง
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerHermesPing}
                    className="flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-500/20 px-2.5 py-1 text-[9px] font-bold tracking-wider text-amber-200 hover:bg-amber-500/30"
                  >
                    <Zap className="h-3 w-3" />
                    <span>DEMO PING</span>
                  </button>
                </div>

                {lastPingStatus && (
                  <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-2.5 text-[10px] font-semibold text-emerald-300">
                    ✓ {lastPingStatus}
                  </div>
                )}

                <div className="mt-3 space-y-2.5">
                  {webhooks.map((wh) => (
                    <div
                      key={wh.id}
                      className="rounded-xl border border-white/10 bg-slate-950/80 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-100">{wh.name}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleWebhook(wh.id)}
                          className={`rounded-md border px-2 py-0.5 text-[8px] font-bold tracking-widest ${
                            wh.enabled
                              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                              : 'border-slate-600 bg-slate-800 text-slate-400'
                          }`}
                        >
                            {wh.enabled ? 'DEMO ENABLED' : 'DEMO DISABLED'}
                        </button>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-slate-500">
                        {wh.endpoint}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-emerald-300" />
                  <p className="section-label">
                    {agent.codename} // Real-Time Execution Outputs
                  </p>
                </div>
                <span className="text-[10px] text-slate-500">
                  {agentEvents.length} LIVE RECORDS
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {agentEvents.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/75 p-3 text-xs text-slate-400">
                    <p className="font-semibold text-slate-200">
                      ยังไม่มี telemetry สำหรับ {agent.codename}
                    </p>
                    <p className="mt-1 text-[11px]">เริ่มภารกิจแล้วตรวจผลจริงที่นี่ ไม่มีการใช้ข้อความตัวอย่างเป็นผลการทำงาน</p>
                  </div>
                ) : (
                  agentEvents.map((ev) => (
                    <div
                      key={ev.event_id}
                      className="rounded-xl border border-emerald-400/30 bg-emerald-950/15 p-3"
                    >
                      <div className="flex items-center justify-between text-[9px] text-emerald-300">
                        <span className="flex items-center gap-1 font-bold">
                          <CheckCircle2 className="h-3 w-3" />
                          {ev.event_type} ({ev.progress_pct}%)
                        </span>
                        <span>{new Date(ev.timestamp).toLocaleTimeString('en-GB')}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-200">{ev.payload_summary}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* Drawer Footer Controls */}
        <footer className="space-y-2.5 border-t border-white/10 bg-slate-950/90 p-4">
          <div className="flex gap-2">
            <input
              value={customDirective}
              onChange={(e) => setCustomDirective(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendDirectMessage();
                }
              }}
              placeholder={`สั่งงาน ${agent.codename} + ${agent.coWorkPartner} (บันทึกคำสั่งอัตโนมัติ)...`}
              className="flex-1 rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-neon-cyan/60"
            />
            <button
              type="button"
              onClick={() => handleSendDirectMessage()}
              className="flex items-center gap-1.5 rounded-xl border border-neon-cyan/60 bg-cyan-500/15 px-3.5 py-2 text-[10px] font-bold tracking-[0.16em] text-cyan-200 shadow-glow-cyan transition-colors hover:bg-cyan-500/25"
            >
              <Send className="h-3.5 w-3.5" />
              <span>RUN</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onLocateOnMap?.(agent)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-400/40 bg-purple-500/10 py-2 text-[10px] font-bold tracking-[0.18em] text-purple-200 transition-colors hover:bg-purple-500/20"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>
              OPEN {team?.label || agent.team.toUpperCase()} ROOM &amp; DELIVERABLES
            </span>
          </button>
        </footer>
      </aside>
    </div>
  );
}
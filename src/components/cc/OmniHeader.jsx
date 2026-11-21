import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { AGENTS } from '../../data/agents.js';
import { TEAMS } from '../../data/teams.js';
import StatusDot from '../StatusDot.jsx';
import ModelBadge from '../ModelBadge.jsx';

const CONNECTION_STYLES = {
  live: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  connecting: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  offline: 'border-red-500/50 bg-red-500/10 text-red-300'
};

export default function OmniHeader({
  online,
  busy,
  errors,
  criticalCount,
  totalAlertsCount = 0,
  connectionState,
  onSubmitTask,
  onResetAlerts,
  onFocusAgent,
  onEnterRoom,
  inputRef
}) {
  const [command, setCommand] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('en-GB'));

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date().toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const teamsMap = useMemo(
    () => Object.fromEntries(TEAMS.map((t) => [t.id, t])),
    []
  );

  const matchedAgents = useMemo(() => {
    const q = command.trim().toLowerCase();
    if (!q) {
      return AGENTS.filter((a) =>
        ['HERMES', 'ARIA', 'HAWK', 'BLADE', 'SAGE', 'REX'].includes(a.id)
      );
    }
    return AGENTS.filter(
      (a) =>
        a.codename.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.team.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.tools.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [command]);

  const handleSubmit = () => {
    const description = command.trim();
    if (!description) return;
    onSubmitTask(description);
    setCommand('');
    setPaletteOpen(false);
  };

  return (
    <header className="relative z-40 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-obsidian/90 px-4 py-3 backdrop-blur-xl">
      {/* Left: Brand Title + Live Agent Status + WS Status */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="section-label">Spatial Multi-Agent Command Center</p>
          <h1 className="mt-0.5 text-base font-bold tracking-[0.22em] text-slate-100">
            ISOMETRIC AI OFFICE
          </h1>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-emerald-300">
          <Activity className="h-3 w-3" />
          {online} AGENTS ONLINE | {busy} BUSY | {errors} ERROR
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.18em] ${
            CONNECTION_STYLES[connectionState] || CONNECTION_STYLES.connecting
          }`}
        >
          WS {connectionState.toUpperCase()}
        </span>
      </div>

      {/* Center: Global Semantic Command Input + Quick-Finder Palette */}
      <div className="relative mx-auto w-full max-w-xl min-w-[260px] flex-1">
        <label className="group flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/75 px-3 py-2 transition-all focus-within:border-neon-cyan/60 focus-within:shadow-glow-cyan">
          <Search className="h-4 w-4 text-slate-500 group-focus-within:text-cyan-300" />
          <input
            ref={inputRef}
            value={command}
            onFocus={() => setPaletteOpen(true)}
            onBlur={() => {
              setTimeout(() => setPaletteOpen(false), 180);
            }}
            onChange={(event) => {
              setCommand(event.target.value);
              setPaletteOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
              if (event.key === 'Escape') {
                setPaletteOpen(false);
              }
            }}
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none"
            placeholder="Search Agent (e.g. HERMES, HAWK), tool, or press Enter to dispatch task..."
          />
          {command.trim() && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="flex items-center gap-1 rounded-lg border border-neon-cyan/50 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-cyan-200 hover:bg-cyan-500/25"
            >
              <Send className="h-2.5 w-2.5" />
              <span>RUN</span>
            </button>
          )}
          <kbd className="rounded-md border border-white/15 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-slate-400">
            CTRL+K
          </kbd>
        </label>

        {/* Live Semantic Command Palette Dropdown */}
        {paletteOpen && (
          <div className="absolute inset-x-0 top-full mt-2 rounded-2xl border border-neon-cyan/40 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                {command.trim()
                  ? `MATCHING AGENTS & TOOLS (${matchedAgents.length})`
                  : 'QUICK AGENT FINDER & RELAY PRESETS'}
              </span>
              <span className="text-[9px] text-slate-500">
                ENTER = DISPATCH TASK • CLICK = INSPECT
              </span>
            </div>

            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {matchedAgents.map((agent) => {
                const teamObj = teamsMap[agent.team];
                return (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/80 p-2 transition-colors hover:border-neon-cyan/50"
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onFocusAgent?.(agent.id);
                        setPaletteOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <StatusDot status={agent.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold tracking-[0.16em] text-slate-100">
                            {agent.codename}
                          </span>
                          <ModelBadge model={agent.model} />
                        </div>
                        <p className="truncate text-[9px] text-slate-400">
                          {agent.role} • {teamObj?.label || agent.team}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onEnterRoom?.(agent.team);
                        setPaletteOpen(false);
                      }}
                      className="flex shrink-0 items-center gap-0.5 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-1 text-[8px] font-bold tracking-wider text-cyan-300 hover:bg-cyan-500/25"
                    >
                      <span>ROOM</span>
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Global Task Presets inside Dropdown */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">
                INSTANT DISPATCH:
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSubmitTask?.(
                    'Hermes Relay: broadcast cross-department telemetry and sync external webhooks'
                  );
                  setPaletteOpen(false);
                }}
                className="flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[8px] font-bold tracking-wider text-amber-300 hover:bg-amber-500/25"
              >
                <Zap className="h-2.5 w-2.5" />
                <span>HERMES RELAY BROADCAST</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSubmitTask?.(
                    'Scan XAU/USD market structure and execute momentum strategy'
                  );
                  setPaletteOpen(false);
                }}
                className="flex items-center gap-1 rounded-md border border-neon-cyan/40 bg-cyan-500/10 px-2 py-0.5 text-[8px] font-bold tracking-wider text-cyan-300 hover:bg-cyan-500/25"
              >
                <Zap className="h-2.5 w-2.5" />
                <span>XAU/USD TRADE PIPELINE</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Critical Escalation Banner OR Nominal Status Pill */}
      <div className="flex items-center gap-2">
        {criticalCount > 0 ? (
          <div className="flex animate-pulse-fast items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-[10px] font-bold tracking-[0.14em] text-red-300 shadow-glow-red">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              {criticalCount} URGENT ACTIONS REQUIRED - HUMAN-IN-THE-LOOP APPROVAL
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold tracking-[0.14em] text-emerald-300 shadow-glow-green">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                ALL SYSTEMS NOMINAL // {totalAlertsCount} NOTIFICATIONS
              </span>
            </div>

            {onResetAlerts && (
              <button
                type="button"
                onClick={onResetAlerts}
                title="Restore sample notifications"
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/80 px-2.5 py-2 text-[10px] font-bold tracking-[0.14em] text-slate-300 transition-colors hover:border-neon-cyan/50 hover:text-cyan-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>RESTORE ALERTS</span>
              </button>
            )}
          </div>
        )}

        <div className="hidden rounded-xl border border-white/10 bg-slate-900/75 px-3 py-2 text-[10px] font-bold tracking-[0.18em] text-cyan-300 xl:block">
          {clock}
        </div>
      </div>
    </header>
  );
}
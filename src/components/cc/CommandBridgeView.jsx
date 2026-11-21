import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Binary,
  Bookmark,
  Bot,
  Briefcase,
  CheckCircle2,
  Code2,
  Coins,
  Copy,
  Cpu,
  Crown,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Hammer,
  KeyRound,
  Layers,
  Map,
  Moon,
  Music,
  Network,
  Palette,
  Pause,
  PenLine,
  Play,
  Radar,
  Radio,
  Rocket,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sword,
  X,
  Zap
} from 'lucide-react';
import { AGENTS } from '../../data/agents.js';
import { TEAMS } from '../../data/teams.js';
import {
  exportDepartmentMarkdown,
  loadDeliverables,
  loadRoomChats
} from '../../lib/departmentVault.js';
import {
  SYSTEM_UPDATES_LOG,
  loadAgentOverrides,
  loadSavedCommands
} from '../../lib/hudEngine.js';
import StatusDot from '../StatusDot.jsx';
import ModelBadge from '../ModelBadge.jsx';

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

const TEAM_CARD_STYLES = {
  purple: 'border-purple-400/40 hover:border-purple-400/70',
  blue: 'border-blue-400/35 hover:border-blue-400/70',
  violet: 'border-violet-400/35 hover:border-violet-400/70',
  emerald: 'border-emerald-400/35 hover:border-emerald-400/70',
  cyan: 'border-neon-cyan/70 shadow-glow-cyan bg-cyan-950/20',
  indigo: 'border-indigo-400/35 hover:border-indigo-400/70',
  amber: 'border-amber-400/35 hover:border-amber-400/70',
  rose: 'border-rose-400/35 hover:border-rose-400/70'
};

const TEAM_TEXT_ACCENT = {
  purple: 'text-purple-300',
  blue: 'text-blue-300',
  violet: 'text-violet-300',
  emerald: 'text-emerald-300',
  cyan: 'text-cyan-300',
  indigo: 'text-indigo-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300'
};

const DEPT_PROMPTS = {
  command:
    '[TEAM:COMMAND] Executive directive: synchronize all 7 departments via HERMES relay',
  tech: '[TEAM:TECH] Tech sprint: optimize API latency and deploy frontend HUD',
  design:
    '[TEAM:DESIGN] Design critique: refine neon contrast and UI shader tokens',
  content:
    '[TEAM:CONTENT] Content research: compile macro intel brief and brand copy',
  trade:
    '[TEAM:TRADE] Scan XAU/USD market structure and execute momentum strategy',
  data: '[TEAM:DATA] Data security audit: verify warehouse schema and MCP permissions',
  finance:
    '[TEAM:FINANCE] Finance model: analyze Q3 budget ledger and growth loop ROI',
  legal:
    '[TEAM:LEGAL] Legal compliance: review autonomous policy guardrails and ops SLA'
};

const AUTOPILOT_ROTATION = [
  'command',
  'tech',
  'content',
  'finance',
  'data',
  'design',
  'legal'
];

function formatNumber(val) {
  return new Intl.NumberFormat('en-US').format(val);
}

export default function CommandBridgeView({
  activity = {},
  events = [],
  focusedAgentId,
  onFocusAgent,
  activeTask,
  onDispatchTask,
  onEnterRoom,
  onOpenSpatialMap,
  onOpenTopologyGraph
}) {
  const [autoPilot, setAutoPilot] = useState(false);
  const [vaultDeliverables, setVaultDeliverables] = useState(() =>
    loadDeliverables()
  );
  const [savedCommands, setSavedCommands] = useState(() => loadSavedCommands());
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [inspectedDeliverable, setInspectedDeliverable] = useState(null);

  useEffect(() => {
    const onVaultUpdated = () => {
      setVaultDeliverables(loadDeliverables());
      setSavedCommands(loadSavedCommands());
    };
    window.addEventListener('maoc-vault-updated', onVaultUpdated);
    return () => window.removeEventListener('maoc-vault-updated', onVaultUpdated);
  }, []);

  useEffect(() => {
    if (!autoPilot) return undefined;
    let cursor = 0;
    const timer = setInterval(() => {
      const deptKey = AUTOPILOT_ROTATION[cursor % AUTOPILOT_ROTATION.length];
      cursor += 1;
      onDispatchTask?.(DEPT_PROMPTS[deptKey]);
    }, 16000);
    return () => clearInterval(timer);
  }, [autoPilot, onDispatchTask]);

  const agentsById = useMemo(
    () => Object.fromEntries(AGENTS.map((agent) => [agent.id, agent])),
    []
  );

  const fleetMetrics = useMemo(() => {
    const baseTokens = AGENTS.reduce((sum, a) => sum + a.tokens.total, 0);
    const liveBonus = events.length * 615;
    const opusCount = AGENTS.filter((a) => a.model === 'OPUS').length;
    const sonnetCount = AGENTS.filter((a) => a.model === 'SONNET').length;
    const haikuCount = AGENTS.filter((a) => a.model === 'HAIKU').length;
    const customCount = AGENTS.filter(
      (a) => !['OPUS', 'SONNET', 'HAIKU', 'FOUNDER'].includes(a.model)
    ).length;
    const activeNowCount = Object.keys(activity).length;

    return {
      totalTokens: baseTokens + liveBonus,
      opusCount,
      sonnetCount,
      haikuCount,
      customCount,
      activeNowCount
    };
  }, [events.length, activity]);

  const allDeliverablesList = useMemo(() => {
    const entries = Object.values(vaultDeliverables).flat();
    if (selectedDeptFilter === 'ALL') return entries;
    return entries.filter((item) => item.deptId === selectedDeptFilter);
  }, [vaultDeliverables, selectedDeptFilter]);

  const handleExportWorkspaceJson = () => {
    const snapshot = {
      exported_at: new Date().toISOString(),
      version: 'v3.4.0-enterprise',
      agent_overrides: loadAgentOverrides(),
      saved_commands: loadSavedCommands(),
      department_deliverables: loadDeliverables(),
      department_chats: loadRoomChats()
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maoc-workspace-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
      {/* 1. TOP EXECUTIVE BRIDGE BANNER */}
      <section className="glass-panel rounded-2xl border border-neon-cyan/30 p-4 shadow-glow-cyan">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-neon-cyan/50 bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.2em] text-cyan-200">
                COMMAND BRIDGE // EXECUTIVE DECK
              </span>
              <span className="rounded-md border border-purple-400/40 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.16em] text-purple-300">
                8 ZONES • {AGENTS.length} AUTONOMOUS NODES
              </span>
            </div>
            <h2 className="mt-2 text-base font-bold tracking-[0.2em] text-slate-100">
              CENTRAL ORCHESTRATION, HERMES RELAY &amp; DEPARTMENT MATRIX
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextState = !autoPilot;
                setAutoPilot(nextState);
                if (nextState) {
                  onDispatchTask?.(DEPT_PROMPTS.command);
                }
              }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold tracking-[0.16em] transition-all ${
                autoPilot
                  ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-glow-gold'
                  : 'border-white/15 bg-slate-900/80 text-slate-300 hover:border-amber-400/50 hover:text-amber-200'
              }`}
            >
              {autoPilot ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>
                {autoPilot ? 'AUTO-PILOT CO-WORK: ON' : 'AUTO-PILOT CO-WORK: OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenSpatialMap}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-[10px] font-bold tracking-[0.16em] text-slate-200 transition-all hover:border-neon-cyan/60 hover:text-cyan-300"
            >
              <Map className="h-3.5 w-3.5 text-cyan-300" />
              <span>SPATIAL MAP</span>
            </button>

            <button
              type="button"
              onClick={onOpenTopologyGraph}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-[10px] font-bold tracking-[0.16em] text-slate-200 transition-all hover:border-purple-400/60 hover:text-purple-300"
            >
              <Layers className="h-3.5 w-3.5 text-purple-300" />
              <span>AGENT GRAPH</span>
            </button>

            <button
              type="button"
              onClick={handleExportWorkspaceJson}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-3 py-2 text-[10px] font-bold tracking-[0.16em] text-emerald-200 transition-all hover:bg-emerald-500/25"
            >
              <Download className="h-3.5 w-3.5" />
              <span>BACKUP (.JSON)</span>
            </button>
          </div>
        </div>

        {/* Executive Telemetry Strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/75 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Command &amp; Relay Core
            </p>
            <p className="mt-1 text-sm font-bold text-gold">
              TAEC &rarr; ARIA &harr; HERMES
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Zero-Latency Bus (9ms) • 7 Depts
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/75 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Cumulative Fleet Tokens
            </p>
            <p className="mt-1 text-sm font-bold text-cyan-300">
              {formatNumber(fleetMetrics.totalTokens)} TOKENS
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {events.length} Live Telemetry Events Logged
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/75 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Model Tier Allocation
            </p>
            <p className="mt-1 text-sm font-bold text-purple-300">
              {fleetMetrics.opusCount} OPUS • {fleetMetrics.sonnetCount} SONNET •{' '}
              {fleetMetrics.haikuCount} HAIKU
            </p>
            <p className="mt-0.5 text-[10px] text-amber-300">
              + {fleetMetrics.customCount} Custom/Hermes • 1 FOUNDER
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/75 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Live Orchestration State
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-300">
                {activeTask
                  ? `${activeTask.state} (${activeTask.progress}%)`
                  : fleetMetrics.activeNowCount > 0
                    ? `${fleetMetrics.activeNowCount} NODES ACTIVE`
                    : 'ALL PIPELINES READY'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">
              {activeTask
                ? activeTask.description
                : 'Click any deliverable below to inspect full spec'}
            </p>
          </div>
        </div>
      </section>

      {/* 2. 8-ZONE OFFICIAL DEPARTMENT MATRIX GRID */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TEAMS.map((team) => {
          const cardStyle = TEAM_CARD_STYLES[team.accent] || 'border-white/10';
          const titleColor = TEAM_TEXT_ACCENT[team.accent] || 'text-slate-100';
          const teamDeliverables = vaultDeliverables[team.id] || [];
          const latestDeliverable = teamDeliverables[0];

          return (
            <section
              key={team.id}
              className={`glass-panel flex flex-col justify-between rounded-2xl border p-4 transition-all ${cardStyle}`}
            >
              <div>
                <header className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-xs font-bold tracking-[0.22em] ${titleColor}`}
                      >
                        {team.label}
                      </h3>
                      <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-bold text-slate-400">
                        {team.agentIds.length} NODES
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">{team.sub}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEnterRoom?.(team.id)}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-neon-cyan/50 bg-cyan-500/15 px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] text-cyan-200 transition-all hover:bg-cyan-500/30"
                  >
                    <span>CHAT &amp; ROOM</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </header>

                <ul className="mt-3 space-y-2">
                  {team.agentIds.map((agentId) => {
                    const agent = agentsById[agentId];
                    if (!agent) return null;

                    const IconComponent = ICON_MAP[agent.icon] || Cpu;
                    const live = activity[agentId];
                    const isFocused = focusedAgentId === agentId;

                    const effectiveStatus = live
                      ? live.type === 'HITL_INTERRUPT'
                        ? 'EXECUTING'
                        : live.type === 'AGENT_THINKING'
                          ? 'THINKING'
                          : 'EXECUTING'
                      : agent.status;

                    return (
                      <li key={agent.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onFocusAgent?.(isFocused ? null : agent.id)
                          }
                          className={`flex w-full items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                            live
                              ? 'border-neon-cyan bg-cyan-950/40 shadow-glow-cyan'
                              : isFocused
                                ? 'border-purple-400 bg-purple-950/30 shadow-glow-purple'
                                : 'border-white/5 bg-slate-950/65 hover:border-white/20'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-slate-900 text-cyan-300">
                              <IconComponent className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold tracking-[0.18em] text-slate-100">
                                  {agent.codename}
                                </span>
                                <StatusDot status={effectiveStatus} />
                              </div>
                              <p className="truncate text-[10px] text-slate-400">
                                {agent.role}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <ModelBadge model={agent.model} />
                            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {live ? live.type : agent.statusLabel}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Clickable Latest Deliverable Preview */}
              <div className="mt-3 border-t border-white/10 pt-2.5">
                {latestDeliverable && (
                  <button
                    type="button"
                    onClick={() => setInspectedDeliverable(latestDeliverable)}
                    className="mb-2 flex w-full items-center justify-between gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-950/20 px-2.5 py-1.5 text-left text-[10px] text-slate-200 transition-colors hover:border-neon-cyan"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="truncate font-semibold">
                        {latestDeliverable.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-[8px] font-bold text-cyan-300">
                      INSPECT &rarr;
                    </span>
                  </button>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold tracking-wider text-slate-500">
                    OUTPUTS: {teamDeliverables.length} ARCHIVED
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onDispatchTask?.(
                        DEPT_PROMPTS[team.id] ||
                          `[TEAM:${team.id.toUpperCase()}] Run ${team.label} pipeline`
                      )
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] text-slate-300 transition-colors hover:border-neon-cyan/50 hover:text-cyan-300"
                  >
                    RUN {team.label}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* 3. BOTTOM EXECUTIVE HUB: ALL-DEPARTMENT DELIVERABLES + SAVED COMMANDS + SYSTEM & UPDATES LATEST */}
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        {/* Left 8 cols: All-Department Deliverables Inspector Vault */}
        <section className="glass-panel rounded-2xl p-4 xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="section-label">
                Executive Deliverables Vault // Click Any Task To Inspect Full Spec
              </p>
              <h3 className="mt-0.5 text-sm font-bold tracking-[0.18em] text-slate-100">
                COLLECTED CO-WORK DELIVERABLES ({allDeliverablesList.length} REPORTS)
              </h3>
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSelectedDeptFilter('ALL')}
                className={`rounded-lg border px-2.5 py-1 text-[8px] font-bold tracking-wider ${
                  selectedDeptFilter === 'ALL'
                    ? 'border-neon-cyan bg-cyan-500/20 text-cyan-200'
                    : 'border-white/10 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                ALL 8 ZONES
              </button>
              {TEAMS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedDeptFilter(t.id)}
                  className={`rounded-lg border px-2 py-1 text-[8px] font-bold tracking-wider ${
                    selectedDeptFilter === t.id
                      ? 'border-neon-cyan bg-cyan-500/20 text-cyan-200'
                      : 'border-white/10 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 md:grid-cols-2">
            {allDeliverablesList.slice(0, 8).map((item) => (
              <div
                key={item.id}
                onClick={() => setInspectedDeliverable(item)}
                className="group cursor-pointer rounded-xl border border-white/10 bg-slate-950/80 p-3 transition-all hover:border-neon-cyan/60 hover:bg-slate-900"
              >
                <div className="flex items-center justify-between text-[9px]">
                  <span className="rounded border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 font-bold text-cyan-300">
                    {item.deptLabel}
                  </span>
                  <span className="flex items-center gap-1 font-bold text-emerald-300 group-hover:underline">
                    <Eye className="h-3 w-3" />
                    INSPECT FULL SPEC
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-bold text-slate-100">
                  {item.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">
                  {item.summary}
                </p>
                <div className="mt-2 flex items-center justify-between text-[8px] text-slate-500">
                  <span>
                    CO-WORK: {(item.coWork || [item.lead]).join(' -> ')}
                  </span>
                  <span>{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right 4 cols: Saved Commands Memory + System & Updates Latest */}
        <section className="glass-panel flex flex-col gap-4 rounded-2xl p-4 xl:col-span-4">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                <Bookmark className="h-3.5 w-3.5" />
                Saved Commands Memory ({savedCommands.length})
              </span>
              <span className="text-[8px] text-slate-500">1-CLICK REPLAY</span>
            </div>
            <div className="mt-2.5 max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {savedCommands.slice(0, 8).map((cmd) => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() =>
                    onDispatchTask?.(
                      `[TEAM:${cmd.team.toUpperCase()}] [COWORK:${cmd.agentId},${
                        cmd.coWorkWith
                      },HERMES] ${cmd.text}`
                    )
                  }
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-2.5 py-2 text-left text-[10px] text-slate-200 transition-colors hover:border-amber-400/50 hover:text-amber-200"
                >
                  <span className="truncate">
                    <strong className="text-cyan-300">{cmd.agentId}:</strong>{' '}
                    {cmd.text}
                  </span>
                  <span className="shrink-0 rounded bg-purple-500/15 px-1.5 py-0.5 text-[8px] font-bold text-purple-300">
                    +{cmd.coWorkWith}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              System &amp; Updates Latest
            </span>
            <ul className="mt-2.5 space-y-2">
              {SYSTEM_UPDATES_LOG.map((up) => (
                <li
                  key={up.version}
                  className="rounded-xl border border-white/5 bg-slate-950/75 p-2.5 text-[10px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">{up.version}</span>
                    <span className="text-[8px] font-bold text-emerald-400">
                      {up.time}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-slate-200">{up.title}</p>
                  <p className="mt-0.5 text-[9px] text-slate-400">{up.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* FULL DEEP-DIVE DELIVERABLE INSPECTOR MODAL ON COMMAND BRIDGE */}
      {inspectedDeliverable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={() => setInspectedDeliverable(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-neon-cyan/50 bg-obsidian/95 shadow-2xl"
          >
            <div className="h-1 w-full bg-gradient-to-r from-neon-cyan via-purple-500 to-gold" />

            <header className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-emerald-400/50 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold tracking-widest text-emerald-300">
                    {inspectedDeliverable.status} // SENIOR DEV DELIVERABLE SPEC
                  </span>
                  <span className="rounded-md border border-neon-cyan/40 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-cyan-300">
                    {inspectedDeliverable.deptLabel}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {inspectedDeliverable.time}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold tracking-wide text-slate-100">
                  {inspectedDeliverable.title}
                </h3>
                <p className="mt-1 text-xs text-purple-300">
                  Co-Work Execution Chain:{' '}
                  <strong>
                    {(inspectedDeliverable.coWork || [inspectedDeliverable.lead]).join(
                      ' -> '
                    )}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportDepartmentMarkdown(inspectedDeliverable.deptLabel, [
                      inspectedDeliverable
                    ])
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold tracking-wider text-emerald-200 hover:bg-emerald-500/25"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>DOWNLOAD .MD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedDeliverable(null)}
                  className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-400 hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
              <section className="rounded-2xl border border-neon-cyan/30 bg-cyan-950/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                  Executive Summary
                </p>
                <p className="mt-1.5 leading-relaxed text-slate-100">
                  {inspectedDeliverable.summary}
                </p>
              </section>

              {inspectedDeliverable.paragraphs?.length > 0 && (
                <section className="space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
                    Multi-Paragraph Architecture &amp; Domain Analysis
                  </p>
                  {inspectedDeliverable.paragraphs.map((para, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/10 bg-slate-900/85 p-3.5 leading-relaxed text-slate-200"
                    >
                      {para}
                    </div>
                  ))}
                </section>
              )}

              {inspectedDeliverable.artifactCode && (
                <section className="rounded-2xl border border-amber-400/30 bg-slate-950 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                      <Code2 className="h-3.5 w-3.5" />
                      Verified Technical Artifact / Payload
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard?.writeText(
                          inspectedDeliverable.artifactCode
                        )
                      }
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-200"
                    >
                      <Copy className="h-3 w-3" />
                      <span>COPY</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-300">
                    {inspectedDeliverable.artifactCode}
                  </pre>
                </section>
              )}

              {inspectedDeliverable.stages?.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Stage-by-Stage Agent Execution Trace
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {inspectedDeliverable.stages.map((st, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 rounded-lg border border-white/5 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span>{st}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
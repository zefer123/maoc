import { ArrowUpRight, Trash2, Zap } from 'lucide-react';
import { NAV_TABS } from '../../data/commandCenter.js';
import { TEAMS } from '../../data/teams.js';

const STATE_STYLES = {
  RUNNING: 'text-cyan-300',
  AWAITING_HITL: 'text-amber-300',
  COMPLETED: 'text-emerald-300',
  REJECTED: 'text-red-400',
  FAILED: 'text-red-400',
  CANCELLED: 'text-slate-400'
};

const BAR_STYLES = {
  RUNNING: 'cc-progress-fill',
  AWAITING_HITL: 'bg-amber-400 animate-pulse-fast',
  COMPLETED: 'bg-emerald-400',
  REJECTED: 'bg-red-500',
  FAILED: 'bg-red-500',
  CANCELLED: 'bg-slate-500'
};

const QUICK_MISSIONS = [
  {
    label: '+ HERMES RELAY',
    prompt:
      '[TEAM:COMMAND] Hermes Relay: broadcast cross-department telemetry and sync external webhooks',
    cls: 'border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 col-span-2'
  },
  {
    label: '+ TEAM TRADE',
    prompt:
      '[TEAM:TRADE] Scan XAU/USD market structure and execute momentum strategy',
    cls: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 col-span-2'
  },
  {
    label: '+ TECH',
    prompt: '[TEAM:TECH] Tech sprint: optimize API latency and deploy frontend HUD',
    cls: 'border-blue-400/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
  },
  {
    label: '+ DESIGN',
    prompt:
      '[TEAM:DESIGN] Design critique: refine neon contrast and UI shader tokens',
    cls: 'border-violet-400/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
  },
  {
    label: '+ CONTENT',
    prompt:
      '[TEAM:CONTENT] Content research: compile macro intel brief and brand copy',
    cls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
  },
  {
    label: '+ DATA & SEC',
    prompt:
      '[TEAM:DATA] Data security audit: verify warehouse schema and MCP permissions',
    cls: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
  },
  {
    label: '+ FINANCE',
    prompt:
      '[TEAM:FINANCE] Finance model: analyze Q3 budget ledger and growth loop ROI',
    cls: 'border-amber-400/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
  },
  {
    label: '+ LEGAL / OPS',
    prompt:
      '[TEAM:LEGAL] Legal compliance: review autonomous policy guardrails and ops SLA',
    cls: 'border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
  }
];

function detectRoomFromPrompt(desc = '') {
  const m = desc.match(/\[TEAM:([a-z]+)\]/i);
  if (m) {
    const tag = m[1].toLowerCase();
    return tag === 'hermes' ? 'command' : tag;
  }
  return 'trade';
}

export default function MissionSidebar({
  activeTab,
  selectedIslandId = 'trade',
  onTabChange,
  liveTasks,
  connectionState,
  onDispatchTask,
  onClearTasks,
  onOpenWorkflow,
  onOpenSchedules
}) {
  const currentRoomTeam = TEAMS.find((t) => t.id === selectedIslandId);

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/10 bg-slate-950/50 p-4 backdrop-blur-md">
      <button type="button" onClick={onOpenWorkflow} className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold tracking-wider text-cyan-200 hover:bg-cyan-500/20">+ WORKFLOW BUILDER</button>
      <button type="button" onClick={onOpenSchedules} className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-bold tracking-wider text-amber-200 hover:bg-amber-500/20">SCHEDULES</button>
      <nav className="space-y-1">
        {NAV_TABS.map((tab) => {
          const isRoomTab = tab.id === 'trade';
          const displayLabel =
            isRoomTab && currentRoomTeam
              ? `DEPT ROOM: ${currentRoomTeam.label}`
              : tab.label.toUpperCase();

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold tracking-[0.16em] transition-all ${
                activeTab === tab.id
                  ? 'border border-neon-cyan/50 bg-cyan-500/10 text-cyan-300 shadow-glow-cyan'
                  : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </nav>

      {/* Quick Department Mission Launcher */}
      <div className="glass-panel rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <p className="section-label">Quick Dispatch (Hermes + 7 Depts)</p>
          <Zap className="h-3 w-3 text-amber-300" />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {QUICK_MISSIONS.map((qm) => (
            <button
              key={qm.label}
              type="button"
              onClick={() => onDispatchTask?.(qm.prompt)}
              className={`rounded-lg border px-2 py-1.5 text-[9px] font-bold tracking-[0.14em] transition-colors ${qm.cls}`}
            >
              {qm.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel min-h-0 flex-1 overflow-y-auto rounded-2xl p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="section-label">Active Mission Queue</p>
          {liveTasks.length > 0 && onClearTasks && (
            <button
              type="button"
              onClick={onClearTasks}
              className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.14em] text-slate-400 transition-colors hover:border-red-400/50 hover:text-red-300"
            >
              <Trash2 className="h-2.5 w-2.5" />
              <span>CLEAR</span>
            </button>
          )}
        </div>

        {connectionState !== 'live' ? (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/5 p-2 text-[10px] leading-relaxed text-red-300">
            TELEMETRY OFFLINE - start server: cd server &amp;&amp; npm start
          </p>
        ) : liveTasks.length === 0 ? (
          <p className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2 text-[10px] leading-relaxed text-slate-400">
            Queue empty - click any button above or press Ctrl+K
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {[...liveTasks].reverse().map((task) => {
              const cleanDesc = (task.description || task.taskId.slice(0, 8))
                .replace(/\[TEAM:[A-Z]+\]\s*/gi, '')
                .replace(/\[COWORK:[^\]]+\]\s*/gi, '');
              const targetDept = detectRoomFromPrompt(task.description || '');

              return (
                <li
                  key={task.taskId}
                  onClick={() => onTabChange('trade')}
                  title="คลิกเพื่อเปิดห้องดูรายละเอียดผลงาน"
                  className="group cursor-pointer rounded-xl border border-white/5 bg-slate-950/60 p-2.5 transition-all hover:border-neon-cyan/50 hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate font-semibold text-slate-200 group-hover:text-cyan-200">
                      {cleanDesc}
                    </span>
                    <span
                      className={`font-bold ${
                        STATE_STYLES[task.state] || 'text-slate-300'
                      }`}
                    >
                      {task.progress}%
                    </span>
                  </div>
                  {task.scheduledRun && <p className="mt-1 break-all text-[9px] text-amber-200">SCHEDULED // run {task.scheduledRun.run} · {task.scheduledRun.schedule_id.slice(0, 8)}</p>}
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        BAR_STYLES[task.state] || 'cc-progress-fill'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[8px]">
                    <span
                      className={`font-semibold tracking-[0.14em] ${
                        STATE_STYLES[task.state] || 'text-slate-500'
                      }`}
                    >
                      {task.state} • {targetDept.toUpperCase()}
                    </span>
                    <span className="flex items-center gap-0.5 text-cyan-400 opacity-0 transition-opacity group-hover:opacity-100">
                      <span>INSPECT</span>
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  {task.swarm && <p className="mt-2 text-[9px] font-bold tracking-wider text-violet-300">SWARM // {task.swarm.agents.length} analysts → {task.swarm.synthesizer}</p>}
                  {task.workflowNodes && <ul aria-label="Workflow node status" className="mt-2 flex flex-wrap gap-1">{task.workflowNodes.map((node) => <li key={node.id} className="rounded border border-white/10 px-1 py-0.5 text-[8px] text-slate-300" title={`${node.id}: ${node.state}`}>{node.agent}: {node.state}</li>)}</ul>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
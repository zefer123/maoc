import { useMemo } from 'react';
import { AGENTS } from '../../data/agents.js';
import { DOCK_AGENT_IDS, ROLE_LABELS } from '../../data/commandCenter.js';

const ACCENT_RING = {
  gold: 'border-gold/60 text-gold',
  purple: 'border-purple-400/60 text-purple-300',
  green: 'border-emerald-400/60 text-emerald-300',
  red: 'border-red-400/60 text-red-300',
  cyan: 'border-cyan-400/60 text-cyan-300',
  blue: 'border-blue-400/60 text-blue-300',
  violet: 'border-violet-400/60 text-violet-300',
  emerald: 'border-emerald-400/60 text-emerald-300',
  indigo: 'border-indigo-400/60 text-indigo-300',
  amber: 'border-amber-400/60 text-amber-300',
  pink: 'border-pink-400/60 text-pink-300',
  orange: 'border-orange-400/60 text-orange-300',
  rose: 'border-rose-400/60 text-rose-300'
};

const EVENT_TEXT_STYLES = {
  AGENT_THINKING: 'text-cyan-300',
  TOOL_CALL: 'text-amber-300',
  HANDOFF: 'text-purple-300',
  HITL_INTERRUPT: 'text-red-400',
  TASK_COMPLETED: 'text-emerald-300'
};

export default function BottomDock({
  streamLines,
  activity,
  focusedAgentId,
  onFocusAgent,
  connectionState
}) {
  const dockAgents = useMemo(
    () => DOCK_AGENT_IDS.map((id) => AGENTS.find((agent) => agent.id === id)).filter(Boolean),
    []
  );

  return (
    <footer className="flex h-44 shrink-0 gap-4 border-t border-white/10 bg-obsidian/90 px-4 py-3 backdrop-blur-xl">
      <div className="glass-panel flex min-w-0 flex-1 flex-col rounded-2xl p-3">
        <p className="section-label">Live Telemetry Stream // WebSocket</p>
        <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[10px] leading-relaxed">
          {streamLines.length === 0 && (
            <p className="text-slate-600">
              {connectionState === 'live'
                ? 'Waiting for events... inject a task via the command bar.'
                : 'No telemetry connection. Start the server to stream events.'}
            </p>
          )}
          {streamLines.map((line) => (
            <p key={line.key} className="text-slate-400">
              <span className="text-slate-600">[{line.time}]</span>{' '}
              <span className={`font-bold ${EVENT_TEXT_STYLES[line.type] || 'text-slate-300'}`}>
                {line.type}
              </span>{' '}
              <span className="font-bold text-cyan-300">{line.from}</span>
              <span className="text-slate-600"> -&gt; </span>
              <span className="font-bold text-purple-300">{line.to}</span>
              <span className="text-slate-500">: {line.text}</span>
            </p>
          ))}
        </div>
      </div>

      <div className="glass-panel flex w-[46%] shrink-0 flex-col rounded-2xl p-3">
        <p className="section-label">Agent Roster Dock</p>
        <div className="mt-2 flex min-h-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
          {dockAgents.map((agent) => {
            const live = activity[agent.id];
            return (
              <button
                key={agent.id}
                type="button"
                title={live ? `${agent.codename}: ${live.type}` : agent.codename}
                onClick={() => onFocusAgent(agent.id === focusedAgentId ? null : agent.id)}
                className={`flex min-w-[74px] flex-col items-center gap-1 rounded-xl border px-2 py-2 transition-all ${
                  live
                    ? 'border-neon-cyan/70 bg-cyan-500/10 shadow-glow-cyan'
                    : focusedAgentId === agent.id
                      ? 'border-purple-400/60 bg-purple-500/10 shadow-glow-purple'
                      : 'border-white/5 bg-slate-900/60 hover:border-white/20'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-slate-950/80 text-sm font-bold ${
                    ACCENT_RING[agent.accent] || 'border-slate-500/60 text-slate-300'
                  }`}
                >
                  {agent.codename.charAt(0)}
                </span>
                <span className="text-[9px] font-bold tracking-[0.14em] text-slate-200">
                  {agent.codename}
                </span>
                <span className="text-[8px] tracking-[0.12em] text-slate-500">
                  {ROLE_LABELS[agent.id] || agent.role}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    live
                      ? 'animate-pulse-fast bg-cyan-300'
                      : agent.status === 'ONLINE'
                        ? 'bg-emerald-400'
                        : agent.status === 'THINKING'
                          ? 'bg-amber-400'
                          : 'bg-red-500'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
import { useMemo } from 'react';
import StatusDot from './StatusDot.jsx';
import ModelBadge from './ModelBadge.jsx';

const ACCENT_TEXT = {
  gold: 'text-gold',
  blue: 'text-blue-300',
  violet: 'text-violet-300',
  emerald: 'text-emerald-300',
  cyan: 'text-cyan-300',
  indigo: 'text-indigo-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  orange: 'text-orange-300',
  pink: 'text-pink-300'
};

const ACCENT_BORDER = {
  gold: 'border-gold/30',
  blue: 'border-blue-400/25',
  violet: 'border-violet-400/25',
  emerald: 'border-emerald-400/25',
  cyan: 'border-cyan-400/25',
  indigo: 'border-indigo-400/25',
  amber: 'border-amber-400/25',
  rose: 'border-rose-400/25',
  orange: 'border-orange-400/25',
  pink: 'border-pink-400/25'
};

export default function RosterPanel({ teams, agents }) {
  const agentsById = useMemo(() => {
    return Object.fromEntries(agents.map((agent) => [agent.id, agent]));
  }, [agents]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {teams.map((team) => (
        <section
          key={team.id}
          className={`glass-panel rounded-2xl p-4 ${
            team.highlighted
              ? 'border-neon-cyan/60 shadow-glow-cyan'
              : ACCENT_BORDER[team.accent] || 'border-white/10'
          }`}
        >
          <header className="flex items-center justify-between gap-3">
            <h2
              className={`text-xs font-bold tracking-[0.3em] ${
                ACCENT_TEXT[team.accent] || 'text-slate-200'
              }`}
            >
              {team.label}
            </h2>
            <span className="text-[10px] text-slate-500">
              {team.agentIds.length} AGENTS
            </span>
          </header>

          {team.loopLabel ? (
            <p className="mt-2 rounded-lg border border-violet-400/20 bg-violet-500/5 px-2 py-1 text-[10px] tracking-[0.18em] text-violet-300">
              {team.loopLabel.toUpperCase()}
            </p>
          ) : null}

          <ul className="mt-3 space-y-2">
            {team.agentIds.map((agentId) => {
              const agent = agentsById[agentId];

              if (!agent) {
                return null;
              }

              return (
                <li
                  key={agent.id}
                  className="rounded-xl border border-white/5 bg-slate-950/60 p-3 transition-colors hover:border-white/15"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StatusDot status={agent.status} />
                      <span className="text-sm font-bold tracking-[0.22em] text-slate-100">
                        {agent.codename}
                      </span>
                    </div>
                    <ModelBadge model={agent.model} />
                  </div>

                  <p className="mt-1 text-xs text-slate-500">{agent.role}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-600">
                    {agent.statusLabel}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
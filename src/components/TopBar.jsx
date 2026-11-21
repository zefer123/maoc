import { useEffect, useMemo, useState } from 'react';

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function Metric({ label, value, valueClassName = 'text-slate-100' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

export default function TopBar({ agents, simulationRunning, onToggleSimulation }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const metrics = useMemo(() => {
    const online = agents.filter((agent) => agent.status === 'ONLINE').length;
    const thinking = agents.filter((agent) => agent.status === 'THINKING').length;
    const executing = agents.filter((agent) => agent.status === 'EXECUTING').length;
    const totalTokens = agents.reduce((sum, agent) => sum + agent.tokens.total, 0);

    return {
      total: agents.length,
      online,
      thinking,
      executing,
      totalTokens,
      alerts: executing
    };
  }, [agents]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-[260px]">
          <p className="section-label">Multi-Agent Orchestration</p>
          <h1 className="mt-1 text-lg font-bold tracking-[0.22em] text-slate-100">
            TOPOLOGY COMMAND CENTER
          </h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Metric label="Agents" value={metrics.total} />
          <Metric label="Online" value={metrics.online} valueClassName="text-emerald-300" />
          <Metric label="Thinking" value={metrics.thinking} valueClassName="text-amber-300" />
          <Metric label="Executing" value={metrics.executing} valueClassName="text-red-400" />
          <Metric label="Total Tokens" value={formatNumber(metrics.totalTokens)} />
          <Metric label="Alerts" value={metrics.alerts} valueClassName="text-red-400" />

          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">System Time</p>
            <p className="mt-1 text-sm font-bold text-cyan-300">
              {now.toLocaleTimeString('en-GB')}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">Mode</p>
            <p
              className={`mt-1 text-sm font-bold ${
                simulationRunning ? 'text-cyan-300' : 'text-slate-500'
              }`}
            >
              {simulationRunning ? 'LIVE' : 'IDLE'}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleSimulation}
            className={`rounded-xl border px-4 py-3 text-xs font-bold tracking-[0.18em] transition-all ${
              simulationRunning
                ? 'border-red-500/50 bg-red-500/10 text-red-300 shadow-glow-red hover:bg-red-500/20'
                : 'border-neon-cyan/50 bg-cyan-500/10 text-cyan-300 shadow-glow-cyan hover:bg-cyan-500/20'
            }`}
          >
            {simulationRunning ? 'PAUSE SIMULATION' : 'SIMULATE LIVE TASK FLOW'}
          </button>
        </div>
      </div>
    </header>
  );
}
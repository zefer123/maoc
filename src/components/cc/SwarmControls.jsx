import { AGENTS } from '../../data/agents.js';

export default function SwarmControls({ swarm, onChange }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-violet-400/40 bg-violet-500/5 p-3 text-xs">
      <legend className="px-1 font-mono text-violet-200">SWARM // independent analysis + synthesis</legend>
      <p id="swarm-help" className="text-slate-400">Select 2–6 distinct AI agents in the order their reports should appear. Each analyzes the same mission independently. A final synthesis compares evidence and disagreements; consensus is not guaranteed. Concurrency uses batch barriers, not continuous scheduling.</p>
      <div aria-describedby="swarm-help" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {AGENTS.map((agent) => {
          const selected = swarm.agents.includes(agent.id);
          return <label key={agent.id} className="flex items-center gap-2 rounded border border-white/10 p-2">
            <input type="checkbox" checked={selected} disabled={!selected && swarm.agents.length >= 6} onChange={(event) => onChange({ ...swarm, agents: event.target.checked ? [...swarm.agents, agent.id] : swarm.agents.filter((id) => id !== agent.id) })} />
            {agent.id}{selected ? ` (#${swarm.agents.indexOf(agent.id) + 1})` : ''}
          </label>;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label>Synthesis agent <select value={swarm.synthesizer} onChange={(event) => onChange({ ...swarm, synthesizer: event.target.value })} className="ml-2 rounded border border-white/20 bg-slate-950 p-2">{AGENTS.map((agent) => <option key={agent.id} value={agent.id}>{agent.id}</option>)}</select></label>
        <label>Swarm concurrency <select value={swarm.maxConcurrency} onChange={(event) => onChange({ ...swarm, maxConcurrency: Number(event.target.value) })} className="ml-2 rounded border border-white/20 bg-slate-950 p-2">{[1, 2, 3, 4].map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      <p className="text-amber-200/90">Cost: {swarm.agents.length + 1} AI steps, plus any tool rounds/failover. Shared RPM, token budgets, deadline and report-review gates still apply. A selected member may also perform synthesis as a separate step. Completed tool side effects are not rolled back.</p>
    </fieldset>
  );
}
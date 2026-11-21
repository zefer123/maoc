const MODE_LABELS = {
  bridge: 'COMMAND BRIDGE // MACRO ISLAND MAP',
  realm: 'THE REALM // SPATIAL MAP',
  graph: 'AGENT GRAPH // TOPOLOGY VIEW',
  trade: 'TRADE FLOOR // ROOM VIEW',
  logs: 'CHRONICLE LOGS // FULL STREAM'
};

export default function CenterStage({ centerMode, focusedAgentId, activeTask }) {
  return (
    <main className="iso-stage relative min-w-0 flex-1 overflow-hidden">
      <div className="iso-plane iso-grid absolute inset-0 m-auto h-[170%] w-[170%]" />

      <div className="cc-scanline pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent" />

      <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-neon-cyan/40 bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-cyan-300 backdrop-blur-md">
          {MODE_LABELS[centerMode] || MODE_LABELS.bridge}
        </span>
        {focusedAgentId && (
          <span className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-purple-300 backdrop-blur-md">
            FOCUS: {focusedAgentId}
          </span>
        )}
        {activeTask && (
          <span
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] backdrop-blur-md ${
              activeTask.state === 'AWAITING_HITL'
                ? 'border-red-500/50 bg-red-500/10 text-red-300'
                : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            TASK {activeTask.progress}% // {activeTask.state}
          </span>
        )}
      </div>

      <p className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-slate-900/70 px-4 py-1.5 text-[9px] tracking-[0.2em] text-slate-500 backdrop-blur-md">
        SPATIAL VIEWPORT // STANDBY
      </p>
    </main>
  );
}
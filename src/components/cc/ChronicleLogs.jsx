import { useMemo, useState } from 'react';
import { Filter, Search, Zap } from 'lucide-react';

const EVENT_STYLES = {
  AGENT_THINKING: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  TOOL_CALL: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  HANDOFF: 'border-purple-400/40 bg-purple-400/10 text-purple-300',
  AGENT_MESSAGE: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300',
  SCHEDULE_UPDATED: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  HITL_INTERRUPT: 'border-red-500/50 bg-red-500/15 text-red-300',
  TASK_COMPLETED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
};

const FILTER_TYPES = [
  { id: 'ALL', label: 'ALL EVENTS' },
  { id: 'AGENT_THINKING', label: 'THINKING' },
  { id: 'TOOL_CALL', label: 'TOOL CALL' },
  { id: 'HANDOFF', label: 'HANDOFF' },
  { id: 'AGENT_MESSAGE', label: 'MESSAGES' },
  { id: 'SCHEDULE_UPDATED', label: 'SCHEDULES' },
  { id: 'HITL_INTERRUPT', label: 'HITL HOLD' },
  { id: 'TASK_COMPLETED', label: 'COMPLETED' }
];

export default function ChronicleLogs({
  events = [],
  liveTasks = [],
  onFocusAgent,
  onDispatchTask
}) {
  const [selectedType, setSelectedType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const mailbox = useMemo(() => liveTasks.flatMap((task) => task.agentMessages || [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-48).reverse(), [liveTasks]);

  const combinedEvents = useMemo(() => {
    const list = [...events].reverse();
    return list.filter((ev) => {
      if (selectedType !== 'ALL' && ev.event_type !== selectedType) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (ev.source_agent || '').toLowerCase().includes(q) ||
        (ev.target_agent || '').toLowerCase().includes(q) ||
        (ev.payload_summary || '').toLowerCase().includes(q) ||
        (ev.event_type || '').toLowerCase().includes(q) ||
        (ev.model_used || '').toLowerCase().includes(q)
      );
    });
  }, [events, selectedType, searchQuery]);

  return (
    <section aria-label="Technical telemetry logs" className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
      <div className="glass-panel flex min-h-0 flex-1 flex-col rounded-2xl p-4">
        {mailbox.length > 0 && <details className="mb-3 shrink-0 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/5 p-3 text-xs">
          <summary className="cursor-pointer font-bold text-fuchsia-200">DIRECT MESSAGES // {mailbox.length} retained messages</summary>
          <p className="my-2 text-slate-400">Latest 48 messages from retained tasks, restored on reconnect independently of event history. Untrusted reference data; DELIVERED means included in context, not read, agreed or approved. Not persisted across backend restart.</p>
          <ul aria-label="Direct agent messages" className="max-h-48 space-y-2 overflow-y-auto">
            {mailbox.map((message) => <li key={message.message_id} className="rounded border border-white/10 p-2">
              <p className="text-fuchsia-200">{message.from_node} ({message.from_agent}) → {message.to_node} ({message.to_agent}) · {message.status}</p>
              <p className="text-[10px] text-slate-500">Task {message.task_id} · {message.created_at}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-slate-200">{message.text}</p>
            </li>)}
          </ul>
        </details>}
        {/* Top Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <p className="section-label">Chronicle Logs // Full Telemetry Audit</p>
            <h2 className="mt-1 text-sm font-bold tracking-[0.2em] text-slate-100">
              REAL-TIME ORCHESTRATION EVENT LEDGER ({combinedEvents.length} RECORDS)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs focus-within:border-neon-cyan/50">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by agent, tool, or summary..."
                className="w-48 bg-transparent text-[11px] text-slate-200 placeholder-slate-500 outline-none"
              />
            </label>

            <button
              type="button"
              onClick={() =>
                onDispatchTask?.('Chronicle Audit Test: Scan XAU/USD and execute momentum strategy')
              }
              className="flex items-center gap-1.5 rounded-xl border border-neon-cyan/50 bg-cyan-500/15 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-cyan-200 shadow-glow-cyan transition-colors hover:bg-cyan-500/25"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>INJECT TEST EVENT FLOW</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-[10px] text-slate-500">
            <Filter className="h-3 w-3" />
            TYPE:
          </span>
          {FILTER_TYPES.map((ft) => (
            <button
              key={ft.id}
              type="button"
              onClick={() => setSelectedType(ft.id)}
              className={`rounded-lg border px-2.5 py-1 text-[9px] font-bold tracking-[0.16em] transition-all ${
                selectedType === ft.id
                  ? 'border-neon-cyan/60 bg-cyan-500/15 text-cyan-200 shadow-glow-cyan'
                  : 'border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/25 hover:text-slate-200'
              }`}
            >
              {ft.label}
            </button>
          ))}
        </div>

        {/* Scrollable Event Table */}
        <div className="mt-3 min-h-0 flex-1 overflow-auto pr-1">
          {combinedEvents.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-white/5 bg-slate-950/40 p-6 text-center">
              <p className="text-xs font-semibold text-slate-400">
                No telemetry events match your current filter.
              </p>
              <p className="mt-1 text-[10px] text-slate-600">
                Try clearing the filter or click &ldquo;INJECT TEST EVENT FLOW&rdquo; above.
              </p>
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-y-1.5 text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md">
                <tr className="text-[10px] tracking-[0.16em] text-slate-500">
                  <th className="px-3 py-2 font-semibold">TIME</th>
                  <th className="px-3 py-2 font-semibold">EVENT TYPE</th>
                  <th className="px-3 py-2 font-semibold">SOURCE -&gt; TARGET</th>
                  <th className="px-3 py-2 font-semibold">MODEL TIER</th>
                  <th className="px-3 py-2 font-semibold">PAYLOAD SUMMARY</th>
                  <th className="px-3 py-2 text-right font-semibold">PROGRESS</th>
                </tr>
              </thead>
              <tbody>
                {combinedEvents.map((event) => (
                  <tr
                    key={event.event_id}
                    className="bg-slate-900/65 transition-colors hover:bg-slate-800/70"
                  >
                    <td className=" whitespace-nowrap rounded-l-xl px-3 py-2 text-[10px] text-slate-400">
                      {new Date(event.timestamp).toLocaleTimeString('en-GB')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] ${
                          EVENT_STYLES[event.event_type] ||
                          'border-slate-500/40 bg-slate-500/10 text-slate-300'
                        }`}
                      >
                        {event.event_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onFocusAgent?.(event.source_agent)}
                          className="rounded border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 hover:border-neon-cyan"
                        >
                          {event.source_agent}
                        </button>
                        <span className="text-slate-600">-&gt;</span>
                        {event.target_agent && event.target_agent !== 'HUMAN' ? (
                          <button
                            type="button"
                            onClick={() => onFocusAgent?.(event.target_agent)}
                            className="rounded border border-purple-400/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 hover:border-purple-300"
                          >
                            {event.target_agent}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            {event.target_agent ?? '-'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[10px] text-slate-400">
                      {event.model_used ?? '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      {event.payload_summary}
                      {event.token_usage && (
                        <p className="mt-1 text-[10px] text-cyan-300">
                          {event.provider || 'Mission'} · provider-reported tokens: {event.token_usage.total_tokens}
                          {' '} (in {event.token_usage.prompt_tokens} / out {event.token_usage.completion_tokens})
                          {event.token_usage.unreported_calls > 0 && ` · ${event.token_usage.unreported_calls} calls without usage metadata`}
                        </p>
                      )}
                      {event.reasoning_trace && (
                        <details className="mt-1 text-[10px] text-slate-400">
                          <summary className="cursor-pointer">Execution trace (summary, not internal thoughts)</summary>
                          <p className="mt-1 whitespace-pre-wrap">{event.reasoning_trace.summary}</p>
                        </details>
                      )}
                    </td>
                    <td className="whitespace-nowrap rounded-r-xl px-3 py-2 text-right font-bold text-cyan-300">
                      {event.progress_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ArrowLeftRight,
  Eye,
  Pause,
  Play,
  Radio,
  Sparkles,
  Zap
} from 'lucide-react';
import { AGENTS } from '../../../data/agents.js';
import { TEAM_DISPLAY_ORDER, TEAMS } from '../../../data/teams.js';
import AgentNodeCard from './AgentNodeCard.jsx';
import useReducedMotion from '../../../hooks/useReducedMotion.js';

const SIM_PIPELINE_SEQUENCE = [
  { id: 'TAEC', note: 'DEMO · ตัวอย่างการเริ่มภารกิจ ไม่ได้ส่งงานจริง' },
  { id: 'ARIA', note: 'DEMO · ตัวอย่างการวางแผนและเลือกทีม' },
  { id: 'HERMES', note: 'DEMO · ตัวอย่างเส้นทางส่งข้อความ' },
  { id: 'HAWK', note: 'DEMO · ตัวอย่างขั้นวิเคราะห์ ไม่ได้ดึงราคา' },
  { id: 'BLADE', note: 'DEMO · ตัวอย่างการประมวลผล ไม่มีคำสั่งซื้อขาย' },
  { id: 'SAGE', note: 'DEMO · ตัวอย่างจุดตรวจรายงาน' },
  { id: 'AUTO', note: 'DEMO · ตัวอย่างจบลำดับ ไม่ได้สร้างผลงานจริง' }
];

const MIN_SCALE = 0.45;
const MAX_SCALE = 1.65;
const DEFAULT_VIEW = { x: 0, y: -20, scale: 0.76 };

const COLUMN_HEADER_ACCENTS = {
  blue: 'text-blue-300 border-blue-400/30 bg-blue-500/10',
  violet: 'text-violet-300 border-violet-400/30 bg-violet-500/10',
  emerald: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10',
  cyan: 'text-cyan-200 border-neon-cyan/60 bg-cyan-500/20',
  indigo: 'text-indigo-300 border-indigo-400/30 bg-indigo-500/10',
  amber: 'text-amber-300 border-amber-400/30 bg-amber-500/10',
  rose: 'text-rose-300 border-rose-400/30 bg-rose-500/10'
};

function VerticalFlowConnector({ active = false, variant = 'default' }) {
  const isTrade = variant === 'trade';
  return (
    <div className="relative flex h-6 w-full items-center justify-center">
      <svg width="24" height="24" viewBox="0 0 24 24" className="overflow-visible">
        <line
          x1="12"
          y1="0"
          x2="12"
          y2="24"
          stroke={active ? '#22d3ee' : isTrade ? '#f87171' : 'rgba(148,163,184,0.35)'}
          strokeWidth={active || isTrade ? '2' : '1.5'}
          strokeDasharray="4 4"
          className={active || isTrade ? 'topo-dash-flow' : ''}
        />
        {(active || isTrade) && (
          <circle
            cx="12"
            cy="12"
            r={active ? '3.5' : '2.5'}
            fill={active ? '#22d3ee' : '#f87171'}
            className="topo-packet-dot"
          />
        )}
      </svg>
    </div>
  );
}

function BidirectionalDesignLoop({ label, active = false }) {
  return (
    <div className="my-1.5 flex flex-col items-center justify-center">
      <div
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.18em] transition-all ${
          active
            ? 'border-neon-cyan/60 bg-cyan-500/15 text-cyan-200 shadow-glow-cyan'
            : 'border-violet-400/40 bg-violet-500/15 text-violet-300'
        }`}
      >
        <ArrowDownUp className="h-3 w-3 animate-pulse-fast" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function TopologyTreeView({
  activity,
  focusedAgentId,
  onFocusAgent,
  activeTask,
  onDispatchTask,
  onEnterTradeRoom
}) {
  const [simRunning, setSimRunning] = useState(false);
  const reducedMotion = useReducedMotion();
  const [effects, setEffects] = useState(null);
  const motion = effects ?? !reducedMotion;
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [view, setView] = useState(DEFAULT_VIEW);

  const stageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!simRunning) return undefined;
    const timer = setInterval(() => {
      setSimStepIndex((prev) => (prev + 1) % SIM_PIPELINE_SEQUENCE.length);
    }, 1200);
    return () => clearInterval(timer);
  }, [simRunning]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      setView((prev) => ({
        ...prev,
        scale: Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, Number((prev.scale + delta).toFixed(2)))
        )
      }));
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const agentsById = useMemo(
    () => Object.fromEntries(AGENTS.map((agent) => [agent.id, agent])),
    []
  );

  const orderedDepartmentTeams = useMemo(() => {
    const map = Object.fromEntries(TEAMS.map((team) => [team.id, team]));
    return TEAM_DISPLAY_ORDER.map((id) => map[id]).filter(Boolean);
  }, []);

  const currentSimStep = simRunning ? SIM_PIPELINE_SEQUENCE[simStepIndex] : null;
  const currentSimAgentId = currentSimStep?.id || null;

  const handleSelectAgent = (agentId) => {
    onFocusAgent(agentId === focusedAgentId ? null : agentId);
  };

  return (
    <main
      ref={stageRef}
      className="iso-stage topology-world relative flex min-w-0 flex-1 cursor-grab flex-col overflow-hidden active:cursor-grabbing"
      data-motion={motion ? 'on' : 'off'}
      data-motion-override={effects === true ? 'on' : undefined}
      onPointerDown={(event) => {
        if (event.target.closest('button')) return;
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          originX: view.x,
          originY: view.y
        };
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        setView((prev) => ({
          ...prev,
          x: dragRef.current.originX + dx,
          y: dragRef.current.originY + dy
        }));
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <div className="iso-plane iso-grid pointer-events-none absolute inset-0 m-auto h-[170%] w-[170%]" />

      {/* Top Floating HUD Bar */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-neon-cyan/40 bg-slate-900/80 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-cyan-300 backdrop-blur-md">
            AGENT GRAPH // HIERARCHICAL TOPOLOGY (8 ZONES • {AGENTS.length} NODES)
          </span>
          {focusedAgentId && (
            <span className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-purple-300 backdrop-blur-md">
              INSPECTING: {focusedAgentId}
            </span>
          )}
          {activeTask && (
            <button
              type="button"
              onClick={() => onEnterTradeRoom?.('trade')}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-emerald-200 backdrop-blur-md hover:bg-emerald-500/25"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>
                LIVE TASK {activeTask.progress}% ({activeTask.state}) — INSPECT ROOM
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={simRunning}
            onClick={() => { if (!simRunning) setEffects(true); setSimRunning((prev) => !prev); }}
            title="เริ่มหรือหยุดลำดับสาธิต การกดเริ่มจะเปิดเอฟเฟกต์เฉพาะกราฟนี้ ไม่เรียก AI"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] backdrop-blur-md transition-all ${
              simRunning
                ? 'border-neon-cyan/60 bg-cyan-500/15 text-cyan-200 shadow-glow-cyan'
                : 'border-white/15 bg-slate-900/75 text-slate-400 hover:text-slate-200'
            }`}
          >
            {simRunning ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {simRunning
              ? 'DEMO FLOW: ON · ไม่ใช่งานจริง'
              : 'DEMO FLOW: OFF · ไม่ใช่งานจริง'}
          </button>

          <button type="button" className="guild-motion-button" aria-label="พักเอฟเฟกต์ Topology" aria-pressed={!motion} onClick={() => setEffects(!motion)}>{motion ? 'Ⅱ พักเอฟเฟกต์' : '▷ เปิดเอฟเฟกต์'}</button>
          {effects !== null && <button type="button" className="guild-motion-button" onClick={() => setEffects(null)}>ตามระบบ</button>}

          <button
            type="button"
            onClick={() =>
              onDispatchTask?.(
                '[TEAM:COMMAND] [COWORK:ARIA,HERMES,REX,HAWK] Full Co-Work Synchronization & Market Audit'
              )
            }
            className="flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-amber-200 backdrop-blur-md transition-all hover:bg-amber-500/25"
          >
            <Zap className="h-3.5 w-3.5" />
            RUN REAL CO-WORK FLOW
          </button>

          <button
            type="button"
            onClick={() =>
              onDispatchTask?.(
                '[TEAM:TRADE] Scan live XAU/USD & BTC prices and execute momentum strategy'
              )
            }
            className="flex items-center gap-1.5 rounded-xl border border-purple-400/50 bg-purple-500/15 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-purple-200 shadow-glow-purple backdrop-blur-md transition-all hover:bg-purple-500/25"
          >
            <Zap className="h-3.5 w-3.5" />
            TRIGGER LIVE TRADE PIPELINE
          </button>
        </div>
      </div>

      {/* Pan & Zoom Interactive Topology Stage */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`
          }}
        >
          <div className="flex w-[1480px] flex-col items-center select-none">
            {/* TIER 1: ROOT (TAEC) */}
            <div className="flex flex-col items-center">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold/80">
                  TIER 1 // COMMAND CORE (ROOT)
                </span>
                {onEnterTradeRoom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnterTradeRoom('command');
                    }}
                    className="rounded border border-purple-400/50 bg-purple-500/15 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-purple-200 hover:bg-purple-500/30"
                  >
                    DRILL-DOWN
                  </button>
                )}
              </div>
              <AgentNodeCard
                agent={agentsById.TAEC}
                liveActivity={activity.TAEC}
                simHighlighted={currentSimAgentId === 'TAEC'}
                isFocused={focusedAgentId === 'TAEC'}
                isCommandNode
                onSelect={handleSelectAgent}
              />
            </div>

            <VerticalFlowConnector
              active={
                currentSimAgentId === 'TAEC' ||
                currentSimAgentId === 'ARIA' ||
                currentSimAgentId === 'HERMES' ||
                Boolean(activity.ARIA) ||
                Boolean(activity.HERMES)
              }
              variant="trade"
            />

            {/* TIER 2: DUAL ORCHESTRATION & RELAY CORE (ARIA <-> HERMES) */}
            <div className="flex flex-col items-center">
              <span className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-purple-300/80">
                TIER 2 // MASTER ORCHESTRATOR &amp; HERMES RELAY BUS
              </span>

              <div className="flex items-center gap-4 rounded-2xl border border-purple-400/35 bg-slate-950/65 px-4 py-2.5 backdrop-blur-md">
                <AgentNodeCard
                  agent={agentsById.ARIA}
                  liveActivity={activity.ARIA}
                  simHighlighted={currentSimAgentId === 'ARIA'}
                  isFocused={focusedAgentId === 'ARIA'}
                  isCommandNode
                  onSelect={handleSelectAgent}
                />

                {agentsById.HERMES && (
                  <>
                    <div className="flex flex-col items-center gap-1 px-1">
                      <span className="flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-amber-300">
                        <ArrowLeftRight className="h-3 w-3 animate-pulse-fast" />
                        <span>RELAY BUS</span>
                      </span>
                    </div>

                    <AgentNodeCard
                      agent={agentsById.HERMES}
                      liveActivity={activity.HERMES}
                      simHighlighted={currentSimAgentId === 'HERMES'}
                      isFocused={focusedAgentId === 'HERMES'}
                      isCommandNode
                      onSelect={handleSelectAgent}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Animated SVG Branching Bus from ARIA + HERMES to 7 Department Columns */}
            <div className="relative h-10 w-full">
              <svg
                className="h-full w-full overflow-visible"
                viewBox="0 0 1400 40"
                preserveAspectRatio="none"
              >
                <line
                  x1="700"
                  y1="0"
                  x2="700"
                  y2="18"
                  stroke="#a855f7"
                  strokeWidth="2.5"
                  strokeDasharray="5 5"
                  className="topo-dash-flow"
                />
                <line
                  x1="100"
                  y1="18"
                  x2="1300"
                  y2="18"
                  stroke="#a855f7"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  className="topo-dash-flow"
                />
                {[100, 300, 500, 700, 900, 1100, 1300].map((xPos, idx) => {
                  const isCenterTrade = idx === 3;
                  return (
                    <g key={xPos}>
                      <line
                        x1={xPos}
                        y1="18"
                        x2={xPos}
                        y2="40"
                        stroke={isCenterTrade ? '#22d3ee' : '#a855f7'}
                        strokeWidth={isCenterTrade ? '2.5' : '1.75'}
                        strokeDasharray="4 4"
                        className="topo-dash-flow"
                      />
                      <circle
                        cx={xPos}
                        cy="18"
                        r={isCenterTrade ? '4.5' : '3'}
                        fill={isCenterTrade ? '#22d3ee' : '#a855f7'}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* TIER 3: 7 DEPARTMENT COLUMNS */}
            <div className="grid w-full grid-cols-7 items-start gap-3">
              {orderedDepartmentTeams.map((team) => {
                const isTradeTeam = team.id === 'trade';
                const isDesignTeam = team.id === 'design';

                return (
                  <section
                    key={team.id}
                    className={`flex flex-col rounded-2xl p-2.5 transition-all ${
                      isTradeTeam
                        ? 'border-2 border-neon-cyan/80 bg-cyan-950/25 shadow-glow-cyan ring-1 ring-neon-cyan/30'
                        : 'glass-panel'
                    }`}
                  >
                    <header className="mb-2.5 flex flex-col gap-1.5 border-b border-white/10 pb-2">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`truncate rounded-md border px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] ${
                            COLUMN_HEADER_ACCENTS[team.accent] ||
                            'border-white/15 bg-white/5 text-slate-200'
                          }`}
                        >
                          {team.label}
                        </span>
                        <span className="shrink-0 text-[8px] font-semibold text-slate-500">
                          {team.agentIds.length} NODES
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        {isTradeTeam ? (
                          <span className="flex items-center gap-1 text-[8px] font-bold tracking-[0.12em] text-cyan-300">
                            <Radio className="h-3 w-3 animate-pulse-fast text-red-400" />
                            PIPELINE
                          </span>
                        ) : isDesignTeam ? (
                          <span className="flex items-center gap-1 text-[8px] font-semibold tracking-[0.12em] text-violet-300">
                            <Sparkles className="h-3 w-3" />
                            LOOP
                          </span>
                        ) : (
                          <span className="truncate text-[8px] text-slate-500">
                            {team.sub}
                          </span>
                        )}

                        {onEnterTradeRoom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEnterTradeRoom(team.id);
                            }}
                            className="shrink-0 rounded border border-neon-cyan/50 bg-cyan-500/15 px-1.5 py-0.5 text-[7px] font-bold tracking-[0.14em] text-cyan-200 transition-colors hover:bg-cyan-500/30"
                          >
                            DRILL-DOWN
                          </button>
                        )}
                      </div>
                    </header>

                    <div className="flex flex-col items-center">
                      {team.agentIds.map((agentId, index) => {
                        const agent = agentsById[agentId];
                        const isSimActive = currentSimAgentId === agentId;
                        const isNextSimActive =
                          currentSimAgentId === team.agentIds[index + 1];

                        return (
                          <div
                            key={agentId}
                            className="flex w-full flex-col items-center"
                          >
                            <AgentNodeCard
                              agent={agent}
                              liveActivity={activity[agentId]}
                              simHighlighted={isSimActive}
                              isFocused={focusedAgentId === agentId}
                              onSelect={handleSelectAgent}
                            />

                            {index < team.agentIds.length - 1 &&
                              (isDesignTeam ? (
                                <BidirectionalDesignLoop
                                  label={team.loopLabel || 'critique + build'}
                                  active={
                                    Boolean(activity.LUNA) ||
                                    Boolean(activity.PIXEL) ||
                                    focusedAgentId === 'LUNA' ||
                                    focusedAgentId === 'PIXEL'
                                  }
                                />
                              ) : (
                                <VerticalFlowConnector
                                  active={
                                    isSimActive ||
                                    isNextSimActive ||
                                    Boolean(activity[agentId]) ||
                                    Boolean(activity[team.agentIds[index + 1]])
                                  }
                                  variant={isTradeTeam ? 'trade' : 'default'}
                                />
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-Center Live Simulation & Co-Work Stage Bar */}
      {currentSimStep && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-neon-cyan/40 bg-slate-950/90 px-4 py-2 shadow-glow-cyan backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse-fast rounded-full bg-cyan-300" />
          <span className="text-[10px] font-bold tracking-[0.16em] text-cyan-300">
            <span data-demo-step={simStepIndex}>FLOW STAGE {simStepIndex + 1}/{SIM_PIPELINE_SEQUENCE.length}:</span>{' '}
            {currentSimStep.id}
          </span>
          <span className="text-[10px] text-slate-300">
            {currentSimStep.note}
          </span>
          <button
            type="button"
            onClick={() => handleSelectAgent(currentSimStep.id)}
            className="rounded-lg border border-purple-400/50 bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold text-purple-200 hover:bg-purple-500/30"
          >
            INSPECT {currentSimStep.id}
          </button>
        </div>
      )}

      {/* Bottom-Right Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5">
        <span className="mr-1 rounded-lg border border-white/10 bg-slate-900/75 px-2.5 py-1.5 text-[9px] font-bold tracking-widest text-slate-400 backdrop-blur-md">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() =>
            setView((prev) => ({
              ...prev,
              scale: Math.min(MAX_SCALE, Number((prev.scale + 0.12).toFixed(2)))
            }))
          }
          className="rounded-lg border border-white/15 bg-slate-900/75 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          +
        </button>
        <button
          type="button"
          onClick={() =>
            setView((prev) => ({
              ...prev,
              scale: Math.max(MIN_SCALE, Number((prev.scale - 0.12).toFixed(2)))
            }))
          }
          className="rounded-lg border border-white/15 bg-slate-900/75 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => setView(DEFAULT_VIEW)}
          className="rounded-lg border border-white/15 bg-slate-900/75 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          RESET
        </button>
      </div>
    </main>
  );
}
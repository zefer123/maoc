import { useEffect, useId, useRef, useState } from 'react';
import { BRIDGES, ISLANDS } from '../../../data/islands.js';
import Island from './Island.jsx';
import GuildBackdrop from './GuildBackdrop.jsx';
import useReducedMotion from '../../../hooks/useReducedMotion.js';
import { fitSpatialScale, teamEventHistory } from '../../../lib/spatialModel.js';

const WORLD = { width: 1200, height: 800 };
const MIN_SCALE = 0.2;
const MAX_SCALE = 2;
const FOCUS_SCALE = 1.3;

export default function IsometricMap({
  spatial,
  focusedAgentId,
  onFocusAgent,
  connectionState,
  onEnterRoom,
  events = []
}) {
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef(null);
  const stageRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const [effects, setEffects] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const motion = effects ?? !reducedMotion;
  const arrow = useId();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resetView = () => {
    const node = stageRef.current;
    if (node) setView({ x: 0, y: 24, scale: fitSpatialScale(node.clientWidth, node.clientHeight) });
  };

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => {
      setView({ x: 0, y: 24, scale: fitSpatialScale(node.clientWidth, node.clientHeight) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      setView((prev) => ({
        ...prev,
        scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + delta))
      }));
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!focusedAgentId) return;
    const island = ISLANDS.find((item) => item.agentIds.includes(focusedAgentId));
    if (!island) return;
    setView({
      x: (WORLD.width / 2 - island.x) * FOCUS_SCALE,
      y: (WORLD.height / 2 - island.y) * FOCUS_SCALE,
      scale: FOCUS_SCALE
    });
  }, [focusedAgentId]);

  const islandById = Object.fromEntries(ISLANDS.map((island) => [island.id, island]));

  const liveLinks = new Map(spatial.links.filter((link) => link.fromTeam !== link.toTeam).map((link) => [`${link.fromTeam}:${link.toTeam}`, link]));

  return (
    <section
      ref={stageRef}
      className="iso-stage guild-world relative min-w-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
      aria-label="แผนที่ฐานบัญชาการ 2.5D"
      data-motion={motion ? 'on' : 'off'}
      data-motion-override={effects === true ? 'on' : undefined}
      onPointerDown={(event) => {
        if (event.target.closest('button, select, input, a')) return;
        event.currentTarget.setPointerCapture(event.pointerId);
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
      <GuildBackdrop />
      <div className="iso-plane iso-grid pointer-events-none absolute inset-0 m-auto h-[170%] w-[170%]" />

      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`
        }}
      >
        <div className="relative" style={{ width: WORLD.width, height: WORLD.height }}>
          <svg
            className="pointer-events-none absolute inset-0"
            width={WORLD.width}
            height={WORLD.height}
            aria-hidden="true"
          >
            {BRIDGES.map(([fromId, toId]) => {
              const from = islandById[fromId];
              const to = islandById[toId];

              return (
                <g key={`${fromId}-${toId}`}>
                  <g data-detail="stone-causeway" aria-hidden="true">
                    <line x1={from.x} y1={from.y + 18} x2={to.x} y2={to.y + 18} stroke="#121424" strokeWidth="18" />
                    <line x1={from.x} y1={from.y + 12} x2={to.x} y2={to.y + 12} stroke="#726077" strokeWidth="14" />
                    <line x1={from.x} y1={from.y + 12} x2={to.x} y2={to.y + 12} stroke="#c1aa8b" strokeWidth="9" strokeDasharray="2 10" opacity=".4" />
                  </g>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#8066bd"
                    strokeWidth="1.5"
                    className="cc-bridge is-ambient-link"
                  />
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} pathLength="100" className="guild-link-packet" stroke="#b49ce9" strokeWidth="2.5" strokeDasharray="2 98" />
                </g>
              );
            })}
          </svg>
          <svg className="pointer-events-none absolute inset-0" width={WORLD.width} height={WORLD.height} aria-hidden="true" data-telemetry-layer="handoffs">
            <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#67e8f9" /></marker></defs>
            {[...liveLinks].map(([key, { fromTeam, toTeam }]) => {
              const from = islandById[fromTeam], to = islandById[toTeam];
              const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
              const line = { x1: from.x + dx / length * 70, y1: from.y + dy / length * 70, x2: to.x - dx / length * 90, y2: to.y - dy / length * 90 };
              return <g key={key} data-handoff={key}><line {...line} className="is-live-link realm-handoff" markerEnd={`url(#${arrow})`} /><line {...line} pathLength="100" className="is-live-link guild-link-packet realm-handoff-packet" strokeDasharray="4 96" /></g>;
            })}
          </svg>

          {ISLANDS.map((island) => (
            <Island
              key={island.id}
              island={island}
              teamSignal={spatial.teams[island.id]}
              agentSignals={spatial.agents}
              focusedAgentId={focusedAgentId}
              onFocusAgent={onFocusAgent}
              onEnter={() => onEnterRoom?.(island.id)}
              history={teamEventHistory(events, island.id, now)}
            />
          ))}
        </div>
      </div>

      <div className="guild-world-toolbar absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-neon-cyan/40 bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-cyan-300 backdrop-blur-md">
          COZY GUILD // {ISLANDS.length} TEAMS · 27 AGENTS
        </span>
        <button type="button" className="guild-motion-button" aria-label="พักเอฟเฟกต์แผนที่" aria-pressed={!motion} title="ค่าเริ่มต้นตามระบบ แต่เลือกเปิดหรือพักเอฟเฟกต์เองได้" onClick={() => setEffects(!motion)}>{motion ? 'Ⅱ พักเอฟเฟกต์' : reducedMotion && effects === null ? '▷ REDUCED MOTION · เปิดเอฟเฟกต์' : '▷ เปิดเอฟเฟกต์'}</button>
        {effects !== null && <button type="button" className="guild-motion-button" onClick={() => setEffects(null)}>ตามระบบ</button>}
        <select className="guild-room-select" aria-label="เข้าห้องทีมจากแผนที่" value="" onChange={(event) => onEnterRoom?.(event.target.value)}><option value="" disabled>เลือกห้องทีม ↗</option>{ISLANDS.map((island) => <option key={island.id} value={island.id}>{island.label}</option>)}</select>
        {focusedAgentId && (
          <span className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-purple-300 backdrop-blur-md">
            FOCUS: {focusedAgentId}
          </span>
        )}
      </div>

      <p className="guild-world-legend">{connectionState !== 'live' ? 'ไม่ได้รับ Telemetry สด · กราฟเป็นเหตุการณ์ที่เก็บไว้' : liveLinks.size ? `ส่งต่องานล่าสุด: ${[...liveLinks.values()].slice(-2).map(({ from, to }) => `${from} → ${to}`).join(' · ')}` : 'เส้น Cyan: ส่งต่องานจริง · สะพาน/แสงม่วง: ตกแต่ง'}<br />กราฟ: events ที่รับมาใน 80 วินาที · ไม่ใช่ราคาหรือกำไร</p>
      <div className="guild-world-zoom absolute bottom-4 right-4 z-10 flex items-center gap-1.5">
        <span className="mr-1 rounded-lg border border-white/10 bg-slate-900/75 px-2.5 py-1.5 text-[9px] font-bold tracking-widest text-slate-400 backdrop-blur-md">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          aria-label="ขยายแผนที่"
          onClick={() =>
            setView((prev) => ({ ...prev, scale: Math.min(MAX_SCALE, prev.scale + 0.15) }))
          }
          className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          +
        </button>
        <button
          type="button"
          aria-label="ย่อแผนที่"
          onClick={() =>
            setView((prev) => ({ ...prev, scale: Math.max(MIN_SCALE, prev.scale - 0.15) }))
          }
          className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          -
        </button>
        <button
          type="button"
          aria-label="จัดแผนที่ให้พอดี"
          onClick={resetView}
          className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          FIT
        </button>
      </div>
    </section>
  );
}
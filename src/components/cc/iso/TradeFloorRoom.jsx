import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Binary,
  Bot,
  Briefcase,
  CheckCircle2,
  Clock,
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
  MessageSquare,
  Moon,
  Music,
  Network,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Radar,
  Radio,
  Rocket,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sword,
  Trash2,
  X,
  Zap
} from 'lucide-react';
import { AGENTS } from '../../../data/agents.js';
import { ISLANDS } from '../../../data/islands.js';
import { isSavedDeliverable } from '../../../lib/dashboardModel.js';
import {
  exportDepartmentMarkdown,
  loadDeliverables,
  loadRoomChats,
  saveRoomChats
} from '../../../lib/departmentVault.js';
import ModelBadge from '../../ModelBadge.jsx';
import { spatialLabel } from '../../../lib/spatialModel.js';
import PixelAgent from './PixelAgent.jsx';
import CozyRoomScene from './CozyRoomScene.jsx';
import useReducedMotion from '../../../hooks/useReducedMotion.js';
import { guildPalette } from '../../../data/cozyGuild.js';
import { fitCozyRoom } from '../../../lib/cozySpatial.js';

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

const ROOM_THEMES = {
  command: {
    presets: [
      'สรุปสถานะแผนกจากหลักฐานที่แนบ และระบุข้อมูลที่ยังขาด',
      'Draft a risk and KPI digest for human review; do not send it externally'
    ]
  },
  tech: {
    presets: [
      'ทบทวนการออกแบบ API และ WebSocket จากซอร์สที่อ่านได้ พร้อมเสนอแผนวัดผล',
      'Propose a HUD performance and release checklist without running CI/CD or deploying'
    ]
  },
  design: {
    presets: [
      'ออกแบบการ์ด UI ใหม่และปรับแสง Neon Contrast',
      'Run critique + build loop on spatial isometric room assets'
    ]
  },
  content: {
    presets: [
      'สรุปข่าวเศรษฐกิจและแนวโน้มตลาดทองคำวันนี้',
      'Compile macro intelligence brief and executive brand copy'
    ]
  },
  trade: {
    presets: [
      'จัดทำรายการตรวจความเสี่ยงจากข้อมูลที่ให้ โดยไม่ส่งคำสั่งซื้อขาย',
      'Draft an analysis-only market brief; state unavailable data and do not place orders'
    ]
  },
  data: {
    presets: [
      'ทบทวนสิทธิ์ของเครื่องมือที่ลงทะเบียน แล้วสรุปข้อจำกัด',
      'Review defensive data-handling controls; do not change configuration or indexes'
    ]
  },
  finance: {
    presets: [
      'คำนวณงบประมาณ Token และวิเคราะห์ผลตอบแทนพอร์ต',
      'Model Q3 capital allocation efficiency and growth loop ROI'
    ]
  },
  legal: {
    presets: [
      'ทบทวนข้อกำหนดที่แนบและร่างสรุปผู้บริหารสำหรับตรวจทาน',
      'Draft a compliance checklist, flag uncertainties, and do not distribute it'
    ]
  }
};

const ROOM_WORLD = { width: 960, height: 700 };
const MIN_SCALE = 0.2;
const MAX_SCALE = 1.8;

function computeDeskPositions(agentIds) {
  if (agentIds.length === 2) {
    return [
      { agentId: agentIds[0], x: 330, y: 390 },
      { agentId: agentIds[1], x: 630, y: 390 }
    ];
  }
  if (agentIds.length === 3) {
    return [
      { agentId: agentIds[0], x: 280, y: 430 },
      { agentId: agentIds[1], x: 480, y: 250 },
      { agentId: agentIds[2], x: 680, y: 430 }
    ];
  }
  if (agentIds.length === 4) {
    return [
      { agentId: agentIds[0], x: 260, y: 380 },
      { agentId: agentIds[1], x: 480, y: 520 },
      { agentId: agentIds[2], x: 700, y: 380 },
      { agentId: agentIds[3], x: 480, y: 240 }
    ];
  }
  const cx = 480;
  const cy = 395;
  const rx = 250;
  const ry = 150;
  return agentIds.map((agentId, index) => {
    const angle = (index / agentIds.length) * Math.PI * 2 - Math.PI / 2;
    return {
      agentId,
      x: Math.round(cx + Math.cos(angle) * rx),
      y: Math.round(cy + Math.sin(angle) * ry)
    };
  });
}

export default function TradeFloorRoom({
  islandId = 'trade',
  onSelectIsland,
  spatial,
  connectionState,
  events = [],
  liveTasks = [],
  focusedAgentId,
  onFocusAgent,
  onDirective,
  onExit
}) {
  const [view, setView] = useState({ x: -120, y: 15, scale: 0.95 });
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleTab, setConsoleTab] = useState('chat');
  const [chatInput, setChatInput] = useState('');
  const [roomChats, setRoomChats] = useState(() => loadRoomChats());
  const [vaultDeliverables, setVaultDeliverables] = useState(() => loadDeliverables());
  const [inspectedDeliverable, setInspectedDeliverable] = useState(null);
  const reducedMotion = useReducedMotion();
  const [effects, setEffects] = useState(null);
  const motion = effects ?? !reducedMotion;
  const arrow = useId();

  const stageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const onVaultUpdated = () => {
      setVaultDeliverables(loadDeliverables());
      setRoomChats(loadRoomChats());
    };
    window.addEventListener('maoc-vault-updated', onVaultUpdated);
    return () => window.removeEventListener('maoc-vault-updated', onVaultUpdated);
  }, []);

  const normalizedId = islandId === 'core' ? 'command' : islandId;

  const currentIsland = useMemo(
    () =>
      ISLANDS.find((item) => item.id === normalizedId) ||
      ISLANDS.find((item) => item.id === 'trade') ||
      ISLANDS[0],
    [normalizedId]
  );

  const theme = ROOM_THEMES[currentIsland.id] || ROOM_THEMES.trade;
  const palette = guildPalette(currentIsland.id);
  const leadAgentId = currentIsland.agentIds[0] || 'ARIA';
  const leadAgent = AGENTS.find((a) => a.id === leadAgentId);

  const desks = useMemo(
    () => computeDeskPositions(currentIsland.agentIds),
    [currentIsland]
  );
  const deskByAgent = new Map(desks.map((desk) => [desk.agentId, desk]));
  const roomLinks = spatial.links.filter(({ fromTeam, toTeam }) => fromTeam === currentIsland.id || toTeam === currentIsland.id);
  const roomSignal = spatial.teams[currentIsland.id];

  const fitRoom = () => {
    const node = stageRef.current;
    if (!node) return;
    setView(fitCozyRoom(node.clientWidth, node.clientHeight, consoleOpen));
  };

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(fitRoom);
    observer.observe(node);
    return () => observer.disconnect();
  }, [consoleOpen, currentIsland.id]);

  const roomEvents = useMemo(() => {
    const set = new Set(currentIsland.agentIds);
    return events
      .filter((ev) => set.has(ev.source_agent) || set.has(ev.target_agent))
      .slice(-30);
  }, [events, currentIsland.agentIds]);

  const combinedDeliverables = useMemo(() => {
    const stored = (vaultDeliverables[currentIsland.id] || []).filter(isSavedDeliverable);
    const storedIds = new Set(stored.map((s) => s.id));
    const tagPrefix = `[TEAM:${currentIsland.id.toUpperCase()}]`;

    const activeRoomTasks = liveTasks
      .filter((t) => {
        if (storedIds.has(`task-${t.taskId}`)) return false;
        const desc = (t.description || '').toUpperCase();
        return desc.startsWith(tagPrefix);
      })
      .reverse()
      .map((t) => {
        const cleanTitle = (t.description || '')
          .replace(/\[TEAM:[A-Z]+\]\s*/gi, '')
          .replace(/\[COWORK:[^\]]+\]\s*/gi, '')
          .trim();
        return {
          id: `live-${t.taskId}`,
          deptId: currentIsland.id,
          deptLabel: currentIsland.label,
          lead: leadAgentId,
          coWork: [...new Set((t.workflowNodes || []).map(({ agent }) => agent))],
          title: cleanTitle || 'Running Mission',
          summary: `สถานะจาก Backend: ${t.state} (${t.progress}%) — ยังไม่ใช่รายงานที่จัดเก็บ`,
          paragraphs: [
            `Backend mission status: ${t.state} (${t.progress}%). This snapshot is not an archived report.`
          ],
          artifactCode: JSON.stringify(
            {
              task_id: t.taskId,
              department: currentIsland.label,
              state: t.state,
              progress_pct: t.progress
            },
            null,
            2
          ),
          status: t.state,
          time: new Date().toLocaleTimeString('en-GB'),
          stages: events.filter((event) => event.task_id === t.taskId)
            .slice(-6)
            .map((ev) => `[${ev.event_type}] ${ev.source_agent}: ${ev.payload_summary}`)
        };
      });

    return [...activeRoomTasks, ...stored];
  }, [currentIsland, vaultDeliverables, liveTasks, leadAgentId, events]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;

    const onWheel = (event) => {
      if (
        event.target.closest('.room-console-panel') ||
        event.target.closest('.deliverable-modal')
      ) {
        return;
      }
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

  const saveRoomNote = () => {
    const rawText = chatInput.trim();
    if (!rawText) return;

    const nowTime = new Date().toLocaleTimeString('en-GB');

    setRoomChats((prev) => {
      const prevList = prev[currentIsland.id] || [];
      const updated = {
        ...prev,
        [currentIsland.id]: [
          ...prevList,
          {
            id: `u-${Date.now()}`,
            sender: 'COMMANDER (YOU)',
            role: 'Room note',
            time: nowTime,
            text: rawText,
            isUser: true
          }
        ]
      };
      saveRoomChats(updated);
      return updated;
    });

    setChatInput('');
  };

  const handleClearRoomHistory = () => {
    setRoomChats((prev) => {
      const updated = { ...prev, [currentIsland.id]: [] };
      saveRoomChats(updated);
      return updated;
    });
  };

  const currentChatHistory = roomChats[currentIsland.id] || [];

  return (
    <main
      ref={stageRef}
      className="iso-stage cozy-room relative min-w-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
      aria-label={`ห้องทำงาน ${currentIsland.label}`}
      data-team={currentIsland.id}
      data-motion={motion ? 'on' : 'off'}
      data-motion-override={effects === true ? 'on' : undefined}
      style={{ '--guild-accent': palette.accent }}
      onPointerDown={(event) => {
        if (
          event.target.closest('button') ||
          event.target.closest('input') ||
          event.target.closest('select') ||
          event.target.closest('.room-console-panel') ||
          event.target.closest('.deliverable-modal')
        ) {
          return;
        }
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          originX: view.x,
          originY: view.y
        };
        event.currentTarget.setPointerCapture(event.pointerId);
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

      {/* Pan & Zoom World Container */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`
        }}
      >
        <div className="relative" style={{ width: ROOM_WORLD.width, height: ROOM_WORLD.height }}>
          <CozyRoomScene teamId={currentIsland.id} />

          <div className="cozy-room-board absolute left-1/2 top-[65px] z-10 -translate-x-1/2 rounded-2xl border px-5 py-2.5" data-spatial-state={roomSignal?.kind}>
            <p className="section-label text-center">
              {currentIsland.label} // LIVE TELEMETRY
            </p>
            <div className="mt-1.5 flex items-center justify-center gap-3">
              <span className="realm-signal-text">{connectionState === 'live' ? spatialLabel(roomSignal) : 'ไม่ได้รับ Telemetry สด'}</span>
            </div>
            {roomLinks.length > 0 && <p className="mt-1 text-center text-xs">ส่งต่อ: {roomLinks.slice(-2).map(({ from, to }) => `${from} → ${to}`).join(' · ')}</p>}
          </div>

          <svg
            className="pointer-events-none absolute inset-0"
            width={ROOM_WORLD.width}
            height={ROOM_WORLD.height}
            aria-hidden="true"
            data-telemetry-layer="handoffs"
          >
            <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#67e8f9" /></marker></defs>
            {roomLinks.map(({ from, to }) => {
              const a = deskByAgent.get(from), b = deskByAgent.get(to);
              if (!a && !b) return null;
              const line = { x1: a?.x ?? ROOM_WORLD.width / 2, y1: (a?.y ?? 150) + 45, x2: b?.x ?? ROOM_WORLD.width / 2, y2: (b?.y ?? 150) + 45 };
              return <g key={`${from}:${to}`} data-handoff={`${from}:${to}`}><line {...line} className="is-live-link realm-handoff" markerEnd={`url(#${arrow})`} /><line {...line} pathLength="100" className="realm-handoff-packet" strokeDasharray="4 96" /></g>;
            })}
          </svg>

          {desks.map((desk) => {
            const agent = AGENTS.find((item) => item.id === desk.agentId);
            if (!agent) return null;

            const live = spatial.agents[desk.agentId];
            const focused = focusedAgentId === desk.agentId;

            return (
              <div
                key={desk.agentId}
                className="absolute z-10"
                style={{
                  left: desk.x,
                  top: desk.y,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="absolute -top-9 left-1/2 -translate-x-1/2">
                  <div
                    data-spatial-state={live?.kind}
                    className="realm-desk-label whitespace-nowrap rounded border px-2 py-1 text-[11px] font-bold"
                  >
                    {spatialLabel(live)}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={`${agent.codename} · ${agent.role} · ${spatialLabel(live)}`}
                  data-spatial-agent={agent.id}
                  data-spatial-state={live?.kind}
                  aria-pressed={focused}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusAgent(focused ? null : desk.agentId);
                  }}
                    className={`guild-desk flex min-w-[136px] flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all hover:-translate-y-0.5 ${
                    focused
                      ? 'border-purple-400/70 bg-purple-500/15 shadow-glow-purple'
                      : live
                        ? 'border-neon-cyan/70 bg-cyan-500/15 shadow-glow-cyan'
                        : 'border-white/10 bg-slate-900/85 hover:border-white/25'
                  }`}
                >
                  <span className="cozy-desk-screen realm-signal-text rounded-md px-2 py-1" aria-hidden="true">{live ? '◆' : '—'}</span>

                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="guild-desk-avatar"><PixelAgent agent={agent} active={Boolean(live)} /></span>
                    <div className="text-left">
                      <p className="text-[10px] font-bold tracking-[0.16em] text-slate-100">
                        {agent.codename}
                      </p>
                      <p className="max-w-[82px] truncate text-[8px] text-slate-400">
                        {agent.role}
                      </p>
                    </div>
                  </div>

                  <div className="mt-0.5">
                    <ModelBadge model={agent.model} />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-Left Room Controls & 8-Zone Official Room Switcher */}
       <div className="room-controls absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 pr-44">
        <span className="rounded-lg border border-neon-cyan/40 bg-slate-900/85 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-cyan-300 backdrop-blur-md">
          DEPT FLOOR // {currentIsland.label} ({currentIsland.agentIds.length} NODES)
        </span>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-white/15 bg-slate-900/85 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          &larr; BACK TO MAP
        </button>
        <button type="button" data-ceo-entry="room" className="dash-button primary" onClick={() => onDirective(currentIsland.id, '')}>Assign via ARIA</button>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-slate-950/85 p-1 backdrop-blur-md">
          {ISLANDS.map((isl) => (
            <button
              key={isl.id}
              type="button"
              onClick={() => onSelectIsland?.(isl.id)}
              className={`rounded-lg px-2 py-1 text-[8px] font-bold tracking-[0.14em] transition-all ${
                isl.id === currentIsland.id
                  ? 'border border-neon-cyan/60 bg-cyan-500/20 text-cyan-200 shadow-glow-cyan'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {isl.label}
            </button>
          ))}
        </div>
        <select className="cozy-agent-select" aria-label="เลือก Agent ในห้อง" value="" onChange={(event) => onFocusAgent(event.target.value)}><option value="" disabled>เลือก Agent ↗</option>{currentIsland.agentIds.map((id) => <option key={id} value={id}>{id}</option>)}</select>
        <select className="cozy-room-select" aria-label="เปลี่ยนห้องทีม" value={currentIsland.id} onChange={(event) => onSelectIsland?.(event.target.value)}>{ISLANDS.map((island) => <option key={island.id} value={island.id}>{island.label}</option>)}</select>
      </div>

      {/* Toggle Button for Department Room Console */}
      <button
        type="button"
        aria-expanded={consoleOpen}
        aria-controls="cozy-room-console"
        onClick={() => setConsoleOpen((prev) => !prev)}
        className="room-console-toggle absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-xl border border-neon-cyan/50 bg-slate-950/90 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-cyan-200 shadow-glow-cyan backdrop-blur-md hover:bg-cyan-500/20"
      >
        {consoleOpen ? (
          <>
            <PanelRightClose className="h-3.5 w-3.5" />
            <span>HIDE DEPT CONSOLE</span>
          </>
        ) : (
          <>
            <PanelRightOpen className="h-3.5 w-3.5" />
            <span>OPEN DEPT CHAT &amp; OUTPUTS</span>
          </>
        )}
      </button>

      {/* RIGHT-SIDE DEPARTMENT COMMAND CHAT & DELIVERABLES VAULT */}
      {consoleOpen && (
        <aside id="cozy-room-console" className="room-console-panel absolute bottom-4 right-4 top-14 z-20 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-neon-cyan/40 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.2em] text-cyan-300">
                {currentIsland.label} // ROOM CONSOLE
              </span>
              <div className="flex items-center gap-1.5">
                {consoleTab === 'deliverables' && (
                  <button
                    type="button"
                    onClick={() =>
                      exportDepartmentMarkdown(
                        currentIsland.label,
                        combinedDeliverables
                      )
                    }
                    className="flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                  >
                    <Download className="h-2.5 w-2.5" />
                    <span>EXPORT .MD</span>
                  </button>
                )}
                {consoleTab === 'chat' && currentChatHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearRoomHistory}
                    className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-bold text-slate-400 hover:border-red-400/40 hover:text-red-300"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    <span>CLEAR</span>
                  </button>
                )}
                <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-bold text-slate-400">
                  LEAD: {leadAgentId}
                </span>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button
                type="button"
                onClick={() => setConsoleTab('chat')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-bold tracking-[0.14em] transition-all ${
                  consoleTab === 'chat'
                    ? 'border border-neon-cyan/50 bg-cyan-500/20 text-cyan-200 shadow-glow-cyan'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                <span>ROOM NOTES ({currentChatHistory.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setConsoleTab('deliverables')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-bold tracking-[0.14em] transition-all ${
                  consoleTab === 'deliverables'
                    ? 'border border-purple-400/50 bg-purple-500/20 text-purple-200 shadow-glow-purple'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck2 className="h-3 w-3" />
                <span>DELIVERABLES ({combinedDeliverables.length})</span>
              </button>
            </div>
          </div>

          {consoleTab === 'chat' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-white/10 bg-slate-900/40 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">
                  MISSION DRAFTS FOR {currentIsland.label}:
                </p>
                <div className="mt-1.5 flex flex-col gap-1">
                  {theme.presets.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onDirective(currentIsland.id, preset)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-left text-[10px] text-slate-300 transition-colors hover:border-neon-cyan/50 hover:text-cyan-200"
                    >
                      <Zap className="h-3 w-3 shrink-0 text-cyan-400" />
                      <span className="truncate">{preset}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 text-[11px]">
                <div className="rounded-xl border border-cyan-400/25 bg-cyan-950/20 p-2.5">
                  <div className="flex items-center justify-between text-[9px] text-cyan-300">
                    <span className="font-bold">
                      {leadAgent?.codename} ({leadAgent?.role})
                    </span>
                    <span>ROOM NOTES · NOT AI</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-slate-200">
                    ห้อง <strong>{currentIsland.label}</strong> (สมาชิก:{' '}
                    <span className="text-cyan-300">
                      {currentIsland.agentIds.join(', ')}
                    </span>
                    ) โน้ตในห้องไม่เริ่มภารกิจหรือสร้างรายงาน ใช้ Assign via ARIA เพื่อส่งงานจริงหลังยืนยัน
                  </p>
                </div>

                {currentChatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl border p-2.5 ${
                      msg.isUser
                        ? 'ml-4 border-purple-400/40 bg-purple-950/30 text-purple-100'
                        : 'mr-2 border-neon-cyan/30 bg-slate-900/90 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <span className="font-bold text-cyan-300">{msg.isUser ? msg.sender : 'Legacy simulation · not AI output'}</span>
                      <span>{msg.time}</span>
                    </div>
                    <p className="mt-1 leading-relaxed">{msg.text}</p>
                  </div>
                ))}

                {roomEvents.slice(-6).map((ev) => (
                  <div
                    key={ev.event_id}
                    className="rounded-xl border border-white/10 bg-slate-900/75 p-2 text-[10px]"
                  >
                    <div className="flex items-center justify-between text-[8px] text-slate-500">
                      <span className="font-bold text-amber-300">
                        {ev.source_agent} &rarr; {ev.target_agent || 'TOOL'} ({ev.event_type})
                      </span>
                      <span>{new Date(ev.timestamp).toLocaleTimeString('en-GB')}</span>
                    </div>
                    <p className="mt-1 text-slate-300">{ev.payload_summary}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 bg-slate-950 p-3">
                <div className="flex gap-1.5">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveRoomNote();
                      }
                    }}
                  aria-label="Room note (not a mission)"
                  placeholder="เขียนโน้ตในห้อง…"
                    className="flex-1 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-neon-cyan"
                  />
                  <button
                    type="button"
                    onClick={saveRoomNote}
                    className="flex items-center gap-1 rounded-xl border border-neon-cyan/60 bg-cyan-500/20 px-3 py-2 text-[10px] font-bold tracking-wider text-cyan-200 shadow-glow-cyan hover:bg-cyan-500/30"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>SAVE NOTE</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <div className="flex items-center justify-between rounded-xl border border-purple-400/30 bg-purple-950/20 p-2.5 text-[10px] text-purple-200">
                <span>คลิกที่การ์ดชิ้นงานเพื่อเปิดดูรายละเอียดเชิงลึก (Deep-Dive)</span>
                <button
                  type="button"
                  onClick={() =>
                    exportDepartmentMarkdown(
                      currentIsland.label,
                      combinedDeliverables
                    )
                  }
                  className="flex items-center gap-1 rounded-md border border-purple-400/50 bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-100 hover:bg-purple-500/30"
                >
                  <Download className="h-3 w-3" />
                  <span>.MD</span>
                </button>
              </div>

              {combinedDeliverables.map((item) => {
                const isDone = item.status === 'COMPLETED';
                return (
                  <div
                    key={item.id}
                    onClick={() => setInspectedDeliverable(item)}
                    className={`group cursor-pointer rounded-xl border p-3 transition-all hover:border-neon-cyan hover:bg-slate-900/90 ${
                      isDone
                        ? 'border-emerald-400/35 bg-emerald-950/15'
                        : 'border-cyan-400/40 bg-cyan-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[9px]">
                      <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-emerald-300">
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 animate-pulse-fast text-amber-300" />
                        )}
                        {item.status}
                      </span>
                      <span className="flex items-center gap-1 font-bold text-cyan-300 group-hover:underline">
                        <Eye className="h-3 w-3" />
                        INSPECT DETAILS
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs font-bold text-slate-100">
                      {item.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-300">
                      {item.summary}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
                      <span>
                        CO-WORK: {(item.coWork || [item.lead]).join(' -> ')}
                      </span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      )}

      {/* FULL DEEP-DIVE DELIVERABLE INSPECTOR MODAL */}
      {inspectedDeliverable && (
        <div
          className="deliverable-modal fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
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
                      Technical Artifact / Payload
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

      {/* Bottom-Left Zoom Controls */}
      <div className="cozy-room-zoom absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 rounded-lg border border-white/10 bg-slate-900/75 px-2.5 py-1.5 text-[9px] font-bold tracking-widest text-slate-400 backdrop-blur-md">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          aria-label="ขยายห้อง"
          onClick={() =>
            setView((prev) => ({ ...prev, scale: Math.min(MAX_SCALE, prev.scale + 0.15) }))
          }
          className="rounded-lg border border-white/15 bg-slate-900/75 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          +
        </button>
        <button
          type="button"
          aria-label="ย่อห้อง"
          onClick={() =>
            setView((prev) => ({ ...prev, scale: Math.max(MIN_SCALE, prev.scale - 0.15) }))
          }
          className="rounded-lg border border-white/15 bg-slate-900/75 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          -
        </button>
        <button
          type="button"
          aria-label="จัดห้องให้พอดี"
          onClick={fitRoom}
          className="rounded-lg border border-white/15 bg-slate-900/75 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-slate-200 backdrop-blur-md hover:border-neon-cyan/50 hover:text-cyan-300"
        >
          FIT
        </button>
        <button type="button" className="guild-motion-button" aria-label="พักเอฟเฟกต์ห้อง" aria-pressed={!motion} onClick={() => setEffects(!motion)}>{motion ? 'Ⅱ พักเอฟเฟกต์' : '▷ เปิดเอฟเฟกต์'}</button>
        {effects !== null && <button type="button" className="guild-motion-button" onClick={() => setEffects(null)}>ตามระบบ</button>}
      </div>
    </main>
  );
}
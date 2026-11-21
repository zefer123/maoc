import {
  Binary,
  Bot,
  Briefcase,
  Coins,
  Cpu,
  Crown,
  Database,
  FileText,
  Hammer,
  KeyRound,
  Moon,
  Music,
  Network,
  Palette,
  PenLine,
  Radar,
  Radio,
  Rocket,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sword,
  Zap
} from 'lucide-react';
import StatusDot from '../../StatusDot.jsx';
import ModelBadge from '../../ModelBadge.jsx';

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

const ACCENT_CARD_STYLES = {
  gold: {
    border: 'border-gold/60 hover:border-gold',
    glow: 'shadow-glow-gold',
    iconBox: 'border-gold/40 bg-gold/15 text-gold'
  },
  purple: {
    border: 'border-purple-400/60 hover:border-purple-300',
    glow: 'shadow-glow-purple',
    iconBox: 'border-purple-400/40 bg-purple-500/15 text-purple-300'
  },
  green: {
    border: 'border-emerald-400/60 hover:border-emerald-300',
    glow: 'shadow-glow-green',
    iconBox: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
  },
  red: {
    border: 'border-red-500/60 hover:border-red-400',
    glow: 'shadow-glow-red',
    iconBox: 'border-red-500/40 bg-red-500/15 text-red-300'
  },
  cyan: {
    border: 'border-neon-cyan/60 hover:border-cyan-300',
    glow: 'shadow-glow-cyan',
    iconBox: 'border-neon-cyan/40 bg-cyan-500/15 text-cyan-300'
  },
  blue: {
    border: 'border-blue-400/40 hover:border-blue-300/80',
    glow: '',
    iconBox: 'border-blue-400/35 bg-blue-500/15 text-blue-300'
  },
  violet: {
    border: 'border-violet-400/40 hover:border-violet-300/80',
    glow: '',
    iconBox: 'border-violet-400/35 bg-violet-500/15 text-violet-300'
  },
  emerald: {
    border: 'border-emerald-400/40 hover:border-emerald-300/80',
    glow: '',
    iconBox: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300'
  },
  orange: {
    border: 'border-orange-400/40 hover:border-orange-300/80',
    glow: '',
    iconBox: 'border-orange-400/35 bg-orange-500/15 text-orange-300'
  },
  pink: {
    border: 'border-pink-400/40 hover:border-pink-300/80',
    glow: '',
    iconBox: 'border-pink-400/35 bg-pink-500/15 text-pink-300'
  },
  indigo: {
    border: 'border-indigo-400/40 hover:border-indigo-300/80',
    glow: '',
    iconBox: 'border-indigo-400/35 bg-indigo-500/15 text-indigo-300'
  },
  amber: {
    border: 'border-amber-400/40 hover:border-amber-300/80',
    glow: '',
    iconBox: 'border-amber-400/35 bg-amber-500/15 text-amber-300'
  },
  rose: {
    border: 'border-rose-400/40 hover:border-rose-300/80',
    glow: '',
    iconBox: 'border-rose-400/35 bg-rose-500/15 text-rose-300'
  }
};

export default function AgentNodeCard({
  agent,
  liveActivity,
  simHighlighted = false,
  isFocused = false,
  isCommandNode = false,
  onSelect
}) {
  if (!agent) return null;

  const IconComponent = ICON_MAP[agent.icon] || Cpu;
  const styleConfig = ACCENT_CARD_STYLES[agent.accent] || ACCENT_CARD_STYLES.cyan;

  const isActiveNow = Boolean(liveActivity) || simHighlighted;

  const effectiveStatus = liveActivity
    ? liveActivity.type === 'HITL_INTERRUPT'
      ? 'EXECUTING'
      : liveActivity.type === 'AGENT_THINKING'
        ? 'THINKING'
        : 'EXECUTING'
    : simHighlighted
      ? 'EXECUTING'
      : agent.status;

  const effectiveStatusLabel = liveActivity
    ? liveActivity.type.replace('_', ' ')
    : simHighlighted
      ? 'PACKET ACTIVE'
      : agent.statusLabel;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(agent.id);
      }}
      className={`group relative flex w-full flex-col gap-2 rounded-2xl border bg-slate-900/75 p-2.5 text-left backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 ${
        isCommandNode ? 'min-w-[240px] max-w-[260px]' : 'w-full'
      } ${
        isActiveNow
          ? 'border-neon-cyan bg-cyan-950/40 shadow-glow-cyan ring-1 ring-neon-cyan/50'
          : isFocused
            ? 'border-purple-400 bg-purple-950/30 shadow-glow-purple ring-1 ring-purple-400/40'
            : `${styleConfig.border} ${styleConfig.glow}`
      }`}
    >
      {/* Top Row: Left Icon + Center Codename/Role + Top-Right Status Dot */}
      <div className="flex w-full items-start gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105 ${styleConfig.iconBox}`}
        >
          <IconComponent className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-100">
              {agent.codename}
            </span>
            <StatusDot status={effectiveStatus} />
          </div>
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{agent.role}</p>
        </div>
      </div>

      {/* Bottom Row: Status Label + Bottom-Right LLM Model Pill Badge */}
      <div className="flex w-full items-center justify-between gap-1 border-t border-white/5 pt-1.5">
        <span
          className={`truncate text-[8px] font-semibold uppercase tracking-[0.14em] ${
            isActiveNow ? 'text-cyan-300' : 'text-slate-500'
          }`}
        >
          {effectiveStatusLabel}
        </span>
        <ModelBadge model={agent.model} />
      </div>
    </button>
  );
}
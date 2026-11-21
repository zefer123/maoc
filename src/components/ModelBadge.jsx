const MODEL_STYLES = {
  FOUNDER: 'border-gold/40 bg-gold/10 text-gold',
  HERMES:
    'border-amber-400/50 bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.25)]',
  OPUS: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300',
  SONNET: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-300',
  HAIKU: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  'GPT-5': 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200',
  GEMINI: 'border-sky-400/50 bg-sky-500/15 text-sky-300',
  QWEN: 'border-rose-400/50 bg-rose-500/15 text-rose-300'
};

export default function ModelBadge({ model }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] ${
        MODEL_STYLES[model] || 'border-slate-500/40 bg-slate-500/10 text-slate-300'
      }`}
    >
      {model}
    </span>
  );
}
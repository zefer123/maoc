const STATUS_STYLES = {
  ONLINE: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]',
  THINKING: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]',
  EXECUTING: 'bg-red-500 shadow-[0_0_12px_rgba(248,113,113,0.8)]'
};

export default function StatusDot({ status, className = '' }) {
  return (
    <span
      title={status}
      className={`inline-flex h-2.5 w-2.5 shrink-0 animate-pulse-fast rounded-full ${
        STATUS_STYLES[status] || 'bg-slate-500'
      } ${className}`}
    />
  );
}
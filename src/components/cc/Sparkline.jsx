export default function Sparkline({ points = [], tone = 'up', width = 96, height = 28, label = 'กราฟตัวอย่างตกแต่ง ไม่ใช่ข้อมูลสด', scan = false }) {
  const safePoints = points.filter(Number.isFinite);
  if (safePoints.length < 2) return <svg width={width} height={height} role="img" aria-label="ไม่มีข้อมูลกราฟ"><path d={`M0 ${height / 2}H${width}`} stroke="#64748b" strokeDasharray="3 3" /></svg>;
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const span = max - min || 1;
  const step = width / (safePoints.length - 1);

  const coords = safePoints.map((point, index) => [
    index * step,
    height - ((point - min) / span) * (height - 4) - 2
  ]);

  const path = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  const stroke = tone === 'up' ? '#34d399' : tone === 'down' ? '#f87171' : '#22d3ee';
  const last = coords[coords.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" role="img" aria-label={label}>
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      {scan && <path className="signal-sweep" d={path} fill="none" stroke="#e0f2fe" strokeWidth="2" pathLength="100" strokeDasharray="7 93" aria-hidden="true" />}
      <circle cx={last[0]} cy={last[1]} r="2" fill={stroke} className="animate-pulse-fast" />
    </svg>
  );
}
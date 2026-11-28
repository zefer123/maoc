import { memo } from 'react';

const circuits = [
  'M-40 94H166L230 158H426L478 106H720L770 56H1100',
  'M-30 138H144L214 208H367L407 248H555',
  'M42 -40V274L102 334V458L168 524H321',
  'M-30 694H202L270 626H415L461 580H665',
  'M-30 739H222L295 666H423L489 600H598L636 562H744',
  'M370 820V741L420 691H605L663 633H789L850 572H1230',
  'M621 820V760L682 699H843L910 632H1230',
  'M120 820V779L168 731H194',
  'M1240 230H1044L983 291H849L807 333H722',
  'M1240 182H994L942 234H810L765 279H613',
  'M1124 -30V138L1070 192V386L1008 448V551',
  'M1176 820V532L1116 472V321',
];
const nodes = [[166,94],[230,158],[478,106],[770,56],[102,334],[168,524],[270,626],[489,600],[682,699],[910,632],[120,779],[983,291],[849,291],[765,279],[1070,386],[1116,472]];
const meteors = [[335,175,.8],[661,150,1.42],[980,180,1.2],[1088,343,.78],[845,410,1.55],[944,590,1.1],[473,481,1.18],[215,540,.9],[470,625,1.28],[715,627,.82]];
const stars = Array.from({ length: 72 }, (_, i) => [(i * 157 + 31) % 1200, (i * i * 41 + i * 89 + 21) % 800, i % 7 === 0 ? 2 : .9]);
// Fixed coordinates keep the sky stable across renders; only the layers move.
let seed = 47;
const next = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const starPlanes = [[148, .3, .7], [75, .45, 1], [24, .7, 1.25]].map(([count, min, max]) =>
  Array.from({ length: count }, () => [next() * 1200, next() * 800, min + next() * (max - min), .55 + next() * .45]));

export default memo(function WorkspaceAtmosphere({ layerRef }) {
  return <div ref={layerRef} className="i47-workspace-ambient" aria-hidden="true">
    <div className="i47-ambient-haze" />
    <div className="i47-starfield">
      {starPlanes.map((plane, depth) => <svg key={depth} className="i47-star-plane" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" focusable="false">
        {plane.map(([x, y, r, opacity], i) => <circle key={i} cx={x} cy={y} r={r} opacity={opacity} />)}
      </svg>)}
    </div>
    <svg className="i47-signal-field" viewBox="0 0 1200 800" preserveAspectRatio="none" fill="none" focusable="false">
      <defs>
        <linearGradient id="i47-meteor-tail" x1="-118" y1="-75" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--hud-accent)" stopOpacity="0" /><stop offset=".72" stopColor="var(--hud-accent)" /><stop offset="1" stopColor="var(--i47-fx-white)" />
        </linearGradient>
      </defs>
      <g className="i47-ambient-stars">{stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>
      <g className="i47-cyber-links">
        {circuits.map((d, i) => <path key={i} className="i47-signal-track" d={d} />)}
        {nodes.map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" />)}
        {circuits.map((d, i) => <path key={i} className="i47-signal-pulse" pathLength="100" d={d} style={{ '--i47-signal-cycle': `${5 + i % 4 * 1.35}s`, '--i47-signal-phase': `${-i * .81}s` }} />)}
      </g>
      <g className="i47-meteors">
        {meteors.map(([x, y, size], i) => <g key={x} transform={`translate(${x} ${y}) scale(${size})`}>
          <g className="i47-signal-star" style={{ '--i47-signal-cycle': `${8 + i % 4 * 1.7}s`, '--i47-signal-phase': `${-1.1 - i * 1.21}s` }}>
            <path className="i47-meteor-glow" d="M-118 -75L0 0" /><path d="M-118 -75L0 0" /><circle r="2.5" />
          </g>
        </g>)}
      </g>
    </svg>
  </div>;
});
import { useEffect, useRef, useState } from 'react';

const initial = { yaw: -22, pitch: 32 };
const tau = Math.PI * 2;
const ring = (radius, y, count = 64, offset = 0) => Array.from({ length: count }, (_, i) => {
  const angle = i * tau / count + offset;
  return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
});

function paint(ctx, width, height, { yaw, pitch }, kind, light, phase) {
  const scale = Math.min(width / 565, height / 435);
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180;
  const project = ([x, y, z]) => {
    const u = x * Math.cos(a) - z * Math.sin(a), v = x * Math.sin(a) + z * Math.cos(a);
    const depth = v * Math.cos(b) + y * Math.sin(b), k = 940 / (940 - depth) * scale;
    return [width / 2 + u * k, height * .56 + (v * Math.sin(b) - y * Math.cos(b)) * k, depth];
  };
  const accent = light ? '46,73,151' : kind === 'nexus' ? '150,164,255' : '110,194,255';
  const tint = (alpha) => `rgba(${accent},${alpha})`;
  function path(points, stroke, fill, close = false, weight = 1) {
    ctx.beginPath();
    points.forEach((point, i) => { const [x, y] = project(point); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    if (close) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = stroke; ctx.lineWidth = weight * scale; ctx.stroke();
  }
  const depth = (points) => points.reduce((sum, point) => sum + project(point)[2], 0) / points.length;
  function solid(top, bottom, tones, cap) {
    top.map((p, i) => ({ i, points: [p, top[(i + 1) % top.length], bottom[(i + 1) % top.length], bottom[i]] }))
      .sort((a, b) => depth(a.points) - depth(b.points))
      .forEach(({ points, i }) => path(points, tint(.55), tones[i % tones.length], true));
    path(top, tint(.6), cap, true);
  }
  ctx.clearRect(0, 0, width, height);
  for (const r of [160, 190, 218, 248, 260]) path(ring(r, -34), tint(r === 248 ? .43 : .22), null, true);
  for (let i = 0; i < 8; i++) {
    const start = i * tau / 8 + .1;
    path(Array.from({ length: 9 }, (_, step) => [219 * Math.cos(start + step * .035), -33, 219 * Math.sin(start + step * .035)]), tint(.85), null, false, 2);
  }
  for (const [r, top, bottom, cap] of [[153, -16, -34, '#11192c'], [142, 1, -16, '#1c2946']]) {
    solid(ring(r, top, 12), ring(r, bottom, 12), ['#10162b', '#202c4a', '#2d4264'], cap);
  }
  for (const r of [106, 124]) path(ring(r, 2), tint(.63), null, true);
  if (kind === 'nexus') {
    solid(ring(63, 14, 8), ring(67, 2, 8), ['#182541', '#2c3b61'], '#283856');
    const hover = Math.sin(phase * .9) * 7;
    const mid = ring(65, 121 + hover, 6, Math.PI / 6 + phase * .32);
    const facets = mid.flatMap((p, i) => [[p, mid[(i + 1) % 6], [0, 210 + hover, 0]], [mid[(i + 1) % 6], p, [0, 54 + hover, 0]]]);
    const colors = ['#7484dc', '#3f4e93', '#4051a2', '#202e55', '#8e9bf0', '#5766b0'];
    facets.map((points, i) => ({ points, fill: colors[i % colors.length] })).sort((a, b) => depth(a.points) - depth(b.points))
      .forEach(({ points, fill }) => path(points, tint(.96), fill, true, 1.5));
    return;
  }
  if (kind !== 'rain') {
    const center = kind === 'sun' ? 0 : -55;
    path(ring(kind === 'sun' ? 49 : 34, 0, 18).map(([x, , z]) => [x + center, z + 143, -33]), '#ffedc5', '#ffd494', true, 1.5);
    for (let i = 0; i < 12; i++) {
      const angle = i * tau / 12, r = kind === 'sun' ? 58 : 42;
      path([r, r + 9].map((size) => [center + size * Math.cos(angle), 143 + size * Math.sin(angle), -33]), '#ffc978', null, false, 1.5);
    }
  }
  if (kind !== 'sun') {
    const clusters = [[-49, 94, 20, 36], [-12, 116, 8, 51], [38, 96, 22, 40], [65, 91, -5, 27]];
    clusters.sort((a, b) => project(a)[2] - project(b)[2]);
    for (const [x, y, z, r] of clusters) {
      const cloud = (radius, h) => ring(radius, h, 9).map(([u, v, w]) => [u + x, v, w + z]);
      solid(cloud(r * .68, y + r * .54), cloud(r, y - r * .31), kind === 'rain' ? ['#40567a', '#667da1', '#50668d'] : ['#739bd3', '#a2c5f4', '#94b8e8'], kind === 'rain' ? '#8496bd' : '#d7e6fb');
    }
  }
  if (kind === 'rain') for (let i = 0; i < 15; i++) {
    const x = -57 + i % 5 * 25, y = 66 - Math.floor(i / 5) * 18, z = 8 + i % 3 * 15;
    path([[x, y, z], [x - 8, y - 14, z + 2]], tint(.9), null, false, 1.8);
  }
}

export default function RealmScene({ kind, light, animate, label }) {
  const canvas = useRef(null);
  const drag = useRef(null);
  const draw = useRef(null);
  const phase = useRef(0);
  const model = useRef({ kind, light, view: initial });
  const [view, setView] = useState(initial);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const el = canvas.current, ctx = el.getContext('2d');
    if (!ctx) { setSupported(false); return; }
    const update = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const width = Math.round(w * ratio), height = Math.round(h * ratio);
      if (el.width !== width || el.height !== height) { el.width = width; el.height = height; }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const { kind, light, view } = model.current;
      paint(ctx, w, h, view, kind, light, phase.current);
    };
    draw.current = update;
    const observer = new ResizeObserver(update);
    observer.observe(el); update();
    return () => { observer.disconnect(); draw.current = null; };
  }, []);
  useEffect(() => { model.current = { kind, light, view }; draw.current?.(); }, [kind, light, view]);
  useEffect(() => {
    if (!animate || kind !== 'nexus' || !supported) return;
    let frame, previous;
    const tick = (now) => {
      if (previous !== undefined && now - previous >= 1000 / 30 && !drag.current) {
        phase.current += Math.min(now - previous, 50) / 1000;
        draw.current?.();
        previous = now;
      } else if (previous === undefined || drag.current) previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, kind, supported]);
  const orbit = (yaw, pitch) => setView({ yaw, pitch: Math.max(15, Math.min(64, pitch)) });
  return <div className="i47-scene">
    <div className="i47-viewport" tabIndex={supported ? 0 : undefined} role="group" aria-label={label} aria-describedby="i47-camera-help"
      onPointerDown={(e) => { if (!supported || !e.isPrimary || e.button !== 0) return; drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ...view }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onLostPointerCapture={() => { drag.current = null; }}
      onPointerMove={(e) => { const p = drag.current; if (p?.id === e.pointerId) orbit(p.yaw + (e.clientX - p.x) * .53, p.pitch + (e.clientY - p.y) * .29); }}
      onKeyDown={(e) => { const delta = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key]; if (!delta) return; e.preventDefault(); orbit(view.yaw + delta[0], view.pitch + delta[1]); }}>
      <canvas ref={canvas} aria-hidden="true" /><span className="i47-scene-label" aria-hidden="true">{kind === 'nexus' ? `${label} / Nexus Core` : 'ATMOSPHERE / 00'}</span>
      {!supported && <p>Canvas unavailable. Forecast and navigation still work.</p>}
    </div>
    <div className="i47-camera"><span id="i47-camera-help">Drag to orbit · Arrow keys when focused</span><output aria-hidden="true">YAW {Math.round(view.yaw)}° / PITCH {Math.round(view.pitch)}°</output><button type="button" className="dash-button" disabled={!supported} onClick={() => setView(initial)}>Reset view</button></div>
  </div>;
}
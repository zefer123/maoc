// Throwaway visual concept. Everything rendered here is local, illustrative geometry.
const canvas = document.getElementById('scene');
const viewer = document.getElementById('viewer');
const ctx = canvas.getContext('2d');
const angleOutput = document.getElementById('angles');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const modes = {
  weather: { name: 'Weather', scene: 'ATMOSPHERE', index: '00', accent: '116,188,255', yaw: -22, pitch: 32 },
  deck: { name: 'Command Deck', scene: 'COMMAND ARRAY', index: '01', accent: '107,236,229', yaw: -38, pitch: 34 },
  station: { name: 'Realm World 2.5D', scene: 'GUILD ORBIT', index: '02', accent: '202,137,255', yaw: -16, pitch: 42 },
  visualizer: { name: '3D Visualizer', scene: 'NEXUS CORE', index: '03', accent: '141,156,255', yaw: -22, pitch: 32 },
};
const buttons = [...document.querySelectorAll('[data-view]')];
const rad = Math.PI / 180;
let mode = 'weather';
let yaw = -22, pitch = 32, targetYaw = yaw, targetPitch = pitch;
let width = 0, height = 0, ratio = 1, frame = 0, drag = null;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rgb = (opacity) => `rgba(${document.body.dataset.theme === 'light' ? '43,75,150' : modes[mode].accent},${opacity})`;
const polar = (r, a, y = 0) => [r * Math.cos(a), y, r * Math.sin(a)];
const outline = (r, y, sides, offset = 0) => Array.from({ length: sides }, (_, i) => polar(r, offset + i * 2 * Math.PI / sides, y));

function render() {
  if (!ctx || !width || !height) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const scale = Math.min(width / 570, height / 408);
  const ox = width * .505, oy = height * .565;
  const sy = Math.sin(yaw * rad), cy = Math.cos(yaw * rad);
  const sp = Math.sin(pitch * rad), cp = Math.cos(pitch * rad);
  const project = ([x, y, z]) => {
    const u = x * cy - z * sy, v = x * sy + z * cy;
    const depth = v * cp + y * sp;
    const p = 940 / (940 - depth);
    return [ox + u * p * scale, oy + (v * sp - y * cp) * p * scale, depth];
  };
  const path = (points, { fill, stroke, weight = 1, close = false, glow = 0 } = {}) => {
    if (!points.length) return;
    ctx.save();
    ctx.beginPath();
    points.forEach((point, i) => { const [x, y] = project(point); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    if (close) ctx.closePath();
    if (glow) { ctx.shadowBlur = glow * scale; ctx.shadowColor = rgb(.9); }
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = weight * scale; ctx.stroke(); }
    ctx.restore();
  };
  const arc = (r, y, start, end, stroke, weight = 1, glow = 0) => {
    const count = Math.max(2, Math.ceil((end - start) / (Math.PI / 54)));
    path(Array.from({ length: count + 1 }, (_, i) => polar(r, start + (end - start) * i / count, y)), { stroke, weight, glow });
  };
  const disk = (r, y, sides, fill, stroke, offset = 0) => path(outline(r, y, sides, offset), { fill, stroke, close: true });
  const solid = (upper, lower, { face, edge, top }) => {
    const faces = upper.map((p, i) => {
      const j = (i + 1) % upper.length;
      const points = [p, upper[j], lower[j], lower[i]];
      return { points, depth: points.reduce((n, q) => n + project(q)[2], 0) / 4, index: i };
    });
    faces.sort((a, b) => a.depth - b.depth).forEach(({ points, index }) => path(points, { fill: face(index), stroke: edge, close: true, weight: .8 }));
    path(upper, { fill: top, stroke: edge, close: true, weight: 1 });
  };
  const platform = (r, y, thick, sides, top, offset = 0) => solid(outline(r, y, sides, offset), outline(r, y - thick, sides, offset), {
    top, edge: rgb(.38), face: (i) => ['#0d1024', '#17203a', '#262d51', '#111629'][i % 4],
  });

  // A sparse, fixed optical grid stays in the viewport while the model orbits.
  ctx.fillStyle = rgb(.15);
  const step = Math.max(17, 25 * scale);
  for (let x = step; x < width; x += step) for (let y = step; y < height; y += step) ctx.fillRect(x, y, 1, 1);
  const halo = ctx.createRadialGradient(ox, oy - 35 * scale, 10, ox, oy - 35 * scale, 205 * scale);
  halo.addColorStop(0, rgb(.19)); halo.addColorStop(.55, rgb(.07)); halo.addColorStop(1, rgb(0));
  ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
  const shadow = ctx.createRadialGradient(ox, oy + 40 * scale, 5, ox, oy + 40 * scale, 230 * scale);
  shadow.addColorStop(0, document.body.dataset.theme === 'light' ? '#5674ac38' : '#03040bd0'); shadow.addColorStop(1, '#03040b00');
  ctx.fillStyle = shadow; ctx.fillRect(0, 0, width, height);

  const turn = Math.PI * 2;
  for (const r of [161, 191, 218, 247, 260]) arc(r, -34, 0, turn, rgb(r === 247 ? .32 : .15));
  for (let i = 0; i < 72; i++) {
    const a = i * turn / 72;
    const long = i % 6 === 0;
    path([polar(long ? 246 : 250, a, -34), polar(257, a, -34)], { stroke: rgb(long ? .55 : .22), weight: long ? 1.3 : .75 });
    if (long) path([polar(192, a, -34), polar(215, a, -34)], { stroke: rgb(.22), weight: .8 });
  }
  for (const a of [.25, 1.65, 3.4, 5.25]) arc(218, -34, a, a + .47, rgb(.79), 1.55, 9);
  platform(151, -15, 21, 12, '#12172c', Math.PI / 12);
  platform(143, 1, 14, 12, '#1b2440', Math.PI / 12);
  disk(133, 1.5, 12, '#12182c', rgb(.46), Math.PI / 12);
  arc(121, 2, 0, turn, rgb(.25));
  arc(106, 2, 0, turn, rgb(.39));
  for (let i = 0; i < 8; i++) {
    const a = i * turn / 8 + .1;
    arc(128, 2, a, a + .29, rgb(.82), 2, 11);
    path([polar(106, a, 2), polar(75, a, 2)], { stroke: rgb(.25), weight: 1 });
  }

  if (mode === 'weather') {
    const weather = document.body.dataset.forecast;
    if (weather !== 'rain') {
      const sun = outline(34, 0, 12).map(([x, , z]) => [x - 49, z + 142, -31]);
      path(sun, { fill: '#ffd494', stroke: '#fff1cb', close: true, weight: 1.4, glow: 20 });
      for (let i = 0; i < 12; i++) {
        const a = i * turn / 12;
        const point = (r) => [Math.cos(a) * r - 49, Math.sin(a) * r + 142, -31];
        path([point(43), point(51)], { stroke: '#ffd494ae', weight: 1.5 });
      }
    }
    if (weather !== 'sun') {
      const clouds = [[-49, 94, 20, 36], [-12, 116, 8, 51], [38, 96, 22, 40], [65, 91, -5, 27]];
      clouds.sort((a, b) => project(a)[2] - project(b)[2]);
      for (const [x, y, z, r] of clouds) {
        const rings = (radius, height) => outline(radius, height, 9).map(([a, b, c]) => [a + x, b, c + z]);
        solid(rings(r * .68, y + r * .54), rings(r, y - r * .31), {
          top: weather === 'rain' ? '#8496bd' : '#d7e6fb', edge: rgb(.65),
          face: (n) => (weather === 'rain' ? ['#3f527e', '#526790', '#6980a8'] : ['#729bd6', '#94b8e8', '#adcef2'])[n % 3],
        });
      }
    }
    if (weather === 'rain') {
      for (let i = 0; i < 15; i++) {
        const x = -57 + i % 5 * 25, y = 67 - Math.floor(i / 5) * 18, z = 8 + i % 3 * 15;
        path([[x, y, z], [x - 8, y - 14, z + 2]], { stroke: rgb(.83), weight: 1.4, glow: 6 });
      }
    }
    for (const a of [.45, 2.65, 4.8]) arc(91, 6, a, a + .52, rgb(.85), 1.7, 9);
  } else if (mode === 'visualizer') {
    // Suspended faceted core, with separate signal arcs and a machined base.
    platform(72, 10, 10, 8, '#222a49', Math.PI / 8);
    platform(51, 18, 8, 8, '#1b2547', Math.PI / 8);
    disk(37, 18.4, 48, rgb(.16), rgb(.8));
    for (let i = 0; i < 6; i++) {
      const a = i * turn / 6;
      path([polar(35, a, 19), polar(15, a, 78)], { stroke: rgb(.26), weight: .85, glow: 8 });
    }
    const ring = outline(67, 120, 6, Math.PI / 6);
    const top = [0, 211, 0], bottom = [0, 55, 0];
    const facets = ring.flatMap((p, i) => {
      const q = ring[(i + 1) % 6];
      return [{ points: [top, p, q], index: i, up: true }, { points: [bottom, q, p], index: i, up: false }];
    });
    facets.sort((a, b) => a.points.reduce((s, p) => s + project(p)[2], 0) - b.points.reduce((s, p) => s + project(p)[2], 0));
    const shades = ['#7785dd', '#485cb0', '#2d3b76', '#313b78', '#606ebd', '#94a2ed'];
    for (const { points, index, up } of facets) {
      path(points, { fill: up ? shades[index] : ['#313b78', '#2e4586', '#161e40', '#1c284f', '#374686', '#5467bb'][index], stroke: rgb(up ? .95 : .73), close: true, weight: 1.25, glow: 8 });
      const center = points.reduce((s, p) => s.map((n, i) => n + p[i] / 3), [0, 0, 0]);
      path(points.map((p) => p.map((n, i) => n * .77 + center[i] * .23)), { stroke: '#ecedff42', close: true, weight: .7 });
    }
    for (const a of [.35, 2.5, 4.66]) arc(94, 83, a, a + .75, rgb(.62), 1.25, 9);
  } else if (mode === 'station') {
    // Guild navigation: eight satellites with distinct heights, around a central spire.
    const pods = Array.from({ length: 8 }, (_, i) => ({ i, p: polar(105, i * turn / 8, 0) })).sort((a, b) => project(a.p)[2] - project(b.p)[2]);
    const pod = ({ i, p: [x, , z] }) => {
      const translated = (r, y, corners) => outline(r, y, corners, Math.PI / 4).map(([u, v, w]) => [u + x, v, w + z]);
      const y = 28 + (i % 3) * 10;
      solid(translated(24, 7, 4), translated(24, 2, 4), { top: '#392b55', edge: rgb(.65), face: () => '#171326' });
      solid(translated(12, y, 4), translated(16, 7, 4), { top: '#ab78d9', edge: rgb(.75), face: (n) => n % 2 ? '#514071' : '#241c39' });
      path([[x, y, z], [x, y + 11, z]], { stroke: rgb(.96), glow: 7 });
    };
    pods.filter(({ p }) => project(p)[2] < 0).forEach(pod);
    platform(46, 19, 16, 6, '#44315e');
    solid(outline(10, 125, 6), outline(30, 19, 6), { top: '#e9c7fc', edge: rgb(.87), face: (n) => ['#45305e', '#725093', '#af82d6'][n % 3] });
    path([[0, 125, 0], [0, 164, 0]], { stroke: rgb(.9), glow: 10 });
    pods.filter(({ p }) => project(p)[2] >= 0).forEach(pod);
  } else {
    // Command navigation: stepped hexagonal layers threaded by a central axis.
    for (const [r, y, top] of [[80, 12, '#203b46'], [64, 40, '#285460'], [46, 70, '#367782'], [29, 100, '#5cb3bb']]) {
      platform(r, y, 11, 6, top, Math.PI / 6);
      arc(r * .82, y + .4, 0, turn, rgb(.7), 1.1, 5);
      for (let i = 0; i < 3; i++) {
        const a = i * turn / 3;
        path([polar(r * .24, a, y + 1), polar(r * .7, a, y + 1)], { stroke: rgb(.8), weight: 1.25 });
      }
    }
    path([[0, 100, 0], [0, 155, 0]], { stroke: rgb(.85), glow: 13 });
    for (const a of [0, turn / 3, turn * 2 / 3]) arc(99, 41, a, a + .66, rgb(.5), 1.3, 5);
  }
}

function tick() {
  frame = 0;
  const easing = motion.matches ? 1 : .34;
  yaw += (targetYaw - yaw) * easing;
  pitch += (targetPitch - pitch) * easing;
  const moving = Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) > .08;
  if (!moving) { yaw = targetYaw; pitch = targetPitch; }
  const wrapped = ((Math.round(yaw) + 180) % 360 + 360) % 360 - 180;
  angleOutput.textContent = `YAW ${wrapped}° / PITCH ${Math.round(pitch)}°`;
  render();
  if (moving) requestDraw();
}

function requestDraw() { if (!frame) frame = requestAnimationFrame(tick); }
function reset() { ({ yaw: targetYaw, pitch: targetPitch } = modes[mode]); requestDraw(); }
function resize() {
  ({ width, height } = viewer.getBoundingClientRect());
  ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  requestDraw();
}

function selectRealmScene(value) {
  mode = Object.hasOwn(modes, value) ? value : 'visualizer';
  const selected = modes[mode];
  document.body.dataset.mode = mode;
  document.getElementById('scene-label').textContent = selected.scene;
  document.getElementById('scene-index').textContent = `FIG. ${selected.index}`;
  document.getElementById('mode-status').textContent = `${selected.name} selected. Model: ${selected.scene.toLowerCase()}.`;
  buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === mode)));
  reset();
}

buttons.forEach((button) => button.addEventListener('click', () => selectRealmScene(button.dataset.view)));
document.getElementById('reset-camera').addEventListener('click', reset);
if (ctx) {
  viewer.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: targetYaw, pitch: targetPitch };
    viewer.setPointerCapture(event.pointerId);
  });
  viewer.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    targetYaw = drag.yaw + (event.clientX - drag.x) * .53;
    targetPitch = clamp(drag.pitch + (event.clientY - drag.y) * .29, 15, 64);
    requestDraw();
  });
  viewer.addEventListener('lostpointercapture', () => { drag = null; });
  viewer.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') targetYaw -= 12;
    if (event.key === 'ArrowRight') targetYaw += 12;
    if (event.key === 'ArrowUp') targetPitch = clamp(targetPitch - 6, 15, 64);
    if (event.key === 'ArrowDown') targetPitch = clamp(targetPitch + 6, 15, 64);
    requestDraw();
  });
  new ResizeObserver(resize).observe(viewer);
  resize();
} else {
  viewer.removeAttribute('tabindex');
  document.getElementById('camera-help').textContent = 'The model requires Canvas support.';
  document.getElementById('reset-camera').hidden = true;
}
selectRealmScene('weather');
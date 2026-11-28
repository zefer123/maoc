import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createApplication } from '../src/server.js';
import { LlmEngine } from '../src/llmEngine.js';
import { telemetryBus } from '../src/eventBus.js';
import { createExecutionObservation } from '../src/performanceStore.js';
import { summarizePerformance } from '../../src/lib/performancePresentation.js';
import { WebSocket } from '../node_modules/ws/wrapper.mjs';
import { createServer } from '../../node_modules/vite/dist/node/index.js';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = process.env.MAOC_DASHBOARD_REPORT || join(root, 'server/dashboard-browser.log');
const navigationEvidence = process.env.MAOC_DASHBOARD_EVIDENCE_DIR;
const pollingOnly = process.argv.includes('--polling-only');
const accessOnly = process.argv.includes('--access-only');
const rootErrorOnly = process.argv.includes('--root-error-only');
const rootErrorMarker = 'MAOC_ROOT_RENDER_FIXTURE';
const fixtureAdmin = accessOnly ? 'fixture_only_admin_not_a_real_secret_2026' : '';
const screenshotPath = (name) => join(navigationEvidence || join(root, 'server'), name);
const checks = []; const errors = []; const layouts = [];
const coreMenuLayout = `(() => {const m=document.querySelector('.i47-core-menu'),r=m.getBoundingClientRect(),rail=m.closest('nav').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:m.scrollWidth,client:m.clientWidth,railLeft:rail.left,railRight:rail.right,railBottom:rail.bottom,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth};})()`;
const workspaceLayout = `(() => {const box=selector=>document.querySelector(selector)?.getBoundingClientRect().toJSON() ?? null;return {main:box('.dash-content'),hero:box('#i47-home-title'),canvas:box('.i47-viewport canvas'),rail:box('.i47-core-bar'),dock:box('.overview-dock-slot'),status:box('.i47-web-status'),scroll:document.querySelector('.dash-content').scrollTop};})()`;
const expectedChunkErrors = []; let expectedChunkFailure = '';
let app, vite, chrome, socket;

/** @param {import('node:net').Server | null} server */
function listeningPort(server) {
  const address = server?.address();
  assert.ok(address && typeof address === 'object', 'Fixture must listen on a TCP port');
  return address.port;
}

try {
  let now = Date.parse('2026-11-13T10:00:00Z');
  const mailed = new Set();
  const llm = new LlmEngine({ settings: { ...config, providers: { gemini: '', openrouter: '', openai: 'offline-browser-transport', ollamaUrl: '' } }, fetcher: async (_, options) => {
    const body = JSON.parse(options.body); const prompt = body.messages[1].content;
    if (prompt.includes('Fixture Tech directive') && /Workflow node: rex\b/.test(prompt)) await delay(700);
    if (prompt.includes('Fixture Tech directive') && /Workflow node: aria\b/.test(prompt) && !body.messages.some(({ role }) => role === 'tool')) {
      return Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: 'spatial-registry', type: 'function', function: { name: 'agent-registry', arguments: '{}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
    }
    if (/Workflow node: inspect\b/.test(prompt) && !body.messages.some((message) => message.role === 'tool')) {
      return Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: 'branch-registry', type: 'function', function: { name: 'agent-registry', arguments: '{}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
    }
    if (prompt.includes('DASHBOARD_MAIL') && body.tools?.some((tool) => tool.function.name === 'agent-message')) {
      const node = prompt.match(/Workflow node: ([\w-]+)/)?.[1];
      if (node === 'sender' && !mailed.has(prompt)) {
        mailed.add(prompt);
        return Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: 'dashboard-mail', type: 'function', function: { name: 'agent-message', arguments: JSON.stringify({ to: 'report', text: 'DASHBOARD_REFERENCE <img src=x onerror=alert(1)>' }) } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
      }
    }
    if (prompt.includes('DASHBOARD_MAIL') && /Workflow node: report\b/.test(prompt)) assert.ok(prompt.includes('DASHBOARD_REFERENCE'));
    return Response.json({ choices: [{ message: { content: 'Deterministic dashboard report. Not live inference or real external execution.' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  } });
  const fixtureOrigins = [];
  app = await createApplication({ vaultDir: await mkdtemp(join(tmpdir(), 'maoc-dashboard-vault-')), storageDriver: process.env.MAOC_TEST_STORAGE_DRIVER || 'atomic-json', llmEngine: llm, schedulerClock: () => now, schedulerAutoStart: false, collectionRealtime: !pollingOnly, corsOrigins: fixtureOrigins, webhookUrl: '', accessGate: accessOnly, adminKey: fixtureAdmin });
  await app.listen(0, '127.0.0.1');
  const executeTool = app.orchestrator.tools.execute.bind(app.orchestrator.tools);
  app.orchestrator.tools.execute = async (name, input, context) => {
    if (name === 'agent-registry' && context.task?.description.includes('Fixture Tech directive')) await delay(1800, undefined, { signal: context.signal });
    return executeTool(name, input, context);
  };
  const backendPort = listeningPort(app.server);
  assert.notEqual(backendPort, 8787, 'Fixture must not use the live port');
  const target = `http://127.0.0.1:${backendPort}`;
  // Do not let local VITE_* settings bypass the fixture proxy and reach the real Vault.
  const rootErrorPlugin = {
    name: 'fixture-root-render-error',
    enforce: /** @type {const} */ ('pre'),
    transform(_code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/App.jsx')) return `export default function App() { throw new Error(${JSON.stringify(rootErrorMarker)}); }`;
    }
  };
  const rootErrorWrites = [];
  if (rootErrorOnly) app.server.prependListener('request', (req) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') rootErrorWrites.push(req.method);
  });
  vite = await createServer({ root, configFile: join(root, 'vite.config.js'), envFile: false, envPrefix: 'MAOC_TEST_PUBLIC_', plugins: rootErrorOnly ? [rootErrorPlugin] : [], server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target }, '/ws': { target, ws: true } } } });
  assert.equal(vite.config.env.VITE_API_BASE_URL, undefined, 'Browser uses the fixture proxy only');
  for (const path of ['/api', '/ws']) {
    const proxy = vite.config.server.proxy?.[path];
    assert.ok(proxy && typeof proxy === 'object', `Expected fixture proxy options for ${path}`);
    assert.equal(proxy.target, target);
  }
  await vite.listen(); const url = `http://127.0.0.1:${listeningPort(vite.httpServer)}`;
  fixtureOrigins.push(url);
  const profile = await mkdtemp(join(tmpdir(), 'maoc-dashboard-chrome-'));
  const executable = process.env.MAOC_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  chrome = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 200; i += 1) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(50); } }
  assert.ok(port, 'Chrome debugger started');
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  const pending = new Map(); let next = 0;
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    if (message.method === 'Runtime.exceptionThrown') {
      const description = message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text;
      if ((rootErrorOnly && description.includes(rootErrorMarker)) || (expectedChunkFailure && description.includes(expectedChunkFailure) && /dynamically imported module|module script|fetch/i.test(description))) expectedChunkErrors.push(description);
      else errors.push(description);
    }
    if (message.id && pending.has(message.id)) { const { resolve, reject, timer } = pending.get(message.id); clearTimeout(timer); pending.delete(message.id); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result); }
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, 15000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const wait = async (expression, evaluateIn = evaluate) => { for (let i = 0; i < 240; i += 1) { try { if (await evaluateIn(`Boolean(${expression})`)) return; } catch (reason) { if (!/context|navigated|Cannot read properties of null/i.test(reason.message)) throw reason; } await delay(50); } throw new Error(`Timed out: ${expression}`); };
  const click = async (text, selector = 'button') => { const found = await evaluate(`(() => {const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.getClientRects().length && b.textContent.trim()===${JSON.stringify(text)}); if(!b || b.disabled)return false;b.click();return true;})()`); assert.ok(found, `Visible enabled control: ${text}`); await delay(40); };
  const coreTrigger = '#i47-core-trigger';
  const currentCoreLabel = `document.querySelector('${coreTrigger} > span').textContent`;
  const openCore = async () => {
    await evaluate(`(() => {const b=document.querySelector('${coreTrigger}');if(b.getAttribute('aria-expanded')!=='true') b.click()})()`);
    await wait(`!document.getElementById('i47-core-menu').hidden`);
  };
  const chooseCorePage = async (core, page) => {
    const id = { Home: 'home', Dashboards: 'dashboards', Agents: 'agents', Armory: 'armory', 'Copilot 47': 'copilot-47' }[core];
    await openCore();
    await evaluate(`(() => {const b=document.getElementById('i47-heading-${id}');if(b.getAttribute('aria-expanded')!=='true') b.click()})()`);
    const list = `#i47-core-${id}`;
    await wait(`document.querySelector('${list}').getClientRects().length===1`);
    const found = await evaluate(`(() => {const b=[...document.querySelectorAll(${JSON.stringify(`${list} button`)})].find(b=>b.getClientRects().length&&b.dataset.navView===${JSON.stringify(page)});if(!b)return false;b.click();return true;})()`);
    assert.ok(found, `Visible owned page ${core} / ${page}`); await delay(40);
  };
  const nav = async (section) => {
    if (section === 'Overview') {
      await chooseCorePage('Home', 'Command Deck');
      await wait(`document.querySelector('.guild-world')`);
      return;
    }
    const category = { Missions: 'Dashboards', Library: 'Dashboards', Activity: 'Dashboards', Analytics: 'Dashboards', Teams: 'Agents', Settings: 'Armory' }[section] || section;
    await chooseCorePage(category, { Home: 'Home Opening', Teams: 'Department roster' }[section] || section);
  };
  // A live element from the outgoing document is not reload completion.
  const reload = async () => {
    const previousOrigin = await evaluate('performance.timeOrigin');
    await cdp('Page.reload');
    await wait(`performance.timeOrigin>${previousOrigin} && document.querySelector('.dash-connection.is-live')`);
  };
  const input = async (label, value) => evaluate(`(() => {const e=[...document.querySelectorAll('label')].find(l=>l.getClientRects().length && l.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector('input,textarea');if(!e)throw new Error('Input '+${JSON.stringify(label)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const select = async (label, value) => evaluate(`(() => {const e=[...document.querySelectorAll('label')].find(l=>l.getClientRects().length && l.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector('select') || [...document.querySelectorAll('select')].find(e=>e.getClientRects().length && e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)throw new Error('Select '+${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const step = async (id) => {
    await wait(`document.getElementById('builder-steps-'+${JSON.stringify(id)})`);
    await evaluate(`document.getElementById('builder-steps-'+${JSON.stringify(id)}).click()`);
  };
  const key = async (key, code = key, virtual = 9) => { await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, ...(key === 'Enter' ? { text: '\r' } : {}) }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual }); };
  async function physicalClick(selector) {
    const measure = () => evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,hit:e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};})()`);
    const initial = await measure();
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: initial.x, y: initial.y });
    // Hover transforms and scroll/fit transitions must settle before choosing a click point.
    await delay(200);
    let point = await measure(); let stable = 0;
    for (let sample = 0; sample < 20 && stable < 3; sample += 1) {
      await delay(100);
      const next = await measure();
      stable = next.hit && Math.abs(next.x-point.x)<.5 && Math.abs(next.y-point.y)<.5 ? stable+1 : 0;
      point = next;
    }
    assert.equal(stable, 3, `Pointer target settles before click: ${selector}`);
    assert.ok(point.hit, `Hit target is not covered: ${selector}`);
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await delay(60);
  }
  const drain = async () => { for (let i = 0; i < 400 && app.orchestrator.running.size; i += 1) await delay(20); assert.equal(app.orchestrator.running.size, 0); };
  const tasks = () => [...app.orchestrator.tasks.values()];
  const waitForDispatchedTask = async (previousCount, label) => {
    // The Builder closes after sending on WS, before the backend commits admission.
    for (let i = 0; i < 400 && tasks().length <= previousCount; i += 1) await delay(20);
    const admitted = tasks();
    assert.equal(admitted.length, previousCount + 1, `${label}: backend must admit exactly one new task`);
    return admitted.at(-1);
  };
  const api = async (path, data) => { const res = await fetch(`${target}/api${path}`, { method: data ? 'POST' : 'GET', ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) }); assert.ok(res.ok, `${path}: ${res.status}`); return res.json(); };
  let acceptDialogs = true;
  socket.on('message', (raw) => { if (JSON.parse(raw).method === 'Page.javascriptDialogOpening') void cdp('Page.handleJavaScriptDialog', { accept: acceptDialogs }); });
  const heldChunks = new Map();
  let holdChunk = '';
  let holdDeliverableRead = false;
  let deliverableRead;
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    if (holdDeliverableRead && request.method === 'GET' && new URL(request.url).pathname === '/api/storage/deliverables' && !deliverableRead) deliverableRead = requestId;
    else if (holdChunk && request.url.includes(holdChunk)) heldChunks.set(requestId, request.url);
    else void cdp('Fetch.continueRequest', { requestId });
  });
  const releaseChunks = async () => { holdChunk = ''; for (const requestId of heldChunks.keys()) await cdp('Fetch.continueRequest', { requestId }); heldChunks.clear(); };
  const waitForHeldChunk = async () => {
    const chunk = holdChunk;
    assert.ok(chunk, 'A lazy chunk must be selected before waiting for interception');
    // Suspense can render before the DevTools Fetch.requestPaused event arrives.
    const intercepted = () => [...heldChunks.values()].some((url) => url.includes(chunk));
    for (let i = 0; i < 240 && !intercepted(); i += 1) await delay(50);
    assert.ok(intercepted(), `DevTools must intercept the lazy request for ${chunk}`);
  };
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*TradeFloorRoom*' }, { urlPattern: '*TopologyTreeView*' }, { urlPattern: '*PerformanceDashboard*' }, { urlPattern: '*AfterActionReview*' }, { urlPattern: '*WorkflowBuilderModal*' }, { urlPattern: '*/api/storage/deliverables' }] });
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('maoc_llm_engine_config_v1',JSON.stringify({provider:'openai',apiKey:'offline-browser-transport',modelName:'offline',autoFailover:false,rpm:1000,maxTaskTokens:500000}));` });
  if (pollingOnly) await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `{
    const schedule = window.setTimeout.bind(window);
    const cancel = window.clearTimeout.bind(window);
    let held;
    window.setTimeout = (callback, ms, ...args) => {
      if (ms !== 15000) return schedule(callback, ms, ...args);
      const id = schedule(() => { held = undefined; callback(...args); }, 60000);
      held = { id, callback, args };
      return id;
    };
    window.clearTimeout = (id) => { if (held?.id === id) held = undefined; cancel(id); };
    window.fixturePollHeld = () => Boolean(held);
    window.fixtureReleasePoll = () => {
      if (!held) return false;
      const { id, callback, args } = held;
      window.clearTimeout(id);
      callback(...args);
      return true;
    };
    const nativeFetch = window.fetch.bind(window);
    window.fixtureStorageReads = [];
    window.fetch = (input, options) => {
      const path = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
      if (path.startsWith('/api/storage/') && (!options?.method || options.method === 'GET')) window.fixtureStorageReads.push(path);
      return nativeFetch(input, options);
    };
  }` });
  await cdp('Page.navigate', { url });
  if (!accessOnly && !rootErrorOnly) await wait(`document.querySelector('.dash-connection.is-live')`);
  if (rootErrorOnly) {
    await wait(`document.querySelector('#root [role="alert"]')`);
    assert.equal(await evaluate(`document.querySelector('#root h1').textContent`), 'เปิด Dashboard ไม่สำเร็จ');
    assert.equal(await evaluate(`document.querySelector('#root').textContent.includes(${JSON.stringify(rootErrorMarker)})`), false);
    const previousOrigin = await evaluate('performance.timeOrigin');
    acceptDialogs = false;
    await click('โหลดหน้าใหม่');
    assert.equal(await evaluate('performance.timeOrigin'), previousOrigin, 'Declining keeps the current document');
    acceptDialogs = true;
    await click('โหลดหน้าใหม่');
    await wait(`performance.timeOrigin > ${previousOrigin} && document.querySelector('#root [role="alert"]')`);
    assert.deepEqual(rootErrorWrites, [], 'Render failure and reload must not write to the backend');
    checks.push('App root catches a render error, hides its details and reloads only on confirmation');
  }
  else if (accessOnly) await checkAccessGate();
  else if (pollingOnly) await checkPollingOnly();
  else if (process.argv.includes('--collection-sync-only')) await checkCollectionSync();
  else if (process.argv.includes('--ceo-directive-only')) await checkCeoDirective();
  else if (process.argv.includes('--hud-only')) await checkHudWorkspace();
  else if (process.argv.includes('--attention-only')) await checkWorkspaceAttention();
  else {
  assert.equal(await evaluate(`document.title`), 'Intelligent 47 (Forty-Seven)');
  assert.equal(await evaluate(`document.querySelector('.dash-shell').dataset.hudTheme`), 'kali-cyber');
  assert.ok(await evaluate(`!location.hash && document.querySelectorAll('.i47-feed-trigger[aria-expanded="false"]').length===2 && !document.querySelector('.i47-hud-popup')`));
  assert.deepEqual(await evaluate(`performance.getEntriesByType('resource').filter(e=>/IsometricMap|TradeFloorRoom|TopologyTreeView|PerformanceDashboard|AfterActionReview|WorkflowBuilderModal|three\.js/.test(e.name)).map(e=>e.name)`), []);
  checks.push('Root opens Home Opening without requesting map, room, topology, analytics, AAR, Builder or Three.js');
  await checkHudWorkspace();
  await nav('Overview');
  assert.equal(await evaluate(`document.querySelectorAll('.dash-metric strong').length`), 4);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.dash-metric strong')].map(e=>e.textContent)`), ['0', '0', '0', '0']);
  assert.equal(await evaluate(`!!document.querySelector('nav[aria-label="Workspace pages"]') && !document.querySelector('.i47-categories textarea')`), true);
  checks.push('Command Deck starts with honest scoped zero counts; workspace tabs are navigation-only');
  assert.equal(await evaluate(`[...document.querySelectorAll('.overview-summary .dash-metric')].every(e=>e.getBoundingClientRect().height>=120)`), true, 'Overview summary uses readable situation cards, not a compressed toolbar');
  const deckTop = await evaluate(`document.querySelector('.bridge-realm').getBoundingClientRect().top`);
  assert.ok(deckTop < 430, `Guild scene and mission board remain in the first desktop viewport: ${deckTop}`);
  assert.equal(await evaluate(`document.querySelector('.guild-mission-board').getBoundingClientRect().top===document.querySelector('.bridge-realm').getBoundingClientRect().top`), true);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.i47-categories .dash-nav-item')].map(e=>e.textContent.trim())`), ['Home', 'Dashboards', 'Agents', 'Armory', 'Copilot 47']);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.i47-categories .dash-nav-item')).fontFamily===getComputedStyle(document.querySelector('.dash-metric strong')).fontFamily`), false);
  assert.equal(await evaluate(`!!document.querySelector('.overview-dock') && !document.querySelector('.overview-dock-panel')`), true);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.overview-dock-counts > span')].map(e=>e.textContent)`), ['Running 0', 'Needs You 0']);
  assert.equal(await evaluate(`new Set([...document.querySelectorAll('.i47-categories .dash-nav-item > svg')].map(e=>getComputedStyle(e).color)).size`), 5);
  const realmColors = { Home: 'rgb(203, 176, 245)', Agents: 'rgb(143, 197, 245)', Dashboards: 'rgb(237, 192, 120)', Armory: 'rgb(192, 199, 214)', 'Copilot 47': 'rgb(234, 160, 207)' };
  for (const [label, expected] of Object.entries(realmColors)) {
    await nav(label);
    assert.equal(await evaluate(currentCoreLabel), label);
    assert.equal(await evaluate(`document.getElementById('i47-core-menu').hidden`), true);
    const actual = await evaluate(`(() => {const e=document.querySelector('.i47-categories .dash-nav-item.is-active'),s=getComputedStyle(e);return {color:s.color,icon:getComputedStyle(e.querySelector('svg')).color,current:e.getAttribute('aria-current'),weight:Number(s.fontWeight),marker:s.boxShadow};})()`);
    assert.equal(actual.color, expected); assert.equal(actual.icon, expected);
    assert.equal(actual.current, 'true'); assert.ok(actual.weight >= 600); assert.ok(actual.marker.includes(expected));
  }
  await nav('Overview');
  checks.push('Five workspace categories retain distinct accents, aria-current, heavier text and a non-color-only inset marker');
  await evaluate(`document.getElementById('overview-status-trigger').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait(`document.getElementById('overview-status-panel')`);
  assert.equal(await evaluate(`document.activeElement.id`), 'overview-dock-heading');
  assert.equal(await evaluate(`document.getElementById('overview-status-panel').textContent.includes('ไม่ใช่การยืนยัน AI provider')`), true);
  await key('Escape', 'Escape', 27);
  assert.equal(await evaluate(`document.activeElement.id`), 'overview-status-trigger');
  await evaluate(`document.getElementById('dashboard-notices-trigger').click()`);
  assert.equal(await evaluate(`document.getElementById('overview-notices-panel').textContent.includes('ยังไม่มีแจ้งเตือน')`), true);
  await key('Escape', 'Escape', 27);
  assert.equal(await evaluate(`document.activeElement.id`), 'dashboard-notices-trigger');
  for (const section of ['Overview', 'Missions', 'Teams', 'Library', 'Activity', 'Settings']) {
    await nav(section);
    const current = { Overview: 'Home', Missions: 'Dashboards', Teams: 'Agents', Library: 'Dashboards', Activity: 'Dashboards', Settings: 'Armory' }[section];
    const shell = await evaluate(`(() => {const b=document.getElementById('dashboard-notices-trigger');return {bells:document.querySelectorAll('.dash-shell .lucide-bell').length,label:b.getAttribute('aria-label'),expanded:b.getAttribute('aria-expanded'),current:${currentCoreLabel},status:document.querySelectorAll('.overview-dock > button').length};})()`);
    assert.deepEqual(shell, { bells: 1, label: 'Notices, 0 unread', expanded: 'false', current, status: section === 'Overview' ? 1 : 0 });
    await evaluate(`document.getElementById('dashboard-notices-trigger').focus()`);
    await key('Enter', 'Enter', 13);
    await wait(`document.getElementById('overview-notices-panel')`);
    assert.equal(await evaluate(`document.activeElement.id`), 'overview-dock-heading');
    assert.equal(await evaluate(currentCoreLabel), current, 'Bell previews without navigating');
    await evaluate(`document.querySelector('[aria-label="Close notices"]').click()`);
    assert.equal(await evaluate(`document.activeElement.id`), 'dashboard-notices-trigger');
  }
  await nav('Overview');
  checks.push('One topbar Bell previews Notices on all six English shell pages without navigation; Overview alone retains Status; Enter, close and focus restoration work');
  await writeFile(screenshotPath('overview-a-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await click('คู่มือเริ่มต้นเริ่มจากเป้าหมาย ไม่จำเป็นต้องสร้าง workflow', 'summary');
  await click('AI provider settings');
  await wait(`document.querySelector('.dash-settings-dialog')`);
  assert.equal(await evaluate(`document.querySelector('.overview-dock')===null`), true, 'Settings suspends Overview feedback');
  assert.equal(await evaluate(`document.getElementById('dashboard-notices-trigger').disabled`), true);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Close settings"]').title`), 'Close settings');
  await key('Escape', 'Escape', 27);
  await wait(`document.querySelector('.overview-dock') && !document.querySelector('.overview-dock-panel')`);
  checks.push('Guild Overview retains four honest counts in readable situation cards, scene/mission-board first-viewport layout, grouped navigation and separate reading/data typography; Status/Bell keyboard focus and Escape preserved');
  for (const [metric, filter] of [['running', 'RUNNING'], ['completed', 'COMPLETED'], ['failed', 'FAILED']]) {
    await evaluate(`document.querySelector('[data-metric="${metric}"]').click()`);
    await wait(`document.getElementById('mission-filter-${filter}')?.getAttribute('aria-selected')==='true'`);
    assert.equal(await evaluate('location.hash'), '#/missions');
    await nav('Overview');
  }
  await evaluate(`document.querySelector('[data-metric="attention"]').focus()`); await key('Enter', 'Enter', 13);
  await wait(`document.getElementById('activity-tabs-actions')?.getAttribute('aria-selected')==='true'`);
  await nav('Overview');
  checks.push('Overview situation cards open exact Running/Completed/Failed mission filters and keyboard Needs You opens Action inbox without dispatch');
  holdChunk = 'PerformanceDashboard';
  await nav('Analytics');
  await wait(`document.querySelector('[data-lazy-state="loading"]')`); await waitForHeldChunk();
  await releaseChunks(); holdChunk = 'AfterActionReview';
  await wait(`document.querySelector('[aria-labelledby="analytics-title"]').textContent.includes('ยังไม่มีข้อมูลที่ตรงตัวกรอง')`);
  await wait(`document.querySelector('[data-lazy-state="loading"]')`); await waitForHeldChunk();
  await releaseChunks();
  checks.push('Cold analytics module shows loading feedback without issuing provider work');
  checks.push('Analytics history requests AAR separately and keeps the analytics controls visible while it loads');
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Agent performance table"] tbody tr').length`), 28);
  assert.equal(tasks().length, 0); assert.equal((await api('/analytics')).mission_count, 0);
  checks.push('Analytics starts with 28 honest empty rows, null rates/latency, no demo metrics or provider dispatch');
  await wait(`document.getElementById('aar-history-title') && document.querySelector('[aria-labelledby="aar-history-title"]').textContent.includes('ยังไม่มี AAR ที่ตรงตัวกรอง')`);
  await nav('Teams'); await openCore(); await evaluate(`document.querySelector('.i47-context-nav [data-nav-view="Guild map"]').focus()`); await key('Enter', 'Enter', 13);
  await wait(`location.hash==='#/teams?view=realm' && document.querySelectorAll('.guild-island').length===8`);
  assert.equal(await evaluate(`document.querySelector('[data-current-location]').textContent`), 'Guild map');
  await openCore();
  assert.equal(await evaluate(`document.querySelector('#i47-core-agents [aria-current="location"]').textContent`), 'Guild map');
  await key('Escape', 'Escape', 27);
  await cdp('Page.navigate', { url: `${url}/#/teams?view=analytics` });
  await wait(`document.querySelector('[aria-labelledby="analytics-title"]') && document.querySelector('.dash-connection.is-live')`);
  assert.equal(await evaluate(`document.querySelector('[data-current-location]').textContent`), 'Analytics');
  assert.equal(tasks().length, 0);
  checks.push('Contextual sidebar destinations support Enter, exact deep links and route-aware current location without dispatch');
  await nav('Teams');
  const navigationTaskCount = tasks().length;
  await evaluate(`document.querySelector('[data-team-open="tech"]').click()`);
  await wait(`document.querySelector('[data-team-workspace="tech"]')`);
  assert.equal(await evaluate('location.hash'), '#/teams/tech');
  assert.equal(await evaluate(`document.querySelectorAll('.team-workspace .dash-agent-row').length`), 5);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.team-workspace-stats dd')].map(e=>e.textContent)`), ['5', '0', '0', '0']);
  assert.equal(await evaluate(`!!document.querySelector('.guild-world')`), false, 'Team dossier is not a duplicate map');
  assert.equal(await evaluate(`document.activeElement===document.querySelector('.dash-content')`), true);
  await evaluate('history.back()'); await wait(`location.hash==='#/teams' && !document.querySelector('.team-workspace')`);
  await evaluate('history.forward()'); await wait(`location.hash==='#/teams/tech' && document.querySelector('[data-team-workspace="tech"]')`);
  await reload(); await wait(`document.querySelector('[data-team-workspace="tech"]')`);
  assert.equal(await evaluate('location.hash'), '#/teams/tech');
  await evaluate(`document.querySelector('.dash-skip').focus()`); await key('Enter', 'Enter', 13);
  assert.equal(await evaluate('location.hash'), '#/teams/tech');
  assert.equal(await evaluate(`document.activeElement===document.querySelector('.dash-content')`), true, 'Skip link focuses main without overwriting the route');
  if (navigationEvidence) await writeFile(join(navigationEvidence, 'team-workspace-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`location.hash='#/teams/design'`); await wait(`document.querySelector('[data-team-workspace="design"]')`);
  assert.equal(await evaluate(`document.querySelectorAll('.team-workspace .dash-agent-row').length`), 2);
  await evaluate(`location.hash='#/teams/missing-team'`); await wait(`document.querySelector('.dash-content').textContent.includes('ไม่พบทีมนี้')`);
  assert.equal(await evaluate(`document.querySelector('.cozy-room')===null`), true);
  await evaluate(`location.hash='#/not-a-page'`); await wait(`document.querySelector('.dash-content').textContent.includes('ไม่พบหน้าที่ต้องการ')`);
  assert.equal(tasks().length, navigationTaskCount);
  checks.push('Team dossiers have distinct URLs/data, honest zero work, main focus, Back/Forward and direct-link reload; unknown teams/routes do not substitute resources or dispatch work');
  await evaluate(`location.hash='#/teams/tech'`); await wait(`document.querySelector('[data-team-workspace="tech"]')`);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=320 && document.querySelector('.dash-content').scrollWidth<=document.querySelector('.dash-content').clientWidth+1`), 'Small 320px dossier has no page-level horizontal overflow');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  checks.push('Skip-to-content preserves the deep link and main focus; team dossier remains contained at 320px');
  await nav('Overview');
  await wait(`document.querySelectorAll('.guild-island').length===8`);
  assert.equal(await evaluate(`document.querySelectorAll('.guild-agent .pixel-agent').length`), 27);
  assert.equal(await evaluate(`document.querySelectorAll('.guild-world .is-live-link').length`), 0);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-building]')].map(e=>[e.dataset.building,e.querySelector('[data-feature]')?.dataset.feature]).sort((a,b)=>a[0].localeCompare(b[0]))`), [
    ['command', 'grand-hall'], ['content', 'hearth-library'], ['data', 'astral-archive'], ['design', 'dream-studio'],
    ['finance', 'gilded-counting-house'], ['legal', 'obsidian-chapterhouse'], ['tech', 'cyber-workshop'], ['trade', 'starfall-observatory']
  ]);
  assert.equal(await evaluate(`document.querySelectorAll('[data-terrain="floating-cliff"]').length`), 8);
  assert.equal(await evaluate(`document.querySelectorAll('[data-detail="stone-causeway"]').length`), 7);
  assert.equal(await evaluate(`document.querySelectorAll('.guild-agent [data-costume="guild-cloak"]').length`), 27);
  assert.equal(await evaluate(`[...document.querySelectorAll('.guild-backdrop')].every(e=>e.getAttribute('aria-hidden')==='true' && getComputedStyle(e).pointerEvents==='none')`), true);
  checks.push('Dark-fantasy art retains eight team IDs with distinct architectural silhouettes, eight floating cliffs, seven decorative causeways and all 27 stable cloaked agents');
  console.log('GUILD_MOTION_DIAGNOSTIC', await evaluate(`({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,motion:document.querySelector('.guild-world').dataset.motion,name:getComputedStyle(document.querySelector('.guild-link-packet')).animationName,duration:getComputedStyle(document.querySelector('.guild-link-packet')).animationDuration,state:getComputedStyle(document.querySelector('.guild-link-packet')).animationPlayState})`));
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await wait(`document.querySelector('.guild-world').dataset.motion==='on'`);
  const flowOffset = await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).strokeDashoffset`);
  await delay(250);
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).strokeDashoffset`), flowOffset, 'Ambient line actually advances between frames');
  const scanOffset = await evaluate(`getComputedStyle(document.querySelector('.signal-sweep')).strokeDashoffset`);
  await delay(150);
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.signal-sweep')).strokeDashoffset`), scanOffset, 'Decorative graph scan advances without random data');
  await evaluate(`document.querySelector('[aria-label="พักเอฟเฟกต์แผนที่"]').click()`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guild-astral-mist')).animationPlayState`), 'paused');
  await evaluate(`Promise.all(document.querySelector('.guild-world').getAnimations({subtree:true}).filter(a=>a.playState==='paused').map(a=>a.ready))`);
  const pausedMist = await evaluate(`getComputedStyle(document.querySelector('.guild-astral-mist')).transform`);
  const pausedOffset = await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).strokeDashoffset`);
  await delay(200);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).strokeDashoffset`), pausedOffset);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guild-astral-mist')).transform`), pausedMist);
  checks.push('Astral mist uses the existing map motion gate and stops between frames when effects are paused');
  await evaluate(`document.querySelector('[aria-label="พักเอฟเฟกต์แผนที่"]').click()`);
  await evaluate(`document.querySelector('.guild-agent[aria-label^="BYTE "]').click()`);
  await wait(`document.querySelector('[role="dialog"][aria-label^="Agent"]')`);
  assert.equal(await evaluate(`document.querySelector('.overview-dock')===null`), true, 'Agent inspector suspends the dock');
  await key('Escape', 'Escape', 27);
  holdChunk = 'TradeFloorRoom';
  await physicalClick('[aria-label="เข้าห้อง TECH SYSTEMS"]');
  await wait(`document.querySelector('[data-lazy-state="loading"]')`);
  await waitForHeldChunk();
  const roomLoadingHeight = await evaluate(`document.querySelector('.dash-spatial-host').getBoundingClientRect().height`);
  await releaseChunks();
  await wait(`document.querySelector('.guild-desk .pixel-agent')`);
  assert.equal(await evaluate(`document.querySelector('.dash-spatial-host').getBoundingClientRect().height`), roomLoadingHeight);
  checks.push('Cold room loading shows an honest status and preserves the reserved spatial height');
  await nav('Overview');
  checks.push('2.5D Overview has 8 rooms/27 pixel agents; ambient connectors and graph scans advance, pause freezes them; room and inspector navigation work');
  assert.equal(await evaluate(`document.querySelectorAll('.guild-ground').length`), 8);
  assert.equal(await evaluate(`new Set([...document.querySelectorAll('[data-building]')].map(e=>e.dataset.building)).size`), 8);
  assert.equal(await evaluate(`[...document.querySelectorAll('.guild-props,.guild-ground')].every(e=>getComputedStyle(e).pointerEvents==='none' && e.getAttribute('aria-hidden')==='true')`), true);
  assert.equal(await evaluate(`document.querySelectorAll('.pixel-agent.is-working').length`), 0, 'Recent events never fabricate a working pose');
  await physicalClick('[aria-label="ขยายแผนที่"]');
  await physicalClick('[aria-label="จัดแผนที่ให้พอดี"]');
  await evaluate(`document.querySelector('.guild-entrance').focus()`);
  assert.equal(await evaluate(`document.activeElement.matches('.guild-entrance')`), true);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait(`document.querySelector('.cozy-room')?.dataset.team==='command'`);
  await nav('Overview');
  checks.push('A focused map entrance opens its original team room with Enter; theme does not replace keyboard navigation');
  await writeFile(screenshotPath('cozy-overview-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await writeFile(screenshotPath('fantasy-overview-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  checks.push('Cozy world has eight material grounds, unique guild buildings and bounded non-interactive props; zoom/Fit controls receive real pointer clicks');
  for (const team of ['command', 'tech', 'design', 'trade', 'finance', 'legal', 'data', 'content']) {
    await physicalClick(`[data-team="${team}"] .guild-entrance`);
    await wait(`document.querySelector('.cozy-room')?.dataset.team===${JSON.stringify(team)} && document.querySelector('.cozy-room-scene')`);
    await physicalClick('.room-console-toggle');
    assert.equal(await evaluate(`document.querySelector('.room-console-panel')===null`), true);
    await physicalClick('[aria-label="จัดห้องให้พอดี"]'); await delay(80);
    assert.equal(await evaluate(`document.querySelector('.cozy-room-scene').getAttribute('aria-hidden')`), 'true');
    assert.equal(await evaluate(`document.querySelector('.cozy-room-scene').dataset.interior`), team);
    assert.equal(await evaluate(`document.querySelectorAll('.cozy-room-scene [data-room-feature]').length`), 1);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.cozy-room-scene')).pointerEvents`), 'none');
    assert.equal(await evaluate(`document.querySelectorAll('.cozy-room-scene [data-detail="stained-glass"]').length`), 1);
    assert.equal(await evaluate(`document.querySelectorAll('.guild-desk').length===document.querySelector('[aria-label="เลือก Agent ในห้อง"]').options.length-1`), true);
    const deskIds = await evaluate(`[...document.querySelectorAll('[aria-label="เลือก Agent ในห้อง"] option')].map(e=>e.value).filter(Boolean)`);
    for (const id of deskIds) {
      await physicalClick(`.guild-desk[aria-label^="${id} "]`);
      await wait(`document.querySelector('[role="dialog"][aria-label^="Agent"]')`); await key('Escape', 'Escape', 27);
    }
    await physicalClick('[aria-label="พักเอฟเฟกต์ห้อง"]');
    assert.equal(await evaluate(`document.querySelector('.cozy-room').dataset.motion`), 'off');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.cozy-room .pixel-agent-body')).animationPlayState`), 'paused');
    await click('ตามระบบ');
    if (team === 'command') {
      await evaluate(`document.querySelector('.guild-desk').focus()`); await delay(80);
      assert.equal(await evaluate(`document.activeElement.matches('.guild-desk')`), true);
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await wait(`document.querySelector('[role="dialog"][aria-label^="Agent"]')`); await key('Escape', 'Escape', 27);
      await writeFile(screenshotPath('cozy-room-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      await writeFile(screenshotPath('fantasy-room-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      await physicalClick('.room-console-toggle');
      assert.equal(await evaluate(`document.querySelector('.room-console-toggle').getAttribute('aria-expanded')`), 'true');
    }
    await nav('Overview');
  }
  assert.equal(tasks().length, 0, 'Cozy scene navigation and presentation controls never create missions');
  checks.push('All eight Cozy rooms render furniture, receive unobstructed desk clicks, open inspector and pause/resume effects; console toggles and scene controls never dispatch');
  checks.push('Every guild entrance and all 27 room desks receive physical pointer clicks; Enter opens the focused desk inspector without dispatch');
  checks.push('All eight themed interiors have their own room feature and Gothic stained glass; furniture remains non-interactive under real desk hit targets');
  await writeFile(join(tmpdir(), 'maoc-dashboard-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const idlePath = await evaluate(`document.querySelector('[data-team="tech"] .guild-signal path').getAttribute('d')`);
  telemetryBus.publish({ event_type: 'AGENT_HANDOFF', source_agent: 'ARIA', target_agent: 'BYTE', payload_summary: 'Deterministic spatial telemetry fixture; no mission or provider call' });
  await wait(`document.querySelector('[data-team="tech"] .guild-signal path').getAttribute('d') !== ${JSON.stringify(idlePath)}`);
  assert.equal(await evaluate(`document.querySelectorAll('.guild-world .is-live-link').length`), 0);
  assert.equal(tasks().length, 0);
  checks.push('An informational WebSocket event updates history without lighting a handoff link or fabricating a task');
  holdChunk = 'TopologyTreeView';
  await nav('Teams'); await click('Topology');
  await wait(`document.querySelector('[data-lazy-state="loading"]')`);
  await waitForHeldChunk(); await releaseChunks();
  await wait(`document.querySelector('.topology-world')`);
  checks.push('Cold topology chunk is requested only on entry and resolves without replacing navigation');
  assert.equal(await evaluate(`!![...document.querySelectorAll('button')].find(e=>e.textContent.includes('DEMO FLOW: OFF'))`), true);
  const topologyOffset = await evaluate(`getComputedStyle(document.querySelector('.topo-dash-flow')).strokeDashoffset`);
  await delay(180);
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.topo-dash-flow')).strokeDashoffset`), topologyOffset);
  await click('DEMO FLOW: OFF · ไม่ใช่งานจริง');
  await wait(`document.body.textContent.includes('ตัวอย่าง')`);
  assert.equal(tasks().length, 0);
  await click('DEMO FLOW: ON · ไม่ใช่งานจริง'); await nav('Overview');
  checks.push('Topology connector animation advances; explicitly labelled opt-in demo never submits real work');

  holdChunk = 'WorkflowBuilderModal';
  await evaluate(`window.builderOpener=[...document.querySelectorAll('button')].find(e=>e.getClientRects().length && e.textContent.trim()==='Create mission');window.builderOpener.focus()`);
  await click('Create mission'); await wait(`document.querySelector('.dash-builder [data-lazy-state="loading"]')`);
  assert.equal(await evaluate(`document.activeElement===document.querySelector('.dash-builder')`), true);
  await key('Tab'); await key('Tab');
  assert.equal(await evaluate(`document.querySelector('.dash-builder').contains(document.activeElement)`), true);
  await key('Escape', 'Escape', 27);
  await wait(`!document.querySelector('.dash-builder')`);
  assert.equal(await evaluate(`document.activeElement===window.builderOpener`), true);
  await waitForHeldChunk(); await releaseChunks();
  await wait(`performance.getEntriesByType('resource').some(e=>e.name.includes('WorkflowBuilderModal'))`);
  await delay(100); assert.equal(await evaluate(`document.querySelector('.dash-builder')===null`), true);
  await click('Create mission');
  await wait(`document.getElementById('workflow-title')`);
  assert.equal(await evaluate(`document.querySelector('.dash-builder').contains(document.activeElement)`), true);
  await key('Escape', 'Escape', 27);
  assert.equal(await evaluate(`document.activeElement===window.builderOpener`), true);
  await click('Create mission'); await wait(`document.getElementById('workflow-title')`);
  checks.push('Cold Builder traps focus, closes via Escape while loading, restores opener and hands focus to the loaded dialog');
  assert.equal(await evaluate(`document.querySelector('.overview-dock')===null`), true, 'Builder suspends the dock');
  await input('Mission', '[TEAM:TECH] [COWORK:BYTE] DASHBOARD_DRAFT');
  await step('method'); await select('Execution mode', 'dag'); await step('goal');
  assert.equal(await evaluate(`document.querySelector('textarea[maxlength="12000"]').value.includes('DASHBOARD_DRAFT')`), true);
  await click('Close'); await nav('Missions'); await click('Create mission');
  assert.equal(await evaluate(`document.querySelector('textarea[maxlength="12000"]').value.includes('DASHBOARD_DRAFT')`), true);
  await evaluate(`document.querySelector('textarea[maxlength="12000"]').focus()`); await key('Enter', 'Enter', 13); assert.equal(tasks().length, 0);
  await step('review'); acceptDialogs = false; await click('Dispatch workflow'); await delay(100); assert.equal(tasks().length, 0); acceptDialogs = true;
  await evaluate(`[...document.querySelectorAll('.dash-builder button')].filter(e=>e.getClientRects().length && !e.disabled).at(-1).focus()`); await key('Tab');
  assert.equal(await evaluate(`document.activeElement.textContent`), 'Close');
  checks.push('Builder preserves draft across steps/close/navigation; Enter outside review and declined confirmation cannot dispatch; focus trap works');

  await step('templates'); await input('Template name', 'Dashboard <img src=x>'); await click('Save draft as template');
  await wait(`document.querySelector('.dash-builder').textContent.includes('Template saved.')`); assert.equal(app.templates.list().length, 1); assert.equal(tasks().length, 0);
  await click('Close'); await click('Templatesเริ่มจากแม่แบบและเติมพารามิเตอร์');
  assert.equal(await evaluate(`document.getElementById('builder-steps-templates').getAttribute('aria-selected')`), 'true');
  await wait(`document.querySelector('.dash-builder').textContent.includes('Saved template (1/50)')`);
  const { template: preset } = await api('/templates', { name: 'Parameterized human', description: '[TEAM:TECH] DASHBOARD_HUMAN {{topic}}', workflow: { nodes: [{ id: 'person', agent: 'HUMAN', prompt: 'Requirements for {{topic}}?', dependsOn: [] }, { id: 'report', agent: 'BYTE', dependsOn: ['person'] }] } });
  assert.ok(preset?.id, 'Template creation returned an ID');
  await click('Refresh templates'); await wait(`document.querySelector('.dash-builder').textContent.includes('Saved template (2/50)')`); await select('Saved template', preset.id);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent==='Load expanded draft').disabled`), true);
  await input('Parameter: topic', 'LOCAL <img src=x onerror=alert(1)> $& {{literal}}');
  await click('Preview expanded mission', 'summary');
  assert.equal(await evaluate(`document.querySelector('.dash-builder details pre img')===null`), true);
  await step('timing'); await select('Dispatch timing', 'recurring'); await step('templates'); await click('Load expanded draft');
  await wait(`document.getElementById('builder-steps-goal').getAttribute('aria-selected')==='true'`);
  await step('timing'); assert.equal(await evaluate(`[...document.querySelectorAll('select')].find(e=>e.closest('label')?.textContent.startsWith('Dispatch timing')).value`), 'now');
  assert.equal(tasks().length, 0); assert.equal(app.scheduler.list().length, 0);
  checks.push('Templates save/load/parameters are non-executing, escape HTML, substitute literally once and reset timing');

  await step('review'); await click('Dispatch workflow'); await wait(`!document.querySelector('.dash-builder')`);
  for (let i = 0; i < 200 && !app.orchestrator.listHumanInputs().length; i += 1) await delay(20);
  assert.equal(app.orchestrator.listHumanInputs().length, 1); await nav('Activity'); await wait(`document.querySelector('textarea[maxlength="12000"]')`);
  await input('Your contribution', 'Human draft kept across tabs and categories'); await click('Messages'); await nav('Overview'); await nav('Activity'); await click('ต้องดำเนินการ1');
  assert.equal(await evaluate(`document.querySelector('textarea[maxlength="12000"]').value`), 'Human draft kept across tabs and categories');
  await reload(); await nav('Activity'); await wait(`document.body.textContent.includes('HUMAN NODE // person')`);
  await input('Your contribution', 'Browser-entered local-only constraints'); await click('Submit & continue'); await drain();
  assert.equal(tasks().at(-1).state, 'COMPLETED'); assert.ok(tasks().at(-1).outputs.some((output) => output.agent === 'HUMAN' && output.text.includes('local-only')));
  await wait(`!document.body.textContent.includes('HUMAN NODE // person')`);
  checks.push('HUMAN action restores from snapshot, preserves unsent draft during navigation, resumes and archives contribution without report approval');

  await nav('Missions'); await click('Create mission'); await wait(`document.getElementById('builder-steps-method')`); await step('method'); await select('Execution mode', 'dag'); await click('Human collaboration example'); await step('review'); await click('Dispatch workflow');
  for (let i = 0; i < 200 && !app.orchestrator.listHumanInputs().length; i += 1) await delay(20);
  await nav('Activity'); await click('Cancel mission'); await drain(); assert.equal(tasks().at(-1).state, 'FAILED'); assert.equal(app.orchestrator.listHumanInputs().length, 0);
  checks.push('HUMAN cancellation is explicit, clears request and stops mission without success artifact');

  const review = await api('/tasks', { description: '[TEAM:TECH] DASHBOARD_REVIEW', workflow: { nodes: [{ id: 'review', agent: 'SAGE', dependsOn: [] }] } });
  await wait(`document.body.textContent.includes('อนุมัติรายงาน')`); assert.equal(app.orchestrator.tasks.get(review.task_id).state, 'AWAITING_HITL');
  await nav('Overview');
  await evaluate(`document.getElementById('overview-status-trigger').click()`);
  await wait(`document.getElementById('overview-status-panel')`);
  assert.equal(await evaluate(`document.querySelector('.overview-status-counts > button:nth-child(2) strong').textContent`), '1');
  assert.equal(await evaluate(`document.querySelector('.overview-dock-counts > span:nth-child(2)').textContent`), 'Needs You 1');
  // Reload earlier in the scenario resets the bounded client event window. Seed
  // six local notices explicitly so latest-five coverage never depends on history.
  const previewTaskId = tasks().find(({ state }) => state === 'COMPLETED').id;
  assert.ok(previewTaskId);
  const previewNotices = Array.from({ length: 6 }, (_, index) => telemetryBus.publish({
    event_type: 'SCHEDULE_UPDATED', source_agent: 'ARIA', task_id: previewTaskId,
    payload_summary: `D.4 local notice ${index} <img src=x onerror=alert(1)>`,
    schedule: { last: { status: 'FAILED' } }
  }));
  await evaluate(`document.getElementById('dashboard-notices-trigger').click()`);
  await wait(`document.querySelector('.overview-notice-list > li')?.dataset.noticeId===${JSON.stringify(previewNotices[5].event_id)}`);
  assert.equal(await evaluate(`document.querySelectorAll('.overview-notice-list > li').length`), 5);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.overview-notice-list > li')].map(e=>e.dataset.noticeId)`), [previewNotices[5].event_id, previewNotices[4].event_id, previewNotices[3].event_id, previewNotices[2].event_id, previewNotices[1].event_id]);
  assert.equal(await evaluate(`document.querySelector('.overview-notice-list img')===null`), true);
  const unreadBeforeDockRead = Number(await evaluate(`document.getElementById('dashboard-notices-trigger').getAttribute('aria-label').split(', ')[1].split(' ')[0]`));
  const dockNoticeId = await evaluate(`document.querySelector('.overview-notice-list > li[data-read="false"]').dataset.noticeId`);
  const dockNoticeText = await evaluate(`document.querySelector('.overview-notice-list > li[data-read="false"] > p').textContent`);
  assert.equal(await evaluate(`[...document.querySelectorAll('.overview-dock-panel button')].some(e=>/อนุมัติรายงาน|ปฏิเสธ/.test(e.textContent))`), false);
  assert.ok(unreadBeforeDockRead > 0);
  await key('Escape', 'Escape', 27);
  assert.equal(Number(await evaluate(`document.getElementById('dashboard-notices-trigger').getAttribute('aria-label').split(', ')[1].split(' ')[0]`)), unreadBeforeDockRead, 'Opening/closing Notices never marks them read');
  assert.equal(await evaluate(`document.activeElement.id`), 'dashboard-notices-trigger');
  await evaluate(`document.getElementById('dashboard-notices-trigger').click()`);
  await evaluate(`document.querySelector('.overview-notice-list > li[data-read="false"] button[aria-label^="Mark notice"]').click()`);
  assert.equal(Number(await evaluate(`document.getElementById('dashboard-notices-trigger').getAttribute('aria-label').split(', ')[1].split(' ')[0]`)), unreadBeforeDockRead - 1);
  assert.equal(app.orchestrator.tasks.get(review.task_id).state, 'AWAITING_HITL', 'Read is not approval');
  for (const section of ['Missions', 'Teams', 'Library', 'Activity', 'Settings']) {
    await nav(section);
    await evaluate(`document.getElementById('dashboard-notices-trigger').click()`);
    await wait(`document.querySelector('.overview-notice-list')`);
    assert.equal(await evaluate(`document.querySelector('[data-notice-id="${dockNoticeId}"]').dataset.read`), 'true');
    assert.equal(Number(await evaluate(`document.getElementById('dashboard-notices-trigger').getAttribute('aria-label').split(', ')[1].split(' ')[0]`)), unreadBeforeDockRead - 1);
    assert.match(await evaluate(`document.querySelector('.i47-status').textContent`), /GATES 1/);
    await key('Escape', 'Escape', 27);
    assert.equal(await evaluate(`document.activeElement.id`), 'dashboard-notices-trigger');
  }
  await nav('Overview'); await evaluate(`document.getElementById('dashboard-notices-trigger').click()`);
  checks.push('Shared newest-five preview and unread/read state survive all six sections while Activity retains its independent pending-review badge');
  const feedbackStack = await evaluate(`(() => {const p=document.querySelector('.overview-dock-panel')?.getBoundingClientRect(),t=document.querySelector('.overview-feedback-stack .dash-toast')?.getBoundingClientRect();return !t || t.bottom<=p.top;})()`);
  assert.equal(feedbackStack, true, 'Toast stacks above the open notice panel');
  await writeFile(screenshotPath('overview-a-notices-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await click('View All'); await wait(`document.getElementById('activity-tabs-notices').getAttribute('aria-selected')==='true'`);
  assert.equal(await evaluate(`document.querySelector('.overview-dock-slot')===null`), true, 'Dock exists only on Overview');
  assert.equal(await evaluate(`[...document.querySelectorAll('.dash-activity article')].filter(e=>e.getClientRects().length).find(e=>e.querySelector('p.line-clamp-3')?.textContent===${JSON.stringify(dockNoticeText)})?.querySelector('button:last-child').disabled`), true, 'Activity observes the same read state');
  await nav('Overview'); await evaluate(`document.getElementById('dashboard-notices-trigger').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-notice-id="${dockNoticeId}"]').dataset.read`), 'true');
  const dockMissionId = await evaluate(`document.querySelector('.overview-notice-list > li button:not([aria-label])')?.closest('li').dataset.noticeId`);
  assert.ok(dockMissionId);
  const noticeTaskId = telemetryBus.snapshot(500).find(({ event_id }) => event_id === dockMissionId)?.task_id;
  assert.ok(noticeTaskId);
  await evaluate(`document.querySelector('.overview-notice-list > li button:not([aria-label])').focus();document.activeElement.click()`);
  await wait(`document.querySelector('.i47-action-overlay[open]')`);
  if (await evaluate(`document.getElementById('i47-overlay-title').textContent==='Notification details'`)) await click('View mission details', '.i47-action-overlay button');
  await wait(`document.querySelector('.i47-action-overlay').textContent.includes('Task ID: '+${JSON.stringify(noticeTaskId)})`);
  assert.ok(await evaluate(`document.querySelector('[data-current-location]').textContent==='Command Deck' && !!document.getElementById('overview-notices-panel') && !!document.querySelector('.overview-dock')`));
  await key('Escape', 'Escape', 27);
  await wait(`!document.querySelector('.i47-action-overlay') && document.activeElement.closest('.overview-notice-list')`);
  await nav('Overview'); await evaluate(`document.getElementById('overview-status-trigger').click()`);
  await evaluate(`document.querySelector('.overview-status-counts > button:nth-child(2)').click()`);
  await wait(`document.getElementById('activity-tabs-actions').getAttribute('aria-selected')==='true'`);
  assert.equal(app.orchestrator.tasks.get(review.task_id).state, 'AWAITING_HITL');
  await nav('Overview'); await evaluate(`document.getElementById('overview-status-trigger').click()`);
  await evaluate(`document.querySelector('.overview-status-counts > button:first-child').click()`);
  await wait(`document.getElementById('mission-filter-active').getAttribute('aria-selected')==='true'`);
  await nav('Overview');
  await evaluate(`document.getElementById('dashboard-notices-trigger').click()`);
  await key('Escape', 'Escape', 27);
  await nav('Activity');
  checks.push('Overview dock shares session read state with Activity; opening does not read, marking one reduces unread without resolving pending review; View All routes to Notices, and toast/panel do not overlap');
  await evaluate(`document.getElementById('activity-tabs-notices').click()`); const mark = await evaluate(`!![...document.querySelectorAll('button')].find(e=>e.getClientRects().length && e.textContent.includes('อ่านทั้งหมด') && !e.disabled)`); if (mark) await click('อ่านทั้งหมด');
  assert.equal(app.orchestrator.tasks.get(review.task_id).state, 'AWAITING_HITL');
  await nav('Overview');
  assert.equal(await evaluate(`document.getElementById('dashboard-notices-trigger').getAttribute('aria-label')`), 'Notices, 0 unread', 'Activity read-all updates the Bell, without resolving a report');
  assert.equal(await evaluate(`document.querySelector('#dashboard-notices-trigger .dash-notification-dot')===null`), true, 'Pending review is not an unread notice');
  assert.match(await evaluate(`document.querySelector('.i47-status').textContent`), /GATES 1/);
  await nav('Activity'); await evaluate(`document.getElementById('activity-tabs-actions').click()`);
  checks.push('Dock opens exact mission in place; Status shortcuts reach canonical actions/active filter; Settings suspends dock; Activity read-all clears shared unread without approval');
  await click('อนุมัติรายงาน'); await drain(); assert.equal(app.orchestrator.tasks.get(review.task_id).state, 'COMPLETED');
  const rejected = await api('/tasks', { description: '[TEAM:TECH] DASHBOARD_REJECT', workflow: { nodes: [{ id: 'review', agent: 'SAGE', dependsOn: [] }] } });
  await wait(`!![...document.querySelectorAll('button')].find(e=>e.getClientRects().length && e.textContent==='ปฏิเสธ / หยุดงาน')`); await click('ปฏิเสธ / หยุดงาน'); await drain(); assert.equal(app.orchestrator.tasks.get(rejected.task_id).state, 'FAILED');
  checks.push('Reading notices never approves; separate confirmed report approve/reject use existing backend guardrails');

  await nav('Missions'); await click('Create mission'); await step('goal'); await input('Mission', '[TEAM:TECH] DASHBOARD_SWARM'); await step('method'); await select('Execution mode', 'swarm');
  assert.equal(await evaluate(`document.querySelectorAll('.dash-builder svg rect').length`), 4); await step('review'); await click('Dispatch swarm');
  await wait(`!document.querySelector('.dash-builder')`); await drain(); assert.equal(tasks().at(-1).swarm.agents.length, 3);
  checks.push('Swarm controls compile fan-out/fan-in; explicit reviewed dispatch retains independent execution and archive');

  await nav('Missions'); await click('Create mission'); await step('goal'); await input('Mission', '[TEAM:TECH] DASHBOARD_SCHEDULE'); await step('method'); await select('Execution mode', 'sequential'); await step('timing'); await select('Dispatch timing', 'recurring');
  await select('Recurrence', 'daily'); await select('Recurrence', 'weekly'); await select('Recurrence', 'interval'); await input('Schedule name', 'Dashboard schedule'); const beforeSchedule = tasks().length;
  await step('review'); await click('Save paused schedule'); await wait(`document.querySelector('[aria-labelledby="schedules-title"]')`);
  assert.equal(app.scheduler.list()[0].state, 'PAUSED'); assert.equal(tasks().length, beforeSchedule);
  await wait(`[...document.querySelectorAll('[aria-label="Saved mission schedules"] button')].some(b=>b.textContent==='Resume schedule' && !b.disabled)`);
  await click('Resume schedule'); await wait(`document.querySelector('[aria-label="Saved mission schedules"]').textContent.includes('ENABLED')`);
  now += 3600001; await app.scheduler.tick(); await drain(); await app.scheduler.tick(); await click('Refresh schedules');
  await wait(`!![...document.querySelectorAll('button')].find(e=>e.textContent==='เปิดภารกิจ / ผลงาน')`); await click('เปิดภารกิจ / ผลงาน');
  await wait(`document.querySelector('[role="main"]').textContent.includes('DASHBOARD_SCHEDULE')`); assert.equal(tasks().at(-1).scheduledRun.run, 1);
  checks.push('Recurring UI supports interval/daily/weekly, saves paused, requires Resume and links latest scheduled run to mission');
  await click('กลับไปภารกิจ'); await wait(`location.hash==='#/missions'`); await click('Schedulesตั้งเวลาซ้ำ · เริ่ม paused เสมอ');
  await wait(`[...document.querySelectorAll('[aria-label="Saved mission schedules"] button')].some(b=>b.textContent==='Pause schedule' && !b.disabled)`);
  await click('Pause schedule'); await wait(`document.querySelector('[aria-label="Saved mission schedules"]').textContent.includes('PAUSED')`); await click('Delete schedule'); await wait(`document.querySelector('[aria-label="Saved mission schedules"]').children.length===0`); await click('Close');
  checks.push('Schedule Pause/Delete retain explicit safeguards through new workspace navigation');

  await nav('Missions'); await click('Create mission'); await step('method'); await select('Execution mode', 'dag');
  await click('Conditional branching example');
  await step('timing'); await select('Dispatch timing', 'now'); await step('method');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Branch fallback"]').value`), 'else');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Join report"]').value`), 'any');
  const conditionalCount = tasks().length;
  await evaluate(`(() => {const e=document.querySelector('[aria-label="Path matched"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'__proto__.id');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await step('review'); assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent==='Dispatch workflow').disabled`), true);
  assert.equal(tasks().length, conditionalCount);
  await step('method'); await click('Conditional branching example'); await step('review');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Conditional routing review"]').textContent.includes('ELSE')`), true);
  await click('Dispatch workflow');
  await wait(`!document.querySelector('.dash-builder')`);
  const conditionalTask = await waitForDispatchedTask(conditionalCount, 'Conditional dispatch');
  await drain();
  assert.equal(conditionalTask.state, 'COMPLETED');
  assert.equal(conditionalTask.workflowNodes.find((node) => node.id === 'fallback').state, 'SKIPPED');
  await nav('Library'); await wait(`document.querySelectorAll('.dash-result-card').length>0`);
  await evaluate(`[...document.querySelectorAll('.dash-result-card')].find(e=>e.textContent.includes('Inspect the actual agent-registry')).click()`);
  await wait(`document.querySelector('article .dash-eyebrow')`); await click('เปิดภารกิจ', '[data-deliverable-detail] a');
  await wait(`document.querySelector('[aria-label="Workflow node status"]').textContent.includes('Condition else not selected')`);
  const exactArtifact = `#/library/task-${conditionalTask.id}`;
  const exactResults = `#/missions/${conditionalTask.id}?tab=results`;
  await evaluate(`document.getElementById('task-detail-steps').focus()`);
  await key('ArrowRight', 'ArrowRight', 39);
  await wait(`location.hash === ${JSON.stringify(exactResults)} && document.activeElement.id==='task-detail-results' && document.querySelector('[data-mission-results] a')`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-mission-results] a')].map(a => a.getAttribute('href'))`), [exactArtifact]);
  await key('Tab');
  assert.equal(await evaluate(`document.activeElement.getAttribute('href')`), exactArtifact);
  await key('Enter', 'Enter', 13);
  await wait(`location.hash === ${JSON.stringify(exactArtifact)} && document.activeElement.id==='dashboard-content' && document.querySelector('[data-deliverable-detail] article')`);
  assert.equal(await evaluate(`document.querySelector('[data-deliverable-detail] a').getAttribute('href')`), `#/missions/${conditionalTask.id}`);
  await evaluate('history.back()');
  await wait(`location.hash === ${JSON.stringify(exactResults)} && document.activeElement.id==='dashboard-content' && document.querySelector('[data-mission-results] a')`);
  await reload();
  await wait(`location.hash === ${JSON.stringify(exactResults)} && document.querySelector('[data-mission-results] a')?.getAttribute('href') === ${JSON.stringify(exactArtifact)}`);
  checks.push('B3 exact mission Results → archive anchor supports keyboard, reciprocal Task ID, Back and deep-link reload');
  await reload();
  await nav('Library'); await wait(`[...document.querySelectorAll('.dash-result-card')].some(e=>e.textContent.includes('Inspect the actual agent-registry'))`);
  await evaluate(`[...document.querySelectorAll('.dash-result-card')].find(e=>e.textContent.includes('Inspect the actual agent-registry')).click()`); await wait(`document.querySelector('[data-deliverable-detail] a')`); await click('เปิดภารกิจ', '[data-deliverable-detail] a');
  await wait(`document.querySelector('[aria-label="Workflow node status"]').textContent.includes('SKIPPED')`);
  checks.push('Conditional builder validates unsafe paths, reviews IF/ELSE and merge; actual tool result skips ELSE and restores decisions after reload');

  await nav('Missions'); await click('Create mission'); await step('method'); await select('Execution mode', 'dag'); await click('Conditional branching example');
  await evaluate(`(() => {const e=document.querySelector('[aria-label="Value matched"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'NO_MATCH');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate(`(() => {const e=document.querySelector('[aria-label="Value fallback"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'NO_MATCH');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const elseTaskCount = tasks().length;
  await step('review'); await click('Dispatch workflow');
  await wait(`!document.querySelector('.dash-builder')`);
  const elseTask = await waitForDispatchedTask(elseTaskCount, 'ELSE dispatch');
  await drain();
  assert.equal(elseTask.state, 'COMPLETED'); assert.equal(elseTask.workflowNodes.find((node) => node.id === 'matched').state, 'SKIPPED');
  assert.equal(elseTask.workflowNodes.find((node) => node.id === 'fallback').state, 'COMPLETED');
  checks.push('Editing typed condition values in browser selects ELSE without running IF; mission still produces final report');
  await nav('Library'); await wait(`document.querySelector('.dash-result-card')`);
  await evaluate(`document.querySelector('.dash-result-card').click()`);
  await wait(`location.hash.startsWith('#/library/')`);
  await click('กลับไปผลงาน'); await wait(`location.hash==='#/library'`);

  const mailedTask = await api('/tasks', { description: '[TEAM:TECH] DASHBOARD_MAIL', workflow: { messaging: true, nodes: [{ id: 'sender', agent: 'NOVA', dependsOn: [] }, { id: 'report', agent: 'BYTE', dependsOn: ['sender'] }] } }); await drain();
  await nav('Activity'); await click('Messages'); await wait(`document.querySelector('.dash-activity').textContent.includes('DASHBOARD_REFERENCE')`); assert.equal(await evaluate(`document.querySelector('.dash-activity img')===null`), true);
  assert.equal(app.orchestrator.tasks.get(mailedTask.task_id).agentMessages[0].status, 'DELIVERED');
  await click('Logs'); await click('MESSAGES'); await wait(`[...document.querySelectorAll('tbody tr')].length>0 && [...document.querySelectorAll('tbody tr')].every(row=>row.textContent.includes('AGENT_MESSAGE'))`);
  checks.push('Messages retain addressed reference/delivery provenance, escape HTML and Logs preserve event filtering');

  await nav('Teams'); await click('รายชื่อทีม');
  await evaluate(`document.querySelector('[data-team-open="tech"]').click()`); await wait(`document.querySelector('[data-team-workspace="tech"]')`);
  await evaluate(`[...document.querySelectorAll('.team-workspace .dash-task-card')].find(e=>e.textContent.includes('DASHBOARD_MAIL')).click()`);
  await wait(`location.hash===${JSON.stringify(`#/missions/${mailedTask.task_id}`)} && document.querySelector('.dash-content').textContent.includes(${JSON.stringify(mailedTask.task_id)})`);
  await evaluate('history.back()'); await wait(`document.querySelector('[data-team-workspace="tech"]')`);
  const linkedArtifact = await evaluate(`document.querySelector('[data-team-artifact]').getAttribute('data-team-artifact')`);
  await evaluate(`document.querySelector('[data-team-artifact]').click()`);
  await wait(`location.hash===${JSON.stringify('#/library/')}+encodeURIComponent(${JSON.stringify(linkedArtifact)}) && document.querySelector('article .dash-eyebrow')`);
  await reload(); await wait(`document.querySelector('article .dash-eyebrow')`);
  assert.equal(await evaluate('location.hash'), `#/library/${encodeURIComponent(linkedArtifact)}`);
  await evaluate(`location.hash='#/teams/tech'`); await wait(`document.querySelector('[data-team-workspace="tech"]')`);
  await click('Enter workspace'); await wait(`location.hash==='#/teams/tech/room' && document.querySelector('.cozy-room')?.dataset.team==='tech'`);
  await evaluate('history.back()'); await wait(`document.querySelector('[data-team-workspace="tech"]')`);
  await click('All teams');
  await nav('Library'); await click('ผลงาน');
  checks.push('Team dossier links the exact mission and archive, archived detail survives reload, room has its own URL and Back restores the team dossier');

  await nav('Library'); await wait(`document.querySelectorAll('.dash-result-card').length>0`); await evaluate(`document.querySelector('.dash-result-card').click()`); await wait(`document.querySelector('article .dash-eyebrow')`); await click('เปิดภารกิจ', '[data-deliverable-detail] a'); await wait(`document.querySelector('[role="main"]').textContent.includes('Task ID:')`);
  checks.push('Archive projection enriches department/task IDs without mutating storage; artifact → mission cross-link works');
  await nav('Teams'); assert.equal(await evaluate(`document.querySelectorAll('.dash-agent-row').length`), 27); await evaluate(`document.querySelector('.dash-agent-row').click()`); await wait(`document.querySelector('[role="dialog"][aria-label^="Agent"]')`); await key('Escape', 'Escape', 27);
  await nav('Settings'); await click('Open settings'); await click('ขีดจำกัด'); await click('ข้อมูล / Backup'); await click('AI Provider'); await key('Escape', 'Escape', 27);
  checks.push('All 27 agents remain reachable with inspector; categorized Settings and dialog Escape/focus restoration work');

  await nav('Analytics'); await wait(`document.querySelector('[aria-label="Analytics summary"]')`);
  const analyticsSnapshot = await api('/analytics?window=all&team=tech&agent=BYTE');
  await select('ช่วงเวลา Analytics', 'all'); await select('ทีม Analytics', 'tech'); await select('Agent Analytics', 'BYTE');
  await wait(`document.querySelectorAll('[aria-label="Agent performance table"] tbody tr').length===1 && document.querySelector('[aria-label="Agent performance table"] tbody tr').textContent.includes('BYTE') && document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='false'`);
  const byteValues = await evaluate(`[...document.querySelector('[aria-label="Agent performance table"] tbody tr').querySelectorAll('td > span:last-child')].map(e=>e.textContent)`);
  assert.equal(Number(byteValues[0]), analyticsSnapshot.rows[0].completed); assert.equal(Number(byteValues[3]), analyticsSnapshot.rows[0].skipped);
  const beforeAnalyticsTasks = tasks().length; await click('รีเฟรชสถิติ'); await wait(`document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='false'`); assert.equal(tasks().length, beforeAnalyticsTasks);
  await evaluate(`document.querySelector('[aria-label="Agent performance table"] button').click()`); await wait(`document.querySelector('[role="dialog"][aria-label^="Agent"]')`); await key('Escape', 'Escape', 27);
  const byteSummary = summarizePerformance(analyticsSnapshot.rows);
  assert.equal(await evaluate(`document.querySelectorAll('.performance-metric strong')[1].textContent`), `${(byteSummary.completion_rate * 100).toFixed(1)}%`);
  assert.equal(await evaluate(`document.querySelector('[data-human-wait]').textContent.includes('n=0')`), true);
  await select('ทีม Analytics', 'human');
  await wait(`document.querySelector('[data-agent="HUMAN"]') && document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='false'`);
  assert.equal(await evaluate(`document.querySelectorAll('.performance-metric strong')[1].textContent`), '—');
  assert.equal(await evaluate(`document.querySelectorAll('.performance-metric strong')[2].textContent`), '—');
  checks.push('B2 measured summary uses AI-only weighted completion/duration, separates HUMAN waits and does not claim pooled percentiles or billing');
  await select('ทีม Analytics', 'tech'); await select('Agent Analytics', 'BYTE');
  await wait(`document.querySelector('[data-agent="BYTE"]') && document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='false'`);
  await evaluate(`window.b2Fetch=window.fetch; window.fetch=(input,options)=>String(input).includes('/api/analytics?') ? Promise.resolve(Response.json({error:'endpoint not found'},{status:404})) : window.b2Fetch(input,options)`);
  await click('รีเฟรชสถิติ'); await wait(`document.querySelector('[aria-labelledby="analytics-title"] [role="alert"]').textContent.includes('ไม่มี Analytics endpoint')`);
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="analytics-title"]').textContent.includes('snapshot ก่อนหน้า') && !!document.querySelector('[data-agent="BYTE"]')`), true);
  await evaluate(`window.fetch=(input,options)=>String(input).includes('/api/reviews?') ? Promise.resolve(Response.json({error:'endpoint not found'},{status:404})) : window.b2Fetch(input,options)`);
  await click('รีเฟรชประวัติ AAR'); await wait(`document.querySelector('[aria-labelledby="aar-history-title"] [role="alert"]').textContent.includes('ไม่มี Reviews endpoint')`);
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="aar-history-title"]').textContent.includes('ยังไม่มี AAR สำหรับ Task ID นี้')`), false);
  await evaluate(`window.fetch=window.b2Fetch; delete window.b2Fetch`);
  await click('รีเฟรชสถิติ'); await click('รีเฟรชประวัติ AAR');
  await wait(`!document.querySelector('[aria-labelledby="analytics-title"] [role="alert"]') && document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='false'`);
  checks.push('B2 missing Analytics/Reviews endpoints are integration errors, never empty data or missing individual reports; refresh retains labelled prior snapshot and recovers');
  await evaluate(`window.b2Fetch=window.fetch;window.b2Release=null;window.fetch=async(input,options)=>{if(!String(input).includes('/api/analytics?'))return window.b2Fetch(input,options);const response=await window.b2Fetch(input,options);const value=await response.json();return new Promise(resolve=>{window.b2Release=()=>resolve(Response.json(value))})}`);
  await click('รีเฟรชสถิติ');
  await wait(`window.b2Release && document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='true'`);
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="analytics-title"]').textContent.includes('กำลังอัปเดต') && !!document.querySelector('[data-agent="BYTE"]')`), true);
  await evaluate(`window.b2Release();window.fetch=window.b2Fetch;delete window.b2Release;delete window.b2Fetch`);
  await wait(`document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='false'`);
  await evaluate(`window.b2Fetch=window.fetch;window.fetch=async(input,options)=>{const response=await window.b2Fetch(input,options);if(!String(input).includes('/api/analytics?'))return response;const value=await response.json();return Response.json({...value,persistence:'degraded'})}`);
  await click('รีเฟรชสถิติ'); await wait(`document.querySelector('[aria-labelledby="analytics-title"] [role="alert"]').textContent.includes('ลงดิสก์ไม่สำเร็จ')`);
  await evaluate(`window.fetch=window.b2Fetch;delete window.b2Fetch`); await click('รีเฟรชสถิติ');
  await wait(`!document.querySelector('[aria-labelledby="analytics-title"] [role="alert"]') && document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='false'`);
  checks.push('B2 slow refresh exposes busy/prior-snapshot state, memory-only persistence warns explicitly, recovery clears warning without dispatch');
  for (const width of [320, 360, 390, 768, 1024, 1440, 1600]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 1024 });
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    const size = await evaluate(`(() => {const content=document.querySelector('.dash-content'),table=document.querySelector('.performance-table'),row=table.querySelector('tbody tr');return {body:document.documentElement.scrollWidth,content:content.scrollWidth,client:content.clientWidth,card: getComputedStyle(row).display,headers:table.querySelectorAll('[role="columnheader"]').length};})()`);
    assert.ok(size.body<=width+1 && size.content<=size.client+1, `B2 analytics contained ${width}: ${JSON.stringify(size)}`);
    assert.equal(size.card, width < 768 ? 'grid' : 'table-row'); assert.equal(size.headers, 12);
    await evaluate(`document.querySelector('.performance-table').focus()`); await key('Tab');
    assert.equal(await evaluate(`document.activeElement===document.querySelector('.performance-table button')`), true);
    await key('Enter', 'Enter', 13); await wait(`document.querySelector('[role="dialog"][aria-label^="Agent"]')`); await key('Escape', 'Escape', 27);
    layouts.push({width,section:'B2 Analytics',...size});
    if (navigationEvidence && [390,1600].includes(width)) {
      await evaluate(`document.querySelector('[aria-labelledby="analytics-title"]').scrollIntoView({block:'start'})`);
      await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      await writeFile(join(navigationEvidence, `analytics-${width}.png`), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      if (width === 390) {
        await evaluate(`document.querySelector('.performance-table').scrollIntoView({block:'start'})`);
        await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
        await writeFile(join(navigationEvidence, 'analytics-mobile-card.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      }
    }
  }
  checks.push('B2 seven widths 320–1600px keep summary/table contained; mobile cards preserve twelve semantic column headers and keyboard inspector access');
  await evaluate(`document.querySelector('.performance-recent button:nth-child(2)').click()`);
  await wait(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('recorded_context')`);
  const directReviewId = await evaluate(`location.hash`); assert.ok(directReviewId.includes('tab=review'));
  assert.equal(tasks().length, beforeAnalyticsTasks);
  await nav('Analytics'); await wait(`document.querySelector('.performance-recent')`);
  checks.push('B2 recent mission evidence links directly to its retained AAR using the existing route, with no task dispatch');
  await evaluate(`[...document.querySelectorAll('[aria-labelledby="analytics-title"] button')].find(e=>e.textContent==='เปิดภารกิจ').click()`); await wait(`document.querySelector('[role="main"]').textContent.includes('Task ID:')`);
  checks.push('Analytics team/agent/time filters match backend measured counts, refresh never dispatches, inspector and mission provenance links work');
  await click('After Action Review'); await wait(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('recorded_context')`);
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('ข้อมูลที่ขาด / ข้อจำกัด')`), true);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="AAR execution evidence"]')`), true);
  const beforeAarReads = tasks().length; await click('รีเฟรช AAR'); await wait(`document.querySelector('[aria-labelledby="aar-title"]').getAttribute('aria-busy')==='false'`); assert.equal(tasks().length, beforeAarReads);
  await nav('Analytics'); await wait(`document.querySelector('[aria-labelledby="aar-history-title"]')`); await select('ผลภารกิจ AAR', 'FAILED');
  await wait(`document.querySelector('[aria-labelledby="aar-history-title"]').getAttribute('aria-busy')==='false' && [...document.querySelectorAll('[aria-labelledby="aar-history-title"] li')].every(e=>e.textContent.includes('FAILED'))`);
  await evaluate(`[...document.querySelectorAll('[aria-labelledby="aar-history-title"] button')].find(e=>e.textContent==='อ่าน AAR').click()`);
  await wait(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('Stop:')`);
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('FAILED')`), true);
  checks.push('AAR success/failure reports expose execution, routing, waits, missing evidence and read-only recommendations; refresh never dispatches');

  const aarSample = tasks().find(task=>task.workflowNodes?.some(node=>node.state==='SKIPPED'));
  const aarEvidence = await api(`/reviews/${aarSample.id}`); assert.ok(aarEvidence.report.context.nodes.some(node=>node.condition?.outcome==='not_selected'));
  for (let index=0; index<26; index+=1) await app.analytics.append({ task_id:`aar-legacy-${index}`, started_at:new Date().toISOString(), finished_at:new Date().toISOString(), duration_ms:0, department:'tech', mode:'dag', state:'COMPLETED', executions:[{...createExecutionObservation('execution-1','BYTE','work'),state:'COMPLETED'}] });
  await nav('Analytics'); await wait(`document.querySelector('[aria-labelledby="aar-history-title"]')`);
  await select('ผลภารกิจ AAR','all'); await click('รีเฟรชประวัติ AAR');
  await wait(`document.querySelectorAll('[aria-labelledby="aar-history-title"] li').length===25 && [...document.querySelectorAll('[aria-labelledby="aar-history-title"] button')].some(b=>b.textContent==='AAR ถัดไป' && !b.disabled)`);
  await click('AAR ถัดไป'); await wait(`document.querySelector('[aria-labelledby="aar-history-title"]').getAttribute('aria-busy')==='false' && ![...document.querySelectorAll('[aria-labelledby="aar-history-title"] button')].find(e=>e.textContent==='AAR ก่อนหน้า').disabled`);
  await click('AAR ก่อนหน้า'); await wait(`document.querySelector('[aria-labelledby="aar-history-title"]').getAttribute('aria-busy')==='false' && document.querySelector('[aria-labelledby="aar-history-title"] li').textContent.includes('aar-legacy-25')`);
  await evaluate(`[...document.querySelectorAll('[aria-labelledby="aar-history-title"] button')].find(e=>e.textContent==='อ่าน AAR').click()`);
  await wait(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('legacy_metrics_only') && document.querySelector('.dash-content').textContent.includes('ภารกิจนี้ไม่อยู่ใน runtime แล้ว')`);
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('Legacy analytics:')`), true);
  await evaluate(`window.aarOriginalFetch=window.fetch; window.fetch=(input,options)=>String(input).includes('/api/reviews/') ? Promise.resolve(Response.json({error:'Simulated read failure'},{status:503})) : window.aarOriginalFetch(input,options)`);
  await click('รีเฟรช AAR'); await wait(`document.querySelector('[aria-labelledby="aar-title"] [role="alert"]')`);
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('snapshot ก่อนหน้า')`),true);
  await evaluate(`window.fetch=(input,options)=>String(input).includes('/api/reviews/') ? Promise.resolve(Response.json({error:'not retained'},{status:404})) : window.aarOriginalFetch(input,options)`);
  await click('รีเฟรช AAR'); await wait(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('ยังไม่มี AAR สำหรับ Task ID นี้')`);
  await evaluate(`window.fetch=(input,options)=>String(input).includes('/api/reviews/') ? Promise.resolve(Response.json({error:'endpoint not found'},{status:404})) : window.aarOriginalFetch(input,options)`);
  await click('รีเฟรช AAR'); await wait(`document.querySelector('[aria-labelledby="aar-title"] [role="alert"]').textContent.includes('ไม่มี Reviews endpoint')`);
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('ยังไม่มี AAR สำหรับ Task ID นี้')`), false);
  await evaluate(`window.fetch=window.aarOriginalFetch; delete window.aarOriginalFetch`); await click('รีเฟรช AAR'); await wait(`document.querySelector('[aria-labelledby="aar-title"]').getAttribute('aria-busy')==='false' && !document.querySelector('[aria-labelledby="aar-title"] [role="alert"]')`);
  checks.push('AAR read failure keeps explicitly labelled prior snapshot; unavailable record has explicit missing-evidence message and refresh recovers');
  const aarWrite = app.analytics.storage.atomicWrite.bind(app.analytics.storage);
  app.analytics.storage.atomicWrite = async()=>{throw new Error('Simulated AAR disk failure');};
  await app.analytics.append({task_id:'aar-degraded',started_at:new Date().toISOString(),finished_at:new Date().toISOString(),duration_ms:0,department:'tech',mode:'dag',state:'FAILED',executions:[]}).catch(()=>{});
  await click('รีเฟรช AAR'); await wait(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('AAR persistence degraded')`);
  app.analytics.storage.atomicWrite = aarWrite; await app.analytics.persist(); await click('รีเฟรช AAR'); await wait(`document.querySelector('[aria-labelledby="aar-title"]').getAttribute('aria-busy')==='false' && !document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('AAR persistence degraded')`);
  checks.push('AAR explicitly warns on memory-only degraded persistence and clears warning after actual disk recovery');
  await reload();
  await nav('Analytics'); await wait(`document.querySelector('[aria-labelledby="aar-history-title"] li')`);
  await evaluate(`[...document.querySelectorAll('[aria-labelledby="aar-history-title"] button')].find(e=>e.textContent==='อ่าน AAR').click()`); await wait(`document.querySelector('[aria-labelledby="aar-title"]').textContent.includes('aar-degraded')`);
  checks.push('AAR history filters/paginates retained records; legacy explicitly lacks context; historical reports remain readable without runtime after browser reload');
  await nav('Teams'); await click('รายชื่อทีม'); await nav('Analytics');
  await wait(`document.getElementById('analytics-title')`); await select('ทีม Analytics', 'command'); await select('Agent Analytics', 'TAEC');
  await wait(`document.querySelector('[aria-labelledby="analytics-title"]').textContent.includes('ยังไม่มีข้อมูลที่ตรงตัวกรอง') && document.querySelector('[aria-labelledby="analytics-title"]').getAttribute('aria-busy')==='false' && document.querySelectorAll('[aria-label="Agent performance table"] tbody tr').length===1 && document.querySelector('[aria-label="Agent performance table"] tbody tr').dataset.agent==='TAEC'`);
  await select('ทีม Analytics', 'all'); await nav('Teams');

  await app.storage.put('deliverables', { ...app.storage.get('deliverables').data, tech: [...app.storage.get('deliverables').data.tech, { id: 'task-unavailable-history', title: 'Historical archived mission', summary: 'Archive remains; runtime is unavailable', lead: 'BYTE', status: 'REAL_LLM' }] }, app.storage.get('deliverables').revision);
  await reload(); await nav('Library'); await wait(`document.querySelector('.dash-content').textContent.includes('Historical archived mission')`);
  await evaluate(`[...document.querySelectorAll('.dash-result-card')].find(e=>e.textContent.includes('Historical archived mission')).click()`); await wait(`document.querySelector('[data-deliverable-detail] a')`); await click('เปิดภารกิจ', '[data-deliverable-detail] a');
  await wait(`document.querySelector('.dash-content').textContent.includes('ภารกิจนี้ไม่อยู่ใน runtime แล้ว')`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-mission-results] a')].map(a=>a.getAttribute('href'))`), ['#/library/task-unavailable-history']);
  await evaluate(`document.querySelector('[data-mission-results] a').click()`);
  await wait(`document.querySelector('[data-deliverable-detail] article')?.textContent.includes('Archive remains; runtime is unavailable')`);
  checks.push('Historical artifact with missing runtime opens explicit unavailable state and links back to the exact preserved archive');

  const missingArtifactHash = '#/library/b3-missing-artifact';
  const beforeB3Read = app.storage.get('deliverables');
  await evaluate(`location.hash=${JSON.stringify(missingArtifactHash)}`);
  await wait(`document.querySelector('[data-deliverable-detail]')?.textContent.includes('ไม่พบผลงานนี้')`);
  holdDeliverableRead = true;
  await reload();
  await wait(`document.querySelector('[data-deliverable-detail] [role="status"]') && !document.querySelector('[data-deliverable-detail] .dash-empty')`);
  for (let i = 0; i < 40 && !deliverableRead; i += 1) await delay(50);
  assert.ok(deliverableRead, 'Fixture must hold the archive read');
  holdDeliverableRead = false;
  await cdp('Fetch.fulfillRequest', { requestId: deliverableRead, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from('{}').toString('base64') });
  await wait(`document.querySelector('[data-deliverable-detail] [role="alert"]') && !document.querySelector('[data-deliverable-detail] .dash-empty')`);
  await evaluate(`(async()=>{const {persistence}=await import('/src/lib/persistenceClient.js'); await persistence.sync();})()`);
  await wait(`location.hash===${JSON.stringify(missingArtifactHash)} && document.querySelector('[data-deliverable-detail] .dash-empty') && !document.querySelector('[data-deliverable-detail] article')`);
  assert.deepEqual(app.storage.get('deliverables'), beforeB3Read);
  checks.push('B3 cold missing-artifact link shows loading → read failure → confirmed absence after recovery, with no redirect or archive write');

  for (const { width, height, mobile } of [
    { width: 1600, height: 1000, mobile: false }, { width: 1024, height: 768, mobile: false },
    { width: 768, height: 1024, mobile: true }, { width: 390, height: 844, mobile: true },
    { width: 360, height: 740, mobile: true }
  ]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }); await delay(100);
    for (const section of ['Overview', 'Missions', 'Library', 'Activity', 'Teams', 'Settings']) {

      await nav(section); const size = await evaluate(`({body:document.documentElement.scrollWidth,viewport:innerWidth,content:document.querySelector('.dash-content').scrollWidth,client:document.querySelector('.dash-content').clientWidth})`);
      if (section === 'Overview' && navigationEvidence && [1600, 390].includes(width)) {
        await evaluate(`document.querySelector('.dash-content').scrollTop=0`);
        await writeFile(join(navigationEvidence, `overview-after-${width}.png`), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      }
      layouts.push({ width, height, section, ...size }); assert.ok(size.body <= width + 1 && size.content <= size.client + 1, `No page overflow ${width} ${section}: ${JSON.stringify(size)}`);
      assert.equal(await evaluate(`document.querySelectorAll('.dash-shell .lucide-bell').length`), 1);
      const bellTarget = await evaluate(`(() => {const b=document.getElementById('dashboard-notices-trigger'),r=b.getBoundingClientRect();return r.width>=44 && r.height>=44 && b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
      assert.equal(bellTarget, true, `Single Bell has unobstructed 44px target ${width} ${section}`);
      await physicalClick('#dashboard-notices-trigger');
      await wait(`document.getElementById('overview-notices-panel')`);
      const noticeLayout = await evaluate(`(() => {const p=document.getElementById('overview-notices-panel'),r=p.getBoundingClientRect(),h=document.querySelector('.dash-topbar').getBoundingClientRect(),n=document.querySelector('.i47-copyright').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,headerBottom:h.bottom,navTop:n.top,scroll:p.scrollWidth,client:p.clientWidth,count:p.querySelectorAll('.overview-notice-list > li').length};})()`);
      assert.ok(noticeLayout.left>=0 && noticeLayout.right<=width && noticeLayout.top>=noticeLayout.headerBottom && noticeLayout.bottom<=height && (width>=1024 || noticeLayout.bottom<=noticeLayout.navTop) && noticeLayout.scroll<=noticeLayout.client+1 && noticeLayout.count<=5, `Topbar preview contained ${width} ${section}: ${JSON.stringify(noticeLayout)}`);
      await evaluate(`document.querySelector('.overview-view-all').scrollIntoView({block:'nearest'})`);
      await physicalClick('.overview-view-all');
      await wait(`document.getElementById('activity-tabs-notices').getAttribute('aria-selected')==='true' && !document.getElementById('overview-notices-panel')`);

      await nav(section);
      layouts.push({width,section:`${section} Bell`,...noticeLayout});
      if (section === 'Overview') {
        await delay(80);
        const dockLayout = await evaluate(`(() => {const d=document.querySelector('.overview-dock').getBoundingClientRect(),c=document.querySelector('.dash-content').getBoundingClientRect(),n=document.querySelector('.i47-copyright').getBoundingClientRect();return {left:d.left,right:d.right,top:d.top,bottom:d.bottom,contentBottom:c.bottom,navTop:n.top,targets:[...document.querySelectorAll('.overview-dock > button')].every(e=>{const r=e.getBoundingClientRect();return r.width>=44 && r.height>=44 && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})};})()`);
        assert.ok(dockLayout.left>=0 && dockLayout.right<=width && dockLayout.bottom<=height && dockLayout.top>=dockLayout.contentBottom && dockLayout.targets && (width>=1024 || dockLayout.bottom<=dockLayout.navTop), `Dock reserved lane and physical hit targets ${width}: ${JSON.stringify(dockLayout)}`);
        await physicalClick('#dashboard-notices-trigger');
        await wait(`document.getElementById('overview-notices-panel')`);
        const dockPanelLayout = await evaluate(`(() => {const p=document.getElementById('overview-notices-panel'),r=p.getBoundingClientRect(),d=document.querySelector('.overview-dock').getBoundingClientRect(),h=document.querySelector('.dash-topbar').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,headerBottom:h.bottom,dockTop:d.top,scroll:p.scrollWidth,client:p.clientWidth,count:p.querySelectorAll('.overview-notice-list > li').length};})()`);
        assert.ok(dockPanelLayout.left>=0 && dockPanelLayout.right<=width && dockPanelLayout.top>=dockPanelLayout.headerBottom && dockPanelLayout.bottom<=dockPanelLayout.dockTop && dockPanelLayout.height>=100 && dockPanelLayout.scroll<=dockPanelLayout.client+1 && dockPanelLayout.count<=5, `Scrollable Notices panel contained ${width}: ${JSON.stringify(dockPanelLayout)}`);
        await evaluate(`document.querySelector('.overview-view-all').scrollIntoView({block:'nearest'})`);
        const viewAllHit = await evaluate(`(() => {const e=document.querySelector('.overview-view-all'),r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
        assert.equal(viewAllHit, true, `Panel bottom remains scroll-reachable at ${width}`);
        await evaluate(`document.querySelector('.overview-dock-panel').scrollTop=0`);
        layouts.push({width,section:'Overview dock',...dockLayout,panel:dockPanelLayout});
        if (width===390) await writeFile(screenshotPath('overview-a-notices-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
        await key('Escape','Escape',27);
        assert.equal(await evaluate(`document.activeElement.id`), 'dashboard-notices-trigger');
        if (width===390) {
          await writeFile(screenshotPath('overview-a-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
          await openCore(); await delay(260);
          await physicalClick('[data-home-view="realm"]');
          await wait(`document.getElementById('realm-world-title')`);
          assert.equal(await evaluate(`document.querySelector('.overview-dock')===null`), true, 'Realm selector does not show the deck dock');
          await click('Open Command Deck', '[data-realm-mode]');
          await wait(`document.querySelector('.overview-dock') && document.querySelector('.guild-world')`);
        }
        assert.equal(await evaluate(`[...document.querySelectorAll('.guild-world-zoom button,.guild-motion-button,.guild-room-select')].filter(e=>e.getClientRects().length).every(e=>{const b=e.getBoundingClientRect();return b.height>=44 && b.width>=44;})`), true, `Map HUD targets at least 44 CSS pixels at ${width}`);
        const contained = await evaluate(`(() => {const r=document.querySelector('.guild-world').getBoundingClientRect();return [...document.querySelectorAll('.guild-island')].every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left && b.right<=r.right && b.top>=r.top && b.bottom<=r.bottom;});})()`);
        assert.equal(contained, true, `All 8 guilds fit inside world at ${width}`);
        await select('เข้าห้องทีมจากแผนที่', 'command');
        await wait(`document.querySelector('.cozy-room-scene') && document.querySelector('.room-console-panel')`);
        const roomLayout = await evaluate(`(() => {const stage=document.querySelector('.cozy-room').getBoundingClientRect(),panel=document.querySelector('.room-console-panel').getBoundingClientRect(),input=document.querySelector('.room-console-panel input').getBoundingClientRect();return {body:document.documentElement.scrollWidth,content:document.querySelector('.dash-content').scrollWidth,client:document.querySelector('.dash-content').clientWidth,panelInside:panel.left>=stage.left && panel.right<=stage.right && panel.top>=stage.top && panel.bottom<=stage.bottom,inputInside:input.left>=panel.left && input.right<=panel.right,panelHeight:panel.height};})()`);
        assert.ok(roomLayout.body<=width+1 && roomLayout.content<=roomLayout.client+1 && roomLayout.panelInside && roomLayout.inputInside && roomLayout.panelHeight>=200, `Room console contained and usable ${width}: ${JSON.stringify(roomLayout)}`);
        layouts.push({width,section:'Cozy room console',...roomLayout});
        await nav('Overview');
        if (width === 360) {
          await evaluate(`(() => {const e=document.querySelector('[aria-label="เข้าห้องทีมจากแผนที่"]');e.value='tech';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
          await wait(`document.querySelector('.guild-desk')`);
          await physicalClick('.room-console-toggle');
          await physicalClick('[aria-label="จัดห้องให้พอดี"]');
          await select('เปลี่ยนห้องทีม', 'design'); await wait(`document.querySelector('.cozy-room').dataset.team==='design'`);
          await select('เลือก Agent ในห้อง', 'PIXEL'); await wait(`document.querySelector('[role="dialog"][aria-label^="Agent"]')`); await key('Escape', 'Escape', 27);
          await physicalClick('[aria-label="พักเอฟเฟกต์ห้อง"]');
          await evaluate(`document.querySelector('.cozy-room').scrollIntoView({block:'start'})`);
          await writeFile(screenshotPath('cozy-room-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
          await writeFile(screenshotPath('fantasy-room-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
          const roomBounds = await evaluate(`({body:document.documentElement.scrollWidth,content:document.querySelector('.dash-content').scrollWidth,client:document.querySelector('.dash-content').clientWidth})`);
          assert.ok(roomBounds.body<=width+1 && roomBounds.content<=roomBounds.client+1, 'Cozy mobile room controls and console are contained');
          layouts.push({ width, section: 'Cozy room', ...roomBounds });
          await nav('Overview');
        }
      }
      if (width < 1024) {
        const bounds = await evaluate(`(() => {const box=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();return {nav:box('.i47-core-bar'),main:box('.dash-content'),header:box('.dash-topbar')};})()`);
        const { nav: railBox, main, header } = bounds;
        const separate = width <= 760 ? railBox.bottom === main.top && railBox.width === width && main.width === width : railBox.right === main.left;
        assert.ok(separate && railBox.left>=0 && railBox.top===header.bottom && main.top>=header.bottom && main.bottom<=height+1, `Closed navigation and content occupy separate tracks at ${width}px: ${JSON.stringify(bounds)}`);
      }
      if (width === 390 && section === 'Overview') {
        await delay(5600);
        await evaluate(`document.querySelector('.guild-world').scrollIntoView({block:'start'})`);
        await writeFile(join(tmpdir(), 'maoc-dashboard-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
        await writeFile(screenshotPath('cozy-overview-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
        await writeFile(screenshotPath('fantasy-overview-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      }
    }
    await nav('Library'); await click('บันทึกและความเชื่อมโยง');
    let noteSize = await evaluate(`({body:document.documentElement.scrollWidth,content:document.querySelector('.dash-content').scrollWidth,client:document.querySelector('.dash-content').clientWidth})`);
    if (noteSize.content > noteSize.client + 1) noteSize.offenders = await evaluate(`(() => {const r=document.querySelector('.dash-content').getBoundingClientRect();return [...document.querySelectorAll('.dash-knowledge-host *')].filter(e=>e.getClientRects().length && e.getBoundingClientRect().right>r.right+1).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,80),width:e.getBoundingClientRect().width}));})()`);
    assert.ok(noteSize.body <= width + 1 && noteSize.content <= noteSize.client + 1, `Notes contained ${width}: ${JSON.stringify(noteSize)}`);
    if (width === 390) await writeFile(join(tmpdir(), 'maoc-dashboard-notes-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await click('ผลงาน');
    await click('Create mission'); await step('method'); await select('Execution mode', 'dag'); await click('Conditional branching example');
    let size = await evaluate(`({scroll:document.querySelector('.dash-builder').scrollWidth,client:document.querySelector('.dash-builder').clientWidth})`); assert.ok(size.scroll <= size.client + 1, `Builder contained ${width}`); await click('Close');
    if (width < 1024) { await openCore(); assert.equal(await evaluate(`getComputedStyle(document.querySelector('.i47-categories')).display`), 'grid'); } await nav('Teams');
    await click('รายชื่อทีม');
    await evaluate(`document.querySelector('[data-team-open="tech"]').click()`); await wait(`document.querySelector('[data-team-workspace="tech"]')`);
    const dossierSize = await evaluate(`({body:document.documentElement.scrollWidth,content:document.querySelector('.dash-content').scrollWidth,client:document.querySelector('.dash-content').clientWidth})`);
    assert.ok(dossierSize.body<=width+1 && dossierSize.content<=dossierSize.client+1, `Team dossier contained ${width}: ${JSON.stringify(dossierSize)}`);
    layouts.push({width,section:'Team dossier',...dossierSize});
    if (width === 390 && navigationEvidence) await writeFile(join(navigationEvidence, 'team-workspace-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await evaluate(`document.querySelector('.team-workspace .dash-agent-row').focus()`); await key('Enter', 'Enter', 13); await wait(`document.querySelector('[role="dialog"][aria-label^="Agent"]')`); await key('Escape', 'Escape', 27);
    await click('All teams');
    await nav('Analytics'); await wait(`document.querySelector('[aria-label="Agent performance table"]')`);
    const analyticsSize = await evaluate(`({body:document.documentElement.scrollWidth,content:document.querySelector('.dash-content').scrollWidth,client:document.querySelector('.dash-content').clientWidth,table:document.querySelector('[aria-label="Agent performance table"]').scrollWidth,tableClient:document.querySelector('[aria-label="Agent performance table"]').clientWidth})`);
    layouts.push({ width, section: 'Analytics', ...analyticsSize }); assert.ok(analyticsSize.body<=width+1 && analyticsSize.content<=analyticsSize.client+1, `Analytics overflow contained ${width}: ${JSON.stringify(analyticsSize)}`);
    await wait(`document.querySelector('[aria-labelledby="aar-history-title"] li')`);
    await evaluate(`[...document.querySelectorAll('[aria-labelledby="aar-history-title"] button')].find(e=>e.textContent==='อ่าน AAR').click()`); await wait(`document.querySelector('[aria-label="AAR execution evidence"]')`);
    const aarSize = await evaluate(`({body:document.documentElement.scrollWidth,content:document.querySelector('.dash-content').scrollWidth,client:document.querySelector('.dash-content').clientWidth})`);
    layouts.push({width,section:'AAR',...aarSize}); assert.ok(aarSize.body<=width+1 && aarSize.content<=aarSize.client+1,`AAR overflow contained ${width}: ${JSON.stringify(aarSize)}`);
    await nav('Teams');
    await click('Spatial Map'); await click('Topology'); await click('ห้องทำงาน');
    size = await evaluate(`({body:document.documentElement.scrollWidth,viewport:innerWidth})`); assert.ok(size.body <= width + 1, `Spatial page contained ${width}`);
    await nav('Settings');
    await click('Open settings'); size = await evaluate(`({scroll:document.querySelector('.dash-settings-dialog').scrollWidth,client:document.querySelector('.dash-settings-dialog').clientWidth})`); assert.ok(size.scroll <= size.client + 1, `Settings contained ${width}`); await key('Escape', 'Escape', 27);
  }
  checks.push('Desktop 1600/1024, tablet 768, mobile 390/360: navigation, core pages, Builder, Settings and spatial page overflow contained');
  checks.push('Single topbar Bell on all six pages at five widths has unobstructed 44px target, contained scrollable preview and working View All; Status-only footer avoids content/mobile navigation and Escape restores Bell focus');
  checks.push('Cozy mobile room supports explicit room/Agent selection, real Fit/console/motion clicks and contained controls at 360px');
  checks.push('Cozy room console/input stay inside the scene at all five widths with at least 200px panel height');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
  await nav('Overview'); await evaluate(`document.querySelector('.dash-content').scrollTop=0`);
  const compactOverview = await evaluate(`(() => {const c=document.querySelector('.dash-content');return {body:document.documentElement.scrollWidth,client:c.clientWidth,content:c.scrollWidth,cards:[...document.querySelectorAll('.dash-metric')].map(e=>({height:e.getBoundingClientRect().height,scroll:e.scrollWidth,client:e.clientWidth}))};})()`);
  assert.ok(compactOverview.body<=320 && compactOverview.content<=compactOverview.client+1 && compactOverview.cards.every(card=>card.height>=120 && card.scroll<=card.client+1), JSON.stringify(compactOverview));
  const compactDock = await evaluate(`(() => {const b=document.getElementById('overview-status-trigger'),r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right,hit:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})()`);
  assert.ok(compactDock.left>=0 && compactDock.right<=320 && compactDock.width<=220 && compactDock.height>=44 && compactDock.hit, JSON.stringify(compactDock));
  await openCore(); await delay(260); await physicalClick('[data-home-view="realm"]');
  await physicalClick('[data-realm-mode="station"]');
  await wait(`location.hash==='#/home/station' && !document.getElementById('realm-world-title') && document.querySelector('.guild-world')`);
  const compactPage = await evaluate(workspaceLayout);
  await openCore(); await delay(260);
  const compactMenu = await evaluate(coreMenuLayout);
  const rail = await evaluate(`[...document.querySelectorAll('.i47-category > button')].map(b=>{const r=b.getBoundingClientRect();return [r.x,r.y,r.right,r.width,r.height]})`);
  assert.ok(rail.length===5 && rail.every(([x,y,right,w,h],i)=>x>=compactMenu.left && x===rail[0][0] && (!i || y>=rail[i-1][1]+rail[i-1][4]) && right<=compactMenu.right && w>=44 && h>=44), JSON.stringify(rail));
  assert.ok(compactMenu.left>=compactMenu.railLeft && compactMenu.right<=compactMenu.railRight && compactMenu.top===compactMenu.railBottom && compactMenu.railRight<=320 && compactMenu.bottom<=740 && compactMenu.scroll<=compactMenu.client+1 && compactMenu.documentWidth<=320, `Home panel fits its mobile top bar: ${JSON.stringify(compactMenu)}`);
  assert.deepEqual(await evaluate(workspaceLayout), compactPage, 'Opening mobile navigation does not move the 2.5D page');
  assert.equal(await evaluate(`(() => {const m=document.getElementById('i47-core-menu').getBoundingClientRect(),t=document.getElementById('i47-core-trigger').getBoundingClientRect(),list=[...document.querySelectorAll('#i47-core-home button')].map(e=>e.getBoundingClientRect());return m.top>=t.bottom && m.left===t.left && list.every((e,i)=>e.left>t.left && e.right<=m.right && e.width>=44 && e.height>=44 && (!i || e.top>=list[i-1].bottom));})()`), true, 'Mobile destinations stack under their category inside the top-bar panel');
  if (navigationEvidence) await writeFile(screenshotPath('realm-home-menu-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  assert.equal(await evaluate(`document.querySelectorAll('.guild-island').length`), 8);
  await key('Escape', 'Escape', 27);
  layouts.push({width:320,section:'Guild Overview',...compactOverview,menu:compactMenu,dock:compactDock});
  checks.push('320px guild Overview keeps four readable cards and one compact task-status target contained; Home submenu fits and 2.5D Station receives a physical click');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await nav('Overview'); await select('เข้าห้องทีมจากแผนที่','command'); await wait(`document.querySelector('.cozy-room')?.dataset.motion==='off'`);
  await physicalClick('.room-console-toggle');
  await physicalClick('[aria-label="พักเอฟเฟกต์ห้อง"]');
  assert.equal(await evaluate(`document.querySelector('.cozy-room').dataset.motion`),'on');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.cozy-room .pixel-agent-body')).animationDuration`),'4s');
  await click('ตามระบบ'); await wait(`document.querySelector('.cozy-room').dataset.motion==='off'`);
  await nav('Overview');
  checks.push('Room motion defaults to OS Reduce motion, explicit opt-in restores real animation duration and system reset pauses again');
  assert.equal(await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`), true);
  await nav('Overview'); await wait(`document.querySelector('.guild-world').dataset.motion==='off'`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="พักเอฟเฟกต์แผนที่"]').disabled`), false);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).animationPlayState`), 'paused');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guild-astral-mist')).animationPlayState`), 'paused');
  const taskCountBeforeMotion = tasks().length;
  await evaluate(`document.querySelector('[aria-label="พักเอฟเฟกต์แผนที่"]').scrollIntoView({block:'center'})`);
  const motionButton = await evaluate(`(() => {const b=document.querySelector('[aria-label="พักเอฟเฟกต์แผนที่"]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`);
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...motionButton, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...motionButton, button: 'left', clickCount: 1 });
  await wait(`document.querySelector('.guild-world').dataset.motion==='on'`);
  assert.equal(await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`), true, 'User override does not change OS preference');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).animationDuration`), '6s');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).animationIterationCount`), 'infinite');
  assert.ok(Number.parseFloat(await evaluate(`getComputedStyle(document.querySelector('.dash-topbar')).animationDuration`)) < .001, 'Override is scoped; unrelated UI keeps OS reduced motion');
  const overrideOffset = await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).strokeDashoffset`);
  const overrideScan = await evaluate(`getComputedStyle(document.querySelector('.signal-sweep')).strokeDashoffset`);
  await delay(200);
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).strokeDashoffset`), overrideOffset);
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.signal-sweep')).strokeDashoffset`), overrideScan);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate(`document.querySelector('.guild-world').dataset.motion`), 'on', 'Explicit user choice survives OS preference changes while mounted');
  await evaluate(`document.querySelector('[aria-label="พักเอฟเฟกต์แผนที่"]').click()`);
  const overridePaused = await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).strokeDashoffset`);
  await delay(150);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.guild-link-packet')).strokeDashoffset`), overridePaused);
  await click('ตามระบบ');
  assert.equal(await evaluate(`document.querySelector('.guild-world').dataset.motion`), 'off');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await wait(`document.querySelector('.guild-world').dataset.motion==='on'`);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await wait(`document.querySelector('.guild-world').dataset.motion==='off'`);
  checks.push('OS Reduce motion defaults to paused; user can enable moving map packets/scans, pause them, or restore automatic OS tracking');

  await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await nav('Teams'); await click('Topology');
  assert.equal(await evaluate(`document.querySelector('.topology-world').dataset.motion`), 'off');
  await click('DEMO FLOW: OFF · ไม่ใช่งานจริง');
  await wait(`document.querySelector('[data-demo-step]')`);
  assert.equal(await evaluate(`document.querySelector('.topology-world').dataset.motion`), 'on');
  const demoStep = await evaluate(`document.querySelector('[data-demo-step]').dataset.demoStep`);
  const demoOffset = await evaluate(`getComputedStyle(document.querySelector('.topo-dash-flow')).strokeDashoffset`);
  await delay(200);
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.topo-dash-flow')).strokeDashoffset`), demoOffset);
  await wait(`document.querySelector('[data-demo-step]').dataset.demoStep!==${JSON.stringify(demoStep)}`);
  await evaluate(`document.querySelector('[aria-label="พักเอฟเฟกต์ Topology"]').click()`);
  const demoPaused = await evaluate(`getComputedStyle(document.querySelector('.topo-dash-flow')).strokeDashoffset`);
  const staticStep = await evaluate(`document.querySelector('[data-demo-step]').dataset.demoStep`);
  await delay(200);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.topo-dash-flow')).strokeDashoffset`), demoPaused);
  await wait(`document.querySelector('[data-demo-step]').dataset.demoStep!==${JSON.stringify(staticStep)}`);
  await click('ตามระบบ');
  assert.equal(await evaluate(`document.querySelector('.topology-world').dataset.motion`), 'off');
  await click('DEMO FLOW: ON · ไม่ใช่งานจริง');
  assert.equal(await evaluate(`document.querySelector('[data-demo-step]')===null`), true);
  assert.equal(tasks().length, taskCountBeforeMotion, 'Motion and demo controls never dispatch a mission');
  checks.push('With OS Reduce motion enabled, Demo Flow starts/stops and advances; scoped animation override works, paused effects retain static step updates, no missions dispatched');
  await nav('Overview');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', modifiers: 2, windowsVirtualKeyCode: 75 });
  assert.equal(await evaluate(`document.activeElement===document.querySelector('.dash-search input')`), true);
  checks.push('Reduced-motion preference recognized and Ctrl+K focuses shared search');
  // A fresh page exercises the other AAR entry without loading Analytics first.
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Network.enable'); await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  await nav('Overview'); await reload();
  await nav('Library'); await wait(`document.querySelector('.dash-result-card')`);
  await evaluate(`document.querySelector('.dash-result-card').click()`); await wait(`document.querySelector('article .dash-eyebrow')`);
  holdChunk = 'AfterActionReview';
  await click('เปิดภารกิจ', '[data-deliverable-detail] a');
  if (await evaluate(`!!document.getElementById('task-detail-review')`)) await click('After Action Review');
  await wait(`document.querySelector('[data-lazy-state="loading"]')`);
  await waitForHeldChunk();
  assert.deepEqual(await evaluate(`performance.getEntriesByType('resource').filter(e=>/PerformanceDashboard/.test(e.name)).map(e=>e.name)`), []);
  await releaseChunks(); await wait(`document.querySelector('[aria-labelledby="aar-title"]')`);
  checks.push('Cold mission-detail AAR loads independently of Analytics and retains the requested mission');
  for (const chunk of ['TopologyTreeView', 'WorkflowBuilderModal']) {
    await nav('Overview'); await reload();
    holdChunk = chunk;
    if (chunk === 'TopologyTreeView') { await nav('Teams'); await click('Topology'); }
    else { await evaluate(`window.builderOpener=[...document.querySelectorAll('button')].find(e=>e.getClientRects().length && e.textContent.trim()==='Create mission');window.builderOpener.focus()`); await click('Create mission'); }
    await wait(`document.querySelector('[data-lazy-state="loading"]')`);
    await waitForHeldChunk(); expectedChunkFailure = chunk; holdChunk = '';
    for (const requestId of heldChunks.keys()) await cdp('Fetch.failRequest', { requestId, errorReason: 'Failed' });
    heldChunks.clear(); await wait(`document.querySelector('[data-lazy-state="error"]')`);
    assert.equal(await evaluate(`!!document.querySelector('.i47-categories')`), true);
    if (chunk === 'WorkflowBuilderModal') {
      assert.equal(await evaluate(`document.querySelector('.dash-builder').contains(document.activeElement)`), true);
      await key('Escape', 'Escape', 27); await wait(`!document.querySelector('.dash-builder')`);
      assert.equal(await evaluate(`document.activeElement===window.builderOpener`), true);
      await click('Create mission'); await wait(`document.querySelector('.dash-builder [data-lazy-state="error"]')`); await click('Close');
    }
    await nav('Overview'); await wait(`document.querySelectorAll('.guild-island').length===8`);
    await delay(100); expectedChunkFailure = '';
  }
  checks.push('Injected chunk failures stay contained; navigation survives and failed Builder supports Escape, focus restoration and reopening');
  await checkCollectionSync();
  await checkWorkspaceAttention();
  await reload();
  await checkCeoDirective();
  await reload();
  await app.close(); app = null;
  await wait(`!document.querySelector('.dash-connection.is-live')`); await nav('Overview'); await wait(`document.querySelector('.dash-content').textContent.includes('ยังไม่เชื่อมต่อ backend')`);
  assert.equal(await evaluate(`document.querySelector('.overview-dock .overview-backend').textContent`), 'Offline');
  assert.equal(await evaluate(`document.querySelector('.overview-dock-counts')`), null, 'Disconnected dock does not present retained counts as live');
  await physicalClick('#overview-status-trigger');
  await wait(`document.querySelector('.overview-dock-warning')`);
  assert.equal(await evaluate(`document.getElementById('overview-status-panel').textContent.includes('ไม่ใช่การยืนยัน AI provider')`), true);
  await key('Escape','Escape',27);
  await click('Create mission'); await wait(`document.getElementById('workflow-title')`); await step('review');
  assert.equal(await evaluate(`[...document.querySelectorAll('.dash-builder button')].find(e=>e.type==='submit').disabled`), true); await click('Close');
  checks.push('Offline overview explains backend loss; dispatch is disabled without connection');
  checks.push('Overview Status switches to Offline and explains stale retained data, without claiming provider health');

  await nav('Analytics'); await wait(`document.querySelector('[aria-labelledby="analytics-title"]').textContent.includes('Backend ออฟไลน์')`);
  assert.equal(await evaluate(`[...document.querySelectorAll('[aria-labelledby="analytics-title"] button')].find(e=>e.textContent==='รีเฟรชสถิติ').disabled`), true);
  checks.push('Analytics explains offline state and disables refresh instead of presenting fabricated live data');
  await wait(`document.querySelector('[aria-labelledby="aar-history-title"]')?.textContent.includes('Backend ออฟไลน์')`);
  checks.push('AAR history explicitly explains offline state; no fabricated cached backend history');
  }

  async function checkWorkspaceAttention() {
    await nav('Home');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
    await evaluate(`document.getElementById('i47-drawer-crew').click()`);
    await wait(`document.querySelectorAll('.i47-crew-list li').length===27`);
    await evaluate(`document.querySelector('.i47-crew-list button').focus();document.activeElement.click()`);
    await wait(`document.querySelector('.i47-action-overlay[open]')?.textContent.includes('TAEC')`);
    assert.ok(await evaluate(`(() => {const b=document.querySelector('.i47-action-overlay').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight})()`));
    await key('Escape', 'Escape', 27);
    await wait(`document.activeElement===document.querySelector('.i47-crew-list button')`);
    await key('Escape', 'Escape', 27);
    await wait(`document.activeElement.id==='i47-drawer-crew' && !document.getElementById('i47-drawer')`);
    const origin = await evaluate('location.href');
    const review = await api('/tasks', { description: '[TEAM:TECH] Slice 2 fixture', workflow: { nodes: [
      { id: 'report', agent: 'LEX', dependsOn: [] }, { id: 'human', agent: 'HUMAN', prompt: 'Slice 2 fixture question', dependsOn: ['report'] }
    ] } });
    await wait(`document.querySelector('.dash-toast')?.textContent.includes('LEX · report approval requested')`);
    assert.equal(await evaluate('location.href'), origin);
    assert.equal(await evaluate(`!!document.querySelector('.i47-action-overlay')`), false);
    await click('เปิดรายละเอียด', '.dash-toast button');
    await wait(`document.querySelector('.i47-action-overlay[open]')?.textContent.includes('อนุมัติรายงาน')`);
    assert.equal(await evaluate(`!!document.querySelector('.i47-action-overlay textarea')`), false);
    await evaluate(`document.querySelector('.i47-action-overlay details').open=true`);
    assert.match(await evaluate(`document.querySelector('.i47-action-overlay details').textContent`), /Deterministic dashboard report/);
    for (let i = 0; i < 105; i++) telemetryBus.publish({ event_type: 'FIXTURE_ACTIVITY', source_agent: 'ARIA' });
    for (const client of app.wss.clients) client.close(1013, 'fixture reconnect');
    await wait(`!document.querySelector('.dash-connection.is-live') && document.querySelector('.i47-action-overlay button.primary').disabled`);
    await wait(`document.querySelector('.dash-connection.is-live') && !document.querySelector('.i47-action-overlay button.primary').disabled`);
    assert.equal(await evaluate(`document.querySelector('.dash-toast')`), null);
    const approval = app.orchestrator.listPendingApprovals().find((item) => item.task_id === review.task_id);
    assert.ok(approval);
    const senderTab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const sender = new WebSocket(senderTab.webSocketDebuggerUrl);
    try {
      await new Promise((resolve, reject) => { sender.once('open', resolve); sender.once('error', reject); });
      const senderEval = (id, method, params) => new Promise((resolve, reject) => {
        const handle = (raw) => { const message = JSON.parse(raw); if (message.id !== id) return; cleanup(); message.error || message.result?.exceptionDetails ? reject(new Error(JSON.stringify(message))) : resolve(message.result); };
        const timer = setTimeout(() => { cleanup(); reject(new Error(`Second tab ${method} timed out`)); }, 10000);
        const cleanup = () => { clearTimeout(timer); sender.off('message', handle); };
        sender.on('message', handle); sender.send(JSON.stringify({ id, method, params }));
      });
      await senderEval(1, 'Page.navigate', { url: `${url}/#/home/opening` });
      // The other tab sends the same existing route the UI uses, exactly once.
      const outcome = await senderEval(2, 'Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
        for(let i=0;i<80&&!document.querySelector('.dash-connection.is-live');i++)await new Promise(r=>setTimeout(r,100));
        if(!document.querySelector('.dash-connection.is-live'))throw Error('Second workspace is not live');
        return (await fetch('/api/hitl/${approval.approval_id}',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"decision":"approve"}'})).status;
      })()` });
      assert.equal(outcome.result.value, 200);
      await wait(`document.querySelector('.i47-action-overlay')?.textContent.includes('no longer pending') && !document.querySelector('.i47-action-overlay button.primary')`);
    } finally { sender.close(); await fetch(`http://127.0.0.1:${port}/json/close/${senderTab.id}`).catch(() => {}); }
    await key('Escape', 'Escape', 27);
    await wait(`!document.querySelector('.i47-action-overlay')`);
    await evaluate(`document.getElementById('i47-drawer-attention').click()`);
    await wait(`document.querySelector('[data-attention="waiting"] button')?.textContent.includes('Slice 2 fixture')`);
    assert.ok(await evaluate(`new Set([...document.querySelectorAll('[data-attention]')].map(e=>getComputedStyle(e).borderInlineStartColor)).size===4`));
    await evaluate(`document.querySelector('[data-attention="waiting"] button').focus();document.activeElement.click()`);
    await wait(`document.querySelector('.i47-action-overlay textarea')`);
    assert.equal(await evaluate(`!!document.querySelector('.i47-action-overlay button.primary')`), false);
    await input('Your contribution', 'Fixture answer');
    await click('Submit & continue', '.i47-action-overlay button');
    await wait(`document.querySelector('.i47-action-overlay')?.textContent.includes('no longer pending')`);
    await click('', '.i47-action-overlay button[aria-label="Close workspace popup"]');
    await wait(`document.activeElement.id==='i47-drawer-attention'`);
    assert.equal(await evaluate('location.href'), origin);
    await drain();
    assert.equal(app.orchestrator.tasks.get(review.task_id).state, 'COMPLETED');
    await key('Escape', 'Escape', 27);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    checks.push('Slice 2 CREW and ATTENTION fit at 320px; keyboard closes to the opener, including a resolved row');
    checks.push('Slice 2 live toast opens exact report in place; reconnect retains it beyond event history and disables decisions while offline');
    checks.push('Slice 2 second-tab approval clears the open report; HUMAN contribution stays separate and completes on the originating page');
  }

  async function checkHudWorkspace() {
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await wait(`document.querySelector('.i47-viewport canvas')?.width>300`);
    assert.equal(await evaluate(`document.getElementById('i47-core-menu').hidden && [...document.querySelectorAll('.i47-core-bar button')].filter(b=>b.getClientRects().length).map(b=>b.id).join()==='i47-core-trigger'`), true);
    await evaluate(`document.querySelector('${coreTrigger}').focus()`); await key('Enter','Enter',13);
    await wait(`document.activeElement.id==='i47-heading-home'`);
    const visibleLists = `[...document.querySelectorAll('.i47-context-nav')].filter(el=>el.getClientRects().length).map(el=>el.id)`;
    assert.deepEqual(await evaluate(visibleLists), ['i47-core-home']);
    assert.equal(await evaluate(`document.querySelectorAll('.i47-categories .i47-category > button').length`), 5);
    assert.equal(await evaluate(`document.querySelector('[data-home-view="visualizer"]').textContent.trim()`), 'Realm Intelligence 3D');
    assert.equal(await evaluate(`document.querySelector('[data-nav-view="Analytics"]').closest('ul').id`), 'i47-core-dashboards');
    if (navigationEvidence) { await delay(260); await writeFile(screenshotPath('realm-home-menu.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
    await evaluate(`document.querySelector('#i47-heading-agents').focus()`);
    assert.equal(await evaluate(`document.activeElement.id`), 'i47-heading-agents', 'Agents receives keyboard focus');
    await key('Enter', 'Enter', 13);
    await wait(`${visibleLists}.join()==='i47-core-agents'`);
    assert.deepEqual(await evaluate(visibleLists), ['i47-core-agents']);
    await wait(`document.activeElement.closest('ul')?.id==='i47-core-agents'`);
    assert.equal(await evaluate(`document.activeElement.closest('ul').id`), 'i47-core-agents');
    await evaluate(`document.getElementById('i47-heading-copilot-47').focus()`);
    await key('Tab');
    await wait(`!document.activeElement.closest('.i47-core-bar') && document.getElementById('i47-core-menu').hidden`);
    await openCore(); await evaluate(`document.querySelector('#i47-heading-agents').focus()`); await key('ArrowDown','ArrowDown',40);
    await wait(`document.activeElement.closest('ul')?.id==='i47-core-agents'`);
    await key('Escape', 'Escape', 27);
    await wait(`document.activeElement.id==='i47-core-trigger' && document.getElementById('i47-core-menu').hidden`);
    assert.equal(await evaluate(`document.querySelectorAll('.i47-visual-stage .i47-forecast-days button').length`), 5);
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Weather display mode"]')`), false);
    await click('Day 0325°CShowers', '.i47-forecast-days button');
    assert.equal(await evaluate(`!location.hash && document.querySelector('.i47-weather-reading').textContent.includes('25°C')`), true);
    assert.equal(await evaluate(`document.querySelector('.i47-forecast-days [aria-pressed="true"]').textContent`), 'Day 0325°CShowers');
    await evaluate(`document.querySelector('.i47-viewport').focus()`); await key('ArrowRight', 'ArrowRight', 39);
    assert.match(await evaluate(`document.querySelector('.i47-camera output').textContent`), /-10°/);
    await click('Reset view'); await click('Day 0127°CPartly cloudy', '.i47-forecast-days button');
    assert.equal(await evaluate(`document.querySelector('.i47-weather-reading').textContent.includes('27°C')`), true);
    await evaluate(`document.querySelector('.i47-web-status > button').click()`);
    assert.equal(await evaluate(`document.querySelector('#i47-session').open && !location.hash`), true);
    await key('Escape', 'Escape', 27);
    await wait(`!document.querySelector('#i47-session').open && document.activeElement.matches('.i47-web-status > button')`);
    assert.equal(await evaluate(`document.querySelectorAll('#i47-session time').length===1 && document.querySelector('#i47-session').textContent.includes('Workspace WebSocketLinked') && document.querySelector('.i47-web-status').offsetWidth<150`), true);
    await checkLandingIndex();
    await checkHomePolish(visibleLists);
    const activeCore = `document.querySelector('${coreTrigger}').dataset.currentCore`;
    await chooseCorePage('Armory', 'Glossary');
    const glossary = `location.hash==='#/settings/glossary' && document.querySelector('.i47-glossary') && ${activeCore}==='armory'`;
    const opening = `!location.hash && document.querySelector('.i47-viewport canvas') && ${activeCore}==='home'`;
    await wait(glossary);
    await evaluate('history.back()'); await wait(opening);
    await evaluate('history.forward()'); await wait(glossary);
    await evaluate('history.back()'); await wait(opening);
    await evaluate(`location.hash='#/overview'`);
    await wait(`document.querySelector('.guild-world') && document.querySelector('[data-current-location]').textContent==='Command Deck' && ${activeCore}==='home'`);
    await evaluate(`location.hash='#/home/visualizer'`);
    await wait(`document.querySelector('#i47-nexus-title')?.textContent==='Realm Intelligence 3D' && ${activeCore}==='home'`);
    await evaluate('history.go(-2)'); await wait(opening);
    if (navigationEvidence) await writeFile(screenshotPath('realm-opening-integrated.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    checks.push('Core owner disclosure, Home forecast without route changes, Canvas keyboard/reset, session dialog, direct bookmarks and active category on Back/Forward');
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Customize HUD').focus()`);
    await key('Enter', 'Enter', 13);
    await wait(`document.querySelector('#i47-hud-title') && [...document.querySelectorAll('.i47-hud-form button')].some(b=>b.textContent==='Save to Workspace' && !b.disabled)`);
    await key('Escape', 'Escape', 27);
    assert.equal(await evaluate(`document.activeElement.textContent.trim()`), 'Customize HUD');
    await evaluate(`document.querySelector('${coreTrigger}').focus()`); await key('ArrowDown', 'ArrowDown', 40);
    await wait(`document.activeElement.dataset.homeView==='opening'`);
    await evaluate(`document.querySelector('[data-home-view="realm"]').focus()`); await key('Enter', 'Enter', 13);
    await wait(`location.hash==='#/home/realm' && document.querySelectorAll('[data-realm-mode]').length===3`);
    await click('Open Realm Intelligence 3D', '[data-realm-mode]');
    await wait(`location.hash==='#/home/visualizer' && document.querySelector('.i47-viewport canvas')`);
    assert.deepEqual(await evaluate(`[document.querySelector('#i47-nexus-title').textContent,document.querySelector('[data-current-location]').textContent,document.querySelector('.i47-viewport').getAttribute('aria-label')]`), Array(3).fill('Realm Intelligence 3D'));
    const pixel = `document.querySelector('.i47-viewport canvas').toDataURL()`;
    const before = await evaluate(pixel);
    await wait(`${pixel}!==${JSON.stringify(before)}`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await wait(`document.querySelector('.i47-shell').dataset.visualMotion==='off'`);
    const paused = await evaluate(pixel);
    await delay(180); assert.equal(await evaluate(pixel), paused, 'OS reduction stops Canvas redraws');
    await evaluate(`document.querySelector('.i47-viewport').focus()`); await key('ArrowRight', 'ArrowRight', 39);
    assert.notEqual(await evaluate(pixel), paused, 'Manual interaction still redraws the paused scene');
    await cdp('Emulation.setEmulatedMedia', { features: [] });
    checks.push('Legacy visualizer hash presents Realm Intelligence 3D; Nexus moves without input and remains keyboard-operable with OS motion paused');
    assert.equal(await evaluate(`document.querySelector('.dash-shell').dataset.hudTheme`), 'kali-cyber');
    await evaluate('history.back()'); await wait(`document.getElementById('realm-world-title')`);
    await evaluate('history.back()'); await wait(`!location.hash && document.querySelector('[data-feed="log"][aria-expanded="false"]')`);
    const prior = await api('/hud-preferences');
    const receiver = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
    const peer = new WebSocket(receiver.webSocketDebuggerUrl);
    let seq = 0;
    const readPeer = async (expression) => {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { peer.off('message', listener); reject(new Error('HUD peer evaluation timed out')); }, 5000);
        function listener(raw) { const message = JSON.parse(raw); if (message.id === id) { clearTimeout(timer); peer.off('message', listener); resolve(message.result?.result?.value); } }
        peer.on('message', listener); peer.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
      });
    };
    try {
      await new Promise((resolve, reject) => { peer.once('open', resolve); peer.once('error', reject); });
      await wait(`document.querySelector('.dash-connection.is-live')`, readPeer);
      await click('Customize HUD'); await select('Theme', 'realm-cyber'); await select('Accent', '#c5a3ff');
      await input('Operator name (this browser only)', 'Fixture Operator');
      await click('Save to Workspace');
      await wait(`document.querySelector('.dash-shell').dataset.hudTheme==='realm-cyber'`);
      // The peer must update sooner than the 15-second polling fallback.
      await wait(`document.querySelector('.dash-shell').dataset.hudAccent==='#c5a3ff'`, readPeer);
      const saved = await api('/hud-preferences');
      assert.deepEqual(saved.data, { theme: 'realm-cyber', accent: '#c5a3ff', tacticalGrid: false });
      assert.equal(saved.revision, prior.revision + 1);
      await reload();
      await wait(`document.querySelector('.i47-greeting').textContent.includes('Fixture Operator') && document.querySelector('.dash-shell').dataset.hudTheme==='realm-cyber'`);
      await click('Customize HUD'); await wait(`[...document.querySelectorAll('.i47-hud-form button')].some(b=>b.textContent==='Save to Workspace' && !b.disabled)`);
      const conflict = await fetch(`${target}/api/hud-preferences`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: saved.revision, data: prior.data }) });
      assert.equal(conflict.status, 200);
      await wait(`document.querySelector('.i47-hud-form').textContent.includes('Reload them before saving')`);
      assert.equal(await evaluate(`document.querySelector('.i47-hud-form button[type=submit]').disabled`), true);
      await key('Escape', 'Escape', 27);
      await wait(`document.querySelector('.dash-shell').dataset.hudTheme==='kali-cyber'`);
      await click('Call 47'); await wait(`location.hash==='#/copilot-47'`);
      assert.equal(tasks().length, 0);
      await evaluate('history.back()'); await wait(`!location.hash && document.querySelector('[data-feed="log"][aria-expanded="false"]')`);
    } finally {
      peer.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${receiver.id}`).catch(() => {});
    }
    checks.push('HUD keyboard focus, dual-tab WS revision, reload, browser-only name, stale draft protection, and Call 47 without dispatch');
  }

  async function checkHomePolish(visibleLists) {
    const backdrop = `.i47-shell > .i47-workspace-ambient`;
    const planes = `[...document.querySelectorAll('${backdrop} .i47-star-plane')]`;
    await evaluate(`void (window.i47FixtureBackdrop=document.querySelector('${backdrop}'))`);
    const checkBackdrop = async () => assert.equal(await evaluate(`(() => {const a=document.querySelector('${backdrop}'),f=a.getBoundingClientRect(),s=a.parentElement.getBoundingClientRect();return a===window.i47FixtureBackdrop && f.width===s.width && f.height===s.height && f.x===s.x && f.y===s.y && getComputedStyle(a).pointerEvents==='none' && !document.querySelector('.i47-visual-stage .i47-signal-field')})()`), true);
    await checkBackdrop();
    for (const width of [1600, 1440, 1024, 768]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const closed = await evaluate(workspaceLayout);
      assert.equal(closed.rail.width, 162);
      if (navigationEvidence && width === 1600) await writeFile(screenshotPath('realm-home-fixed-menu-closed.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      await physicalClick(coreTrigger);
      const box = await evaluate(coreMenuLayout);
      assert.ok(box.left>=box.railLeft && box.right<=box.railRight && box.railRight===closed.main.left && box.bottom<=box.railBottom && box.scroll<=box.client+1 && box.documentWidth<=box.viewport, `Workspace menu stays inside the fixed left column at ${width}px: ${JSON.stringify(box)}`);
      assert.deepEqual(await evaluate(workspaceLayout), closed, `Opening the menu does not move the workspace at ${width}px`);
      assert.ok(await evaluate(`[...document.querySelectorAll('.i47-category > button > span')].every(el=>{const text=document.createRange();text.selectNodeContents(el);return text.getClientRects().length===1})`), 'Desktop category names fit on one line');
      if (navigationEvidence && width === 1600) await writeFile(screenshotPath('realm-home-fixed-menu-open.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      await physicalClick('#i47-heading-dashboards');
      await wait(`${visibleLists}.join()==='i47-core-dashboards'`);
      assert.deepEqual(await evaluate(workspaceLayout), closed, `Switching categories does not move the workspace at ${width}px`);
      assert.ok(await evaluate(`(() => {const m=document.getElementById('i47-core-menu'),r=m.getBoundingClientRect();return m.scrollWidth<=m.clientWidth+1 && [...m.querySelectorAll('button')].filter(b=>b.getClientRects().length).every(b=>b.getBoundingClientRect().right<=r.right && b.scrollWidth<=b.clientWidth+1)})()`), 'Category labels and destinations fit the rail');
      await key('Escape','Escape',27);
      await wait(`document.activeElement.id==='i47-core-trigger' && document.getElementById('i47-core-menu').hidden`);
      assert.deepEqual(await evaluate(workspaceLayout), closed, `Closing the menu does not move the workspace at ${width}px`);
      layouts.push({ width, section: 'Fixed workspace rail', ...box });
    }
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    await physicalClick(coreTrigger);
    assert.equal(await evaluate(`(() => {const p=document.getElementById('i47-core-menu'),a=p.getBoundingClientRect(),t=document.querySelector('${coreTrigger}').getBoundingClientRect(),r=[...p.querySelectorAll('.i47-category > button')].map(e=>e.getBoundingClientRect());return a.left===t.left && a.top>=t.bottom && a.bottom<=innerHeight && r.length===5 && r.every((e,i)=>e.left===r[0].left && e.right<=a.right && (!i || e.top>=r[i-1].bottom))})()`), true, 'Desktop categories stack in one left-aligned frame');
    const moveTo = async (selector) => {
      const point = await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    };
    await moveTo('#i47-heading-dashboards');
    assert.deepEqual(await evaluate(visibleLists), ['i47-core-home'], 'Hover does not switch the selected category');
    await physicalClick('#i47-heading-dashboards');
    await wait(`${visibleLists}.join()==='i47-core-dashboards'`);
    await moveTo('#i47-home-title');
    assert.deepEqual(await evaluate(visibleLists), ['i47-core-dashboards'], 'Pointer leave does not collapse explicit tabs');
    await physicalClick('#i47-home-title');
    await wait(`document.getElementById('i47-core-menu').hidden`);
    await key('Escape', 'Escape', 27);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...(await evaluate(`(() => {const r=document.querySelector('.dash-content').getBoundingClientRect();return {x:r.left+r.width*.8,y:r.top+12};})()`)) });
    const starOffsets = `${planes}.map(el=>Math.abs(new DOMMatrix(getComputedStyle(el).transform).m41))`;
    await wait(`(() => {const [far,middle,near]=${starOffsets};return far>0 && far<middle && middle<near})()`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.i47-viewport canvas')).transform`), 'none', 'Mouse parallax does not move the Weather canvas');
    assert.equal(await evaluate(`document.querySelector('.i47-shell').dataset.atmosphere === 'stars' && getComputedStyle(document.querySelector('.i47-signal-field')).display==='none' && ${planes}.every(el=>el.getClientRects().length>0)`), true);
    const motionOff = `document.querySelector('.i47-shell').dataset.visualMotion==='off' && !document.querySelector('${backdrop}').style.getPropertyValue('--px')`;
    const motionOn = `document.querySelector('.i47-shell').dataset.visualMotion==='on' && matchMedia('(prefers-reduced-motion: no-preference)').matches`;
    const stillStars = `${planes}.every(el=>el.getClientRects().length && new DOMMatrix(getComputedStyle(el).transform).isIdentity)`;
    const toggleMotion = () => evaluate(`document.querySelector('.i47-appearance input').click()`);
    await click('Customize HUD');
    await toggleMotion(); await wait(`${motionOff} && ${stillStars}`);
    await toggleMotion(); await wait(motionOn);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await wait(`${motionOff} && ${stillStars}`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await select('Atmosphere','meteor');
    // The atmosphere can render before React handles the media-query change.
    await wait(`document.querySelector('.i47-shell').dataset.atmosphere==='meteor' && ${motionOn}`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.i47-cyber-links')).display`), 'none');
    const meteor = `getComputedStyle(document.querySelector('.i47-signal-star')).animationName`;
    const cyber = `getComputedStyle(document.querySelector('.i47-signal-pulse')).animationName`;
    assert.equal(await evaluate(meteor), 'i47-star');
    await toggleMotion(); await wait(`${motionOff} && ${meteor}==='none'`);
    await toggleMotion(); await wait(`${meteor}==='i47-star'`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await wait(`${motionOff} && ${meteor}==='none'`);
    await select('Atmosphere','cyber-link'); await wait(`document.querySelector('.i47-shell').dataset.atmosphere==='cyber-link' && ${motionOff} && ${cyber}==='none'`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await wait(`${cyber}==='i47-signal'`);
    await select('Atmosphere','minimal');
    await wait(`getComputedStyle(document.querySelector('.i47-signal-field')).display==='none'`);
    await select('Atmosphere','cyber-link');
    await toggleMotion(); await wait(`${motionOff} && ${cyber}==='none'`);
    await toggleMotion();
    await key('Escape','Escape',27);
    if (navigationEvidence) await writeFile(screenshotPath('realm-workspace-cyber-link.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await chooseCorePage('Armory', 'Armory'); await wait(`location.hash==='#/armory'`); await checkBackdrop();
    await click('Customize HUD'); await select('Atmosphere','meteor'); await key('Escape','Escape',27);
    await wait(`document.querySelector('.i47-shell').dataset.atmosphere==='meteor'`);
    await wait(`[...document.querySelectorAll('.i47-signal-star')].some(s=>{const r=s.getBoundingClientRect();return r.top>innerHeight*.34 && r.right<innerWidth-20 && Number(getComputedStyle(s).opacity)>.8})`);
    if (navigationEvidence) {
      // Freeze the visible streaks for compositor capture, then restore the live animation.
      await evaluate(`document.querySelectorAll('.i47-signal-star').forEach(s=>s.style.animationPlayState='paused')`);
      await writeFile(screenshotPath('realm-workspace-meteor.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      await evaluate(`document.querySelectorAll('.i47-signal-star').forEach(s=>s.style.removeProperty('animation-play-state'))`);
    }
    await moveTo('[data-current-location]');
    await wait(`parseFloat(document.querySelector('${backdrop}').style.getPropertyValue('--px'))<-15`);
    await click('Customize HUD'); await select('Atmosphere','stars'); await key('Escape','Escape',27);
    await evaluate('history.back()'); await wait(`!location.hash && document.getElementById('i47-home-title')`); await checkBackdrop();
    assert.equal(await evaluate(`document.querySelector('.i47-shell').dataset.atmosphere`), 'stars');
    checks.push('Parallax Stars default: three distinct depths on one workspace backdrop, static with app pause or Reduce Motion, no canvas transforms; Cyber-Link and Meteor remain selectable');
    checks.push('Desktop rail stays 162px at 768/1024/1440/1600px; opening, switching and closing leave the hero, canvas, content and status in place');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
    const tap = async (selector) => {
      const point = await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y)) ? {x,y} : null;})()`);
      assert.ok(point, `Unobstructed touch target: ${selector}`);
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    assert.deepEqual(await evaluate(visibleLists), []);
    const mobilePage = await evaluate(workspaceLayout);
    assert.ok(mobilePage.rail.width===320 && mobilePage.rail.bottom===mobilePage.main.top, '320px shows a permanent menu row above the workspace');
    if (navigationEvidence) await writeFile(screenshotPath('realm-home-top-menu-closed-320.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await tap(coreTrigger); await wait(`${visibleLists}.join()==='i47-core-home'`);
    assert.deepEqual(await evaluate(workspaceLayout), mobilePage, 'Opening the top menu does not move Home Opening');
    const mobileBox = await evaluate(coreMenuLayout);
    assert.ok(mobileBox.left>=0 && mobileBox.right<=320 && mobileBox.bottom<640 && mobileBox.top===mobilePage.rail.bottom && mobileBox.scroll<=mobileBox.client+1, JSON.stringify(mobileBox));
    assert.ok(await evaluate(`(() => {const m=document.getElementById('i47-core-menu');return m.scrollHeight>m.clientHeight})()`), '320px top menu scrolls internally');
    if (navigationEvidence) { await delay(220); await writeFile(screenshotPath('realm-home-top-menu-open-320.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
    const touchPoint = await evaluate(`(() => {const r=document.getElementById('i47-core-menu').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.bottom-28)}})()`);
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
    for (const dy of [40, 80, 125, 170, 210]) await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...touchPoint, y: touchPoint.y-dy }] });
    // End a drag rather than flinging the list; Chromium swallows a tap used to stop momentum.
    await delay(300);
    await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(`document.getElementById('i47-core-menu').scrollTop>180`);
    assert.deepEqual(await evaluate(workspaceLayout), mobilePage, 'Dragging the menu scrolls only the menu');
    await tap('#i47-heading-armory'); await wait(`${visibleLists}.join()==='i47-core-armory'`);
    await evaluate(`document.getElementById('i47-core-menu').scrollTop=0`);
    await tap('#i47-heading-agents'); await wait(`${visibleLists}.join()==='i47-core-agents'`);
    assert.deepEqual(await evaluate(workspaceLayout), mobilePage, 'Switching mobile categories leaves Home Opening in place');
    await tap(coreTrigger); await wait(`document.getElementById('i47-core-menu').hidden`);
    await tap(coreTrigger); await wait(`${visibleLists}.join()==='i47-core-home'`);
    await tap('[data-current-location]'); await wait(`document.getElementById('i47-core-menu').hidden`);
    assert.deepEqual(await evaluate(workspaceLayout), mobilePage, 'Dismissing the top menu does not move Home Opening');
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    checks.push('320px touch opens, scrolls and switches the bounded top menu without shifting the page; trigger or outside tap dismisses it');
    await physicalClick('[data-feed="tasks"]');
    await wait(`document.getElementById('i47-active') && document.querySelector('.i47-feed').textContent.includes('No retained tasks yet.')`);
    await delay(220);
    const box = await evaluate(`(() => {const p=document.querySelector('.i47-hud-popup'),r=p.getBoundingClientRect(),s=document.querySelector('.i47-web-status').getBoundingClientRect(),b=p.querySelector('header button').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,statusTop:s.top,statusWidth:s.width,overflow:p.scrollWidth-p.clientWidth,closeWidth:b.width,closeHeight:b.height};})()`);
    assert.ok(box.left>=0 && box.right<=320 && box.bottom<=box.statusTop && box.statusWidth<320 && box.overflow<=1 && box.closeWidth>=44 && box.closeHeight>=44, JSON.stringify(box));
    layouts.push({ width: 320, section: 'Home Opening glass HUD', ...box });
    await physicalClick('[data-feed="log"]');
    await wait(`document.getElementById('i47-log') && !document.getElementById('i47-active') && document.querySelector('.i47-feed').textContent.includes('No execution events yet.')`);
    await key('Escape','Escape',27);
    assert.equal(await evaluate(`!document.querySelector('.i47-hud-popup') && document.activeElement.dataset.feed==='log' && !location.hash`), true);
    await cdp('Emulation.clearDeviceMetricsOverride');
    checks.push('Home feed counts open one bounded popup without navigating; Close/Escape restore focus and the 320px status pill remains separate');
  }

  async function checkLandingIndex() {
    const main = `document.querySelector('.dash-content')`;
    const index = `document.querySelector('.i47-workspace-index')`;
    const jump = '.i47-index-jump button';
    for (const [width, height] of [[1280, 760], [320, 640]]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 320 });
      const size = await evaluate(`({page:document.documentElement.scrollWidth,client:${main}.clientWidth,content:${main}.scrollWidth,links:${index}.querySelectorAll('button').length})`);
      assert.ok(size.page<=width && size.content<=size.client+1 && size.links===3, JSON.stringify(size));
      layouts.push({ width, section: 'Home Opening landing', ...size });
    }
    if (navigationEvidence) await writeFile(screenshotPath('realm-opening-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await evaluate(`(() => {const n=${index},scroll=n.scrollIntoView.bind(n);n.scrollIntoView=(opts)=>{n.dataset.testScroll=opts.behavior;scroll(opts)};})()`);
    await click('Explore the workspace', jump);
    await wait(`${main}.scrollTop>0 && ${index}.dataset.revealed==='true' && document.activeElement.id==='i47-index-title'`);
    assert.equal(await evaluate(`${index}.dataset.testScroll`), 'smooth');
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await wait(`document.querySelector('.i47-shell').dataset.visualMotion==='off'`);
    await click('Explore the workspace', jump);
    assert.equal(await evaluate(`${index}.dataset.testScroll`), 'instant');
    assert.equal(await evaluate(`getComputedStyle(${index}.firstElementChild).animationName`), 'none');
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await cdp('Emulation.clearDeviceMetricsOverride');
    await evaluate(`void (${main}.scrollTop=0)`);
    await click('Command DeckMeasured mission status, live signals, and confirmed directives.', '[data-index-mode="deck"]');
    await wait(`location.hash==='#/home/deck' && document.querySelector('.overview-dock')`);
    await evaluate('history.back()'); await wait(`!location.hash && ${index}`);
    checks.push('Home landing fits 320 and desktop, scrolls and focuses its index, honors OS reduced motion, and opens Command Deck');
  }

  async function checkAccessGate() {
    const activate = async (secret) => {
      await wait(`document.querySelector('#activation-title')`);
      await input('Access key', secret); await click('Activate');
      await wait(`document.querySelector('.dash-connection.is-live')`);
    };
    const hash = (path) => evaluate(`location.hash=${JSON.stringify(path)}`);
    await wait(`document.querySelector('#activation-title')`);
    assert.equal(await evaluate(`!!document.querySelector('.dash-shell')`), false);
    await activate(fixtureAdmin); await hash('#settings/admin');
    await wait(`document.querySelector('#admin-console-title')`);
    await input('User label', 'Browser fixture member'); await click('+ Issue key');
    await wait(`document.querySelector('[aria-label="One-time activation key"] code')`);
    const issued = await evaluate(`document.querySelector('[aria-label="One-time activation key"] code').textContent`);
    await click('Hide key'); await click('Back to Settings'); await click('Lock workspace');
    await activate(issued); await hash('#settings/admin');
    await wait(`document.querySelector('[aria-label="Workspace settings actions"]')`);
    assert.equal(await evaluate(`!!document.querySelector('#admin-console-title') || [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Admin')`), false);
    const rotate = async (action, id) => {
      const response = await fetch(`${target}/api/admin/keys${id ? `/${id}/${action}` : ''}`, { method: id ? 'POST' : 'GET', signal: AbortSignal.timeout(3000), headers: { Authorization: `Bearer ${fixtureAdmin}` } });
      assert.equal(response.status, 200);
      return response.json();
    };
    const { keys: [account] } = await rotate();
    assert.equal(account.activeSessions, 1);
    const fresh = (await rotate('rekey', account.id)).activationKey;
    await wait(`document.querySelector('.access-card [role="alert"]')?.textContent.includes('เปลี่ยนคีย์แล้ว')`);
    await input('Access key', issued); await click('Activate');
    await wait(`document.querySelector('.access-card [role="alert"]')?.textContent.includes('คีย์ไม่ถูกต้อง')`);
    await activate(fresh);
    assert.equal(await evaluate(`(() => { const values=[location.href, ...Object.values(localStorage), ...Object.values(sessionStorage)].join('|'); return ${JSON.stringify([fixtureAdmin, issued, fresh])}.some(key=>values.includes(key)); })()`), false);
    await rotate('revoke', account.id);
    await wait(`document.querySelector('.access-card [role="alert"]')?.textContent.includes('ถูกระงับ')`);
    checks.push('Admin-only lazy Settings page issues a one-time key; User deep link stays hidden; active browser is returned to Activation on re-key/revoke, and keys never enter URLs or browser storage');
  }

  async function checkCeoDirective() {
    const before = tasks().length;
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate(`location.hash='#/overview'; window.fixtureTaskPosts=0; const fixtureFetch=window.fetch.bind(window); window.fetch=(path, opts)=>{if(new URL(path, location.href).pathname==='/api/tasks' && opts?.method==='POST')window.fixtureTaskPosts++;return fixtureFetch(path,opts);};`);
    await wait(`document.querySelector('[data-ceo-entry="dashboard"]')`);
    await evaluate(`document.querySelector('[data-ceo-entry="dashboard"]').focus()`);
    await click('CEO Quick Directive'); await wait(`document.querySelector('[data-ceo-directive]')`);
    assert.equal(await evaluate(`document.querySelector('[data-ceo-directive] select').options.length`), 8);
    assert.equal(await evaluate(`document.querySelector('[data-ceo-directive]').scrollWidth <= document.querySelector('[data-ceo-directive]').clientWidth`), true);
    await input('CEO directive', 'Fixture Tech directive'); await click('Review directive');
    assert.match(await evaluate(`document.querySelector('[data-directive-route]').textContent`), /ARIA → HUMAN Review → REX → NOVA → BYTE → ZETA → FORGE/);
    await key('Escape', 'Escape', 27); await wait(`!document.querySelector('[data-ceo-directive]')`);
    assert.equal(await evaluate(`document.activeElement?.dataset.ceoEntry`), 'dashboard');
    assert.equal(await evaluate('window.fixtureTaskPosts'), 0);
    assert.equal(tasks().length, before);

    await evaluate(`location.hash='#/teams/tech'`); await wait(`document.querySelector('[data-ceo-entry="team"]')`);
    await click('Assign via ARIA'); await input('CEO directive', 'Fixture Tech directive'); await click('Review directive');
    await evaluate(`(() => {const b=[...document.querySelectorAll('[data-ceo-directive] button')].find(e=>e.textContent==='Confirm & dispatch');b.click();b.click();})()`);
    await wait(`document.querySelector('[data-team-workspace="tech"] [data-spatial-state="tool"]') || document.querySelector('[data-team-workspace="tech"] [data-spatial-state="running"]')`);
    await evaluate(`location.hash='#/teams/command/room'`);
    await wait(`document.querySelector('[data-spatial-agent="ARIA"][data-spatial-state="tool"]')`);
    await evaluate(`location.hash='#/teams/tech'`);
    await wait(`location.hash==='#/teams/tech' && document.querySelector('.realm-receipt') && document.querySelector('[data-team-workspace="tech"] [data-spatial-state="human"]')`);
    const task = tasks().at(-1);
    for (let n = 0; n < 100 && !app.orchestrator.listHumanInputs().some(x => x.task_id === task.id); n++) await delay(20);
    const inputs = app.orchestrator.listHumanInputs();
    assert.equal(tasks().length, before + 1); assert.equal(await evaluate('window.fixtureTaskPosts'), 1);
    assert.equal(task.department, 'tech'); assert.deepEqual(task.outputs.map(o => o.agent), ['ARIA']);
    assert.equal(inputs[0].task_id, task.id);
    await evaluate(`location.hash='#/overview'`);
    await wait(`document.querySelector('.guild-island[data-team="tech"][data-spatial-state="human"]')`);
    await api(`/human-inputs/${inputs[0].input_id}`, { action: 'submit', text: 'Fixture CEO approved brief.' });
    await wait(`document.querySelector('.guild-world [data-handoff="command:tech"]') && document.querySelector('.guild-island[data-team="tech"] [data-spatial-state="thinking"]')`);
    assert.equal(await evaluate(`document.querySelectorAll('[data-detail="stone-causeway"] .is-live-link').length`), 0);
    await drain();
    assert.deepEqual(task.outputs.map(o => o.agent), ['ARIA', 'HUMAN', 'REX', 'NOVA', 'BYTE', 'ZETA', 'FORGE']);
    assert.ok(app.storage.get('deliverables').data.tech.some(x => x.id === `task-${task.id}`));
    checks.push('CEO Directive stays on its originating screen; confirmed REST mission lights HUMAN wait, then a directed handoff and Tech thinking on the separate map layer');

    await evaluate(`location.hash='#/teams/design/room'`); await wait(`document.querySelector('[data-ceo-entry="room"]')`);
    const revision = app.storage.get('deliverables').revision;
    await evaluate(`(() => {const e=document.querySelector('input[aria-label="Room note (not a mission)"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Room note only');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('SAVE NOTE'); await wait(`document.querySelector('.room-console-panel').textContent.includes('Room note only')`);
    assert.equal(tasks().length, before + 1); assert.equal(app.storage.get('deliverables').revision, revision);
    await click('Assign via ARIA'); await select('Execution route', 'direct'); await input('CEO directive', 'Fixture Design directive'); await click('Review directive');
    assert.match(await evaluate(`document.querySelector('[data-directive-route]').textContent`), /ARIA → LUNA → PIXEL$/);
    await click('Confirm & dispatch'); await wait(`!document.querySelector('[data-ceo-directive]')`);
    await wait(`location.hash==='#/teams/design/room' && document.querySelector('.cozy-room [data-handoff="ARIA:LUNA"]')`);
    await drain();
    await wait(`!document.querySelector('.cozy-room [data-handoff]')`);
    assert.equal(await evaluate(`document.querySelectorAll('.cozy-room [data-spatial-state]').length`), 0);
    assert.equal(await evaluate('window.fixtureTaskPosts'), 2);
    assert.equal(tasks().at(-1).department, 'design'); assert.deepEqual(tasks().at(-1).outputs.map(o => o.agent), ['ARIA', 'LUNA', 'PIXEL']);
    await click('Open dispatched mission'); await wait(`location.hash === ${JSON.stringify(`#/missions/${tasks().at(-1).id}`)} && document.querySelector('[aria-label="Workflow node status"]')`);
    checks.push('Room notes start no task and write no deliverable; room directive-prefill dispatches the actual Design workflow');
    await evaluate(`location.hash='#/teams/legal/room'`);
    const submitSocket = new WebSocket(target.replace(/^http/, 'ws') + '/ws');
    try {
      await new Promise((resolve, reject) => { submitSocket.once('open', resolve); submitSocket.once('error', reject); });
      submitSocket.send(JSON.stringify({ type: 'SUBMIT_TASK', description: '[TEAM:LEGAL] Fixture report review', workflow: { nodes: [{ id: 'review', agent: 'LEX', dependsOn: [] }] } }));
      await wait(`document.querySelector('[data-spatial-agent="LEX"][data-spatial-state="review"]')`);
      const id = tasks().at(-1).id;
      const pending = telemetryBus.snapshot(50).find((e) => e.task_id === id && e.event_type === 'HITL_INTERRUPT');
      await api(`/hitl/${pending.approval_id}`, { decision: 'reject' });
      await drain();
      await wait(`!document.querySelector('.cozy-room [data-spatial-state]')`);
    } finally { submitSocket.close(); }
    checks.push('WS SUBMIT_TASK illuminates the LEX desk for report review, then clears after rejection');
    await cdp('Emulation.clearDeviceMetricsOverride');
  }

  async function checkPollingOnly() {
    await nav('Library'); await click('บันทึกและความเชื่อมโยง');
    await wait(`document.querySelector('.dash-knowledge-host') && window.fixturePollHeld()`);
    const reads = await evaluate('window.fixtureStorageReads.slice()');
    assert.deepEqual(reads, ['notes', 'deliverables', 'agentOverrides', 'savedCommands', 'chats'].map(name => `/api/storage/${name}`));
    assert.equal(app.wss.clients.size, 1);
    const [original] = app.wss.clients;
    const note = { id: 'polling-only-note', title: 'Polling-only fixture note', content: 'Fixture only', tags: [], links: [] };
    const endpoint = `${target}/api/storage/notes`;
    const before = await (await fetch(endpoint)).json();
    const saved = await fetch(endpoint, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: before.revision, data: [note, ...before.data] })
    });
    assert.equal(saved.status, 200);
    const { revision } = await saved.json();
    const displayed = `document.querySelector('[aria-label="เปิดบันทึก ${note.title}"]') && JSON.parse(localStorage.getItem('maoc_persistence_sync_v1')).notes.revision === ${revision}`;

    // Observe the incoming snapshot to prove the actual reconnect path ran, not just socket open.
    await cdp('Network.enable');
    const snapshots = [];
    socket.on('message', raw => {
      const message = JSON.parse(raw);
      if (message.method !== 'Network.webSocketFrameReceived') return;
      let frame;
      try { frame = JSON.parse(message.params.response.payloadData); } catch { return; }
      if (frame.type === 'SNAPSHOT') snapshots.push(frame);
    });
    original.close(1013, 'fixture reconnect');
    await wait(`!document.querySelector('.dash-connection.is-live')`);
    await wait(`document.querySelector('.dash-connection.is-live')`);
    for (let i = 0; i < 100 && snapshots.length === 0; i++) await delay(20);
    assert.equal(snapshots[0]?.collection_realtime, false);
    assert.ok(Array.isArray(snapshots[0].tasks));
    assert.deepEqual(await evaluate('window.fixtureStorageReads.slice()'), reads);
    assert.equal(await evaluate(`Boolean(${displayed})`), false);
    checks.push('Polling-only: task WebSocket reconnects without triggering collection reads or applying a pushed update');
    assert.equal(await evaluate('window.fixtureReleasePoll()'), true);
    await wait(displayed);
    await wait(`window.fixturePollHeld()`);
    assert.deepEqual(await evaluate('window.fixtureStorageReads.slice()'), [...reads, ...reads]);
    checks.push('Polling-only: releasing the next scheduled poll refreshes the Library from REST');
  }

  async function checkCollectionSync() {
  // Pause only the receiver's periodic persistence poll in this fresh document.
  const noPoll = await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `{
    const schedule = window.setTimeout.bind(window);
    window.setTimeout = (callback, ms, ...args) => schedule(callback, ms === 15000 ? 60000 : ms, ...args);
  }` });
  await reload();
  await cdp('Page.removeScriptToEvaluateOnNewDocument', noPoll);
  await nav('Library'); await click('บันทึกและความเชื่อมโยง');
  await wait(`document.querySelector('.dash-knowledge-host') && localStorage.getItem('maoc_persistence_sync_v1') && JSON.parse(localStorage.getItem('maoc_persistence_sync_v1')).notes?.dirty === false`);
  const syncNote = { id: 'stage31-browser-note', title: 'Stage 3.1 fixture note', content: 'Isolated browser proof', tags: [], links: [] };
  const senderUrl = new URL('/index.html', url);
  const senderTab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT', signal: AbortSignal.timeout(5000) })).json();
  const senderSocket = new WebSocket(senderTab.webSocketDebuggerUrl, { handshakeTimeout: 5000 });
  try {
    await new Promise((resolve, reject) => { senderSocket.once('open', resolve); senderSocket.once('error', reject); });
    let senderCommandId = 0;
    const senderCdp = (method, params) => new Promise((resolve, reject) => {
      const id = ++senderCommandId;
      const cleanup = () => { clearTimeout(timer); senderSocket.off('message', onMessage); senderSocket.off('close', onClose); };
      const onClose = () => { cleanup(); reject(new Error(`Stage 3.1 sender tab closed during ${method}`)); };
      const onMessage = (raw) => {
        const message = JSON.parse(raw);
        if (message.id !== id) return;
        cleanup();
        if (message.error) reject(new Error(`Stage 3.1 sender ${method}: ${message.error.message}`));
        else resolve(message.result);
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Stage 3.1 sender ${method} timed out`)); }, 5000);
      senderSocket.on('message', onMessage);
      senderSocket.once('close', onClose);
      senderSocket.send(JSON.stringify({ id, method, params }), (error) => { if (error) { cleanup(); reject(error); } });
    });
    const evaluateSender = async (expression) => {
      const response = await senderCdp('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression });
      if (response.exceptionDetails) throw new Error(`Stage 3.1 sender evaluation: ${response.exceptionDetails.exception?.description || response.exceptionDetails.text}`);
      return response.result.value;
    };
    const navigation = await senderCdp('Page.navigate', { url: senderUrl.href });
    assert.ok(!navigation.errorText, `Stage 3.1 sender navigation failed: ${navigation.errorText}`);
    await wait(`location.href === ${JSON.stringify(senderUrl.href)} && document.readyState !== 'loading'`, evaluateSender);
    // Probe readiness only; submit the write exactly once and surface errors.
    const result = await evaluateSender(`(async () => {
        const origin = ${JSON.stringify(senderUrl.origin)};
        const endpoint = origin + '/api/storage/notes';
        if (location.origin !== origin) throw Error('Not on the fixture origin');
        const response = await fetch(endpoint);
        if (!response.ok) throw Error('Reading the current note revision failed: HTTP ' + response.status);
        const current = await response.json();
        const save = await fetch(endpoint, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({revision:current.revision,data:[${JSON.stringify(syncNote)},...current.data]})});
        return {status:save.status,revision:(await save.json()).revision};
      })()`);
    assert.equal(result.status, 200);
    const displayed = `document.querySelector('[aria-label="เปิดบันทึก ${syncNote.title}"]') && JSON.parse(localStorage.getItem('maoc_persistence_sync_v1')).notes.revision === ${result.revision}`;
    await wait(displayed);
    checks.push('Stage 3.1: second Chromium tab commits through REST; Library in the receiving tab renders the notified revision before polling');
  } finally {
    senderSocket.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${senderTab.id}`, { signal: AbortSignal.timeout(5000) });
  }

  // Block upgrades at the fixture so a commit is guaranteed to occur between connections.
  const upgrades = app.server.listeners('upgrade');
  const denyUpgrade = (_req, socket) => socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
  for (const handler of upgrades) app.server.off('upgrade', handler);
  app.server.on('upgrade', denyUpgrade);
  const missed = { ...syncNote, id: 'stage32-browser-note', title: 'Stage 3.2 recovered note' };
  let nextRevision;
  try {
    for (const client of app.wss.clients) client.close(1013, 'fixture disconnect');
    await wait(`!document.querySelector('.dash-connection.is-live')`);
    const endpoint = `${target}/api/storage/notes`;
    const before = await (await fetch(endpoint, { signal: AbortSignal.timeout(5000) })).json();
    const response = await fetch(endpoint, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ revision: before.revision, data: [missed, ...before.data] })
    });
    assert.equal(response.status, 200);
    nextRevision = (await response.json()).revision;
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="เปิดบันทึก ${missed.title}"]')`), false);
  } finally {
    app.server.off('upgrade', denyUpgrade);
    for (const handler of upgrades) app.server.on('upgrade', handler);
  }
  await wait(`document.querySelector('.dash-connection.is-live') && document.querySelector('[aria-label="เปิดบันทึก ${missed.title}"]') && JSON.parse(localStorage.getItem('maoc_persistence_sync_v1')).notes.revision === ${nextRevision}`);
  checks.push('Stage 3.2: Library recovers a commit missed while WebSocket was disconnected, before polling');

  // Stage a local draft through the public client. Stop its timers so only
  // the explicit flush (not a debounce) can attempt to upload it.
  await evaluate(`(async () => {
    const { persistence } = await import('/src/lib/persistenceClient.js');
    await persistence.flush();
    persistence.stop();
    persistence.write('notes', persistence.read('notes', []).map(note => note.id === ${JSON.stringify(missed.id)} ? {...note, content:'Pending browser edit'} : note));
  })()`);
  const endpoint = `${target}/api/storage/notes`;
  const beforeConflict = await (await fetch(endpoint, { signal: AbortSignal.timeout(5000) })).json();
  const remoteEdit = { ...missed, content: 'Saved Vault edit' };
  const savedConflict = await fetch(endpoint, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ revision: beforeConflict.revision, data: beforeConflict.data.map(note => note.id === missed.id ? remoteEdit : note) })
  });
  assert.equal(savedConflict.status, 200);
  const savedRemote = await savedConflict.json();
  const notesState = await evaluate(`(async () => {
    const { persistence } = await import('/src/lib/persistenceClient.js');
    await persistence.flush();
    return { status: persistence.inspect().notes.status, dirty: persistence.inspect().notes.dirty,
      content: persistence.read('notes', []).find(note => note.id === ${JSON.stringify(missed.id)})?.content };
  })()`);
  assert.deepEqual(notesState, { status: 'conflict', dirty: true, content: 'Pending browser edit' });
  await nav('Settings'); await click('Open settings'); await click('ข้อมูล / Backup');
  await wait(`document.querySelector('[aria-label="Local vault persistence"]').textContent.includes('conflict · pending write')`);
  await click('ใช้ Local Vault', '[aria-label="Local vault persistence"] button');
  await wait(`!document.querySelector('[aria-label="Local vault persistence"]').textContent.includes('conflict · pending write')`);
  const resolved = await evaluate(`(async () => {
    const { persistence } = await import('/src/lib/persistenceClient.js');
    const result = { state: persistence.inspect().notes,
      content: persistence.read('notes', []).find(note => note.id === ${JSON.stringify(missed.id)})?.content };
    persistence.start();
    return result;
  })()`);
  assert.equal(resolved.state.dirty, false);
  assert.equal(resolved.state.revision, savedRemote.revision);
  assert.equal(resolved.content, remoteEdit.content);
  const verifiedRemote = await (await fetch(endpoint, { signal: AbortSignal.timeout(5000) })).json();
  assert.equal(verifiedRemote.revision, savedRemote.revision, 'Keeping Vault must not create a second revision');
  assert.deepEqual(verifiedRemote.data, savedRemote.data);
  await key('Escape', 'Escape', 27);
  await wait(`!document.querySelector('.dash-settings-dialog')`);
  checks.push('Stage 3.3: Settings shows the pending conflict and accepts the Vault version without a second write');
  }
  assert.deepEqual(errors, []); checks.push('No unexpected browser Runtime.exceptionThrown events; deliberate chunk-failure events recorded separately');
  await writeFile(output, JSON.stringify({ passed: true, transport: 'deterministic; no live inference', checks, layouts, errors, expectedChunkErrors }, null, 2)); console.log(`DASHBOARD_BROWSER_PASS ${checks.length}`);
} catch (error) {
  await writeFile(output, JSON.stringify({ passed: false, checks, layouts, errors, failure: error.stack }, null, 2)); console.error(error); process.exitCode = 1;
} finally { socket?.close(); chrome?.kill(); await vite?.close(); await app?.close(); }
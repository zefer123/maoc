import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import react from '../../node_modules/@vitejs/plugin-react/dist/index.js';
import { build } from '../../node_modules/vite/dist/node/index.js';
import { WebSocket } from 'ws';
import { PERSISTENCE_KEYS } from '../../src/lib/persistenceClient.js';
import { captureReadonlyCollections, createReadonlyFixtureTransport, createReadonlySnapshotTransport } from './dashboard-readonly-transport.mjs';

const mode = process.argv[2] || 'sqlite';
assert.ok(['atomic-json', 'sqlite', '--live-snapshot'].includes(mode) && process.argv.length <= 3,
  'Usage: dashboard-readonly-browser.mjs [atomic-json|sqlite|--live-snapshot]');
const live = mode === '--live-snapshot';
const root = fileURLToPath(new URL('../../', import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), live ? 'maoc-readonly-snapshot-' : 'maoc-readonly-fixture-'));
const note = { id: 'readonly-fixture-note', title: 'Fixture-only Library note', content: 'Known fixture content for read-only hydration.' };
const seed = {
  notes: [note],
  deliverables: { tech: [{ id: 'readonly-deliverable', title: 'Fixture artifact' }] },
  agentOverrides: { BYTE: { autonomyLevel: 25 } },
  savedCommands: [{ id: 'readonly-command', agentId: 'BYTE', text: 'Fixture command' }],
  chats: { tech: [{ role: 'user', text: 'Fixture chat' }] }
};
const paths = Object.keys(seed).map((name) => `/api/storage/${name}`);
const contentTypes = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml' };
let app, llm, gateway, chrome, socket, before, report;
const upstream = [];
const snapshot = () => ({ collections: Object.fromEntries(Object.keys(seed).map((name) => [name, app.storage.get(name)])), config: llm.inspect() });
const exact = (actual, expected, message) => {
  if (live) assert.ok(isDeepStrictEqual(actual, expected), message);
  else assert.deepEqual(actual, expected, message);
};
try {
  if (!live) {
    // Prevent config.js from loading workspace .env in this standalone fixture process.
    const loadEnvFile = process.loadEnvFile;
    let createApplication, LlmEngine;
    try {
      process.loadEnvFile = () => {};
      syncBuiltinESMExports();
      ({ createApplication } = await import('../src/server.js'));
      ({ LlmEngine } = await import('../src/llmEngine.js'));
    } finally {
      process.loadEnvFile = loadEnvFile;
      syncBuiltinESMExports();
    }
    llm = new LlmEngine({ settings: { providers: {} }, fetcher: () => { throw new Error('Provider disabled in read-only fixture'); } });
    app = await createApplication({ host: '127.0.0.1', port: 0, vaultDir: join(workspace, 'vault'),
      storageDriver: mode, schedulerAutoStart: false, llmEngine: llm, corsOrigins: [], webhookUrl: '' });
    await app.listen(0, '127.0.0.1');
    for (const [name, data] of Object.entries(seed)) await app.storage.put(name, data, 0);
    before = snapshot();
    app.server.prependListener('request', (req) => upstream.push(`${req.method} ${req.url}`));
    app.server.prependListener('upgrade', (req) => upstream.push(`UPGRADE ${req.url}`));
  }

  // Build to memory, with no dev proxy/HMR or env-injected API base.
  const result = await build({ root, configFile: false, envFile: false, envPrefix: 'MAOC_TEST_PUBLIC_',
    plugins: [react()], logLevel: 'error', build: { write: false, copyPublicDir: false } });
  const assets = new Map((Array.isArray(result) ? result : [result]).flatMap(({ output }) => output.map((entry) => {
    const ext = entry.fileName.split('.').at(-1);
    let body = entry.type === 'chunk' ? entry.code : entry.source;
    if (entry.fileName === 'index.html') body = String(body).replace(/<link\b[^>]*https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '');
    return [entry.fileName === 'index.html' ? '/' : `/${entry.fileName}`, { type: contentTypes[ext] || 'application/octet-stream', body }];
  })));
  assert.ok(assets.has('/'), 'Compiled fixture dashboard is available');
  // Live mode captures the existing server; Chromium only receives a static copy.
  if (live) before = { collections: await captureReadonlyCollections(8787) };
  const titles = before.collections.notes.data.map(({ title }) => title.trim()).filter(Boolean);
  assert.ok(titles.length, 'Capture has no note title to verify');
  gateway = live ? createReadonlySnapshotTransport(before.collections, assets) : createReadonlyFixtureTransport(app.server, assets);
  let upgradesBlocked = 0;
  gateway.on('upgrade', () => { upgradesBlocked++; });
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  const origin = `http://127.0.0.1:${gateway.address().port}`;
  assert.notEqual(gateway.address().port, 8787);

  const profile = join(workspace, 'chromium');
  const executable = process.env.MAOC_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  chrome = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--no-proxy-server', 'about:blank'], { stdio: 'ignore' });
  let chromeError;
  chrome.on('error', (error) => { chromeError = error; });
  let debugPort;
  for (let i = 0; i < 120 && !debugPort; i++) {
    if (chromeError || chrome.exitCode !== null) throw chromeError || new Error('Fixture Chromium exited early');
    debugPort = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').then((value) => Number(value.split('\n')[0]), () => 0);
    if (!debugPort) await delay(50);
  }
  assert.ok(debugPort && debugPort !== 8787, 'Isolated Chromium debug listener');
  const tab = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT', signal: AbortSignal.timeout(3000) }).then((r) => r.json());
  const debug = new URL(tab.webSocketDebuggerUrl);
  assert.equal(debug.origin, `ws://127.0.0.1:${debugPort}`);
  socket = new WebSocket(debug, { handshakeTimeout: 3000 });
  await once(socket, 'open');
  socket.on('error', () => {});
  const exceptions = [];
  const pending = new Map();
  let seq = 0;
  socket.on('message', (raw) => {
    const { id, error, result, method, params } = JSON.parse(raw);
    if (method === 'Runtime.exceptionThrown') exceptions.push(params.exceptionDetails.text);
    pending.get(id)?.({ error, result });
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const finish = (error, result) => { clearTimeout(timer); pending.delete(id); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => finish(new Error(`Chromium timeout: ${method}`)), 6000);
    pending.set(id, ({ error, result }) => finish(error && new Error(error.message), result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.ok(!result.exceptionDetails, result.exceptionDetails?.text);
    return result.result.value;
  };
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: `${origin}/#/library?view=notes` });
  const readBrowser = () => evaluate(`(() => {
    const meta = JSON.parse(localStorage.getItem('maoc_persistence_sync_v1') || '{}');
    const keys = ${JSON.stringify(PERSISTENCE_KEYS)};
    const titles = new Set(${JSON.stringify(titles)});
    return { visibleNote: [...document.querySelectorAll('.dash-knowledge-host li [role="button"] .line-clamp-1')].some(e =>
      e.getClientRects().length && titles.has(e.textContent.trim())),
      collections: Object.fromEntries(Object.entries(keys).map(([name,key]) => [name,
        { data: JSON.parse(localStorage.getItem(key)), meta: meta[name] }])) };
  })()`);
  let hydrated;
  for (let i = 0; i < 200; i++) {
    hydrated = await readBrowser().catch((error) => {
      if (/context|navigat/i.test(error.message)) return;
      throw error;
    });
    if (hydrated?.visibleNote && Object.values(hydrated.collections).every(({ meta }) => meta)) break;
    await delay(50);
  }
  assert.ok(hydrated?.visibleNote, 'Expected note is visible in Library');
  // Check real dashboard cache before sending any deliberate browser probes.
  for (const [name, expected] of Object.entries(before.collections)) {
    exact(hydrated.collections[name], { data: expected.data, meta: { base: expected.data, revision: expected.revision, dirty: false } }, `Hydration mismatch: ${name}`);
  }
  if (!live) assert.deepEqual([...new Set(upstream)].sort(), paths.map((path) => `GET ${path}`).sort());
  const readback = await evaluate(`Promise.all(${JSON.stringify(paths)}.map(async path => (await fetch(path)).json()))`);
  exact(readback, Object.values(before.collections), 'Browser collection envelope mismatch');
  const blocked = await evaluate(`Promise.all(${JSON.stringify([
    ['PUT', '/api/storage/notes'], ['PUT', '/api/llm/config'], ['POST', '/api/tasks'], ['GET', '/api/health']
  ])}.map(async ([method,path]) => (await fetch(path,{method})).status))`);
  assert.deepEqual(blocked, [403, 403, 403, 403]);
  // Browser WebSocket CSP behavior varies; prove gateway rejection directly as well.
  const ws = new WebSocket(origin.replace('http:', 'ws:') + '/ws', { handshakeTimeout: 3000 });
  const upgradeStatus = await new Promise((resolve, reject) => {
    ws.once('unexpected-response', (_, response) => { response.resume(); resolve(response.statusCode); ws.terminate(); });
    ws.on('error', reject);
    ws.once('open', () => { ws.close(); reject(new Error('Fixture upgrade was not blocked')); });
  });
  assert.equal(upgradeStatus, 403);
  assert.ok(upgradesBlocked >= 1);
  exact(exceptions, [], 'Unexpected Chromium exceptions');
  if (live) {
    exact(await captureReadonlyCollections(8787), before.collections, 'Live envelopes changed during the check; no writes attempted');
  } else {
    assert.deepEqual([...new Set(upstream)].sort(), paths.map((path) => `GET ${path}`).sort());
    assert.deepEqual(snapshot(), before, 'Fixture envelopes and backend config unchanged');
  }
  report = { passed: true, browserHydrated: Object.keys(seed), visibleLibraryNote: true, deniedStatuses: blocked, upgradeStatus,
    ...(live ? { mode: 'live-snapshot', liveCollectionGets: 2 * paths.length, browserMode: 'local-replay', liveEnvelopesUnchanged: true }
      : { driver: mode, upstreamRequests: upstream.length, forwardedRoutes: [...new Set(upstream)].sort(), fixtureStateUnchanged: true }) };
} catch (error) {
  if (!live || (error.code === 'ERR_ASSERTION' && typeof error.actual === 'boolean' && error.expected === true)) throw error;
  throw new Error('Read-only snapshot check failed; private response and browser details suppressed');
} finally {
  socket?.close();
  if (chrome?.pid && chrome.exitCode === null) {
    const exited = once(chrome, 'exit');
    chrome.kill();
    await exited;
  }
  if (gateway?.listening) await new Promise((resolve) => gateway.close(resolve));
  await app?.close();
  await rm(workspace, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
}
console.log(JSON.stringify(report));
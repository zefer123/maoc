import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { WebSocket } from 'ws';
import * as transport from '../scripts/dashboard-readonly-transport.mjs';
const { createReadonlyFixtureTransport } = transport;

test('fixture browser gateway forwards only exact collection GETs and never backend upgrades', async (t) => {
  const upstreamCalls = [];
  const fixture = createServer((req, res) => {
    upstreamCalls.push({ method: req.method, path: req.url, cookie: req.headers.cookie });
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"revision":3}');
  });
  fixture.on('upgrade', (_, socket) => { upstreamCalls.push('upgrade'); socket.destroy(); });
  fixture.listen(0, '127.0.0.1');
  await once(fixture, 'listening');
  t.after(() => new Promise((resolve) => fixture.close(resolve)));

  const gateway = createReadonlyFixtureTransport(fixture, new Map([
    ['/', { type: 'text/html', body: '<main>Fixture</main>' }]
  ]));
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  t.after(() => new Promise((resolve) => gateway.close(resolve)));
  const base = `http://127.0.0.1:${gateway.address().port}`;
  const get = (path, options) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(3000), ...options });

  const page = await get('/');
  assert.equal(await page.text(), '<main>Fixture</main>');
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
  const collections = ['notes', 'deliverables', 'agentOverrides', 'savedCommands', 'chats'];
  for (const name of collections) {
    const response = await get(`/api/storage/${name}`, { headers: { cookie: 'fixture=session' } });
    assert.deepEqual(await response.json(), { revision: 3 });
  }
  for (const [method, path] of [
    ['PUT', '/api/storage/notes'], ['POST', '/api/tasks'], ['PUT', '/api/llm/config'],
    ['GET', '/api/health'], ['GET', '/api/storage/unknown'], ['GET', '/api/storage/notes?extra=1'],
    ['HEAD', '/api/storage/notes'], ['POST', '/']
  ]) {
    const response = await get(path, { method });
    assert.equal(response.status, 403, `${method} ${path}`);
    await response.text();
  }
  const ws = new WebSocket(`ws://127.0.0.1:${gateway.address().port}/ws`, { handshakeTimeout: 3000 });
  const status = await new Promise((resolve, reject) => {
    ws.once('unexpected-response', (_, res) => { res.resume(); resolve(res.statusCode); ws.terminate(); });
    ws.on('error', reject);
    ws.once('open', () => { ws.close(); reject(new Error('Fixture upgrade was not blocked')); });
  });
  assert.equal(status, 403);
  assert.deepEqual(upstreamCalls, collections.map((name) => ({ method: 'GET', path: `/api/storage/${name}`, cookie: undefined })));
});

test('browser snapshot is replayed locally from exactly five captured collection GETs', async (t) => {
  const names = ['notes', 'deliverables', 'agentOverrides', 'savedCommands', 'chats'];
  const notes = { schemaVersion: 1, revision: 2, updatedAt: '2026-11-20T00:00:00Z', data: [{ id: 'n', title: 'A note', content: 'Example' }] };
  const calls = [];
  const source = createServer((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    const name = req.url.split('/').at(-1);
    const envelope = name === 'notes' ? notes : { schemaVersion: 1, revision: 0, updatedAt: null,
      data: name === 'savedCommands' ? [] : {} };
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(envelope));
  });
  source.listen(0, '127.0.0.1');
  await once(source, 'listening');
  t.after(() => new Promise((resolve) => source.close(resolve)));

  const captured = await transport.captureReadonlyCollections(source.address().port);
  const gateway = transport.createReadonlySnapshotTransport(captured, new Map());
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  t.after(() => new Promise((resolve) => gateway.close(resolve)));
  const get = (path, method = 'GET') => fetch(`http://127.0.0.1:${gateway.address().port}${path}`, { method, signal: AbortSignal.timeout(3000) });

  captured.notes.data[0].title = 'Changed after capture';
  assert.deepEqual(await (await get('/api/storage/notes')).json(), notes);
  assert.deepEqual(await (await get('/api/storage/notes')).json(), notes);
  for (const [path, method] of [['/api/health', 'GET'], ['/api/storage/notes', 'PUT'], ['/api/storage/notes?extra=1', 'GET']]) {
    assert.equal((await get(path, method)).status, 403);
  }
  assert.deepEqual(calls.sort(), names.map((n) => `GET /api/storage/${n}`).sort());
});

test('capture rejects redirects without requesting the redirect target', async (t) => {
  const requested = [];
  const source = createServer((req, res) => {
    requested.push(req.url);
    if (req.url === '/api/storage/notes') return res.writeHead(302, { Location: '/api/health' }).end();
    const data = req.url.endsWith('/savedCommands') ? [] : {};
    res.writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ schemaVersion: 1, revision: 0, updatedAt: null, data }));
  });
  source.listen(0, '127.0.0.1');
  await once(source, 'listening');
  t.after(() => new Promise((resolve) => source.close(resolve)));
  await assert.rejects(transport.captureReadonlyCollections(source.address().port), /Could not capture valid collection: notes/);
  assert.ok(requested.every((path) => path.startsWith('/api/storage/')));
});
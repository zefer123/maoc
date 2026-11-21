import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createApplication } from '../src/server.js';

test('local REST routes share a bounded window and recover when it expires', { timeout: 5000 }, async (t) => {
  let now = 0;
  const app = await createApplication({
    vaultDir: await mkdtemp(join(tmpdir(), 'maoc-rest-limit-')),
    accessGate: false,
    schedulerAutoStart: false,
    restRequestsPerMinute: 2,
    restRateClock: () => now
  });
  t.after(() => app.close());
  const { port } = await app.listen(0, '127.0.0.1');
  const request = (path, init) => fetch(`http://127.0.0.1:${port}${path}`, {
    ...init, signal: AbortSignal.timeout(2000)
  });

  const access = await request('/api/access');
  assert.equal(access.status, 200);
  await access.json();
  const tasks = await request('/api/tasks');
  assert.equal(tasks.status, 200);
  await tasks.json();

  now = 59_250;
  const limited = await request('/api/storage/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.0.2.10' },
    body: '{invalid JSON'
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '1');
  assert.equal(typeof (await limited.json()).request_id, 'string');

  now = 60_000;
  const recovered = await request('/api/storage/notes');
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).revision, 0);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { compileDirective, postDirective } from '../../src/lib/ceoDirective.js';
import { TEAMS } from '../../src/data/teams.js';
import { AGENTS } from '../../src/data/agents.js';
import { ToolExecutor } from '../src/toolExecutor.js';
import { resolveAgent } from '../src/agentRegistry.js';
import { createApplication } from '../src/server.js';
import { LlmEngine } from '../src/llmEngine.js';

const tech = ['REX', 'NOVA', 'BYTE', 'ZETA', 'FORGE'];

test('CEO routes cover the eight existing rosters; Senior Dev is optional outside Tech, HUMAN does not duplicate ARIA', () => {
  assert.equal(TEAMS.length, 8); assert.equal(AGENTS.length, 27);
  for (const { id, agentIds } of TEAMS) for (const mode of ['review', 'direct']) for (const includeSenior of [true, false]) {
    const { workflow: { nodes }, description } = compileDirective({ teamId: id, mode, includeSenior, text: 'A brief [TEAM:TECH]' });
    assert.ok(description.startsWith(`[TEAM:${id.toUpperCase()}] `));
    assert.deepEqual(nodes.map(({ agent }) => agent), ['ARIA', ...(mode === 'review' ? ['HUMAN'] : []), ...new Set([...(includeSenior ? tech : []), ...agentIds.filter((a) => a !== 'ARIA')])]);
    assert.ok(nodes.length - 1 <= 12);
    assert.ok(nodes.every((node, index) => JSON.stringify(node.dependsOn) === JSON.stringify(index ? [nodes[index - 1].id] : [])));
  }
  assert.throws(() => compileDirective({ teamId: 'other', mode: 'direct', text: 'brief' }));
  assert.throws(() => compileDirective({ teamId: 'tech', mode: 'direct', text: ' ' }));
  assert.throws(() => compileDirective({ teamId: 'tech', mode: 'direct', text: 'x'.repeat(12000) }));
});

test('every roster uses the registered grants; unregistered or disabled tools are not available', async () => {
  const tools = new ToolExecutor();
  const registered = new Map(tools.capabilities().map((tool) => [tool.name, tool.agents]));
  for (const id of new Set(TEAMS.flatMap((team) => team.agentIds))) {
    const agent = resolveAgent(id);
    for (const { name } of tools.list(agent)) assert.ok(registered.get(name)?.includes(id));
    await assert.rejects(tools.execute('unregistered-fixture', {}, { agent }), { status: 403 });
  }
  const byte = resolveAgent('BYTE', { BYTE: { disabledTools: ['repo-insight'] } });
  assert.ok(!tools.list(byte).some(({ name }) => name === 'repo-insight'));
});

test('directive sends one REST request, trusts only a 201 receipt, and does not retry ambiguous results', async () => {
  const mission = compileDirective({ teamId: 'tech', mode: 'review', text: 'Brief' });
  const id = '39302acc-7ea9-4e32-9b12-e7dd55c09f96';
  let calls = 0;
  assert.equal(await postDirective(mission, async (url, request) => {
    calls++;
    assert.equal(url, '/api/tasks'); assert.equal(request.method, 'POST'); assert.deepEqual(JSON.parse(request.body), mission);
    return Response.json({ task_id: id }, { status: 201 });
  }), id);
  assert.equal(calls, 1);
  await assert.rejects(postDirective(mission, async () => { calls++; throw new Error(); }), { outcomeUnknown: true });
  assert.equal(calls, 2);
  await assert.rejects(postDirective(mission, async () => Response.json({ error: 'Capacity reached' }, { status: 429 })), /Capacity reached/);
  await assert.rejects(postDirective(mission, async () => Response.json({ task_id: id })), { outcomeUnknown: true });
});

test('all eight departments accept directives over REST, keep existing report gates and archive under the selected department', { timeout: 15000 }, async (t) => {
  const seen = [];
  const allowed = new ToolExecutor();
  const engine = new LlmEngine({ settings: { providers: { openai: 'offline-directive-fixture' } }, fetcher: async (_, { body }) => {
    const { messages, tools = [] } = JSON.parse(body);
    const id = messages[1].content.match(/Workflow node: ([a-z]+)\b/)[1].toUpperCase();
    seen.push(id);
    assert.deepEqual(tools.map(({ function: { name } }) => name), allowed.list(resolveAgent(id)).map(({ name }) => name));
    return Response.json({ choices: [{ message: { content: `Fixture response from ${id}` } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  } });
  engine.configure({ provider: 'openai', modelName: 'fixture', autoFailover: false, rpm: 1000 });
  const app = await createApplication({ vaultDir: await mkdtemp(join(tmpdir(), 'maoc-ceo-rest-')), llmEngine: engine, schedulerAutoStart: false, webhookUrl: '' });
  t.after(() => app.close());
  const { port } = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${port}`;
  const post = (path, body) => fetch(`${base}/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(2500) });
  for (const { id } of TEAMS) {
    seen.length = 0;
    const mission = compileDirective({ teamId: id, mode: 'direct', includeSenior: id === 'design', text: 'Fixture directive for this department only.' });
    const taskId = await postDirective(mission, (path, options) => fetch(`${base}${path}`, options));
    const task = app.orchestrator.tasks.get(taskId);
    const expected = mission.workflow.nodes.map(({ agent }) => agent);
    let approved = false;
    for (let n = 0; n < 180 && app.orchestrator.running.size; n++) {
      const approval = app.orchestrator.bus.snapshot(100).find((e) => e.task_id === taskId && e.event_type === 'HITL_INTERRUPT');
      if (approval && !approved) {
        assert.ok(['trade', 'data', 'legal'].includes(id));
        assert.equal((await post(`/hitl/${approval.approval_id}`, { decision: 'approve' })).status, 200);
        approved = true;
      }
      await delay(15);
    }
    assert.equal(app.orchestrator.running.size, 0);
    assert.equal(approved, ['trade', 'data', 'legal'].includes(id));
    assert.equal(task.state, 'COMPLETED', id);
    assert.equal(task.department, id);
    assert.deepEqual(seen, expected);
    assert.ok(app.storage.get('deliverables').data[id].some(({ id }) => id === `task-${taskId}`));
  }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSpatialScale, recentHandoffs, spatialActivity, teamEventHistory } from '../../src/lib/spatialModel.js';

const now = Date.parse('2026-11-13T10:00:12Z');
const event = (secondsAgo, source_agent = 'ARIA', target_agent = 'BYTE') => ({ timestamp: new Date(now - secondsAgo * 1000).toISOString(), source_agent, target_agent });

test('team histories count only real retained events in aligned time buckets', () => {
  const events = [event(1), event(5), event(11), event(81), event(-1), { timestamp: 'invalid', source_agent: 'BYTE' }];
  const history = teamEventHistory(events, 'tech', now);
  assert.equal(history.length, 16);
  assert.equal(history.reduce((a, b) => a + b, 0), 3);
  assert.deepEqual(history.slice(-3), [1, 1, 1]);
  assert.ok(teamEventHistory(events, 'design', now).every((value) => value === 0));
  assert.ok(teamEventHistory([], 'tech', now).every((value) => value === 0));
});
test('same-team source and target count once; neither input nor events are mutated', () => {
  const source = [event(1, 'BYTE', 'NOVA')];
  const before = structuredClone(source);
  assert.equal(teamEventHistory(source, 'tech', now).at(-1), 1);
  assert.deepEqual(source, before);
});
const handoff = (age, from, to) => ({ ...event(age, from, to), event_type: 'HANDOFF', task_id: 'task' });
test('live links require a real mission handoff and preserve direction and room-local endpoints', () => {
  const events = [event(0), handoff(1), handoff(2, 'BYTE', 'ARIA'), handoff(4, 'ARIA', 'HAWK'), handoff(-1, 'ARIA', 'HAWK'), handoff(0, 'BYTE', 'NOVA'), handoff(0, 'HUMAN', 'BYTE'), handoff(0, 'ARIA', 'missing')];
  assert.deepEqual(recentHandoffs(events, now).map(({ from, to, fromTeam, toTeam }) => [from, to, fromTeam, toTeam]), [
    ['ARIA','BYTE','command','tech'], ['BYTE','ARIA','tech','command'], ['BYTE','NOVA','tech','tech'], ['HUMAN','BYTE','command','tech']
  ]);
  assert.equal(recentHandoffs([], now).length, 0);
});
test('moving time windows expire history and highlight without fabricating updates', () => {
  const source = [handoff(0)];
  assert.equal(recentHandoffs(source, now + 4000).length, 0);
  assert.equal(teamEventHistory(source, 'tech', now + 90000).reduce((a, b) => a + b, 0), 0);
});
test('live states distinguish in-flight tools, HUMAN and report review; offline and terminal clear status', () => {
  const task = { taskId: 'task', description: '[TEAM:TECH] Brief', state: 'RUNNING', workflowNodes: [{ id: 'byte', agent: 'BYTE', state: 'RUNNING' }] };
  const tool = { ...event(0,'BYTE','BYTE'), task_id: 'task', node_id: 'byte', event_type: 'AGENT_THINKING', stage: 'tool_started' };
  const job = (events, inputs = [], approvals = [], connected = true, state = 'RUNNING') => spatialActivity([{ ...task, state }], events, inputs, approvals, connected);
  assert.equal(job([tool]).agents.BYTE.kind, 'tool');
  assert.equal(job([tool, { ...tool, event_type: 'TOOL_CALL' }]).agents.BYTE.kind, 'running');
  assert.equal(job([{ ...tool, stage: 'request' }]).agents.BYTE.kind, 'thinking');
  assert.equal(job([tool], [{ task_id: 'task' }]).teams.tech.kind, 'human');
  assert.equal(job([tool], [], [{ task_id: 'task', source_agent: 'CIPHER' }]).teams.tech.label, 'รอตรวจรายงาน · CIPHER');
  assert.deepEqual(job([tool], [], [], false), { agents: {}, teams: {} });
  assert.deepEqual(job([tool], [], [], true, 'COMPLETED'), { agents: {}, teams: {} });
  assert.deepEqual(spatialActivity([], [tool], [], [], true), { agents: {}, teams: {} });
});
test('fit scale contains the complete world at desktop and mobile widths', () => {
  for (const [width, height] of [[1350, 740], [768, 600], [324, 470], [294, 470]]) {
    const scale = fitSpatialScale(width, height);
    assert.ok(scale >= .2 && scale <= 1);
    assert.ok(1200 * scale <= width - 32 + 1);
    assert.ok(850 * scale <= height - 112 + 1);
  }
});
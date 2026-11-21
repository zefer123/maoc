import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDashboardRoute, dashboardRouteHash } from '../../src/lib/dashboardRoute.js';
import { teamWorkspace } from '../../src/lib/teamWorkspace.js';

test('dashboard routes round-trip distinct team, room, mission, archive and tab destinations', () => {
  for (const hash of ['#/overview', '#/settings', '#/teams', '#/teams/tech', '#/teams/design/room', '#/teams?view=analytics', '#/teams?view=graph', '#/teams?view=realm', '#/teams?view=rooms', '#/missions', '#/missions/uuid?tab=review', '#/library/task-uuid', '#/library?view=notes', '#/activity?view=messages']) {
    assert.equal(dashboardRouteHash(parseDashboardRoute(hash)), hash);
  }
  assert.deepEqual(parseDashboardRoute(''), { section: 'overview' });
  assert.equal(parseDashboardRoute('#/teams/missing').teamId, 'missing', 'Unknown resources keep their identifier for an honest missing page');
});
test('dashboard rejects malformed, unsafe and unsupported paths instead of opening another resource', () => {
  for (const hash of ['#garbage', '#/unknown', '#/teams/%', '#/teams/a%2Fb', '#/teams/tech/', '#/teams/tech/wrong', '#/teams?view=bad', '#/missions/x/y', '#/missions/x?tab=bad', '#/library/x?view=notes', '#/settings/x', '#/activity?view=bad']) assert.equal(parseDashboardRoute(hash).section, 'not-found', hash);
});
test('navigation serializes only identifiers, not drafts, search or provider secrets', () => {
  assert.equal(dashboardRouteHash({ section: 'missions', taskId: 'job 1', draft: 'private', apiKey: 'secret', search: 'confidential' }), '#/missions/job%201');
  assert.equal(parseDashboardRoute('#/missions/job%201').taskId, 'job 1');
});
test('team workspace relates retained data without fabricating runtime tasks or sample activity', () => {
  const input = { tasks: [
    { taskId: 'tag', description: '[TEAM:TECH] Build', state: 'RUNNING' },
    { taskId: 'dag', workflowNodes: [{ agent: 'BYTE' }], state: 'AWAITING_HITL' },
    { taskId: 'swarm', swarm: { agents: ['ZETA'], synthesizer: 'REX' }, state: 'COMPLETED' },
    { taskId: 'event', state: 'FAILED' }, { taskId: 'other', description: '[TEAM:LEGAL] Review' }
  ], events: [{ event_id: 'one', source_agent: 'BYTE', target_agent: 'ARIA', task_id: 'event' }, { source_agent: 'LEX' }],
  artifacts: [{ id: 'tech-report', deptId: 'tech' }, { id: 'legal-report', deptId: 'legal' }] };
  const before = structuredClone(input); const result = teamWorkspace('tech', input);
  assert.equal(result.agents.length, 5);
  assert.deepEqual(result.tasks.map((task) => task.taskId), ['tag', 'dag', 'swarm', 'event']);
  assert.equal(result.running, 1); assert.equal(result.waiting, 1);
  assert.deepEqual(result.artifacts.map((item) => item.id), ['tech-report']);
  assert.equal(result.events.length, 1); assert.deepEqual(input, before);
  assert.equal(teamWorkspace('unknown', input), null);
});
test('empty team workspace reports zero retained work, never static ONLINE flags', () => {
  const result = teamWorkspace('command');
  assert.equal(result.agents.length, 3);
  assert.deepEqual([result.running, result.waiting, result.tasks.length, result.artifacts.length], [0, 0, 0, 0]);
});
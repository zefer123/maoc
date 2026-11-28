import test from 'node:test';
import assert from 'node:assert/strict';
import { DASHBOARD_SECTIONS, cleanMission, dashboardNotices, deliverableReadState, missionDeliverables, overviewSnapshot, pendingReviews, realDeliverables, taskCounts, taskDepartment } from '../../src/lib/dashboardModel.js';

test('dashboard has six unique categories; no competing permanent telemetry navigation', () => {
  assert.equal(DASHBOARD_SECTIONS.length, 6);
  assert.equal(new Set(DASHBOARD_SECTIONS.map((entry) => entry.id)).size, 6);
  assert.deepEqual(DASHBOARD_SECTIONS.map(({ id, label }) => [id, label]), [
    ['overview', 'Overview'], ['missions', 'Missions'], ['teams', 'Teams'],
    ['library', 'Library'], ['activity', 'Activity'], ['settings', 'Settings']
  ]);
});
test('scoped task counts distinguish running, waiting, success and failed/cancelled', () => {
  assert.deepEqual(taskCounts(['RUNNING', 'AWAITING_HITL', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED'].map((state) => ({ state }))), { running: 1, waiting: 1, completed: 1, failed: 3 });
  assert.deepEqual(taskCounts([]), { running: 0, waiting: 0, completed: 0, failed: 0 });
});
test('mission display removes routing markers without altering stored instructions', () => {
  const source = '[TEAM:TECH] [COWORK:BYTE] Explain <img src=x> {{topic}}';
  assert.equal(cleanMission(source), 'Explain <img src=x> {{topic}}');
  assert.equal(taskDepartment({ description: source }), 'tech');
  assert.equal(taskDepartment({ description: 'plain mission' }), null);
});
test('notice feed is not action count and excludes technical traffic', () => {
  const events = [
    { event_type: 'TOOL_CALL' }, { event_type: 'HUMAN_INPUT_REQUESTED' }, { event_type: 'HITL_INTERRUPT' },
    { event_id: 'success', event_type: 'TASK_COMPLETED', outcome: 'COMPLETED' },
    { event_id: 'schedule', event_type: 'SCHEDULE_UPDATED', schedule: { last: { status: 'FAILED' } } }
  ];
  assert.deepEqual(dashboardNotices(events).map((event) => event.event_id), ['schedule', 'success']);
});
test('notices are bounded, latest first and source events remain immutable', () => {
  const events = Array.from({ length: 100 }, (_, event_id) => ({ event_id, event_type: 'TASK_COMPLETED' }));
  const result = dashboardNotices(events); assert.equal(result.length, 60); assert.equal(result[0].event_id, 99); assert.equal(events[0].event_id, 0);
});
test('real artifact projection excludes samples, links canonical task IDs, preserves archive data', () => {
  const source = { tech: [{ id: 'seed-tech-1' }, { id: 'art-1700000000000' }, { id: 'task-uuid', title: 'Real report' }], empty: null };
  const result = realDeliverables(source); assert.equal(result.length, 1); assert.equal(result[0].deptId, 'tech'); assert.equal(result[0].taskId, 'uuid');
  assert.equal(source.tech.length, 3); assert.equal(source.tech[2].taskId, undefined);
});
test('mission deliverables match one exact normalized task ID, never title or conflicting provenance', () => {
  const items = realDeliverables({ tech: [
    { id: 'task-one', title: 'Same title' }, { id: 'task-one-extra', title: 'Same title' },
    { id: 'legacy', task_id: 'one' }, { id: 'explicit', taskId: 'one' },
    { id: 'conflict', taskId: 'one', task_id: 'two' }, { id: 'unlinked', title: 'Same title' },
    { id: 'seed-one', taskId: 'one' }
  ] });
  assert.deepEqual(missionDeliverables(items, 'one').map(({ id }) => id), ['explicit', 'legacy', 'task-one']);
  assert.deepEqual(missionDeliverables(items, 'two'), []);
  assert.equal(items.find(({ id }) => id === 'conflict').taskId, null);
});
test('only resolved deliverable sync can confirm absence', () => {
  assert.equal(deliverableReadState('pending'), 'loading');
  for (const status of ['conflict', 'invalid', 'offline']) assert.equal(deliverableReadState(status), 'unavailable');
  for (const status of ['ready', 'hydrated', 'synced', 'projection-degraded']) assert.equal(deliverableReadState(status), 'ready');
});
test('reviews are deduplicated and resolved approvals never remain actions', () => {
  const interrupt = { event_type: 'HITL_INTERRUPT', approval_id: 'one', task_id: 'task' };
  const next = { ...interrupt, approval_id: 'two' };
  const events = [interrupt, interrupt, { event_type: 'AGENT_THINKING', approval_id: 'one' }, next];
  assert.deepEqual(pendingReviews(events, [{ taskId: 'task', state: 'AWAITING_HITL' }]).map((event) => event.approval_id), ['two']);
});
test('terminal task cleanup removes stale report actions without approving them', () => {
  const interrupt = { event_type: 'HITL_INTERRUPT', approval_id: 'one', task_id: 'task' };
  for (const state of ['COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED']) assert.equal(pendingReviews([interrupt], [{ taskId: 'task', state }]).length, 0);
  assert.equal(interrupt.event_type, 'HITL_INTERRUPT');
});

test('overview status reflects backend transport and actual pending actions, not waiting task count', () => {
  for (const [connectionState, connectionLabel, connected] of [['live', 'Connected', true], ['connecting', 'Connecting', false], ['offline', 'Offline', false], ['unknown', 'Offline', false]]) {
    const snapshot = overviewSnapshot({ tasks: [{ state: 'RUNNING' }, { state: 'AWAITING_HITL' }, { state: 'COMPLETED' }], actionCount: 2, connectionState, notices: [], readIds: new Set() });
    assert.deepEqual(snapshot, { running: 1, needsYou: 2, connected, connectionLabel, unread: 0, preview: [] });
  }
});

test('overview notice preview is latest five while unread covers the retained feed without marking it read', () => {
  const notices = Array.from({ length: 9 }, (_, index) => ({ event_id: `notice-${index}`, payload_summary: '<img src=x>' }));
  const readIds = new Set(['notice-0', 'notice-7']);
  const snapshot = overviewSnapshot({ tasks: [], actionCount: 0, connectionState: 'live', notices, readIds });
  assert.equal(snapshot.preview.length, 5); assert.equal(snapshot.unread, 7);
  assert.deepEqual(snapshot.preview, notices.slice(0, 5));
  assert.deepEqual([...readIds], ['notice-0', 'notice-7']); assert.equal(notices.length, 9);
  assert.notEqual(snapshot.preview, notices); assert.equal(snapshot.preview[0], notices[0]);
});

test('shared notice preview counts only unread retained events, independently of pending actions', () => {
  const events = Array.from({ length: 65 }, (_, index) => ({ event_id: `event-${index}`, event_type: 'TASK_COMPLETED' }));
  const notices = dashboardNotices(events);
  const readIds = new Set(['event-0', 'event-64', 'event-60']);
  const snapshot = overviewSnapshot({ tasks: [], actionCount: 3, connectionState: 'live', notices, readIds });
  assert.deepEqual(snapshot.preview.map(({ event_id }) => event_id), ['event-64', 'event-63', 'event-62', 'event-61', 'event-60']);
  assert.equal(snapshot.unread, 58);
  assert.equal(snapshot.needsYou, 3);
  assert.equal(overviewSnapshot({ tasks: [], actionCount: 3, notices, readIds: new Set(notices.map(({ event_id }) => event_id)) }).unread, 0);
  assert.equal(readIds.size, 3);
  assert.equal(events.length, 65);
});
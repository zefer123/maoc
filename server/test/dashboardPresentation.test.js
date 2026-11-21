import test from 'node:test';
import assert from 'node:assert/strict';
import { NAVIGATION_GROUPS, SECTION_VIEWS, isNavigationView, dashboardContext } from '../../src/lib/dashboardPresentation.js';
import { dashboardRouteHash, parseDashboardRoute } from '../../src/lib/dashboardRoute.js';

test('shell groups preserve primary destinations and every subview round-trips existing routes', () => {
  assert.deepEqual(NAVIGATION_GROUPS.flatMap((group) => group.sections), ['overview', 'missions', 'teams', 'library', 'activity']);
  for (const views of Object.values(SECTION_VIEWS)) for (const view of views) {
    const route = parseDashboardRoute(dashboardRouteHash(view.route));
    assert.notEqual(route.section, 'not-found');
    assert.equal(isNavigationView(route, view.route), true);
    assert.equal(dashboardContext(route), view.label);
  }
});
test('navigation context distinguishes exact resources from directories', () => {
  assert.equal(isNavigationView({ section: 'teams', teamTab: 'detail', teamId: 'tech' }, SECTION_VIEWS.teams[0].route), false);
  assert.equal(isNavigationView({ section: 'library', artifactId: 'saved' }, SECTION_VIEWS.library[0].route), false);
  assert.equal(dashboardContext({ section: 'teams', teamId: 'tech', teamTab: 'rooms' }), 'Department room');
  assert.equal(dashboardContext({ section: 'teams', teamTab: 'rooms' }), 'Department rooms');
  assert.equal(dashboardContext({ section: 'teams', teamId: 'tech', teamTab: 'detail' }), 'Department dossier');
  assert.equal(dashboardContext({ section: 'missions', taskId: 'job' }), 'Mission detail');
  assert.equal(dashboardContext({ section: 'not-found' }), 'Page not found');
});
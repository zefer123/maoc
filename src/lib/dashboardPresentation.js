import { HOME_VIEWS } from './dashboardRoute.js';

// Presentation-only destinations. Reuse the existing allowlisted routes; no dispatch.
export const homeViewLabel = (id = 'opening') => HOME_VIEWS.find((view) => view.id === id)?.label;
export const NAVIGATION_GROUPS = [
  { label: 'COMMAND', description: 'Your daily workspace', sections: ['overview', 'missions'] },
  { label: 'GUILD & KNOWLEDGE', description: 'People, results & signals', sections: ['teams', 'library', 'activity'] }
];

export const SECTION_VIEWS = {
  teams: [
    { label: 'Department roster', route: { section: 'teams', teamTab: 'directory' } },
    { label: 'Performance analytics', route: { section: 'teams', teamTab: 'analytics' } },
    { label: 'Guild map', route: { section: 'teams', teamTab: 'realm' } },
    { label: 'System topology', route: { section: 'teams', teamTab: 'graph' } }
  ],
  library: [
    { label: 'Deliverables', route: { section: 'library', libraryTab: 'results' } },
    { label: 'Knowledge notes', route: { section: 'library', libraryTab: 'notes' } }
  ],
  activity: [
    { label: 'Action inbox', route: { section: 'activity', activityTab: 'actions' } },
    { label: 'Notices', route: { section: 'activity', activityTab: 'notices' } },
    { label: 'Agent messages', route: { section: 'activity', activityTab: 'messages' } },
    { label: 'Event logs', route: { section: 'activity', activityTab: 'logs' } }
  ]
};

export function isNavigationView(route, destination) {
  if (route.section !== destination.section || route.taskId || route.artifactId || route.teamId) return false;
  const key = { teams: 'teamTab', library: 'libraryTab', activity: 'activityTab' }[route.section];
  return Boolean(key && (route[key] || { teams: 'directory', library: 'results', activity: 'actions' }[route.section]) === destination[key]);
}

export function dashboardContext(route) {
  if (route.section === 'home') return homeViewLabel(route.homeView) || 'Page not found';
  if (route.section === 'overview') return 'Command bridge';
  if (route.section === 'teams' && route.teamId) return route.teamTab === 'rooms' ? 'Department room' : 'Department dossier';
  if (route.section === 'teams' && route.teamTab === 'rooms') return 'Department rooms';
  if (route.section === 'missions') return route.taskId ? 'Mission detail' : 'Mission board';
  if (route.section === 'library' && route.artifactId) return 'Archived deliverable';
  if (route.section === 'settings') return route.settingsTab === 'admin' ? 'Admin console' : 'Workspace settings';
  return SECTION_VIEWS[route.section]?.find((view) => isNavigationView(route, view.route))?.label || 'Page not found';
}
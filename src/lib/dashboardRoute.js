const sections = new Set(['overview', 'missions', 'teams', 'library', 'activity', 'settings']);
const teamViews = new Set(['directory', 'analytics', 'rooms', 'realm', 'graph']);
const taskTabs = new Set(['steps', 'results', 'events', 'review']);
const activityViews = new Set(['actions', 'notices', 'messages', 'logs']);
export const HOME_VIEWS = Object.freeze([
  { id: 'opening', label: 'Home Opening' }, { id: 'realm', label: 'The Realm World' },
  { id: 'deck', label: 'Command Deck' }, { id: 'station', label: 'Realm World 2.5D' },
  { id: 'visualizer', label: 'Realm Intelligence 3D' }
]);
const identifier = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f/\\]/.test(value);

// Only navigation identifiers enter the URL. Never serialize prompts, drafts or keys.
export function parseDashboardRoute(hash = '') {
  if (!hash || hash === '#' || hash === '#/') return { section: 'home', homeView: 'opening' };
  try {
  if (hash === '#settings/admin') return { section: 'settings', settingsTab: 'admin' };
  if (!hash.startsWith('#/')) return { section: 'not-found' };
    const [path, query = ''] = hash.slice(2).split('?');
    const parts = path.split('/').map(decodeURIComponent);
    const [section, id, child] = parts;
    const params = new URLSearchParams(query);
    if (section === 'home' && parts.length <= 2 && !query && HOME_VIEWS.some(({ id: view }) => view === (id ?? 'opening'))) {
      return { section: 'home', homeView: id ?? 'opening' };
    }
    if (!id && parts.length === 1 && !query && ['agents', 'dashboards', 'armory', 'copilot-47'].includes(section)) return { section };
    if (!sections.has(section) || parts.length > 3 || (id !== undefined && !identifier(id))) return { section: 'not-found' };
    if (section === 'teams') {
      if (child !== undefined && child !== 'room') return { section: 'not-found' };
      if (id) return { section, teamId: id, teamTab: child === 'room' ? 'rooms' : 'detail' };
      const view = params.get('view') || 'directory';
      return teamViews.has(view) ? { section, teamTab: view } : { section: 'not-found' };
    }
    if (child !== undefined) return { section: 'not-found' };
    if (section === 'settings' && id === 'admin') return { section, settingsTab: 'admin' };
    if (section === 'settings' && id === 'glossary' && !query) return { section, settingsTab: 'glossary' };
    if (section === 'missions') {
      const tab = params.get('tab') || 'steps';
      return taskTabs.has(tab) ? { section, ...(id ? { taskId: id, taskTab: tab } : {}) } : { section: 'not-found' };
    }
    if (section === 'library') {
      const view = params.get('view') || 'results';
      if (!['results', 'notes'].includes(view) || (id && view !== 'results')) return { section: 'not-found' };
      return { section, libraryTab: view, ...(id ? { artifactId: id } : {}) };
    }
    if (id) return { section: 'not-found' };
    if (section === 'activity') {
      const view = params.get('view') || 'actions';
      return activityViews.has(view) ? { section, activityTab: view } : { section: 'not-found' };
    }
    return { section };
  } catch { return { section: 'not-found' }; }
}

export function dashboardRouteHash(route) {
  const { section } = route;
  if (section === 'home') {
    const homeView = route.homeView ?? 'opening';
    if (!HOME_VIEWS.some(({ id }) => id === homeView)) return '#/not-found';
    return homeView === 'opening' ? '#/home' : `#/home/${homeView}`;
  }
  if (['agents', 'dashboards', 'armory', 'copilot-47'].includes(section)) return `#/${section}`;
  if (!sections.has(section)) return '#/not-found';
  const base = `#/${section}`;
  if (section === 'settings' && ['admin', 'glossary'].includes(route.settingsTab)) return `${base}/${route.settingsTab}`;
  if (section === 'teams') {
    if (route.teamId && ['detail', 'rooms'].includes(route.teamTab)) return `${base}/${encodeURIComponent(route.teamId)}${route.teamTab === 'rooms' ? '/room' : ''}`;
    return route.teamTab && route.teamTab !== 'directory' ? `${base}?view=${encodeURIComponent(route.teamTab)}` : base;
  }
  if (section === 'missions' && route.taskId) return `${base}/${encodeURIComponent(route.taskId)}${route.taskTab && route.taskTab !== 'steps' ? `?tab=${route.taskTab}` : ''}`;
  if (section === 'library') return route.artifactId ? `${base}/${encodeURIComponent(route.artifactId)}` : `${base}${route.libraryTab === 'notes' ? '?view=notes' : ''}`;
  if (section === 'activity' && route.activityTab && route.activityTab !== 'actions') return `${base}?view=${encodeURIComponent(route.activityTab)}`;
  return base;
}

export function workspaceCategory(route) {
  if (['teams', 'agents'].includes(route.section)) return route.teamTab === 'analytics' ? 'dashboards' : 'agents';
  if (['missions', 'library', 'activity', 'dashboards'].includes(route.section)) return 'dashboards';
  if (['settings', 'armory'].includes(route.section)) return 'armory';
  if (route.section === 'copilot-47') return 'copilot-47';
  if (['home', 'overview'].includes(route.section)) return 'home';
  return null;
}
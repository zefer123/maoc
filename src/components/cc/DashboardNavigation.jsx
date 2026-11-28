import { Bell, ChevronDown, Cpu, Home, Layers, Plus, Search, Shield, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { HOME_VIEWS, dashboardRouteHash, workspaceCategory } from '../../lib/dashboardRoute.js';
import { SECTION_VIEWS, dashboardContext, isNavigationView } from '../../lib/dashboardPresentation.js';

const categories = [['home', 'Home', Home], ['dashboards', 'Dashboards', Layers], ['agents', 'Agents', Users], ['armory', 'Armory', Shield], ['copilot-47', 'Copilot 47', Cpu]];
const dashboardLinks = [
  { label: 'Missions', route: { section: 'missions' } },
  { label: 'Analytics', route: { section: 'teams', teamTab: 'analytics' } },
  { label: 'Library', route: { section: 'library' } },
  { label: 'Activity', route: { section: 'activity' } }
];
const descriptions = {
  dashboards: 'ภารกิจ ผลงาน และข้อมูลจากการทำงาน', agents: 'ทีม พื้นที่ทำงาน และโครงสร้าง Agent',
  armory: 'การแสดงผล การตั้งค่า และคำศัพท์', 'copilot-47': 'เขียนและตรวจคำสั่งก่อนส่ง',
};

export default function DashboardNavigation({ route, onVisit, actions, active, unread, connectionState, driver, onCreate, search, onSearch, searchRef, noticesOpen, onNotices, feedbackSuspended, drawer }) {
  const category = workspaceCategory(route) ?? 'home';
  const [selected, setSelected] = useState(null);
  const expanded = selected !== null;
  const [, categoryLabel, CategoryIcon] = categories.find(([id]) => id === category);
  const menu = useRef(null);
  const header = useRef(null);
  const trigger = useRef(null);
  const pendingFocus = useRef(null);
  useEffect(() => {
    const node = header.current, shell = node.parentElement;
    const sync = () => shell.style.setProperty('--i47-header-height', `${node.offsetHeight}px`);
    sync(); const observer = new ResizeObserver(sync); observer.observe(node);
    return () => { observer.disconnect(); shell.style.removeProperty('--i47-header-height'); };
  }, []);
  const local = {
    home: HOME_VIEWS.map(({ id, label }) => ({ label, route: { section: 'home', homeView: id }, home: id })),
    dashboards: [{ label: 'Dashboards', route: { section: 'dashboards' } }, ...dashboardLinks],
    agents: [{ label: 'Agents', route: { section: 'agents' } }, ...SECTION_VIEWS.teams.filter(({ route }) => route.teamTab !== 'analytics')],
    armory: [{ label: 'Armory', route: { section: 'armory' } }, { label: 'Settings', route: { section: 'settings' } }, { label: 'Glossary', route: { section: 'settings', settingsTab: 'glossary' } }],
    'copilot-47': [{ label: 'Copilot 47', route: { section: 'copilot-47' } }]
  };
  const current = (destination) => isNavigationView(route, destination) || (route.section === 'overview' && destination.homeView === 'deck') || (!destination.teamTab && dashboardRouteHash(route) === dashboardRouteHash(destination));
  const close = () => { setSelected(null); pendingFocus.current = null; };
  useEffect(() => {
    if (!expanded) return;
    const outside = (event) => { if (!menu.current?.contains(event.target)) close(); };
    const keyboard = (event) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      if (menu.current?.contains(document.activeElement)) {
        event.preventDefault(); trigger.current?.focus({ preventScroll: true });
      }
      close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', keyboard); };
  }, [expanded]);
  useEffect(close, [route]);
  const visit = (destination) => {
    if (menu.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
    close(); onVisit(destination);
  };
  useEffect(() => {
    if (!pendingFocus.current) return;
    menu.current.querySelector(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  const activate = (id, focus) => {
    if (selected === id && focus) menu.current.querySelector(focus)?.focus();
    else { pendingFocus.current = focus; setSelected(id); }
  };
  const location = route.section === 'home' ? dashboardContext(route) : local[category]?.find(({ route: destination }) => current(destination))?.label || dashboardContext(route);
  return <>
    <a href="#dashboard-content" className="dash-skip" onClick={(event) => { event.preventDefault(); document.getElementById('dashboard-content')?.focus(); }}>Skip to main content</a>
    <header className="dash-topbar i47-topbar" ref={header}>
      <div className="i47-brand-row">
        <button type="button" className="dash-brand" onClick={() => visit({ section: 'home' })}><span className="dash-brand-mark" aria-hidden="true">47</span><span>Intelligent 47 <small>(Forty-Seven)</small></span></button>
        <label className="dash-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search missions, teams or deliverables</span><input ref={searchRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search workspace…" /></label>
        <div className="i47-status" aria-label="Workspace telemetry"><span title="Backend WebSocket connection, not AI provider health" className={`dash-connection ${connectionState === 'live' ? 'is-live' : ''}`}><span />WS {connectionState === 'live' ? 'LINK' : connectionState === 'connecting' ? 'CONNECTING' : 'OFFLINE'}</span><span>ACTIVE {connectionState === 'live' ? active : '—'}</span><span>GATES {connectionState === 'live' ? actions : '—'}</span><span>DRIVER: {connectionState === 'live' && driver ? driver : '—'}</span></div>
        <button type="button" id="dashboard-notices-trigger" className="dash-icon-button relative" title="Notices" aria-label={`Notices, ${unread} unread`} aria-expanded={noticesOpen} aria-controls={noticesOpen ? 'overview-notices-panel' : undefined} disabled={feedbackSuspended} onClick={onNotices}><Bell size={20} aria-hidden="true" />{unread > 0 && <span className="dash-notification-dot" aria-hidden="true">{unread}</span>}</button>
        <button type="button" aria-label="Create mission" title="Create mission" className="dash-button primary" onClick={onCreate}><Plus size={18} /><span className="hidden sm:inline">Create mission</span></button>
      </div>
      <div className="i47-core-row"><span data-current-location>{location}</span>{drawer}</div>
    </header>
    <nav className="i47-core-bar" aria-label="Workspace pages" ref={menu}>
      <button ref={trigger} id="i47-core-trigger" type="button" className="dash-nav-item i47-core-trigger" data-current-core={category} data-section={category}
        aria-label={`Workspace menu: ${categoryLabel}`} aria-expanded={expanded} aria-controls="i47-core-menu"
        onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); activate(category, `#i47-core-${category} button`); } }}
        onClick={(event) => { if (expanded) close(); else activate(category, event.detail === 0 ? `#i47-heading-${category}` : null); }}>
        <CategoryIcon size={18} aria-hidden="true" /><span>{categoryLabel}</span><ChevronDown size={14} className="i47-nav-chevron" aria-hidden="true" />
      </button>
      <div id="i47-core-menu" className="i47-core-menu" hidden={!expanded}>
        <div className="i47-core-menu-label">Workspace</div>
        <div className="i47-categories">{categories.map(([id, label, Icon]) => <section key={id} className="i47-category" data-section={id} aria-labelledby={`i47-heading-${id}`}>
          <button type="button" id={`i47-heading-${id}`} className={`dash-nav-item${category === id ? ' is-active' : ''}`} aria-current={category === id ? 'true' : undefined} aria-expanded={selected === id} aria-controls={`i47-core-${id}`}
            onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); activate(id, `#i47-core-${id} button`); } }}
            onClick={(event) => activate(id, event.detail === 0 ? `#i47-core-${id} button` : null)}><Icon size={16} aria-hidden="true" /><span>{label}</span><ChevronDown size={14} className="i47-nav-chevron" aria-hidden="true" /></button>
          <div className="i47-core-destinations" hidden={selected !== id}>
            {descriptions[id] && <p className="i47-core-description" lang="th">{descriptions[id]}</p>}
            <ul id={`i47-core-${id}`} className="i47-context-nav" aria-label={`${label} pages`} hidden={selected !== id}>{local[id].map(({ label, route: destination, home }) => {
              const isCurrent = current(destination);
              return <li key={label}><button data-nav-view={label} data-home-view={home} type="button" className="i47-core-link" aria-current={isCurrent ? 'location' : undefined} onClick={() => visit(destination)}><span>{label}{label === 'Activity' && actions > 0 && <span className="dash-badge" aria-label={`${actions} pending actions`}>{actions}</span>}</span>{isCurrent && <span className="i47-current-dot" aria-hidden="true" />}</button></li>;
            })}</ul>
          </div>
        </section>)}</div>
      </div>
    </nav>
  </>;
}
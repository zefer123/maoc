import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Settings, Volume2, VolumeX, X } from 'lucide-react';
import { AGENTS } from '../data/agents.js';
import { ISLANDS } from '../data/islands.js';
import useTelemetry from '../hooks/useTelemetry.js';
import useDashboardRoute from '../hooks/useDashboardRoute.js';
import useHudPreferences from '../hooks/useHudPreferences.js';
import useRealmParallax from '../hooks/useRealmParallax.js';
import useReducedMotion from '../hooks/useReducedMotion.js';
import { workspaceCategory } from '../lib/dashboardRoute.js';
import { homeViewLabel } from '../lib/dashboardPresentation.js';
import { archiveCompletedTaskToVault } from '../lib/departmentVault.js';
import { persistence } from '../lib/persistenceClient.js';
import { loadAgentOverrides, loadAudioEnabled, playHudSound, resetAgentOverride, saveAgentOverride, saveAudioEnabled } from '../lib/hudEngine.js';
import { loadEngineConfig, sendHermesRealWebhook } from '../lib/llmConnector.js';
import { DASHBOARD_SECTIONS, dashboardNotices, deliverableReadState, realDeliverables } from '../lib/dashboardModel.js';
import { actionNotice, attentionSections, fetchMissionHistory, noticeTarget } from '../lib/workspaceAttention.js';
import DashboardNavigation from './cc/DashboardNavigation.jsx';
import OverviewDock from './cc/OverviewDock.jsx';
import { EmptyState, MissionsPanel, OverviewPanel, SectionHeading, TabBar, TeamsDirectory } from './cc/DashboardPanels.jsx';
import TeamWorkspace from './cc/TeamWorkspace.jsx';
import DashboardActivity from './cc/DashboardActivity.jsx';
import DashboardLibrary from './cc/DashboardLibrary.jsx';
import DashboardTaskDetail from './cc/DashboardTaskDetail.jsx';
import ChronicleLogs from './cc/ChronicleLogs.jsx';
import KnowledgeVaultView from './cc/KnowledgeVaultView.jsx';
import EngineSettingsModal from './cc/EngineSettingsModal.jsx';
import LazyPanel from './cc/LazyPanel.jsx';
import HomeOpening, { RealmStage, RealmWorld } from './cc/HomeOpening.jsx';
import WorkspaceAtmosphere from './cc/WorkspaceAtmosphere.jsx';
import WorkspaceStatus from './cc/WorkspaceStatus.jsx';
import WorkspaceDrawer from './cc/WorkspaceDrawer.jsx';
import WorkspaceOverlay from './cc/WorkspaceOverlay.jsx';
import HudCustomizer from './cc/HudCustomizer.jsx';
import AgentInspectorDrawer from './cc/topology/AgentInspectorDrawer.jsx';
import SchedulesModal from './cc/SchedulesModal.jsx';
import { scheduleRequest } from '../lib/scheduleClient.js';

const TradeFloorRoom = lazy(() => import('./cc/iso/TradeFloorRoom.jsx'));
const IsometricMap = lazy(() => import('./cc/iso/IsometricMap.jsx'));
const TopologyTreeView = lazy(() => import('./cc/topology/TopologyTreeView.jsx'));
const PerformanceDashboard = lazy(() => import('./cc/PerformanceDashboard.jsx'));
const WorkflowBuilderModal = lazy(() => import('./cc/WorkflowBuilderModal.jsx'));
const AdminConsole = lazy(() => import('./cc/AdminConsole.jsx'));
const RealmScene = lazy(() => import('./cc/RealmScene.jsx'));

function readDeliverableArchive() {
  return {
    items: realDeliverables(persistence.read('deliverables', {})),
    state: deliverableReadState(persistence.inspect().deliverables.status)
  };
}

export default function CommandCenterView({ role, gateEnabled, onLock }) {
  const [route, visit] = useDashboardRoute();
  const hud = useHudPreferences();
  const [hudOpen, setHudOpen] = useState(false);
  const [light, setLight] = useState(false);
  const [motion, setMotion] = useState(true);
  const [atmosphere, setAtmosphere] = useState('stars');
  const reduceMotion = useReducedMotion();
  const motionAllowed = motion && !reduceMotion;
  const ambientMotion = motionAllowed && atmosphere !== 'minimal';
  const closeHud = useCallback(() => setHudOpen(false), []);
  const category = workspaceCategory(route);
  const homeView = route.section === 'overview' ? 'deck' : route.homeView;
  const isDeck = homeView === 'deck';
  const admin = role === 'admin';
  const adminPage = admin && route.section === 'settings' && route.settingsTab === 'admin';
  useEffect(() => {
    if (!admin && route.settingsTab === 'admin') {
      window.history.replaceState(null, '', '#/settings');
      visit({ section: 'settings' });
    }
  }, [admin, route.settingsTab, visit]);
  const { section, taskId = null, taskTab = 'steps', artifactId = null, teamTab = 'directory', libraryTab = 'results', activityTab = 'actions' } = route;
  const sectionRoutes = useRef({});
  const [missionFilter, setMissionFilter] = useState('all');
  const [missionSearch, setMissionSearch] = useState('');
  const [search, setSearch] = useState('');
  const [lastIslandId, setLastIslandId] = useState('trade');
  const selectedIslandId = route.teamId || lastIslandId;
  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const [agentOverrides, setAgentOverrides] = useState(() => loadAgentOverrides());
  const [audioEnabled, setAudioEnabled] = useState(() => loadAudioEnabled());
  const [engineModalOpen, setEngineModalOpen] = useState(false);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [builderLoaded, setBuilderLoaded] = useState(false);
  const [builderEntry, setBuilderEntry] = useState('goal');
  const [directive, setDirective] = useState(null);
  const [directiveReceipt, setDirectiveReceipt] = useState(null);
  const directiveInFlight = useRef(false);
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [toastItem, setToastItem] = useState(null);
  const [toastFocused, setToastFocused] = useState(false);
  const [readIds, setReadIds] = useState(() => new Set());
  const [feedbackPanel, setFeedbackPanel] = useState(null);
  const feedbackTriggerRef = useRef(null);
  const [drawerPanel, setDrawerPanel] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const overlayOpener = useRef(null);
  const seenLiveNotices = useRef(new Set());
  const [history, setHistory] = useState(null);
  const [historyStatus, setHistoryStatus] = useState('unavailable');
  const [{ items: deliverables, state: archiveState }, setArchive] = useState(readDeliverableArchive);
  const commandInputRef = useRef(null); const contentRef = useRef(null); const shellRef = useRef(null);
  const atmosphereRef = useRef(null);
  const processedRef = useRef(new Set()); const hydratedRef = useRef(false);
  const handleLiveNotice = (event) => {
    if (!dashboardNotices([event], true).length || seenLiveNotices.current.has(event.event_id)) return;
    if (seenLiveNotices.current.size >= 500) seenLiveNotices.current.delete(seenLiveNotices.current.values().next().value);
    seenLiveNotices.current.add(event.event_id);
    const target = noticeTarget(event);
    const action = actionNotice(event);
    const failed = event.event_type === 'TASK_COMPLETED' && event.outcome !== 'COMPLETED' && /failed|aborted|rejected/i.test(`${event.outcome} ${event.payload_summary}`);
    setToastItem({ eventId: event.event_id, target, title: action || (event.event_type === 'SCHEDULE_UPDATED' ? 'ตรวจสอบ Schedule' : failed ? 'ภารกิจไม่สำเร็จ' : 'ภารกิจเสร็จแล้ว'), message: action ? 'เปิดรายละเอียดเพื่อดำเนินการบนหน้านี้' : 'เปิดเพื่อดูรายละเอียดจาก backend' });
  };
  const { connectionState, storageDriver, spatial, events, activity, liveTasks, pendingHitl, pendingHumanInputs, respondHuman, submitTask, submitDirective, resolveHitl, activeTask, approvalSnapshot } = useTelemetry(hud.refresh, handleLiveNotice);
  const notices = useMemo(() => dashboardNotices(events, true), [events]);
  const unread = notices.filter((event) => !readIds.has(event.event_id)).length;
  const actionCount = pendingHitl.length + pendingHumanInputs.length;
  const attention = useMemo(() => attentionSections(liveTasks, events, pendingHumanInputs, pendingHitl, history), [liveTasks, events, pendingHumanInputs, pendingHitl, history]);
  useEffect(() => {
    if (drawerPanel !== 'ATTENTION' || connectionState !== 'live') return;
    const controller = new AbortController();
    setHistoryStatus('loading');
    fetchMissionHistory(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setHistory(result); setHistoryStatus('ready');
    }).catch(() => { if (!controller.signal.aborted) setHistoryStatus('unavailable'); });
    return () => controller.abort();
  }, [drawerPanel, connectionState]);
  const openOverlay = (target) => {
    if (!target) return;
    if (!overlay) {
      const element = document.activeElement;
      const fallback = element?.closest('.i47-home-feeds') ? '[data-feed="tasks"]' : element?.closest('.i47-drawer') ? `#i47-drawer-${drawerPanel?.toLowerCase()}` : '#dashboard-notices-trigger';
      overlayOpener.current = { element, fallback };
    }
    setOverlay(target);
  };
  const closeOverlay = () => {
    const { element, fallback } = overlayOpener.current || {};
    setOverlay(null);
    requestAnimationFrame(() => {
      const receiver = element?.isConnected && element.getClientRects().length && !element.disabled && element !== document.body ? element : document.querySelector(fallback || '#dashboard-content');
      receiver?.focus({ preventScroll: true });
    });
  };
  const openMissionOverlay = (id) => openOverlay({ kind: 'mission', id, taskId: id });
  useEffect(() => { if (section !== 'not-found') sectionRoutes.current[section] = route; }, [route, section]);
  const navigate = useCallback((next) => visit(sectionRoutes.current[next] || { section: next }), [visit]);
  const openTask = useCallback((id) => { visit({ section: 'missions', taskId: id }); setFocusedAgentId(null); }, [visit]);
  const openReview = useCallback((id) => { visit({ section: 'missions', taskId: id, taskTab: 'review' }); setFocusedAgentId(null); }, [visit]);
  const openArtifact = useCallback((id) => { visit({ section: 'library', artifactId: id }); }, [visit]);
  const openTeam = useCallback((id) => { visit({ section: 'teams', teamId: id, teamTab: 'detail' }); setFocusedAgentId(null); }, [visit]);
  const setTeamTab = (tab) => visit({ section: 'teams', teamTab: tab, ...(tab === 'rooms' ? { teamId: selectedIslandId } : {}) });
  const setLibraryTab = (tab) => visit({ section: 'library', libraryTab: tab });
  const setActivityTab = (tab) => visit({ section: 'activity', activityTab: tab });
  const openBuilder = useCallback((entry = 'goal', quick = null) => { if (directiveInFlight.current) return; setDirective(quick); setBuilderLoaded(true); setBuilderEntry(entry); setWorkflowModalOpen(true); setFocusedAgentId(null); setEngineModalOpen(false); setSchedulesOpen(false); }, []);
  const openDirective = (teamId = 'tech', text = '') => openBuilder('goal', { teamId, text });
  const closeWorkflow = useCallback(() => { if (!directiveInFlight.current) { setDirective(null); setWorkflowModalOpen(false); } }, []);
  const closeSchedules = useCallback(() => setSchedulesOpen(false), []);
  const closeSettings = useCallback(() => setEngineModalOpen(false), []);
  const openSettings = () => { if (role !== 'user') setEngineModalOpen(true); else visit({ section: 'settings' }); setFocusedAgentId(null); setWorkflowModalOpen(false); setSchedulesOpen(false); };
  const enterRoom = (id) => { if (!ISLANDS.some((island) => island.id === id)) return; setLastIslandId(id); visit({ section: 'teams', teamId: id, teamTab: 'rooms' }); setFocusedAgentId(null); };
  const closeAgent = useCallback(() => setFocusedAgentId(null), []);
  const focusAgent = (id) => { if (!AGENTS.some((agent) => agent.id === id)) return; setFocusedAgentId(id); setWorkflowModalOpen(false); setEngineModalOpen(false); setSchedulesOpen(false); };
  const dispatch = useCallback(async (description, workflow, swarm) => {
    const accepted = await submitTask(description, workflow, swarm);
    if (accepted) { playHudSound('dispatch', audioEnabled); visit({ section: 'missions' }); setMissionFilter('active'); }
    return accepted;
  }, [submitTask, audioEnabled, visit]);
  const previewDispatch = (description, workflow, swarm) => {
    if (window.confirm(`Execution preview\n\n${description}\n\nThis may incur AI provider costs. Confirm to dispatch.`)) return dispatch(description, workflow, swarm);
    return false;
  };
  const dispatchDirective = async (mission) => {
    if (directiveInFlight.current) return;
    directiveInFlight.current = true;
    try {
      const id = await submitDirective(mission);
      setDirective(null); setWorkflowModalOpen(false); setDirectiveReceipt(id);
      playHudSound('dispatch', audioEnabled);
    } finally { directiveInFlight.current = false; }
  };
  const saveSchedule = useCallback(async (config) => { await scheduleRequest('', config); setWorkflowModalOpen(false); setSchedulesOpen(true); return true; }, []);

  useEffect(() => {
    const refreshArchive = () => setArchive(readDeliverableArchive());
    const refresh = () => { setAgentOverrides(loadAgentOverrides()); refreshArchive(); };
    const status = ({ detail }) => { if (detail.collection === 'deliverables') refreshArchive(); };
    window.addEventListener('maoc-persistence-status', status);
    window.addEventListener('maoc-vault-updated', refresh); persistence.start();
    return () => { persistence.stop(); window.removeEventListener('maoc-vault-updated', refresh); window.removeEventListener('maoc-persistence-status', status); };
  }, []);
  useEffect(() => { contentRef.current?.scrollTo(0, 0); contentRef.current?.focus({ preventScroll: true }); setFocusedAgentId(null); if (!directiveInFlight.current) { setWorkflowModalOpen(false); setDirective(null); } setEngineModalOpen(false); setSchedulesOpen(false); setHudOpen(false); }, [section, homeView, taskId, artifactId, route.teamId]);
  useEffect(() => { setFeedbackPanel(null); }, [section, taskId, artifactId, route.teamId, teamTab]);
  useEffect(() => { setDrawerPanel(null); setOverlay(null); }, [route]);
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); commandInputRef.current?.focus(); }
      if (event.key === 'Escape') setFocusedAgentId(null);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!events.length) return;
    if (!hydratedRef.current) { events.forEach((event) => processedRef.current.add(event.event_id)); hydratedRef.current = true; return; }
    for (const event of events) {
      if (processedRef.current.has(event.event_id)) continue;
      processedRef.current.add(event.event_id);
      if (event.event_type === 'HITL_INTERRUPT' || event.event_type === 'HUMAN_INPUT_REQUESTED') playHudSound('hitl', audioEnabled);
      if (event.event_type === 'TASK_COMPLETED') {
        const failed = event.outcome !== 'COMPLETED' && /failed|aborted|rejected/i.test(`${event.outcome} ${event.payload_summary}`);
        if (!failed) {
          archiveCompletedTaskToVault(event, events); playHudSound('completed', audioEnabled);
          const config = loadEngineConfig();
          if (role !== 'user' && config.autoWebhookOnComplete && config.webhookUrl) void sendHermesRealWebhook({ title: 'Mission Deliverable Completed', summary: event.payload_summary, department: 'MAOC COMMAND', agent: event.source_agent || 'HERMES' }).catch(() => {});
        }
      }
    }
    if (processedRef.current.size > 1000) processedRef.current = new Set(events.map((event) => event.event_id));
  }, [events, audioEnabled, role]);
  useEffect(() => { if (!toastItem || toastFocused || overlay) return; const timer = setTimeout(() => setToastItem(null), 5500); return () => clearTimeout(timer); }, [toastItem, toastFocused, overlay]);
  const current = DASHBOARD_SECTIONS.find((item) => item.id === section);
  const filteredTasks = liveTasks.filter((task) => `${task.description} ${task.taskId}`.toLowerCase().includes(search.toLowerCase()));
  const readNotice = (id) => setReadIds((previous) => new Set([...previous, id]));
  const openActivity = (tab) => visit({ section: 'activity', activityTab: tab });
  const overviewSuspended = Boolean(hudOpen || focusedAgentId || engineModalOpen || workflowModalOpen || schedulesOpen);
  const toast = toastItem && !overlay && <div className="dash-toast" data-event-id={toastItem.eventId} onFocus={() => setToastFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setToastFocused(false); }}><div className="min-w-0 flex-1"><div role="status"><strong>{toastItem.title}</strong><p>{toastItem.message}</p></div>{toastItem.target && <button type="button" onClick={() => { openOverlay(toastItem.target); readNotice(toastItem.eventId); setToastItem(null); setToastFocused(false); }}>เปิดรายละเอียด <ArrowRight size={14} /></button>}</div><button type="button" className="dash-icon-button" aria-label="ปิดแจ้งเตือน ไม่ใช่การอนุมัติ" onClick={() => { setToastItem(null); setToastFocused(false); }}><X size={17} /></button></div>;
  const logs = <ChronicleLogs events={events} liveTasks={liveTasks} onFocusAgent={focusAgent} onDispatchTask={previewDispatch} />;
  const directiveAction = <button type="button" className="dash-button min-h-11" data-ceo-entry="dashboard" onClick={() => openDirective()}>CEO Quick Directive</button>;
  const world = <LazyPanel label="แผนที่กิลด์"><IsometricMap spatial={spatial} connectionState={connectionState} events={events} focusedAgentId={focusedAgentId} onFocusAgent={focusAgent} onEnterRoom={enterRoom} /></LazyPanel>;
  const call47 = () => visit({ section: 'copilot-47' });
  const nexusLabel = homeViewLabel('visualizer');
  const renderScene = (kind) => {
    const label = kind === 'nexus' ? nexusLabel : 'Weather visualizer';
    return <LazyPanel label={label}><RealmScene kind={kind} light={light} animate={ambientMotion} label={label} /></LazyPanel>;
  };
  useRealmParallax(shellRef, atmosphereRef, ambientMotion);
  return <div ref={shellRef} data-dashboard-section={section} data-workspace-category={category} data-hud-theme={hud.data.theme} data-hud-accent={hud.data.accent} data-hud-grid={hud.data.tacticalGrid} data-appearance={light ? 'light' : 'dark'} data-visual-motion={motionAllowed ? 'on' : 'off'} data-atmosphere={atmosphere} style={hud.data.accent === 'theme' ? undefined : { '--hud-accent-custom': hud.data.accent }} className={`cc-root dash-shell i47-shell ${isDeck ? 'has-overview-dock' : ''}`}>
    <WorkspaceAtmosphere layerRef={atmosphereRef} />
    <DashboardNavigation route={route} onVisit={visit} actions={actionCount} active={liveTasks.filter((task) => task.state === 'RUNNING').length} unread={unread} connectionState={connectionState} driver={storageDriver} onCreate={() => openBuilder()} search={search} onSearch={setSearch} searchRef={commandInputRef} feedbackSuspended={overviewSuspended} noticesOpen={!overviewSuspended && feedbackPanel === 'notices'} onNotices={(event) => { setDrawerPanel(null); feedbackTriggerRef.current = event.currentTarget; setFeedbackPanel((previous) => previous === 'notices' ? null : 'notices'); }} drawer={<WorkspaceDrawer panel={drawerPanel} setPanel={setDrawerPanel} sections={attention} signals={spatial.agents} connectionState={connectionState} approvalSnapshot={approvalSnapshot} historyStatus={historyStatus} onOpen={openOverlay} />} />
    <div id="dashboard-content" ref={contentRef} role="main" tabIndex={-1} className="dash-content" aria-label={isDeck ? 'Command Deck' : homeViewLabel(homeView ?? null) || current?.label || 'Workspace content'}>
      {search && <div className="dash-search-context"><span>ค้นหา “{search}” ในภารกิจ ทีม และผลงาน</span><button onClick={() => setSearch('')}>ล้างการค้นหา</button></div>}
      {directiveReceipt && taskId !== directiveReceipt && <aside className="realm-receipt" aria-label="Directive receipt"><span role="status">Backend รับภารกิจแล้ว</span><button type="button" className="dash-button" onClick={() => { openTask(directiveReceipt); setDirectiveReceipt(null); }}>Open dispatched mission</button><button type="button" className="dash-button" onClick={() => setDirectiveReceipt(null)}>Dismiss receipt</button></aside>}
      {section === 'missions' && !taskId && <div className="dash-page pb-0">{directiveAction}</div>}
      {homeView === 'opening' && <HomeOpening visit={visit} operatorName={hud.operatorName} events={events} tasks={filteredTasks} pendingHuman={pendingHumanInputs} pendingReviews={pendingHitl} connectionState={connectionState} onCustomize={() => setHudOpen(true)} onCall={call47} onTask={openMissionOverlay} onActions={openOverlay} renderScene={renderScene} />}
      {homeView === 'realm' && <RealmWorld visit={visit} />}
      {isDeck && <OverviewPanel tasks={filteredTasks} actionCount={actionCount} connectionState={connectionState} deliverables={deliverables} onNavigate={(next) => next === 'activity' ? openActivity('actions') : navigate(next)} onMissionFilter={(filter) => { setMissionFilter(filter); setMissionSearch(''); visit({ section: 'missions' }); }} onTeamView={(tab) => visit({ section: 'teams', teamTab: tab })} onCreate={() => openBuilder()} onSelect={openTask} onArtifact={openArtifact} onSettings={openSettings} directiveAction={directiveAction} world={world} />}
      {homeView === 'station' && <div className="dash-page"><SectionHeading eyebrow="HOME / SPATIAL WORKSPACE" title="Realm World 2.5D">Activity and handoffs use backend telemetry. Offline, the map shows the roster without live signals.</SectionHeading><div className="dash-spatial-host">{world}</div></div>}
      {homeView === 'visualizer' && <div className="dash-page i47-opening"><RealmStage titleId="i47-nexus-title" title={nexusLabel} eyebrow="THE ETERNAL NEXUS / CONCEPT" scene={renderScene('nexus')} actions={<div className="i47-actions"><button type="button" className="dash-button primary" onClick={() => visit({ section: 'home', homeView: 'station' })}>Open Realm World 2.5D</button><button type="button" className="dash-button" onClick={() => setHudOpen(true)}>Customize HUD</button></div>}><p>Orbit the Nexus Core. This Canvas preview does not represent live activity; use 2.5D for workspace signals.</p></RealmStage></div>}
      {section === 'agents' && <><div className="dash-page pb-0"><SectionHeading eyebrow="WORKSPACE / ROSTER" title="Agents">Built-in roster and team inspectors. Custom agent creation is not enabled.</SectionHeading></div><TeamsDirectory activity={activity} search={search} onFocusAgent={focusAgent} onRoom={enterRoom} onTeam={openTeam} tasks={liveTasks} artifacts={deliverables} events={events} /></>}
      {section === 'dashboards' && <div className="dash-page"><SectionHeading eyebrow="WORKSPACE / MEASURED DATA" title="Dashboards">Browse missions, measured analytics, retained deliverables and activity.</SectionHeading><MissionsPanel tasks={filteredTasks} filter={missionFilter} onFilter={setMissionFilter} search={missionSearch} onSearch={setMissionSearch} onSelect={openTask} onCreate={() => openBuilder()} onTemplates={() => openBuilder('templates')} onSchedules={() => setSchedulesOpen(true)} /></div>}
      {section === 'armory' && <div className="dash-page"><SectionHeading eyebrow="WORKSPACE / CONTROLS" title="Armory">Appearance and motion apply to this browser session. Shared HUD settings remain separate.</SectionHeading><div className="i47-actions"><button type="button" className="dash-button" aria-pressed={light} onClick={() => setLight(!light)}>Light appearance</button><button type="button" className="dash-button" aria-pressed={motion} onClick={() => setMotion(!motion)}>Background motion</button><button type="button" className="dash-button primary" onClick={() => setHudOpen(true)}>Customize HUD</button><button type="button" className="dash-button" onClick={() => openBuilder('templates')}>Mission templates</button><button type="button" className="dash-button" onClick={() => setSchedulesOpen(true)}>UTC schedules</button></div></div>}
      {section === 'copilot-47' && <div className="dash-page"><SectionHeading eyebrow="WORKSPACE / INTELLIGENT 47" title="Copilot 47">Start a written CEO Quick Directive. Review the execution preview before confirming. Voice and wake-call are not enabled.</SectionHeading>{directiveAction}</div>}
      {section === 'missions' && (taskId ? <DashboardTaskDetail id={taskId} task={liveTasks.find((task) => task.taskId === taskId)} events={events} artifacts={deliverables} archiveState={archiveState} tab={taskTab} onTab={(tab) => visit({ ...route, taskTab: tab })} onBack={() => visit({ section: 'missions' })} onActions={() => openActivity('actions')} onAgent={focusAgent} onRoom={enterRoom} connectionState={connectionState} /> : <MissionsPanel tasks={filteredTasks} filter={missionFilter} onFilter={setMissionFilter} search={missionSearch} onSearch={setMissionSearch} onSelect={openTask} onCreate={() => openBuilder()} onTemplates={() => openBuilder('templates')} onSchedules={() => { setFocusedAgentId(null); setSchedulesOpen(true); }} />)}
      {section === 'teams' && <><div className="dash-page team-section-header">{teamTab !== 'detail' && teamTab !== 'analytics' && <SectionHeading eyebrow="WORKSPACE / TEAMS" title="ทีมและพื้นที่">ดูความสามารถก่อนเลือก Agent · Spatial views เป็นภาพประกอบ ไม่ใช่หลักฐานว่ามีการซื้อขายหรือ deploy จริง</SectionHeading>}{teamTab !== 'analytics' && <TabBar label="team-tabs" value={teamTab === 'detail' ? 'directory' : teamTab} onChange={setTeamTab} items={[{ id: 'directory', label: 'รายชื่อทีม' }, { id: 'rooms', label: 'ห้องทำงาน' }, { id: 'realm', label: 'Spatial Map' }, { id: 'graph', label: 'Topology' }]} />}</div>
        {teamTab === 'detail' || (route.teamId && !ISLANDS.some((island) => island.id === route.teamId)) ? <TeamWorkspace id={route.teamId} tasks={liveTasks} events={events} artifacts={deliverables} activity={activity} connectionState={connectionState} teamSignal={spatial.teams[route.teamId]} onBack={() => visit({ section: 'teams' })} onRoom={enterRoom} onAgent={focusAgent} onTask={openTask} onArtifact={openArtifact} onDirective={openDirective} /> : teamTab === 'analytics' ? <LazyPanel label="สถิติ"><PerformanceDashboard connectionState={connectionState} onAgent={focusAgent} onTask={openTask} onReview={openReview} /></LazyPanel> : teamTab === 'directory' ? <TeamsDirectory activity={activity} search={search} onFocusAgent={focusAgent} onRoom={enterRoom} onTeam={openTeam} tasks={liveTasks} artifacts={deliverables} events={events} /> : <div className="dash-spatial-host" key={teamTab}>
          {teamTab === 'realm' && world}
          {teamTab === 'graph' && <LazyPanel label="ผังระบบ"><TopologyTreeView activity={activity} focusedAgentId={focusedAgentId} onFocusAgent={focusAgent} activeTask={activeTask} onDispatchTask={previewDispatch} onEnterTradeRoom={enterRoom} /></LazyPanel>}
          {teamTab === 'rooms' && <LazyPanel label="ห้องทำงาน"><TradeFloorRoom islandId={selectedIslandId} onSelectIsland={enterRoom} spatial={spatial} connectionState={connectionState} events={events} liveTasks={liveTasks} focusedAgentId={focusedAgentId} onFocusAgent={focusAgent} onDirective={openDirective} onExit={() => openTeam(selectedIslandId)} /></LazyPanel>}
        </div>}</>}
      {section === 'library' && <><div className="dash-page pb-0"><SectionHeading eyebrow="WORKSPACE / KNOWLEDGE" title="คลังความรู้">ผลงานที่บันทึกไว้และพื้นที่อ่าน/แก้ไขบันทึก · ไม่รวม templates หรือ schedules ใน browser backup</SectionHeading><TabBar label="library-tabs" value={libraryTab} onChange={setLibraryTab} items={[{ id: 'results', label: 'ผลงาน' }, { id: 'notes', label: 'บันทึกและความเชื่อมโยง' }]} /></div>{libraryTab === 'results' ? <DashboardLibrary items={deliverables} archiveState={archiveState} search={search} selectedId={artifactId} onSelect={(id) => id ? openArtifact(id) : visit({ section: 'library' })} onAgent={focusAgent} /> : <div className="dash-knowledge-host"><KnowledgeVaultView onDispatchTask={dispatch} onFocusAgent={focusAgent} /></div>}</>}
      <div hidden={section !== 'activity'}><DashboardActivity tab={activityTab} onTab={setActivityTab} tasks={liveTasks} pendingHumanInputs={pendingHumanInputs} pendingHitl={pendingHitl} notices={notices} readIds={readIds} onRead={readNotice} onReadAll={() => setReadIds((previous) => new Set([...previous, ...notices.map((event) => event.event_id)]))} onNotice={(notice) => openOverlay(noticeTarget(notice))} onTask={openTask} onRespond={respondHuman} onResolve={resolveHitl} connectionState={connectionState} logs={logs} /></div>
      {section === 'settings' && (route.settingsTab === 'glossary' ? <div className="dash-page"><SectionHeading eyebrow="ARMORY / REFERENCE" title="Glossary">Terms used across Intelligent 47.</SectionHeading><dl className="dash-surface i47-glossary"><dt>Core</dt><dd>One of the five top-level workspaces. Each Core owns its menu pages.</dd><dt>Home Opening</dt><dd>Starting screen for retained execution signals and the sample weather visualization.</dd><dt>Realm World</dt><dd>Home’s selector for the Command Deck, guild map and Nexus preview.</dd><dt>Web Status</dt><dd>Browser connectivity and workspace WebSocket, not provider health.</dd></dl></div> : adminPage ? <LazyPanel label=" Admin Console"><AdminConsole onBack={() => visit({ section: 'settings' })} /></LazyPanel> : <div className="dash-page"><SectionHeading eyebrow="WORKSPACE / SETTINGS" title="Settings">แยกการตั้งค่าออกจากหน้าติดตามงาน ไม่มีการเรียก provider เพียงแค่เปิดหน้านี้</SectionHeading><nav className="mb-4 flex flex-wrap gap-2" aria-label="Workspace settings actions">{admin && <button type="button" className="dash-button" onClick={() => visit({ section: 'settings', settingsTab: 'admin' })}>Admin</button>}<button type="button" className="dash-button" onClick={onLock}>{gateEnabled ? 'Lock workspace' : 'Switch access key'}</button></nav><div className="dash-team-grid">{role !== 'user' && <section className="dash-surface"><Settings /><h2 className="my-3 text-lg font-semibold">AI และข้อมูล</h2><p className="mb-5 text-sm leading-relaxed text-slate-400">Provider / Model, ขีดจำกัด, Webhook และ Backup แยกเป็นแท็บ ตรวจคำเตือนก่อนทดสอบจริงหรือ reset ข้อมูล</p><button className="dash-button primary" onClick={openSettings}>Open settings</button></section>}<section className="dash-surface"><h2 className="mb-3 text-lg font-semibold">เสียงและการแสดงผล</h2><p className="mb-5 text-sm text-slate-400">ลด animation อัตโนมัติเมื่อระบบตั้งค่า Reduce motion</p><button className="dash-button" aria-pressed={audioEnabled} onClick={() => setAudioEnabled((previous) => { saveAudioEnabled(!previous); return !previous; })}>{audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}เสียงแจ้งเตือน: {audioEnabled ? 'เปิด' : 'ปิด'}</button></section></div><section className="dash-surface mt-5"><h2 className="mb-3 font-semibold">ขอบเขตการใช้งาน</h2><p className="text-sm leading-relaxed text-slate-400">{gateEnabled ? `Access Gate เปิด · ${role} · ใช้ Vault ร่วมกัน` : 'Access Gate ปิด · โหมดใช้งานในเครื่อง ไม่ใช่การบังคับสิทธิ์ผู้ใช้'} · ไม่เปิด live orders, arbitrary shell หรือ deployment tools</p></section></div>)}
      {section === 'not-found' && <div className="dash-page"><EmptyState title="ไม่พบหน้าที่ต้องการ" action={<button type="button" className="dash-button" onClick={() => navigate('overview')}>Overview</button>}>ลิงก์ไม่ถูกต้องหรือไม่รองรับ ไม่มีการเปิดข้อมูลรายการอื่นแทน</EmptyState></div>}
    </div>
    <OverviewDock tasks={liveTasks} actionCount={actionCount} connectionState={connectionState} notices={notices} readIds={readIds} onRead={readNotice} onNotice={(notice) => openOverlay(noticeTarget(notice))} onActivity={(tab) => { setFeedbackPanel(null); openActivity(tab); }} onMissions={() => { setFeedbackPanel(null); setMissionFilter('active'); visit({ section: 'missions' }); }} suspended={overviewSuspended} toast={toast} panel={feedbackPanel} setPanel={setFeedbackPanel} triggerRef={feedbackTriggerRef} isOverview={isDeck} />
    <AgentInspectorDrawer agentId={focusedAgentId} agentOverrides={agentOverrides} onUpdateAgentOverride={(id, patch) => setAgentOverrides({ ...saveAgentOverride(id, patch) })} onResetAgentOverride={(id) => setAgentOverrides({ ...resetAgentOverride(id) })} events={events} activity={activity} onClose={closeAgent} onDispatchTask={dispatch} onLocateOnMap={(agent) => { const island = ISLANDS.find((item) => item.agentIds.includes(agent.id)); if (island) enterRoom(island.id); }} />
    {role !== 'user' && <EngineSettingsModal open={engineModalOpen} onClose={closeSettings} />}
    {builderLoaded && <LazyPanel label="ตัวสร้างภารกิจ" modal open={workflowModalOpen} onClose={closeWorkflow}><WorkflowBuilderModal open={workflowModalOpen} onClose={closeWorkflow} onDispatch={dispatch} onSchedule={saveSchedule} connectionState={connectionState} entryTab={builderEntry} directive={directive} onDirective={dispatchDirective} onCheckMissions={() => { closeWorkflow(); visit({ section: 'missions' }); }} /></LazyPanel>}
    <SchedulesModal open={schedulesOpen} onClose={closeSchedules} connectionState={connectionState} onOpenTask={(id) => { setSchedulesOpen(false); openTask(id); }} />
    <WorkspaceStatus connectionState={connectionState} />
    {hudOpen && <HudCustomizer hud={hud} onClose={closeHud} atmosphere={atmosphere} onAtmosphere={setAtmosphere} motion={motion} onMotion={setMotion} reduceMotion={reduceMotion} />}
    {overlay && <WorkspaceOverlay target={overlay} tasks={liveTasks} events={events} artifacts={deliverables} humans={pendingHumanInputs} reports={pendingHitl} signals={spatial.agents} connectionState={connectionState} onClose={closeOverlay} onOpen={openOverlay} onRespond={respondHuman} onResolve={resolveHitl} />}
  </div>;
}
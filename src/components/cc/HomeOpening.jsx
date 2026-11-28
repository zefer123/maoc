import { memo, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, CloudRain, CloudSun, Layers, ListChecks, Orbit, ScrollText, SlidersHorizontal, Sun, X } from 'lucide-react';
import { HOME_VIEWS } from '../../lib/dashboardRoute.js';
import { cleanMission } from '../../lib/dashboardModel.js';
import { TaskCard } from './DashboardPanels.jsx';
import './homeOpening.css';

const shortTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function Greeting({ name }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const hour = now.getHours();
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 18 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  return <span className="i47-greeting" lang="th">{greeting}{name ? `, ${name}` : ''}</span>;
}

const forecasts = [['cloud', 'Partly cloudy', 27], ['sun', 'Sunny', 30], ['rain', 'Showers', 25], ['cloud', 'Partly cloudy', 28], ['sun', 'Sunny', 29]];
const weatherIcons = { cloud: CloudSun, sun: Sun, rain: CloudRain };
const sampleDay = (day) => `Day ${String(day + 1).padStart(2, '0')}`;

export function RealmStage({ title, eyebrow, scene, actions, children, titleId, outlook }) {
  return <section className="i47-visual-stage" aria-labelledby={titleId}>
    <div className="i47-stage-band"><span>INTELLIGENT 47 / HOME</span><span>{eyebrow}</span></div>
    <div className="i47-stage-body"><div className="i47-stage-copy"><h1 id={titleId}>{title}</h1>{children}{actions}</div>{scene}</div>{outlook}
  </section>;
}

const modeDetails = {
  deck: ['Operations', 'Measured mission status, live signals, and confirmed directives.'],
  station: ['Guild atlas', 'Explore eight departments, their rooms, and real-time handoffs.'],
  visualizer: ['Nexus preview', 'Orbit the Nexus Core. This illustration does not show live workspace activity.']
};
const modeIcons = { deck: ListChecks, station: Layers, visualizer: Orbit };

function WorkspaceIndex({ visit, indexRef }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const node = indexRef.current;
    if (!node || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setRevealed(true);
      observer.disconnect();
    }, { root: node.closest('.dash-content'), threshold: .08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [indexRef]);
  return <section ref={indexRef} className="i47-workspace-index" aria-labelledby="i47-index-title" data-revealed={revealed}>
    <div className="i47-index-intro">
      <p className="i47-kicker">02 <span aria-hidden="true">/</span> WORKSPACE INDEX</p>
      <h2 id="i47-index-title" tabIndex={-1}>Explore the workspace</h2>
      <p>Check mission status, visit a team room, or take a closer look at the Nexus.</p>
    </div>
    <ol className="i47-index-links">{HOME_VIEWS.slice(2).map(({ id, label }) => {
      const Icon = modeIcons[id];
      return <li key={id}><button type="button" data-index-mode={id} onClick={() => visit({ section: 'home', homeView: id })}>
        <Icon className="i47-index-icon" size={20} aria-hidden="true" /><span><strong>{label}</strong><small>{modeDetails[id][1]}</small></span><ArrowRight size={17} aria-hidden="true" />
      </button></li>;
    })}</ol>
  </section>;
}

export function RealmWorld({ visit }) {
  return <div className="dash-page i47-opening"><section className="i47-realm-intro" aria-labelledby="realm-world-title">
    <p className="i47-kicker">ELYSIAN GRAND HALL / THE ETERNAL NEXUS</p><h1 id="realm-world-title">The Realm World</h1>
    <p>Follow missions in Command Deck, explore the guild in 2.5D, or orbit the illustrated Nexus. Opening a view does not start a mission.</p>
  </section><div className="i47-realm-modes">{HOME_VIEWS.slice(2).map(({ id, label }) => <article className="dash-surface" key={id}>
    <p className="i47-kicker">{modeDetails[id][0]}</p><h2>{label}</h2><p>{modeDetails[id][1]}</p>
    <button type="button" className="dash-button primary" data-realm-mode={id} onClick={() => visit({ section: 'home', homeView: id })}>Open {label} <ArrowRight size={15} aria-hidden="true" /></button>
  </article>)}</div></div>;
}

export const ExecutionLog = memo(function ExecutionLog({ events, connectionState }) {
  const entries = events.slice(-20).reverse();
  return <div className="i47-feed">
    <p>{connectionState === 'live' ? 'Backend events · limited to the latest 20' : 'Not live · showing retained events only'}</p>
    {entries.length ? <ol>{entries.map((event) => {
      const trace = event.reasoning_trace;
      const summary = trace?.kind === 'execution_summary' && typeof trace.summary === 'string' && trace.summary.length <= 512 && trace.summary.trim() ? trace.summary : null;
      const time = new Date(event.timestamp);
      return <li key={event.event_id}><time dateTime={event.timestamp}>{Number.isFinite(+time) ? shortTime.format(time) : '—'}</time><div><strong>{event.event_type}{event.source_agent ? ` · ${event.source_agent}` : ''}</strong>{summary && <p>{summary}</p>}</div></li>;
    })}</ol> : <p>No execution events yet.</p>}
  </div>;
});

function HomeFeeds({ events, tasks, pendingHuman, pendingReviews, connectionState, onTask, onActions }) {
  const [panel, setPanel] = useState(null);
  const host = useRef(null), trigger = useRef(null), closeButton = useRef(null);
  useEffect(() => {
    if (!panel) return;
    closeButton.current?.focus({ preventScroll: true });
    const outside = (event) => { if (!host.current?.contains(event.target)) setPanel(null); };
    const escape = (event) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      event.preventDefault(); setPanel(null); trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', escape); };
  }, [panel]);
  const retained = tasks.filter((task) => !['RUNNING', 'AWAITING_HITL'].includes(task.state)).slice(-5).reverse();
  const running = tasks.filter((task) => task.state === 'RUNNING');
  const taskCount = running.length + retained.length + pendingHuman.length + pendingReviews.length;
  const waiting = (items, label, kind) => items.length ? <section><h3>{label}</h3><ul>{items.map((item) => <li key={item.input_id ?? item.approval_id}><button className="dash-button" type="button" onClick={() => onActions({ kind, id: item.input_id || item.approval_id, taskId: item.task_id })}>{cleanMission(item.mission || tasks.find((task) => task.taskId === item.task_id)?.description) || item.source_agent || label} <ArrowRight size={14} aria-hidden="true" /></button></li>)}</ul></section> : null;
  return <div className="i47-home-feeds" ref={host}>
    {[[ 'tasks', 'Live Task List', taskCount, ListChecks ], [ 'log', 'Live Execution Log', Math.min(events.length, 20), ScrollText ]].map(([id, label, count, Icon]) => <button key={id} type="button" className="dash-button i47-feed-trigger" data-feed={id} aria-label={`${label}, ${count} ${connectionState === 'live' ? 'items' : 'retained items'}`} aria-haspopup="dialog" aria-expanded={panel === id} aria-controls={panel === id ? 'i47-feed-popup' : undefined} onClick={(event) => { trigger.current = event.currentTarget; setPanel(panel === id ? null : id); }}><Icon size={16} aria-hidden="true" />{id === 'tasks' ? 'Tasks' : 'Log'}<strong>{count}</strong></button>)}
    {panel && <section id="i47-feed-popup" className="i47-hud-popup" role="dialog" aria-labelledby={panel === 'tasks' ? 'i47-active' : 'i47-log'}>
      <header><h2 id={panel === 'tasks' ? 'i47-active' : 'i47-log'}>{panel === 'tasks' ? 'Live Task List' : 'Live Execution Log'}</h2><button ref={closeButton} type="button" className="dash-icon-button" aria-label="Close live panel" onClick={() => { setPanel(null); trigger.current?.focus({ preventScroll: true }); }}><X size={17} aria-hidden="true" /></button></header>
      {panel === 'tasks' ? <div className="i47-feed">
        {connectionState !== 'live' && <p>Backend not live; retained task state may be stale.</p>}
        {waiting(pendingHuman, 'HUMAN input', 'human')}{waiting(pendingReviews, 'Report approval', 'report')}
        {running.length > 0 && <section><h3>Running</h3>{running.map((task) => <TaskCard key={task.taskId} task={task} onSelect={onTask} />)}</section>}
        {retained.length > 0 && <section><h3>Recent retained tasks</h3>{retained.map((task) => <TaskCard key={task.taskId} task={task} onSelect={onTask} />)}</section>}
        {!taskCount && <p>No retained tasks yet.</p>}
      </div> : <ExecutionLog events={events} connectionState={connectionState} />}
    </section>}
  </div>;
}

export default function HomeOpening({ visit, operatorName, events, tasks, pendingHuman, pendingReviews, connectionState, onCustomize, onCall, onTask, onActions, renderScene }) {
  const [day, setDay] = useState(0);
  const indexRef = useRef(null);
  const showIndex = () => {
    const node = indexRef.current;
    const motion = node.closest('.i47-shell').dataset.visualMotion === 'on' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.querySelector('h2').focus({ preventScroll: true });
    node.scrollIntoView({ behavior: motion ? 'smooth' : 'instant', block: 'start' });
  };
  const [kind, label, degrees] = forecasts[day];
  return <div className="dash-page i47-opening i47-landing">
    <div className="i47-landing-masthead">
      <p className="i47-kicker"><span className="i47-masthead-mark" aria-hidden="true" /> 01 <span aria-hidden="true">/</span> INTELLIGENT 47</p>
      <HomeFeeds events={events} tasks={tasks} pendingHuman={pendingHuman} pendingReviews={pendingReviews} connectionState={connectionState} onTask={onTask} onActions={onActions} />
    </div>
    <RealmStage titleId="i47-home-title" title={<>Home <em>Opening</em></>} eyebrow="WEATHER VISUALIZER / SAMPLE" scene={renderScene(kind)} actions={<div className="i47-actions"><button type="button" className="dash-button primary i47-enter-realm" onClick={() => visit({ section: 'home', homeView: 'realm' })}>Enter The Realm World <ArrowRight size={16} aria-hidden="true" /></button><button type="button" className="dash-button" onClick={onCall}>Call 47</button><button type="button" className="dash-button" onClick={onCustomize}><SlidersHorizontal size={16} aria-hidden="true" /> Customize HUD</button></div>} outlook={
      <section className="i47-forecast" aria-labelledby="i47-forecast-title">
        <div className="i47-forecast-head"><h2 id="i47-forecast-title">5-day forecast</h2><p>Sample data · Pick a day to update the scene</p></div>
        <div className="i47-forecast-days" role="group" aria-label="Sample forecast days">{forecasts.map(([condition, summary, temp], i) => {
          const Icon = weatherIcons[condition];
          return <button type="button" key={i} className="dash-button" aria-pressed={day === i} onClick={() => setDay(i)}><span>{sampleDay(i)}</span><Icon aria-hidden="true" size={18} /><strong>{temp}°C</strong><small>{summary}</small></button>;
        })}</div>
      </section>}>
      <Greeting name={operatorName} />
      <p className="i47-landing-deck">Your starting point for missions, team rooms, and the Nexus.</p>
      <div className="i47-weather-reading" aria-live="polite"><strong>{degrees}°C</strong><span>{label}<small>Sample forecast · {sampleDay(day)}</small></span></div>
    </RealmStage>
    <div className="i47-index-jump"><button type="button" onClick={showIndex}><ArrowDown size={16} aria-hidden="true" /> Explore the workspace</button></div>
    <WorkspaceIndex visit={visit} indexRef={indexRef} />
  </div>;
}
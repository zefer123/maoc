/// <reference types="vite/client" />

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTelemetryClient } from '../lib/telemetryClient.js';
import { loadEngineConfig, syncEngineConfig } from '../lib/llmConnector.js';
import { persistence } from '../lib/persistenceClient.js';
import { reduceHumanInputs, sendHumanResponse } from '../lib/humanInputs.js';
import { pendingReviews } from '../lib/dashboardModel.js';
import { postDirective } from '../lib/ceoDirective.js';
import { accessFetch } from '../lib/accessClient.js';
import { recentHandoffs, spatialActivity } from '../lib/spatialModel.js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const WS_URL = API_BASE ? `${API_BASE.replace(/^http/, 'ws')}/ws` : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
const HTTP_EVENTS_URL = `${API_BASE}/api/events?limit=100`;
const ACTIVITY_WINDOW_MS = 2500;

function stateFromEvent(event) {
  if (event.task_state) return event.task_state;
  if (event.event_type === 'HITL_INTERRUPT') return 'AWAITING_HITL';
  if (event.event_type === 'TASK_COMPLETED') {
    if (event.outcome) return event.outcome === 'COMPLETED' ? 'COMPLETED' : 'REJECTED';
    return /aborted|failed/i.test(event.payload_summary) ? 'REJECTED' : 'COMPLETED';
  }
  return 'RUNNING';
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB');
}

export default function useTelemetry() {
  const [connectionState, setConnectionState] = useState('connecting');
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [client, setClient] = useState(null);
  const [humanInputs, setHumanInputs] = useState({});

  useEffect(() => {
    let connection = 0;
    const telemetry = createTelemetryClient(WS_URL, {
      onOpen: () => {
        const generation = ++connection;
        syncEngineConfig(loadEngineConfig()).catch(() => {});
        accessFetch(HTTP_EVENTS_URL)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (generation === connection && data?.events?.length) {
              setEvents((current) => {
                const seen = new Set(current.map((event) => event.event_id));
                return [...data.events.filter((event) => !seen.has(event.event_id)), ...current].slice(-300);
              });
            }
          })
          .catch(() => {});
      },
      onClose: () => { connection++; setConnectionState('offline'); },
      onCollectionReady: persistence.reconcile,
      onCollectionChanged: persistence.invalidate,
      onServerError: (message) => window.alert(`Backend: ${message.error || 'Request failed'}`),
      onSnapshot: (snapshot) => {
        setConnectionState('live');
        setHumanInputs(Object.fromEntries((snapshot.human_inputs || []).map((input) => [input.input_id, input])));
        const nextTasks = {};
        for (const task of snapshot.tasks || []) {
          nextTasks[task.task_id] = {
            description: task.description,
            department: task.department,
            state: task.state,
            progress: task.progress_pct,
            workflowNodes: task.workflow_nodes,
            swarm: task.swarm,
            agentMessages: task.agent_messages || [],
            scheduledRun: task.scheduled_run
          };
        }
        setTasks(nextTasks);
        setEvents(snapshot.events || []);
      },
      onEvent: (event) => {
        setHumanInputs((current) => reduceHumanInputs(current, event));
        setEvents((prev) => [...prev.filter((item) => item.event_id !== event.event_id).slice(-299), event]);
        if (!event.task_id) return; // Scheduler status events are not mission state transitions.
        setTasks((prev) => {
          const current = prev[event.task_id] || {
            description: '',
            state: 'RUNNING',
            progress: 0
          };
          const description =
            current.description ||
            (event.event_type === 'AGENT_THINKING' && event.source_agent === 'ARIA'
              ? event.payload_summary.replace('Decomposing task: ', '')
              : '');
          return {
            ...prev,
            [event.task_id]: {
              description,
              department: current.department,
              state: stateFromEvent(event),
              progress: event.progress_pct,
              workflowNodes: event.workflow_nodes || current.workflowNodes,
              swarm: event.swarm || current.swarm,
              scheduledRun: event.scheduled_run || current.scheduledRun,
              agentMessages: event.agent_message
                ? [...(current.agentMessages || []).filter((message) => message.message_id !== event.agent_message.message_id), event.agent_message]
                : current.agentMessages || []
            }
          };
        });
      }
    });

    setClient(telemetry);
    return () => { connection++; telemetry.close(); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const submitTask = useCallback(
    async (description, workflow, swarm) => {
      try {
        await persistence.sync();
        await syncEngineConfig(loadEngineConfig());
        if (!client?.send({ type: 'SUBMIT_TASK', description, ...(workflow ? { workflow } : {}), ...(swarm ? { swarm } : {}) })) throw new Error('WebSocket offline — reconnect before submitting');
        return true;
      } catch (error) {
        window.dispatchEvent(new CustomEvent('maoc-engine-status', { detail: { error: error.message } }));
        window.alert(`ส่งภารกิจไม่สำเร็จ: ${error.message}`);
        return false;
      }
    },
    [client]
  );

  const submitDirective = useCallback(async (mission) => {
    await persistence.sync();
    await syncEngineConfig(loadEngineConfig());
    const id = await postDirective(mission);
    setTasks((previous) => ({ ...previous, [id]: {
      state: 'RUNNING', progress: 0, ...previous[id], description: mission.description
    } }));
    return id;
  }, []);

  const resolveHitl = useCallback(
    async (approvalId, decision) => {
      const response = await accessFetch(`${API_BASE}/api/hitl/${encodeURIComponent(approvalId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Review failed (${response.status})`);
      return response.json();
    },
    []
  );

  const clearTasks = useCallback(() => {
    setTasks({});
  }, []);
  const respondHuman = useCallback((inputId, response) => sendHumanResponse(API_BASE, inputId, response), []);

  const streamLines = useMemo(
    () =>
      events.slice(-60).map((event) => ({
        key: event.event_id,
        time: formatTime(event.timestamp),
        type: event.event_type,
        from: event.source_agent,
        to: event.target_agent ?? '-',
        text: event.payload_summary
      })),
    [events]
  );

  const activity = useMemo(() => {
    const map = {};
    for (const event of events) {
      const at = new Date(event.timestamp).getTime();
      if (now - at > ACTIVITY_WINDOW_MS) continue;
      for (const agent of [event.source_agent, event.target_agent]) {
        if (!agent || agent === 'HUMAN') continue;
        map[agent] = { type: event.event_type, at };
      }
    }
    return map;
  }, [events, now]);

  const liveTasks = useMemo(
    () => Object.entries(tasks).map(([taskId, task]) => ({ taskId, ...task })),
    [tasks]
  );

  const pendingHitl = useMemo(() => {
    return pendingReviews(events, liveTasks);
  }, [events, liveTasks]);
  const spatial = useMemo(() => ({
    ...spatialActivity(liveTasks, events, Object.values(humanInputs), pendingHitl, connectionState === 'live'),
    links: connectionState === 'live' ? recentHandoffs(events, Math.max(now, Date.now())) : []
  }), [liveTasks, events, humanInputs, pendingHitl, connectionState, now]);

  const activeTask = useMemo(
    () =>
      liveTasks.find(
        (task) => task.state === 'RUNNING' || task.state === 'AWAITING_HITL'
      ) || null,
    [liveTasks]
  );

  return {
    connectionState,
    spatial,
    events,
    streamLines,
    activity,
    liveTasks,
    pendingHitl,
    pendingHumanInputs: Object.values(humanInputs),
    respondHuman,
    activeTask,
    submitTask,
    submitDirective,
    resolveHitl,
    clearTasks
  };
}
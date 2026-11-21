import { AGENTS } from '../data/agents.js';
import { CO_WORK_PARTNERS } from '../data/agentSkills.js';
import { persistence } from './persistenceClient.js';

const AUDIO_ENABLED_KEY = 'maoc_hud_audio_enabled_v1';

export const AVAILABLE_MODELS = [
  'OPUS',
  'SONNET',
  'HAIKU',
  'HERMES',
  'GPT-5',
  'GEMINI',
  'QWEN'
];

export const SYSTEM_UPDATES_LOG = [
  {
    version: 'v3.4.0 (LATEST)',
    time: 'LIVE NOW',
    title: 'Real-Time Binance Market + Wikipedia/HN Intelligence Engine',
    detail: 'Backend orchestrator now fetches real XAU/BTC prices and live web research on every task.'
  },
  {
    version: 'v3.3.0',
    time: 'VERIFIED',
    title: 'Individual Agent Skill Matrix, Co-Work Pairing & Saved Command Memory',
    detail: 'Configure custom skills, pair Co-Work agents, and replay saved commands per agent.'
  },
  {
    version: 'v3.2.0',
    time: 'VERIFIED',
    title: 'Obsidian Synaptic Graph & NotebookLM Audio Briefing Studio',
    detail: 'Auto-archives completed department deliverables into persistent Obsidian Markdown notes.'
  }
];

const INITIAL_AGENT_DEFAULTS = Object.fromEntries(
  AGENTS.map((a) => [
    a.id,
    {
      model: a.model,
      systemPrompt: a.systemPrompt,
      tools: [...a.tools],
      disabledTools: [],
      coWorkPartner: CO_WORK_PARTNERS[a.id],
      autonomyLevel: 90
    }
  ])
);

export function applyOverridesToAgents(overridesMap = {}) {
  for (const agent of AGENTS) {
    const def = INITIAL_AGENT_DEFAULTS[agent.id];
    const custom = overridesMap[agent.id] || {};
    agent.model = custom.model || def.model;
    agent.systemPrompt = custom.systemPrompt || def.systemPrompt;
    agent.tools = custom.tools && custom.tools.length > 0 ? custom.tools : [...def.tools];
    agent.disabledTools = custom.disabledTools || [];
    agent.coWorkPartner = custom.coWorkPartner || def.coWorkPartner;
    agent.autonomyLevel = custom.autonomyLevel ?? def.autonomyLevel;
  }
}

export function loadAgentOverrides() {
  try {
    const parsed = persistence.read('agentOverrides', {});
    applyOverridesToAgents(parsed);
    return parsed;
  } catch {
    return {};
  }
}

export function saveAgentOverride(agentId, patch) {
  try {
    const current = loadAgentOverrides();
    const updated = {
      ...current,
      [agentId]: {
        ...(current[agentId] || {}),
        ...patch
      }
    };
    persistence.write('agentOverrides', updated);
    applyOverridesToAgents(updated);
    return updated;
  } catch {
    return {};
  }
}

export function resetAgentOverride(agentId) {
  try {
    const current = loadAgentOverrides();
    const next = { ...current };
    delete next[agentId];
    persistence.write('agentOverrides', next);
    applyOverridesToAgents(next);
    return next;
  } catch {
    return {};
  }
}

const DEFAULT_SAVED_COMMANDS = [
  {
    id: 'cmd-seed-1',
    agentId: 'HERMES',
    team: 'command',
    text: 'ซิงก์ข้อมูลทุกแผนกและสรุปสถานะพอร์ตล่าสุดส่งเข้าคลัง Obsidian',
    coWorkWith: 'ARIA',
    createdAt: '14:00'
  },
  {
    id: 'cmd-seed-2',
    agentId: 'HAWK',
    team: 'trade',
    text: 'ดึงราคาทองคำ XAU/USD และ BTC สดจากตลาดแล้วคำนวณจุดเข้าเทรด',
    coWorkWith: 'SAGE',
    createdAt: '14:10'
  },
  {
    id: 'cmd-seed-3',
    agentId: 'LUNA',
    team: 'design',
    text: 'ออกแบบระบบ Cyberpunk UI Component ร่วมกับทีม Frontend',
    coWorkWith: 'ZETA',
    createdAt: '14:15'
  },
  {
    id: 'cmd-seed-4',
    agentId: 'SCOUT',
    team: 'content',
    text: 'ค้นคว้างานวิจัย Multi-Agent AI ล่าสุดและสรุปเข้าคลังความจำ MEMO',
    coWorkWith: 'MEMO',
    createdAt: '14:20'
  }
];

export function loadSavedCommands() {
  try {
    const parsed = persistence.read('savedCommands', DEFAULT_SAVED_COMMANDS);
    return parsed.length > 0 ? parsed : DEFAULT_SAVED_COMMANDS;
  } catch {
    return DEFAULT_SAVED_COMMANDS;
  }
}

export function addSavedCommand({ agentId, team, text, coWorkWith }) {
  try {
    const current = loadSavedCommands();
    const clean = text.trim();
    if (!clean) return current;
    const newEntry = {
      id: `cmd-${Date.now()}`,
      agentId,
      team,
      text: clean,
      coWorkWith: coWorkWith || 'HERMES',
      createdAt: new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    const updated = [
      newEntry,
      ...current.filter((c) => !(c.agentId === agentId && c.text === clean))
    ].slice(0, 40);
    persistence.write('savedCommands', updated);
    return updated;
  } catch {
    return DEFAULT_SAVED_COMMANDS;
  }
}

export function removeSavedCommand(cmdId) {
  try {
    const current = loadSavedCommands();
    const updated = current.filter((c) => c.id !== cmdId);
    persistence.write('savedCommands', updated);
    return updated;
  } catch {
    return DEFAULT_SAVED_COMMANDS;
  }
}

export function loadAudioEnabled() {
  try {
    const raw = localStorage.getItem(AUDIO_ENABLED_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function saveAudioEnabled(enabled) {
  try {
    localStorage.setItem(AUDIO_ENABLED_KEY, String(Boolean(enabled)));
  } catch {
    // ignore storage errors
  }
}

let sharedAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playTone(freq, durationMs, type = 'sine', gainValue = 0.05, delayMs = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const startAt = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);

  gain.gain.setValueAtTime(gainValue, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000);
}

export function playHudSound(kind = 'dispatch', enabled = true) {
  if (!enabled) return;
  try {
    if (kind === 'dispatch') {
      playTone(580, 90, 'sine', 0.04, 0);
      playTone(880, 120, 'triangle', 0.04, 70);
    } else if (kind === 'hitl') {
      playTone(320, 160, 'sawtooth', 0.05, 0);
      playTone(260, 220, 'sawtooth', 0.05, 150);
    } else if (kind === 'completed') {
      playTone(523.25, 100, 'triangle', 0.045, 0);
      playTone(659.25, 110, 'triangle', 0.045, 85);
      playTone(1046.5, 180, 'sine', 0.05, 170);
    }
  } catch {
    // ignore audio autoplay restrictions
  }
}
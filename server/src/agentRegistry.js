import { AGENTS } from '../../src/data/agents.js';
import { CO_WORK_PARTNERS } from '../../src/data/agentSkills.js';

export const MODEL_TIERS = {
  'claude-3-opus': {
    label: 'OPUS',
    outputScale: 1
  },
  'claude-3-5-sonnet': {
    label: 'SONNET',
    outputScale: 0.85
  },
  'claude-3-haiku': {
    label: 'HAIKU',
    outputScale: 0.6
  },
  'nous-hermes-3': {
    label: 'HERMES',
    outputScale: 0.7
  }
};

export const AGENT_DEFINITIONS = {
  TAEC: {
    id: 'TAEC',
    role: 'Founder & CEO',
    team: 'command',
    model: 'claude-3-opus',
    tools: ['executive-dashboard', 'strategy-memo', 'org-override']
  },
  ARIA: {
    id: 'ARIA',
    role: 'Supervisor / Grand Secretary',
    team: 'command',
    model: 'claude-3-5-sonnet',
    tools: ['task-router', 'agent-registry', 'memory-index', 'escalation-channel']
  },
  HERMES: {
    id: 'HERMES',
    role: 'Chief Relay & API Messenger',
    team: 'command',
    model: 'nous-hermes-3',
    tools: ['webhook-bridge', 'external-api-relay', 'signal-broadcaster', 'telemetry-bus']
  },
  // TEAM TRADE
  HAWK: {
    id: 'HAWK',
    role: 'Market Intel',
    team: 'trade',
    model: 'claude-3-opus',
    tools: ['market-data-feed', 'signal-scanner', 'news-sentiment', 'volatility-index']
  },
  BLADE: {
    id: 'BLADE',
    role: 'Trade Executor',
    team: 'trade',
    model: 'claude-3-opus',
    tools: ['order-executor', 'exchange-gateway', 'slippage-monitor']
  },
  SAGE: {
    id: 'SAGE',
    role: 'Risk Manager',
    team: 'trade',
    model: 'claude-3-opus',
    tools: ['risk-engine', 'exposure-limit', 'kill-switch']
  },
  AUTO: {
    id: 'AUTO',
    role: 'Algo Bot',
    team: 'trade',
    model: 'claude-3-haiku',
    tools: ['algo-router', 'latency-probe', 'order-scheduler']
  },
  // TECH SYSTEMS
  REX: {
    id: 'REX',
    role: 'Tech Lead',
    team: 'tech',
    model: 'claude-3-opus',
    tools: ['repo-insight', 'incident-board', 'tech-radar']
  },
  NOVA: {
    id: 'NOVA',
    role: 'Systems Architect',
    team: 'tech',
    model: 'claude-3-opus',
    tools: ['architecture-map', 'dependency-graph', 'capacity-planner']
  },
  BYTE: {
    id: 'BYTE',
    role: 'Backend Engineer',
    team: 'tech',
    model: 'claude-3-5-sonnet',
    tools: ['code-sandbox', 'api-spec', 'test-runner']
  },
  ZETA: {
    id: 'ZETA',
    role: 'Frontend Engineer',
    team: 'tech',
    model: 'claude-3-5-sonnet',
    tools: ['ui-kit', 'storybook', 'performance-profiler']
  },
  FORGE: {
    id: 'FORGE',
    role: 'DevOps Engineer',
    team: 'tech',
    model: 'claude-3-haiku',
    tools: ['ci-pipeline', 'infra-monitor', 'secret-vault']
  },
  // DESIGN STUDIO
  LUNA: {
    id: 'LUNA',
    role: 'Creative Director',
    team: 'design',
    model: 'claude-3-opus',
    tools: ['moodboard', 'design-tokens', 'critique-notes']
  },
  PIXEL: {
    id: 'PIXEL',
    role: 'Visual Designer',
    team: 'design',
    model: 'claude-3-5-sonnet',
    tools: ['component-library', 'icon-grid', 'contrast-checker']
  },
  // CONTENT INTEL
  SCOUT: {
    id: 'SCOUT',
    role: 'Research Lead',
    team: 'content',
    model: 'claude-3-opus',
    tools: ['web-search', 'source-ranker', 'summary-index']
  },
  INK: {
    id: 'INK',
    role: 'Copywriter',
    team: 'content',
    model: 'claude-3-5-sonnet',
    tools: ['style-guide', 'copy-editor', 'terminology-base']
  },
  GRACE: {
    id: 'GRACE',
    role: 'Editor',
    team: 'content',
    model: 'claude-3-5-sonnet',
    tools: ['grammar-check', 'consistency-lint', 'publish-queue']
  },
  VIBE: {
    id: 'VIBE',
    role: 'Tone & Brand Voice',
    team: 'content',
    model: 'claude-3-haiku',
    tools: ['voice-profile', 'tone-score', 'brand-memory']
  },
  // DATA & SECURITY
  ATLAS: {
    id: 'ATLAS',
    role: 'Data Architect',
    team: 'data',
    model: 'claude-3-opus',
    tools: ['schema-designer', 'lineage-map', 'warehouse-console']
  },
  MEMO: {
    id: 'MEMO',
    role: 'Knowledge Base',
    team: 'data',
    model: 'claude-3-5-sonnet',
    tools: ['vector-search', 'memory-index', 'citation-resolver']
  },
  CIPHER: {
    id: 'CIPHER',
    role: 'Security / Encryption',
    team: 'data',
    model: 'claude-3-5-sonnet',
    tools: ['secret-vault', 'access-audit', 'threat-monitor']
  },
  // FINANCE WING
  COIN: {
    id: 'COIN',
    role: 'Finance Analyst',
    team: 'finance',
    model: 'claude-3-opus',
    tools: ['finance-model', 'budget-ledger', 'scenario-planner']
  },
  DEAL: {
    id: 'DEAL',
    role: 'Deal Strategist',
    team: 'finance',
    model: 'claude-3-5-sonnet',
    tools: ['deal-room', 'term-sheet-analyzer', 'counterparty-check']
  },
  BOOST: {
    id: 'BOOST',
    role: 'Growth Optimizer',
    team: 'finance',
    model: 'claude-3-haiku',
    tools: ['experiment-board', 'funnel-metrics', 'growth-loop']
  },
  // LEGAL & OPS
  LEX: {
    id: 'LEX',
    role: 'Legal Counsel',
    team: 'legal',
    model: 'claude-3-opus',
    tools: ['policy-library', 'compliance-check', 'contract-reader']
  },
  NEXUS: {
    id: 'NEXUS',
    role: 'Operations Coordinator',
    team: 'legal',
    model: 'claude-3-5-sonnet',
    tools: ['ops-board', 'dependency-tracker', 'notification-hub']
  },
  ECHO: {
    id: 'ECHO',
    role: 'Communications Officer',
    team: 'legal',
    model: 'claude-3-haiku',
    tools: ['status-brief', 'incident-channel', 'stakeholder-mail']
  }
};

for (const agent of AGENTS) {
  Object.assign(AGENT_DEFINITIONS[agent.id], {
    systemPrompt: agent.systemPrompt,
    tier: agent.tier,
    coWorkPartner: CO_WORK_PARTNERS[agent.id],
    autonomyLevel: 90
  });
}

export function resolveAgent(id, overrides = {}) {
  const base = Object.hasOwn(AGENT_DEFINITIONS, id) ? AGENT_DEFINITIONS[id] : null;
  if (!base) throw new Error('Unknown agent');
  const override = overrides[id] || {};
  const labels = { OPUS: 'claude-3-opus', FOUNDER: 'claude-3-opus', SONNET: 'claude-3-5-sonnet', HAIKU: 'claude-3-haiku', HERMES: 'nous-hermes-3' };
  return {
    ...base, ...override,
    model: labels[override.model] || override.model || base.model,
    coWorkPartner: Object.hasOwn(AGENT_DEFINITIONS, override.coWorkPartner) ? override.coWorkPartner : base.coWorkPartner,
    tools: (override.tools ?? base.tools).filter((name) => !(override.disabledTools || []).includes(name))
  };
}
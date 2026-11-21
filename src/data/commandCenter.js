export const NAV_TABS = [
  { id: 'bridge', label: 'Command Bridge' },
  { id: 'realm', label: 'The Realm (Spatial Map)' },
  { id: 'graph', label: 'Agent Graph (Topology)' },
  { id: 'trade', label: 'Dept Floor (Rooms)' },
  { id: 'vault', label: 'Knowledge Vault (AI)' },
  { id: 'logs', label: 'Chronicle Logs' }
];

export const MISSIONS = [];

export const INITIAL_ALERTS = [];

export const CHATTER_FEED = [
  { from: 'HAWK', to: 'BLADE', text: 'Liquidity sweep detected, passing execution payload...' },
  { from: 'BLADE', to: 'SAGE', text: 'Requesting risk clearance for 2.4M notional order slice.' },
  { from: 'SAGE', to: 'BLADE', text: 'Clearance granted with 15% size cap. Monitor slippage.' },
  { from: 'AUTO', to: 'HERMES', text: 'Venue latency table updated: EBX 11ms, NCX 14ms.' },
  { from: 'ARIA', to: 'REX', text: 'Prioritize topology canvas perf ticket for this sprint.' },
  { from: 'REX', to: 'FORGE', text: 'Greenlight canary deploy after load test passes.' },
  { from: 'COIN', to: 'DEAL', text: 'Burn rate nominal. Headroom for one more data vendor.' },
  { from: 'LUNA', to: 'PIXEL', text: 'Critique: increase neon contrast on escalation banner.' },
  { from: 'PIXEL', to: 'LUNA', text: 'Build pushed: glow intensity +12%, awaiting critique.' },
  { from: 'LEX', to: 'NEXUS', text: 'Policy update: auto-execution requires dual approval.' },
  { from: 'ATLAS', to: 'MEMO', text: 'Index tonight’s orchestration decisions for audit.' },
  { from: 'SCOUT', to: 'INK', text: 'Fresh intel brief ready: Fed speech tone shifted hawkish.' }
];

export const KPIS = [
  {
    id: 'k1',
    label: 'Net Performance',
    value: '+24.8%',
    delta: '+2.1% today (TEAM TRADE)',
    tone: 'up',
    trend: [12, 14, 13, 17, 19, 18, 22, 24, 23, 26]
  },
  {
    id: 'k2',
    label: 'Active Fleet (27 Nodes)',
    value: '18 Online',
    delta: '9 busy • 0 error (8 zones)',
    tone: 'flat',
    trend: [17, 18, 18, 19, 18, 20, 19, 18, 18, 18]
  },
  {
    id: 'k3',
    label: 'Completed Tasks',
    value: '1,284',
    delta: 'Live WebSocket Telemetry',
    tone: 'up',
    trend: [40, 44, 47, 52, 58, 61, 66, 70, 74, 79]
  }
];

export const DOCK_AGENT_IDS = [
  'TAEC',
  'ARIA',
  'HERMES',
  'HAWK',
  'BLADE',
  'SAGE',
  'AUTO',
  'REX',
  'LUNA',
  'SCOUT',
  'ATLAS',
  'COIN',
  'LEX'
];

export const ROLE_LABELS = {
  TAEC: 'Command Core',
  ARIA: 'Command Core',
  HERMES: 'Hermes Relay',
  HAWK: 'Team Trade',
  BLADE: 'Team Trade',
  SAGE: 'Team Trade',
  AUTO: 'Team Trade',
  REX: 'Tech Systems',
  LUNA: 'Design Studio',
  SCOUT: 'Content Intel',
  ATLAS: 'Data & Sec',
  COIN: 'Finance Wing',
  LEX: 'Legal & Ops'
};
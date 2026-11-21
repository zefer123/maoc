export const TEAM_DISPLAY_ORDER = [
  'tech',
  'design',
  'content',
  'trade',
  'data',
  'finance',
  'legal'
];

export const TEAMS = [
  {
    id: 'command',
    label: 'COMMAND CORE',
    sub: 'Executive, Orchestration & Relay',
    accent: 'purple',
    kind: 'command',
    highlighted: false,
    agentIds: ['TAEC', 'ARIA', 'HERMES']
  },
  {
    id: 'tech',
    label: 'TECH SYSTEMS',
    sub: 'Engineering & DevOps',
    accent: 'blue',
    kind: 'pipeline',
    highlighted: false,
    agentIds: ['REX', 'NOVA', 'BYTE', 'ZETA', 'FORGE']
  },
  {
    id: 'design',
    label: 'DESIGN STUDIO',
    sub: 'Critique + Build Loop',
    accent: 'violet',
    kind: 'loop',
    highlighted: false,
    loopLabel: 'critique + build',
    agentIds: ['LUNA', 'PIXEL']
  },
  {
    id: 'content',
    label: 'CONTENT INTEL',
    sub: 'Research & Brand Copy',
    accent: 'emerald',
    kind: 'pipeline',
    highlighted: false,
    agentIds: ['SCOUT', 'INK', 'GRACE', 'VIBE']
  },
  {
    id: 'trade',
    label: 'TEAM TRADE',
    sub: 'Execution & Risk Desk',
    accent: 'cyan',
    kind: 'pipeline',
    highlighted: true,
    agentIds: ['HAWK', 'BLADE', 'SAGE', 'AUTO']
  },
  {
    id: 'data',
    label: 'DATA & SECURITY',
    sub: 'Architecture, Memory & Sec',
    accent: 'indigo',
    kind: 'pipeline',
    highlighted: false,
    agentIds: ['ATLAS', 'MEMO', 'CIPHER']
  },
  {
    id: 'finance',
    label: 'FINANCE WING',
    sub: 'Capital, Deals & Growth',
    accent: 'amber',
    kind: 'pipeline',
    highlighted: false,
    agentIds: ['COIN', 'DEAL', 'BOOST']
  },
  {
    id: 'legal',
    label: 'LEGAL & OPS',
    sub: 'Compliance, Ops & Comms',
    accent: 'rose',
    kind: 'pipeline',
    highlighted: false,
    agentIds: ['LEX', 'NEXUS', 'ECHO']
  }
];
export const ISLANDS = [
  {
    id: 'command',
    label: 'COMMAND CORE',
    sub: 'Executive, Orchestration & Relay',
    accent: 'purple',
    x: 600,
    y: 390,
    wall: 'line',
    trend: [14, 16, 15, 19, 21, 20, 24, 26],
    agentIds: ['TAEC', 'ARIA', 'HERMES']
  },
  {
    id: 'tech',
    label: 'TECH SYSTEMS',
    sub: 'Engineering & DevOps',
    accent: 'blue',
    x: 600,
    y: 120,
    wall: 'line',
    trend: [30, 28, 33, 35, 34, 38, 40, 42],
    agentIds: ['REX', 'NOVA', 'BYTE', 'ZETA', 'FORGE']
  },
  {
    id: 'design',
    label: 'DESIGN STUDIO',
    sub: 'Critique + Build Loop',
    accent: 'pink',
    x: 230,
    y: 195,
    wall: 'line',
    trend: [12, 14, 13, 16, 15, 18, 17, 20],
    agentIds: ['LUNA', 'PIXEL']
  },
  {
    id: 'trade',
    label: 'TEAM TRADE',
    sub: 'Execution & Risk Desk',
    accent: 'cyan',
    x: 200,
    y: 465,
    wall: 'candles',
    trend: [18, 21, 19, 24, 26, 25, 29, 31],
    agentIds: ['HAWK', 'BLADE', 'SAGE', 'AUTO']
  },
  {
    id: 'finance',
    label: 'FINANCE WING',
    sub: 'Capital, Deals & Growth',
    accent: 'gold',
    x: 425,
    y: 665,
    wall: 'line',
    trend: [20, 22, 21, 25, 27, 26, 30, 32],
    agentIds: ['COIN', 'DEAL', 'BOOST']
  },
  {
    id: 'legal',
    label: 'LEGAL & OPS',
    sub: 'Compliance, Ops & Comms',
    accent: 'purple',
    x: 775,
    y: 665,
    wall: 'line',
    trend: [10, 11, 12, 12, 14, 15, 16, 18],
    agentIds: ['LEX', 'NEXUS', 'ECHO']
  },
  {
    id: 'data',
    label: 'DATA & SECURITY',
    sub: 'Architecture, Memory & Sec',
    accent: 'emerald',
    x: 1000,
    y: 465,
    wall: 'line',
    trend: [15, 17, 16, 19, 21, 23, 22, 25],
    agentIds: ['ATLAS', 'MEMO', 'CIPHER']
  },
  {
    id: 'content',
    label: 'CONTENT INTEL',
    sub: 'Research & Brand Copy',
    accent: 'emerald',
    x: 970,
    y: 195,
    wall: 'line',
    trend: [8, 10, 9, 13, 12, 15, 17, 19],
    agentIds: ['SCOUT', 'INK', 'GRACE', 'VIBE']
  }
];

export const BRIDGES = [
  ['command', 'tech'],
  ['command', 'design'],
  ['command', 'trade'],
  ['command', 'finance'],
  ['command', 'legal'],
  ['command', 'data'],
  ['command', 'content']
];
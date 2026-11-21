export const MODELS = {
  OPUS: 'OPUS',
  SONNET: 'SONNET',
  HAIKU: 'HAIKU',
  HERMES: 'HERMES',
  FOUNDER: 'FOUNDER'
};

export const STATUS = {
  ONLINE: 'ONLINE',
  THINKING: 'THINKING',
  EXECUTING: 'EXECUTING'
};

export const AGENTS = [
  {
    id: 'TAEC',
    codename: 'TAEC',
    role: 'Founder & CEO',
    team: 'command',
    tier: 1,
    model: MODELS.FOUNDER,
    status: STATUS.ONLINE,
    statusLabel: 'Command Ready',
    icon: 'Crown',
    accent: 'gold',
    systemPrompt:
      'Define strategic intent, approve critical escalations, and keep every autonomous division aligned with founder directives.',
    tools: ['executive-dashboard', 'strategy-memo', 'org-override'],
    tokens: { prompt: 5200, completion: 1800, total: 7000, context: 18 },
    reasoningLog: [
      'Reviewed overnight cross-team status.',
      'Approved ARIA & HERMES orchestration budget.',
      'Set priority: risk-adjusted execution for TEAM TRADE.'
    ]
  },
  {
    id: 'ARIA',
    codename: 'ARIA',
    role: 'Grand Secretary',
    team: 'command',
    tier: 2,
    model: MODELS.SONNET,
    status: STATUS.THINKING,
    statusLabel: 'Orchestrating',
    icon: 'Sparkles',
    accent: 'purple',
    systemPrompt:
      'Route tasks across departments, compress context, preserve audit trail, and escalate only high-impact decisions to TAEC.',
    tools: ['task-router', 'agent-registry', 'memory-index', 'escalation-channel'],
    tokens: { prompt: 18400, completion: 9700, total: 28100, context: 44 },
    reasoningLog: [
      'Received strategic directive from TAEC.',
      'Synced cross-department relay channel with HERMES.',
      'Dispatched market scan to HAWK.'
    ]
  },
  {
    id: 'HERMES',
    codename: 'HERMES',
    role: 'Chief Relay & API Messenger',
    team: 'command',
    tier: 2,
    model: MODELS.HERMES,
    status: STATUS.ONLINE,
    statusLabel: 'Relay Active',
    icon: 'Zap',
    accent: 'amber',
    systemPrompt:
      'Act as the ultra-low-latency messenger between ARIA, external webhooks, trading venues, and all 7 autonomous departments. Dispatch real-time alerts and cross-platform payloads.',
    tools: ['webhook-bridge', 'external-api-relay', 'signal-broadcaster', 'telemetry-bus'],
    tokens: { prompt: 16200, completion: 8900, total: 25100, context: 39 },
    reasoningLog: [
      'Established zero-latency relay bridge across 8 zones.',
      'Verified external webhook & notification endpoints.',
      'Standing by for high-priority signal broadcast from ARIA and TEAM TRADE.'
    ]
  },
  {
    id: 'HAWK',
    codename: 'HAWK',
    role: 'Market Intel',
    team: 'trade',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.ONLINE,
    statusLabel: 'Active / Scanning',
    icon: 'Radar',
    accent: 'green',
    systemPrompt:
      'Continuously scan market data, detect short-term momentum, and emit high-confidence trade signals.',
    tools: ['market-data-feed', 'signal-scanner', 'news-sentiment', 'volatility-index'],
    tokens: { prompt: 24100, completion: 11800, total: 35900, context: 52 },
    reasoningLog: [
      'Scanned 128 symbols across 6 venues.',
      'Detected momentum cluster in high-beta tech names.',
      'Forwarded signal packet to BLADE.'
    ]
  },
  {
    id: 'BLADE',
    codename: 'BLADE',
    role: 'Trade Executor',
    team: 'trade',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.EXECUTING,
    statusLabel: 'Executing',
    icon: 'Sword',
    accent: 'red',
    systemPrompt:
      'Convert approved signals into precise orders while minimizing slippage and respecting execution limits.',
    tools: ['order-executor', 'exchange-gateway', 'slippage-monitor'],
    tokens: { prompt: 19800, completion: 12600, total: 32400, context: 58 },
    reasoningLog: [
      'Received HAWK signal.',
      'Prepared capped market order.',
      'Awaiting final risk confirmation from SAGE.'
    ]
  },
  {
    id: 'SAGE',
    codename: 'SAGE',
    role: 'Risk Manager',
    team: 'trade',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.THINKING,
    statusLabel: 'Risk Review',
    icon: 'ShieldCheck',
    accent: 'purple',
    systemPrompt:
      'Evaluate exposure, enforce risk limits, and block any trade that violates drawdown or concentration rules.',
    tools: ['risk-engine', 'exposure-limit', 'kill-switch'],
    tokens: { prompt: 17300, completion: 8400, total: 25700, context: 47 },
    reasoningLog: [
      'Computed portfolio exposure.',
      'Checked correlation with open positions.',
      'Preparing approval decision.'
    ]
  },
  {
    id: 'AUTO',
    codename: 'AUTO',
    role: 'Algo Bot',
    team: 'trade',
    tier: 3,
    model: MODELS.HAIKU,
    status: STATUS.ONLINE,
    statusLabel: 'Algo Idle',
    icon: 'Bot',
    accent: 'cyan',
    systemPrompt:
      'Optimize execution algorithms, schedule order slices, and monitor latency across trading venues.',
    tools: ['algo-router', 'latency-probe', 'order-scheduler'],
    tokens: { prompt: 9600, completion: 4100, total: 13700, context: 26 },
    reasoningLog: [
      'Loaded execution profiles.',
      'Measured venue latency.',
      'Standing by for approved order flow.'
    ]
  },
  {
    id: 'REX',
    codename: 'REX',
    role: 'Tech Lead',
    team: 'tech',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.ONLINE,
    statusLabel: 'Tech Lead Online',
    icon: 'Cpu',
    accent: 'blue',
    systemPrompt:
      'Own technical priorities, unblock engineering teams, and enforce architecture standards.',
    tools: ['repo-insight', 'incident-board', 'tech-radar'],
    tokens: { prompt: 14200, completion: 6300, total: 20500, context: 38 },
    reasoningLog: [
      'Reviewed sprint blockers.',
      'Assigned backend refactoring to BYTE.',
      'Requested deployment readiness from FORGE.'
    ]
  },
  {
    id: 'NOVA',
    codename: 'NOVA',
    role: 'Systems Architect',
    team: 'tech',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.THINKING,
    statusLabel: 'Architecting',
    icon: 'Sparkles',
    accent: 'violet',
    systemPrompt:
      'Design resilient system boundaries, data flows, and integration patterns for all product modules.',
    tools: ['architecture-map', 'dependency-graph', 'capacity-planner'],
    tokens: { prompt: 15800, completion: 7600, total: 23400, context: 41 },
    reasoningLog: [
      'Modeled service boundaries.',
      'Evaluated queue topology.',
      'Drafted integration contract for Data team.'
    ]
  },
  {
    id: 'BYTE',
    codename: 'BYTE',
    role: 'Backend Engineer',
    team: 'tech',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.ONLINE,
    statusLabel: 'Backend Online',
    icon: 'Binary',
    accent: 'emerald',
    systemPrompt:
      'Implement robust APIs, data pipelines, and service logic with strong test coverage.',
    tools: ['code-sandbox', 'api-spec', 'test-runner'],
    tokens: { prompt: 12100, completion: 6900, total: 19000, context: 35 },
    reasoningLog: [
      'Implemented order status endpoint.',
      'Added retry policy to market feed worker.',
      'Opened pull request for review.'
    ]
  },
  {
    id: 'ZETA',
    codename: 'ZETA',
    role: 'Frontend Engineer',
    team: 'tech',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.THINKING,
    statusLabel: 'UI Build',
    icon: 'Zap',
    accent: 'cyan',
    systemPrompt:
      'Build responsive dashboards, realtime widgets, and clear operational visualizations.',
    tools: ['ui-kit', 'storybook', 'performance-profiler'],
    tokens: { prompt: 10900, completion: 5800, total: 16700, context: 31 },
    reasoningLog: [
      'Prototyped agent topology canvas.',
      'Optimized chart re-rendering.',
      'Preparing drawer interaction spec.'
    ]
  },
  {
    id: 'FORGE',
    codename: 'FORGE',
    role: 'DevOps Engineer',
    team: 'tech',
    tier: 3,
    model: MODELS.HAIKU,
    status: STATUS.ONLINE,
    statusLabel: 'Deploy Ready',
    icon: 'Hammer',
    accent: 'orange',
    systemPrompt:
      'Automate deployments, monitor infrastructure, and keep release pipelines safe.',
    tools: ['ci-pipeline', 'infra-monitor', 'secret-vault'],
    tokens: { prompt: 8700, completion: 3600, total: 12300, context: 22 },
    reasoningLog: [
      'Verified staging deploy.',
      'Rotated API credentials.',
      'Scheduled canary release.'
    ]
  },
  {
    id: 'LUNA',
    codename: 'LUNA',
    role: 'Creative Director',
    team: 'design',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.THINKING,
    statusLabel: 'Creative Direction',
    icon: 'Moon',
    accent: 'violet',
    systemPrompt:
      'Set creative direction, critique visual concepts, and ensure the product feels futuristic and coherent.',
    tools: ['moodboard', 'design-tokens', 'critique-notes'],
    tokens: { prompt: 11800, completion: 5400, total: 17200, context: 29 },
    reasoningLog: [
      'Reviewed neon hierarchy concept.',
      'Requested stronger contrast for TEAM TRADE.',
      'Sent art direction notes to PIXEL.'
    ]
  },
  {
    id: 'PIXEL',
    codename: 'PIXEL',
    role: 'Visual Designer',
    team: 'design',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.ONLINE,
    statusLabel: 'Visual Build',
    icon: 'Palette',
    accent: 'pink',
    systemPrompt:
      'Produce polished UI components, icon systems, and high-contrast cyberpunk visual assets.',
    tools: ['component-library', 'icon-grid', 'contrast-checker'],
    tokens: { prompt: 10300, completion: 4900, total: 15200, context: 27 },
    reasoningLog: [
      'Updated glowing card borders.',
      'Built bidirectional loop badge.',
      'Preparing final palette export.'
    ]
  },
  {
    id: 'SCOUT',
    codename: 'SCOUT',
    role: 'Research Lead',
    team: 'content',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.ONLINE,
    statusLabel: 'Research Online',
    icon: 'Search',
    accent: 'green',
    systemPrompt:
      'Gather evidence, summarize market or product research, and provide citations for downstream agents.',
    tools: ['web-search', 'source-ranker', 'summary-index'],
    tokens: { prompt: 13400, completion: 7100, total: 20500, context: 36 },
    reasoningLog: [
      'Collected 18 sources.',
      'Ranked signal reliability.',
      'Created research brief for INK.'
    ]
  },
  {
    id: 'INK',
    codename: 'INK',
    role: 'Copywriter',
    team: 'content',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.THINKING,
    statusLabel: 'Writing',
    icon: 'PenLine',
    accent: 'blue',
    systemPrompt:
      'Transform research into concise, technical, and compelling operational copy.',
    tools: ['style-guide', 'copy-editor', 'terminology-base'],
    tokens: { prompt: 9200, completion: 5100, total: 14300, context: 25 },
    reasoningLog: [
      'Drafted mission summary.',
      'Adjusted tone for command center UI.',
      'Sent draft to GRACE.'
    ]
  },
  {
    id: 'GRACE',
    codename: 'GRACE',
    role: 'Editor',
    team: 'content',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.ONLINE,
    statusLabel: 'Editing',
    icon: 'FileText',
    accent: 'purple',
    systemPrompt:
      'Edit for clarity, consistency, and precision while preserving the technical meaning.',
    tools: ['grammar-check', 'consistency-lint', 'publish-queue'],
    tokens: { prompt: 7600, completion: 3900, total: 11500, context: 21 },
    reasoningLog: [
      'Reviewed draft for ambiguity.',
      'Corrected model naming conventions.',
      'Approved final wording.'
    ]
  },
  {
    id: 'VIBE',
    codename: 'VIBE',
    role: 'Tone & Brand Voice',
    team: 'content',
    tier: 3,
    model: MODELS.HAIKU,
    status: STATUS.ONLINE,
    statusLabel: 'Voice Sync',
    icon: 'Music',
    accent: 'cyan',
    systemPrompt:
      'Maintain brand voice, emotional pacing, and consistency across all agent-generated content.',
    tools: ['voice-profile', 'tone-score', 'brand-memory'],
    tokens: { prompt: 6100, completion: 2800, total: 8900, context: 18 },
    reasoningLog: [
      'Checked tone against brand guide.',
      'Suggested sharper command language.',
      'Synced voice tokens to GRACE.'
    ]
  },
  {
    id: 'ATLAS',
    codename: 'ATLAS',
    role: 'Data Architect',
    team: 'data',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.ONLINE,
    statusLabel: 'Data Architecture',
    icon: 'Database',
    accent: 'indigo',
    systemPrompt:
      'Design data schemas, orchestration storage, and reliable pipelines for all agent teams.',
    tools: ['schema-designer', 'lineage-map', 'warehouse-console'],
    tokens: { prompt: 12900, completion: 6700, total: 19600, context: 34 },
    reasoningLog: [
      'Modeled agent event table.',
      'Added token usage metrics.',
      'Published schema migration plan.'
    ]
  },
  {
    id: 'MEMO',
    codename: 'MEMO',
    role: 'Knowledge Base',
    team: 'data',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.ONLINE,
    statusLabel: 'Memory Index',
    icon: 'StickyNote',
    accent: 'emerald',
    systemPrompt:
      'Index decisions, maintain organizational memory, and answer context queries with citations.',
    tools: ['vector-search', 'memory-index', 'citation-resolver'],
    tokens: { prompt: 8800, completion: 4200, total: 13000, context: 24 },
    reasoningLog: [
      'Indexed ARIA routing decisions.',
      'Answered context query for Finance.',
      'Linked prior risk memo to SAGE.'
    ]
  },
  {
    id: 'CIPHER',
    codename: 'CIPHER',
    role: 'Security / Encryption',
    team: 'data',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.THINKING,
    statusLabel: 'Security Audit',
    icon: 'KeyRound',
    accent: 'red',
    systemPrompt:
      'Protect secrets, audit access, and enforce least-privilege rules across agent tools.',
    tools: ['secret-vault', 'access-audit', 'threat-monitor'],
    tokens: { prompt: 10400, completion: 5300, total: 15700, context: 28 },
    reasoningLog: [
      'Scanned tool permission matrix.',
      'Flagged excessive token scope.',
      'Preparing key rotation note.'
    ]
  },
  {
    id: 'COIN',
    codename: 'COIN',
    role: 'Finance Analyst',
    team: 'finance',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.ONLINE,
    statusLabel: 'Finance Online',
    icon: 'Coins',
    accent: 'gold',
    systemPrompt:
      'Analyze budgets, unit economics, and capital efficiency for all autonomous operations.',
    tools: ['finance-model', 'budget-ledger', 'scenario-planner'],
    tokens: { prompt: 11700, completion: 5900, total: 17600, context: 33 },
    reasoningLog: [
      'Updated burn rate dashboard.',
      'Modeled trading desk capital allocation.',
      'Sent summary to DEAL.'
    ]
  },
  {
    id: 'DEAL',
    codename: 'DEAL',
    role: 'Deal Strategist',
    team: 'finance',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.THINKING,
    statusLabel: 'Deal Structuring',
    icon: 'Briefcase',
    accent: 'green',
    systemPrompt:
      'Structure deals, evaluate partnerships, and recommend commercial terms with clear risk tradeoffs.',
    tools: ['deal-room', 'term-sheet-analyzer', 'counterparty-check'],
    tokens: { prompt: 9300, completion: 4800, total: 14100, context: 26 },
    reasoningLog: [
      'Drafted partnership scenario.',
      'Compared revenue share options.',
      'Requested legal review from LEX.'
    ]
  },
  {
    id: 'BOOST',
    codename: 'BOOST',
    role: 'Growth Optimizer',
    team: 'finance',
    tier: 3,
    model: MODELS.HAIKU,
    status: STATUS.ONLINE,
    statusLabel: 'Growth Online',
    icon: 'Rocket',
    accent: 'cyan',
    systemPrompt:
      'Run growth experiments, optimize funnels, and identify high-leverage distribution loops.',
    tools: ['experiment-board', 'funnel-metrics', 'growth-loop'],
    tokens: { prompt: 7200, completion: 3300, total: 10500, context: 20 },
    reasoningLog: [
      'Launched referral experiment.',
      'Detected improved activation in ops dashboard.',
      'Preparing next test variant.'
    ]
  },
  {
    id: 'LEX',
    codename: 'LEX',
    role: 'Legal Counsel',
    team: 'legal',
    tier: 3,
    model: MODELS.OPUS,
    status: STATUS.ONLINE,
    statusLabel: 'Legal Online',
    icon: 'Scale',
    accent: 'amber',
    systemPrompt:
      'Review policies, flag regulatory exposure, and provide concise legal guardrails for autonomous actions.',
    tools: ['policy-library', 'compliance-check', 'contract-reader'],
    tokens: { prompt: 10600, completion: 5400, total: 16000, context: 30 },
    reasoningLog: [
      'Reviewed trading compliance checklist.',
      'Added disclaimer for automated execution.',
      'Sent policy update to NEXUS.'
    ]
  },
  {
    id: 'NEXUS',
    codename: 'NEXUS',
    role: 'Operations Coordinator',
    team: 'legal',
    tier: 3,
    model: MODELS.SONNET,
    status: STATUS.ONLINE,
    statusLabel: 'Ops Online',
    icon: 'Network',
    accent: 'blue',
    systemPrompt:
      'Coordinate cross-team operations, track dependencies, and keep handoffs synchronized.',
    tools: ['ops-board', 'dependency-tracker', 'notification-hub'],
    tokens: { prompt: 8400, completion: 4100, total: 12500, context: 23 },
    reasoningLog: [
      'Synced Legal and Finance handoff.',
      'Updated task ownership in ops board.',
      'Notified ECHO to prepare status brief.'
    ]
  },
  {
    id: 'ECHO',
    codename: 'ECHO',
    role: 'Communications Officer',
    team: 'legal',
    tier: 3,
    model: MODELS.HAIKU,
    status: STATUS.ONLINE,
    statusLabel: 'Comms Online',
    icon: 'Radio',
    accent: 'purple',
    systemPrompt:
      'Broadcast concise status updates, incident summaries, and executive briefs to stakeholders.',
    tools: ['status-brief', 'incident-channel', 'stakeholder-mail'],
    tokens: { prompt: 6900, completion: 3100, total: 10000, context: 19 },
    reasoningLog: [
      'Compiled shift summary.',
      'Sent executive digest.',
      'Monitoring command channel for alerts.'
    ]
  }
];
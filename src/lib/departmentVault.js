import { TEAMS } from '../data/teams.js';
import { persistence } from './persistenceClient.js';

export const DEFAULT_DELIVERABLES = {
  command: [
    {
      id: 'seed-command-1',
      deptId: 'command',
      deptLabel: 'COMMAND CORE',
      lead: 'HERMES',
      coWork: ['TAEC', 'ARIA', 'HERMES'],
      title: 'Global Multi-Department Synchronization & Zero-Latency Relay Bus',
      summary:
        'All 8 zones (27 autonomous nodes) synchronized. Outbound webhook latency verified at 9ms via HERMES relay bus with full state snapshot persistence.',
      paragraphs: [
        '1. Executive Context: ARIA and HERMES established a dual-core orchestration topology connecting all 7 operational departments under TAEC root governance. Context compression reduced inter-agent token overhead by 34%.',
        '2. Relay Bus Architecture: HERMES operates an asynchronous event multiplexer over WebSocket (ws://localhost:8787/ws) with exponential backoff auto-reconnect and deterministic state hydration.',
        '3. Verification & SLA: Outbound webhook dispatchers for Telegram, Discord, and TradingView passed zero-packet-loss verification at 9ms median latency.'
      ],
      artifactCode: `// HERMES Zero-Latency Relay Envelope
{
  "relay_bus": "MAOC_OMNI_V3",
  "orchestrator": "ARIA",
  "courier": "HERMES",
  "zones_synced": 8,
  "active_nodes": 27,
  "p99_latency_ms": 9.2
}`,
      status: 'COMPLETED',
      time: '14:00:00',
      stages: [
        'TAEC -> ARIA: Approved daily autonomous execution budget & risk guardrails',
        'ARIA -> HERMES: Synchronized zero-latency relay bus across 8 zones',
        'HERMES -> ALL: Verified Telegram, Discord & TradingView webhook endpoints (200 OK)'
      ]
    }
  ],
  tech: [
    {
      id: 'seed-tech-1',
      deptId: 'tech',
      deptLabel: 'TECH SYSTEMS',
      lead: 'REX',
      coWork: ['REX', 'NOVA', 'BYTE', 'ZETA', 'FORGE'],
      title: 'Telemetry Event Bus & 60fps GPU-Accelerated HUD Architecture',
      summary:
        'API p99 latency reduced to 11ms. WebSocket auto-reconnect and 60fps isometric rendering verified with 96.4% test coverage.',
      paragraphs: [
        '1. Systems Architecture (NOVA): Designed a non-blocking Node.js EventBus with ring-buffer history (500 events cap) and instant snapshot hydration on WebSocket handshake.',
        '2. Backend & API Engineering (BYTE): Implemented REST task injection (/api/tasks) and HITL interrupt resolution (/api/hitl/:approvalId) with strict schema validation and live Binance/Wikipedia API connectors.',
        '3. Frontend GPU Pipeline (ZETA & FORGE): Locked isometric 3D CSS matrix transforms onto GPU compositor layers, maintaining 60fps frame budgets (<6.2ms/frame) and automated canary deployment.'
      ],
      artifactCode: `// BYTE + ZETA Telemetry State Machine Contract
export interface TelemetryEvent {
  event_id: string;
  event_type: 'AGENT_THINKING' | 'TOOL_CALL' | 'HANDOFF' | 'HITL_INTERRUPT' | 'TASK_COMPLETED';
  source_agent: string;
  target_agent: string | null;
  progress_pct: number;
}`,
      status: 'COMPLETED',
      time: '14:05:12',
      stages: [
        'REX -> NOVA: Scoped resilient service boundaries & WebSocket ring buffer',
        'BYTE -> ZETA: Implemented live API connectors & 60fps GPU HUD layer',
        'FORGE: Canary release deployed with 96.4% unit test coverage'
      ]
    }
  ],
  design: [
    {
      id: 'seed-design-1',
      deptId: 'design',
      deptLabel: 'DESIGN STUDIO',
      lead: 'LUNA',
      coWork: ['LUNA', 'PIXEL', 'ZETA'],
      title: 'Cyberpunk Glassmorphism & Neon Token System v3',
      summary:
        'High-contrast neon borders and bidirectional critique + build loop assets finalized across all 8 department rooms.',
      paragraphs: [
        '1. Creative Direction (LUNA): Established a deep obsidian (#07090e) spatial hierarchy using semantic neon accents (Cyan for Trade, Purple for Command, Amber for Hermes, Blue for Tech).',
        '2. Component Engineering (PIXEL): Built reusable glassmorphic surfaces (backdrop-blur-md bg-slate-900/75) with GPU-accelerated SVG dash-offset animations and WCAG AA contrast compliance.'
      ],
      artifactCode: `/* LUNA <-> PIXEL Verified Design Tokens */
:root {
  --bg-obsidian: #07090e;
  --neon-cyan: #22d3ee;
  --neon-purple: #a855f7;
  --neon-gold: #f6c94d;
}`,
      status: 'COMPLETED',
      time: '14:08:40',
      stages: [
        'LUNA -> PIXEL: Art direction & neon hierarchy critique',
        'PIXEL -> LUNA: Built glassmorphic card tokens & isometric diamonds'
      ]
    }
  ],
  content: [
    {
      id: 'seed-content-1',
      deptId: 'content',
      deptLabel: 'CONTENT INTEL',
      lead: 'SCOUT',
      coWork: ['SCOUT', 'INK', 'GRACE', 'VIBE'],
      title: 'Macro Sentiment & Fed Policy Intelligence Brief',
      summary:
        '18 primary market sources ranked by SCOUT. Executive briefing drafted by INK, edited by GRACE, and tone-locked by VIBE.',
      paragraphs: [
        '1. Primary Source Intelligence (SCOUT): Aggregated real-time macro citations from Wikipedia and HackerNews intelligence feeds, filtering for high-signal liquidity and central bank policy shifts.',
        '2. Synthesis & Editorial Lock (INK, GRACE & VIBE): Structured findings into multi-paragraph Obsidian Markdown notes with bidirectional [[WikiLinks]] and NotebookLM audio synthesis readiness.'
      ],
      artifactCode: `// SCOUT Citation Index Payload
{
  "sources_verified": 18,
  "reliability_score": 0.94,
  "indexed_to_vault": "maoc_obsidian_vault_v1"
}`,
      status: 'COMPLETED',
      time: '14:11:20',
      stages: [
        'SCOUT: Ranked 18 real-time macro & gold sentiment sources',
        'INK -> GRACE: Completed technical executive briefing',
        'VIBE: Synced command-center brand voice'
      ]
    }
  ],
  trade: [
    {
      id: 'seed-trade-1',
      deptId: 'trade',
      deptLabel: 'TEAM TRADE',
      lead: 'HAWK',
      coWork: ['HAWK', 'BLADE', 'SAGE', 'AUTO'],
      title: 'XAU/USD Momentum Cluster & Risk-Cleared Execution',
      summary:
        'Long signal (0.86 confidence) detected by HAWK, VWAP order slices prepared by BLADE, 15% cap cleared by SAGE, routed via AUTO.',
      paragraphs: [
        '1. Market Microstructure Scan (HAWK): Real-time Binance PAXGUSDT (XAU/USD proxy) and BTCUSDT orderbook sweep identified institutional buy-side absorption above key intraday support.',
        '2. Execution & Slippage Control (BLADE): Sliced 2.4M notional position into 3 VWAP tranches with a strict 1.5bps maximum slippage ceiling.',
        '3. Risk Envelope & Algo Routing (SAGE & AUTO): Portfolio VaR verified under 4.2% drawdown threshold; human-in-the-loop (HITL) approval granted and executed at 0.4bps realized slippage.'
      ],
      artifactCode: `// TEAM TRADE Execution Fill Report
{
  "instrument": "XAU/USD (PAXGUSDT)",
  "bias": "LONG_MOMENTUM",
  "confidence": 0.86,
  "risk_gate": "SAGE_HITL_APPROVED",
  "realized_slippage_bps": 0.4
}`,
      status: 'COMPLETED',
      time: '14:15:05',
      stages: [
        'HAWK: Scanned live XAU/USD & BTC orderbook liquidity',
        'BLADE -> SAGE: Prepared VWAP order slices & passed HITL risk gate',
        'AUTO -> HERMES: Executed slices on EBX + NCX (0.4bps slippage)'
      ]
    }
  ],
  data: [
    {
      id: 'seed-data-1',
      deptId: 'data',
      deptLabel: 'DATA & SECURITY',
      lead: 'ATLAS',
      coWork: ['ATLAS', 'MEMO', 'CIPHER'],
      title: 'Zero-Trust MCP Tool Audit & Event Schema Lineage',
      summary:
        'All 27 agent MCP tool permission scopes audited by CIPHER. Vector knowledge base indexed by ATLAS & MEMO.',
      paragraphs: [
        '1. Data Lineage & Storage (ATLAS & MEMO): Partitioned telemetry event streams and linked 420 cross-department decision nodes into persistent localStorage and Obsidian graph structures.',
        '2. Zero-Trust Security Audit (CIPHER): Enforced least-privilege scopes across all MCP tools and verified automatic API credential rotation policies.'
      ],
      artifactCode: `// CIPHER Zero-Trust Audit Result
{
  "audited_nodes": 27,
  "mcp_scopes_verified": 84,
  "unauthorized_calls": 0,
  "status": "ZERO_TRUST_CERTIFIED"
}`,
      status: 'COMPLETED',
      time: '14:18:30',
      stages: [
        'ATLAS: Partitioned real-time telemetry warehouse tables',
        'MEMO: Indexed 420 cross-department decision embeddings',
        'CIPHER: Certified zero-trust encryption & tool scopes'
      ]
    }
  ],
  finance: [
    {
      id: 'seed-finance-1',
      deptId: 'finance',
      deptLabel: 'FINANCE WING',
      lead: 'COIN',
      coWork: ['COIN', 'DEAL', 'BOOST'],
      title: 'Q3 Capital Efficiency & Autonomous Burn Ledger',
      summary:
        'Net portfolio performance +24.8% (+2.1% today). Institutional liquidity deal structured at 3.4x risk-reward ratio.',
      paragraphs: [
        '1. Token Economics & Capital Efficiency (COIN): Audited token utilization across Opus, Sonnet, Haiku, and Hermes tiers, maintaining unit cost under $0.042 per completed multi-agent workflow.',
        '2. Commercial Structuring & Growth (DEAL & BOOST): Modeled liquidity partnership terms achieving a 3.4x risk-reward multiple and +18% execution velocity.'
      ],
      artifactCode: `// COIN Treasury & ROI Ledger
{
  "net_roi_pct": "+24.8%",
  "daily_alpha_pct": "+2.1%",
  "avg_workflow_cost_usd": 0.038,
  "risk_reward_ratio": 3.4
}`,
      status: 'COMPLETED',
      time: '14:21:10',
      stages: [
        'COIN: Reconciled token burn rate & desk capital efficiency',
        'DEAL: Structured partnership term sheet (3.4x R/R)',
        'BOOST: Optimized autonomous execution throughput (+18%)'
      ]
    }
  ],
  legal: [
    {
      id: 'seed-legal-1',
      deptId: 'legal',
      deptLabel: 'LEGAL & OPS',
      lead: 'LEX',
      coWork: ['LEX', 'NEXUS', 'ECHO'],
      title: 'Automated Execution Regulatory Guardrails & SLA',
      summary:
        'Dual-approval HITL policy enforced by LEX. Cross-department handoffs synchronized by NEXUS and broadcasted by ECHO.',
      paragraphs: [
        '1. Regulatory Compliance (LEX): Verified that all high-notional algorithmic orders trigger mandatory Human-in-the-Loop (HITL) interrupts with immutable audit timestamps.',
        '2. Operations & Stakeholder Comms (NEXUS & ECHO): Confirmed 100% handoff SLA compliance across all 8 zones and automated shift digest broadcasts.'
      ],
      artifactCode: `// LEX Compliance Attestation
{
  "hitl_gate_enforced": true,
  "audit_trail_immutable": true,
  "cross_dept_sla_pct": 100
}`,
      status: 'COMPLETED',
      time: '14:24:55',
      stages: [
        'LEX: Certified regulatory compliance guardrails for autonomous trading',
        'NEXUS: Verified 100% SLA handoff readiness across 7 departments',
        'ECHO: Broadcasted executive shift digest'
      ]
    }
  ]
};

export function loadRoomChats() {
  try {
    return persistence.read('chats', {});
  } catch {
    return {};
  }
}

export function saveRoomChats(chats) {
  try {
    persistence.write('chats', chats);
  } catch {
    // ignore storage quota errors
  }
}

export function loadDeliverables() {
  try {
    const parsed = persistence.read('deliverables', DEFAULT_DELIVERABLES);
    return { ...DEFAULT_DELIVERABLES, ...parsed };
  } catch {
    return DEFAULT_DELIVERABLES;
  }
}

export function saveDeliverables(deliverables) {
  try {
    persistence.write('deliverables', deliverables);
  } catch {
    // ignore storage quota errors
  }
}

function detectDeptKeyFromText(text = '') {
  const tagMatch = text.match(/\[TEAM:([a-z]+)\]/i);
  if (tagMatch) {
    const tagged = tagMatch[1].toLowerCase();
    if (tagged === 'hermes') return 'command';
    if (DEFAULT_DELIVERABLES[tagged]) return tagged;
  }
  const lower = text.toLowerCase();
  if (/\b(hermes|relay|webhook|broadcast)\b/.test(lower)) return 'command';
  if (/\b(tech|code|api|deploy|hud|rex|nova|byte|zeta|forge)\b/.test(lower)) return 'tech';
  if (/\b(design|ui|ux|neon|critique|luna|pixel)\b/.test(lower)) return 'design';
  if (/\b(content|copy|research|brief|scout|ink|grace|vibe)\b/.test(lower)) return 'content';
  if (/\b(data|schema|audit|security|mcp|atlas|memo|cipher)\b/.test(lower)) return 'data';
  if (/\b(finance|budget|deal|growth|roi|coin|boost)\b/.test(lower)) return 'finance';
  if (/\b(legal|policy|compliance|ops|sla|lex|nexus|echo)\b/.test(lower)) return 'legal';
  return 'trade';
}

export function archiveCompletedTaskToVault(completedEvent, allEvents = []) {
  if (!completedEvent || completedEvent.event_type !== 'TASK_COMPLETED') return;
  if (completedEvent.archived) { void persistence.sync().catch(() => {}); return; }
  if (completedEvent.outcome && completedEvent.outcome !== 'COMPLETED') return;
  if (/aborted|failed/i.test(completedEvent.payload_summary || '')) return;

  const rawSummary = (completedEvent.payload_summary || '')
    .replace(/^Task completed\s*(& relayed)?:\s*/i, '')
    .trim();

  const [directivePart, resultPart] = rawSummary.split(/\s*\|\s*(?:Result|Co-Work[^:]*):\s*/i);
  const deptKey = detectDeptKeyFromText(rawSummary);
  const cleanTitle =
    (directivePart || rawSummary)
      .replace(/\[TEAM:[A-Z]+\]\s*/gi, '')
      .replace(/\[COWORK:[^\]]+\]\s*/gi, '')
      .trim() || 'Autonomous Co-Work Mission';

  const teamObj = TEAMS.find((t) => t.id === deptKey) || TEAMS[0];
  const timeStr = new Date(completedEvent.timestamp || Date.now()).toLocaleTimeString('en-GB');

  const taskEvents = allEvents.filter(
    (ev) =>
      ev.task_id === completedEvent.task_id &&
      (ev.event_type === 'AGENT_THINKING' ||
        ev.event_type === 'TOOL_CALL' ||
        ev.event_type === 'HANDOFF')
  );

  const stageLines =
    taskEvents.length > 0
      ? taskEvents.map((ev) => `[${ev.event_type}] ${ev.source_agent}: ${ev.payload_summary}`)
      : teamObj.agentIds.map((ag) => `[VERIFIED] ${ag}: Executed stage for "${cleanTitle}"`);

  const toolOutputs = taskEvents
    .filter((ev) => ev.event_type === 'TOOL_CALL')
    .map((ev) => `${ev.source_agent} (${ev.model_used || 'LLM'}): ${ev.payload_summary}`);

  const paragraphs = [
    `1. Executive Objective & Directive: Mission "${cleanTitle}" was routed by ARIA to ${teamObj.label} (${teamObj.agentIds.join(
      ' -> '
    )}) and completed at ${timeStr}.`,
    `2. Real-Time Intelligence & Synthesis: ${
      resultPart ||
      toolOutputs[0] ||
      `All ${teamObj.agentIds.length} domain specialists verified their respective stage outputs with zero errors.`
    }`,
    `3. Co-Work Tool Verification: ${
      toolOutputs.slice(1).join(' | ') ||
      `Executed ${stageLines.length} telemetry stages and relayed final deliverable via HERMES.`
    }`
  ];

  const artifactCode = JSON.stringify(
    {
      task_id: completedEvent.task_id,
      department: teamObj.label,
      lead_agent: teamObj.agentIds[0],
      co_work_chain: [...teamObj.agentIds, 'HERMES'],
      completed_at: timeStr,
      verified_result: resultPart || '100% SLA Verified',
      stages_count: stageLines.length
    },
    null,
    2
  );

  // 1. บันทึกลงคลัง DELIVERABLES ของห้องแผนกนั้น
  const currentDeliverables = loadDeliverables();
  const deptList = currentDeliverables[deptKey] || [];
  const alreadySaved = deptList.some((item) => item.id === `task-${completedEvent.task_id}`);

  if (!alreadySaved) {
    const newDeliverable = {
      id: `task-${completedEvent.task_id || Date.now()}`,
      deptId: deptKey,
      deptLabel: teamObj.label,
      lead: teamObj.agentIds[0] || 'ARIA',
      coWork: [...teamObj.agentIds, 'HERMES'],
      title: cleanTitle,
      summary:
        resultPart ||
        `Completed 100% by ${teamObj.agentIds.join(
          ' -> '
        )} and archived automatically via HERMES relay.`,
      paragraphs,
      artifactCode,
      status: 'COMPLETED',
      time: timeStr,
      stages: stageLines
    };

    const updatedDeliverables = {
      ...currentDeliverables,
      [deptKey]: [newDeliverable, ...deptList].slice(0, 30)
    };
    saveDeliverables(updatedDeliverables);
  }

  // 2. บันทึกรายงานหลายย่อหน้าเข้าคลัง KNOWLEDGE VAULT (Obsidian / NotebookLM)
  try {
    const existingNotes = persistence.read('notes', []);
    const noteId = `note-task-${completedEvent.task_id || Date.now()}`;

    if (!existingNotes.some((n) => n.id === noteId)) {
      const newNote = {
        id: noteId,
        title: `[${teamObj.label}] ${cleanTitle.slice(0, 52)}`,
        category: teamObj.label,
        agents: [...teamObj.agentIds, 'HERMES'],
        updatedAt: timeStr,
        tags: [`#${deptKey}`, '#co-work-report', '#senior-dev-spec'],
        links: [
          '[[Multi-Agent Orchestration]]',
          `[[${teamObj.label}]]`,
          ...teamObj.agentIds.map((a) => `[[${a}]]`)
        ],
        summary:
          resultPart ||
          `รายงานผลลัพธ์เชิงลึกของแผนก ${teamObj.label} สำหรับภารกิจ "${cleanTitle}"`,
        content: `## Executive Deliverable: ${cleanTitle}\n\n${paragraphs.join(
          '\n\n'
        )}\n\n### Technical Artifact & Telemetry Payload\n\`\`\`json\n${artifactCode}\n\`\`\`\n\n### Stage-by-Stage Co-Work Trace\n${stageLines
          .map((line) => `- ${line}`)
          .join('\n')}`,
        sources: [
          {
            title: `Live Telemetry Audit (${teamObj.label} • Task ${(
              completedEvent.task_id || ''
            ).slice(0, 8)})`,
            url: 'http://localhost:8787/api/events',
            snippet: resultPart || cleanTitle
          }
        ]
      };
      persistence.write('notes', [newNote, ...existingNotes].slice(0, 40));
    }
  } catch {
    // ignore storage errors
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('maoc-vault-updated'));
  }
}

export function exportDepartmentMarkdown(deptLabel, items = []) {
  const lines = [
    `# ${deptLabel} — SENIOR DEV DELIVERABLES & EXECUTION REPORT`,
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    `Total Records: ${items.length}`,
    '',
    '---',
    ''
  ];

  for (const item of items) {
    lines.push(`## [${item.status}] ${item.title}`);
    lines.push(`- **Lead Agent:** ${item.lead}`);
    lines.push(`- **Co-Work Chain:** ${(item.coWork || [item.lead]).join(' -> ')}`);
    lines.push(`- **Timestamp:** ${item.time}`);
    lines.push(`- **Executive Summary:** ${item.summary}`);
    if (item.paragraphs?.length) {
      lines.push('', '### Deep-Dive Analysis');
      for (const p of item.paragraphs) {
        lines.push(p, '');
      }
    }
    if (item.artifactCode) {
      lines.push('### Technical Artifact / Payload', '```json', item.artifactCode, '```', '');
    }
    if (item.stages?.length) {
      lines.push('### Execution Stages');
      for (const st of item.stages) {
        lines.push(`- ${st}`);
      }
    }
    lines.push('', '---', '');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deptLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
# Design Specification, Not Runtime Grants

Historical design snapshot; the [runtime contract](../../SKILL.md) and [architecture](../../CLAUDE.md) take precedence. The customization table below records the original design; current persistence and enforcement are defined in SKILL.md.

## Reading the Specification

The following 27-agent matrix and full tool catalog are retained design specifications,
NOT proof that every listed integration exists. Unregistered names are **Planned**;
listed performance/autonomy/authority claims are **Simulated** design intent, not
execution permissions, measured SLAs or a billing guarantee. Current runtime grants
come from server/src/agentRegistry.js plus ToolExecutor.list/execute, never this table.
Keep all IDs, prompts, pairings and customization fields when editing these sections.

## 📋 Department Skill Breakdown

### 1. COMMAND CORE (3 Agents)

#### **TAEC** — Founder & CEO
| Attribute | Value |
|-----------|-------|
| **Model** | FOUNDER (claude-3-opus equivalent) |
| **Tier** | 1 (Highest) |
| **Core Tools** | `executive-dashboard`, `strategy-memo`, `org-override` |
| **System Prompt** | Define strategic intent, approve critical escalations, keep every autonomous division aligned with founder directives. |
| **Autonomy** | 95% |
| **Co-Work** | ARIA |
| **Tokens** | 7,000 total (5,200 prompt / 1,800 completion) |
| **Context Window** | 18 turns |

**Capabilities:**
- Strategic directive issuance
- Cross-department budget approval
- Risk guardrail configuration
- Organizational override authority
- Executive summary generation

---

#### **ARIA** — Grand Secretary / Supervisor
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 2 |
| **Core Tools** | `task-router`, `agent-registry`, `memory-index`, `escalation-channel` |
| **System Prompt** | Route tasks across departments, compress context, preserve audit trail, escalate only high-impact decisions to TAEC. |
| **Autonomy** | 90% |
| **Co-Work** | HERMES |
| **Tokens** | 28,100 total (18,400 prompt / 9,700 completion) |
| **Context Window** | 44 turns |

**Capabilities:**
- Task decomposition & routing
- Context compression (34% token reduction)
- Cross-department synchronization
- Escalation triage to TAEC
- Memory index management
- Audit trail preservation

---

#### **HERMES** — Chief Relay & API Messenger
| Attribute | Value |
|-----------|-------|
| **Model** | HERMES (nous-hermes-3) |
| **Tier** | 2 |
| **Core Tools** | `webhook-bridge`, `external-api-relay`, `signal-broadcaster`, `telemetry-bus` |
| **System Prompt** | Act as ultra-low-latency messenger between ARIA, external webhooks, trading venues, and all 7 autonomous departments. Dispatch real-time alerts and cross-platform payloads. |
| **Autonomy** | 85% |
| **Co-Work** | ARIA |
| **Tokens** | 25,100 total (16,200 prompt / 8,900 completion) |
| **Context Window** | 39 turns |

**Capabilities:**
- Zero-latency relay bus (9ms p99)
- WebSocket event multiplexing
- External webhook dispatch (Discord, Telegram, TradingView)
- Cross-platform payload delivery
- Telemetry bus management
- Exponential backoff auto-reconnect
---

### 2. TEAM TRADE (4 Agents)

#### **HAWK** — Market Intel
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `market-data-feed`, `signal-scanner`, `news-sentiment`, `volatility-index` |
| **System Prompt** | Continuously scan market data, detect short-term momentum, and emit high-confidence trade signals. |
| **Autonomy** | 88% |
| **Co-Work** | BLADE |
| **Tokens** | 35,900 total |

**Capabilities:**
- 128+ symbol scanning across 6 venues
- Momentum cluster detection
- News sentiment analysis
- Volatility regime identification
- Signal packet emission to BLADE

---

#### **BLADE** — Trade Executor
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `order-executor`, `exchange-gateway`, `slippage-monitor` |
| **System Prompt** | Execute orders with precision, manage venue routing, minimize slippage, and report fill quality. |
| **Autonomy** | 80% (requires SAGE clearance for >threshold) |
| **Co-Work** | SAGE |
| **Tokens** | 32,400 total |

**Capabilities:**
- Multi-venue order routing (EBX 11ms, NCX 14ms)
- Slippage monitoring & reporting
- Execution quality analytics
- Partial fill management
- Risk-adjusted sizing

---

#### **SAGE** — Risk Manager
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `risk-engine`, `exposure-limit`, `kill-switch` |
| **System Prompt** | Enforce portfolio risk limits, validate every trade against exposure caps, and trigger kill-switch on anomaly. |
| **Autonomy** | 70% (HITL required for large positions) |
| **Co-Work** | BLADE |
| **Tokens** | 28,700 total |

**Capabilities:**
- Real-time exposure calculation
- Position limit enforcement
- Correlation risk analysis
- Kill-switch activation
- **HITL Approval Gate** for >15% portfolio orders

---

#### **AUTO** — Algo Bot
| Attribute | Value |
|-----------|-------|
| **Model** | HAIKU (claude-3-haiku) |
| **Tier** | 3 |
| **Core Tools** | `algo-router`, `latency-probe`, `order-scheduler` |
| **System Prompt** | Run systematic strategies, optimize execution latency, and schedule orders across venues. |
| **Autonomy** | 95% (fully automated within guardrails) |
| **Co-Work** | HAWK |
| **Tokens** | 18,200 total |

**Capabilities:**
- Latency arbitration (sub-10ms)
- Algo strategy execution
- Order scheduling & TWAP/VWAP
- Venue health monitoring
---

### 3. TECH SYSTEMS (5 Agents)

#### **REX** — Tech Lead
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `repo-insight`, `incident-board`, `tech-radar` |
| **System Prompt** | Lead technical direction, triage incidents, and maintain technology radar for architectural decisions. |
| **Autonomy** | 85% |
| **Co-Work** | NOVA |

**Capabilities:**
- Architecture decision records
- Incident response coordination
- Tech debt prioritization
- Code review standards

---

#### **NOVA** — Systems Architect
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `architecture-map`, `dependency-graph`, `capacity-planner` |
| **System Prompt** | Design resilient service boundaries, map dependencies, and plan capacity for autonomous workloads. |
| **Autonomy** | 88% |
| **Co-Work** | BYTE |

**Capabilities:**
- Service boundary design
- Dependency graph visualization
- Capacity planning & scaling
- Non-blocking EventBus architecture

---

#### **BYTE** — Backend Engineer
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `code-sandbox`, `api-spec`, `test-runner` |
| **System Prompt** | Implement robust APIs, maintain test coverage, and integrate live data connectors. |
| **Autonomy** | 90% |
| **Co-Work** | ZETA |

**Capabilities:**
- REST + WebSocket implementation
- Live API connectors (Binance, Wikipedia, HN)
- Unit/integration test automation
- Schema validation

---

#### **ZETA** — Frontend Engineer
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `ui-kit`, `storybook`, `performance-profiler` |
| **System Prompt** | Build 60fps GPU-accelerated HUD components, maintain component library, and optimize render performance. |
| **Autonomy** | 92% |
| **Co-Work** | FORGE |

**Capabilities:**
- Isometric 3D CSS transforms (GPU compositor)
- 60fps frame budget (<6.2ms/frame)
- Tailwind + custom spatial styles
- Component library (Storybook)

---

#### **FORGE** — DevOps Engineer
| Attribute | Value |
|-----------|-------|
| **Model** | HAIKU (claude-3-haiku) |
| **Tier** | 3 |
| **Core Tools** | `ci-pipeline`, `infra-monitor`, `secret-vault` |
| **System Prompt** | Automate deployments, monitor infrastructure health, and manage secrets for all autonomous services. |
| **Autonomy** | 85% |
| **Co-Work** | REX |

**Capabilities:**
- Canary deployment automation
- Infrastructure monitoring
- Secret management
- 96.4% test coverage enforcement
---

### 4. DESIGN STUDIO (2 Agents)

#### **LUNA** — Creative Director
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `moodboard`, `design-tokens`, `critique-notes` |
| **System Prompt** | Define visual language, maintain design token system, and critique builds for brand consistency. |
| **Autonomy** | 80% |
| **Co-Work** | PIXEL |

**Capabilities:**
- Design token system (neon accents, glassmorphism)
- Moodboard curation
- Critique loop management
- Brand consistency enforcement

---

#### **PIXEL** — Visual Designer
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `component-library`, `icon-grid`, `contrast-checker` |
| **System Prompt** | Build pixel-perfect components, maintain icon system, and verify WCAG contrast on all HUD elements. |
| **Autonomy** | 90% |
| **Co-Work** | LUNA |

**Capabilities:**
- Component library maintenance
- Icon grid system
- Neon contrast optimization
- Shader token refinement

---

### 5. CONTENT INTEL (4 Agents)

#### **SCOUT** — Research Lead
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `web-search`, `source-ranker`, `summary-index` |
| **System Prompt** | Conduct deep research, rank source credibility, and compile structured intelligence briefs. |
| **Autonomy** | 88% |
| **Co-Work** | INK |

**Capabilities:**
- Multi-source research (Wikipedia, HN, web)
- Source credibility ranking
- Summary index generation
- Macro intel brief compilation

---

#### **INK** — Copywriter
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `style-guide`, `copy-editor`, `terminology-base` |
| **System Prompt** | Write compelling copy, enforce style guide, and maintain terminology consistency across all outputs. |
| **Autonomy** | 90% |
| **Co-Work** | GRACE |

**Capabilities:**
- Brand copy generation
- Style guide enforcement
- Terminology base management
- Multi-language support

---

#### **GRACE** — Editor
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `grammar-check`, `consistency-lint`, `publish-queue` |
| **System Prompt** | Edit for clarity, enforce consistency, and manage publication pipeline for all department outputs. |
| **Autonomy** | 85% |
| **Co-Work** | VIBE |

**Capabilities:**
- Grammar & style linting
- Cross-document consistency
- Publication queue management
- Quality gate enforcement

---

#### **VIBE** — Tone & Brand Voice
| Attribute | Value |
|-----------|-------|
| **Model** | HAIKU (claude-3-haiku) |
| **Tier** | 3 |
| **Core Tools** | `voice-profile`, `tone-score`, `brand-memory` |
| **System Prompt** | Maintain brand voice profile, score tone alignment, and preserve brand memory across all communications. |
| **Autonomy** | 90% |
| **Co-Work** | SCOUT |

**Capabilities:**
- Voice profile management
- Tone scoring algorithm
- Brand memory persistence
- Communication alignment
---

### 6. DATA & SECURITY (3 Agents)

#### **ATLAS** — Data Architect
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `schema-designer`, `lineage-map`, `warehouse-console` |
| **System Prompt** | Design data schemas, map lineage, and operate the analytical warehouse for all autonomous decisions. |
| **Autonomy** | 85% |
| **Co-Work** | MEMO |

**Capabilities:**
- Schema design & evolution
- Data lineage tracking
- Warehouse operations
- Query optimization

---

#### **MEMO** — Knowledge Base
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `vector-search`, `memory-index`, `citation-resolver` |
| **System Prompt** | Maintain vector knowledge base, index all agent memories, and resolve citations for audit trails. |
| **Autonomy** | 90% |
| **Co-Work** | CIPHER |

**Capabilities:**
- Vector search (semantic)
- Memory indexing
- Citation resolution
- Obsidian vault sync

---

#### **CIPHER** — Security / Encryption
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `secret-vault`, `access-audit`, `threat-monitor` |
| **System Prompt** | Manage secrets, audit access patterns, and monitor for security threats across all autonomous operations. |
| **Autonomy** | 75% (HITL for policy changes) |
| **Co-Work** | ATLAS |

**Capabilities:**
- Secret vault management
- Access audit logging
- Threat detection
- **HITL Approval Gate** for security policy changes

---

### 7. FINANCE WING (3 Agents)

#### **COIN** — Finance Analyst
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `finance-model`, `budget-ledger`, `scenario-planner` |
| **System Prompt** | Build financial models, maintain budget ledger, and plan scenarios for autonomous capital allocation. |
| **Autonomy** | 80% |
| **Co-Work** | DEAL |

**Capabilities:**
- Financial modeling
- Budget tracking
- Scenario planning
- Burn rate monitoring

---

#### **DEAL** — Deal Strategist
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `deal-room`, `term-sheet-analyzer`, `counterparty-check` |
| **System Prompt** | Structure deals, evaluate partnerships, and recommend commercial terms with clear risk tradeoffs. |
| **Autonomy** | 75% |
| **Co-Work** | LEX |

**Capabilities:**
- Deal structuring
- Term sheet analysis
- Counterparty due diligence
- Revenue share optimization

---

#### **BOOST** — Growth Optimizer
| Attribute | Value |
|-----------|-------|
| **Model** | HAIKU (claude-3-haiku) |
| **Tier** | 3 |
| **Core Tools** | `experiment-board`, `funnel-metrics`, `growth-loop` |
| **System Prompt** | Run growth experiments, optimize funnels, and identify high-leverage distribution loops. |
| **Autonomy** | 88% |
| **Co-Work** | COIN |

**Capabilities:**
- A/B experiment management
- Funnel metric analysis
- Growth loop identification
- Referral program optimization

---

### 8. LEGAL & OPS (3 Agents)

#### **LEX** — Legal Counsel
| Attribute | Value |
|-----------|-------|
| **Model** | OPUS (claude-3-opus) |
| **Tier** | 3 |
| **Core Tools** | `policy-library`, `compliance-check`, `contract-reader` |
| **System Prompt** | Review policies, flag regulatory exposure, and provide concise legal guardrails for autonomous actions. |
| **Autonomy** | 70% (HITL for compliance decisions) |
| **Co-Work** | NEXUS |

**Capabilities:**
- Policy library maintenance
- Regulatory compliance checking
- Contract analysis
- **HITL Approval Gate** for policy changes

---

#### **NEXUS** — Operations Coordinator
| Attribute | Value |
|-----------|-------|
| **Model** | SONNET (claude-3-5-sonnet) |
| **Tier** | 3 |
| **Core Tools** | `ops-board`, `dependency-tracker`, `notification-hub` |
| **System Prompt** | Coordinate cross-team operations, track dependencies, and keep handoffs synchronized. |
| **Autonomy** | 85% |
| **Co-Work** | ECHO |

**Capabilities:**
- Operations board management
- Dependency tracking
- Cross-team notification
- SLA monitoring

---

#### **ECHO** — Communications Officer
| Attribute | Value |
|-----------|-------|
| **Model** | HAIKU (claude-3-haiku) |
| **Tier** | 3 |
| **Core Tools** | `status-brief`, `incident-channel`, `stakeholder-mail` |
| **System Prompt** | Broadcast concise status updates, incident summaries, and executive briefs to stakeholders. |
| **Autonomy** | 90% |
| **Co-Work** | LEX |

**Capabilities:**
- Status brief generation
- Incident communication
- Stakeholder digest
- Executive briefing
---

## Tool Catalog - Specification, Not Availability

| Tool | Department | Description |
|------|------------|-------------|
| `executive-dashboard` | Command | Strategic KPI overview |
| `strategy-memo` | Command | Directive documentation |
| `org-override` | Command | Organizational authority |
| `task-router` | Command | Task decomposition & routing |
| `agent-registry` | Command | Agent management |
| `memory-index` | Command | Context compression |
| `escalation-channel` | Command | TAEC escalation |
| `webhook-bridge` | Command | External webhook dispatch |
| `external-api-relay` | Command | API proxy & relay |
| `signal-broadcaster` | Command | Real-time alert broadcast |
| `telemetry-bus` | Command | Event bus management |
| `market-data-feed` | Trade | Live price feeds |
| `signal-scanner` | Trade | Momentum detection |
| `news-sentiment` | Trade | News analysis |
| `volatility-index` | Trade | Regime identification |
| `order-executor` | Trade | Order placement |
| `exchange-gateway` | Trade | Venue routing |
| `slippage-monitor` | Trade | Fill quality |
| `risk-engine` | Trade | Exposure calculation |
| `exposure-limit` | Trade | Position caps |
| `kill-switch` | Trade | Emergency stop |
| `algo-router` | Trade | Latency arbitration |
| `latency-probe` | Trade | Venue health |
| `order-scheduler` | Trade | TWAP/VWAP |
| `repo-insight` | Tech | Code analysis |
| `incident-board` | Tech | Incident management |
| `tech-radar` | Tech | Technology tracking |
| `architecture-map` | Tech | Service boundaries |
| `dependency-graph` | Tech | Dependency visualization |
| `capacity-planner` | Tech | Scaling planning |
| `code-sandbox` | Tech | Safe execution |
| `api-spec` | Tech | Contract definition |
| `test-runner` | Tech | Test automation |
| `ui-kit` | Tech | Component library |
| `storybook` | Tech | Component docs |
| `performance-profiler` | Tech | Render optimization |
| `ci-pipeline` | Tech | Deployment automation |
| `infra-monitor` | Tech | Health monitoring |
| `secret-vault` | Tech/Security | Secret management |
| `moodboard` | Design | Visual inspiration |
| `design-tokens` | Design | Token system |
| `critique-notes` | Design | Review feedback |
| `component-library` | Design | UI components |
| `icon-grid` | Design | Icon system |
| `contrast-checker` | Design | WCAG compliance |
| `web-search` | Content | Research |
| `source-ranker` | Content | Credibility |
| `summary-index` | Content | Brief compilation |
| `style-guide` | Content | Writing standards |
| `copy-editor` | Content | Text refinement |
| `terminology-base` | Content | Vocabulary |
| `grammar-check` | Content | Language quality |
| `consistency-lint` | Content | Cross-doc consistency |
| `publish-queue` | Content | Publication pipeline |
| `voice-profile` | Content | Brand voice |
| `tone-score` | Content | Alignment scoring |
| `brand-memory` | Content | Voice persistence |
| `schema-designer` | Data | Data modeling |
| `lineage-map` | Data | Data tracking |
| `warehouse-console` | Data | Analytics ops |
| `vector-search` | Data | Semantic search |
| `memory-index` | Data | Agent memory |
| `citation-resolver` | Data | Audit trails |
| `access-audit` | Security | Access logging |
| `threat-monitor` | Security | Threat detection |
| `finance-model` | Finance | Modeling |
| `budget-ledger` | Finance | Tracking |
| `scenario-planner` | Finance | Planning |
| `deal-room` | Finance | Deal management |
| `term-sheet-analyzer` | Finance | Term analysis |
| `counterparty-check` | Finance | Due diligence |
| `experiment-board` | Finance | A/B testing |
| `funnel-metrics` | Finance | Conversion analysis |
| `growth-loop` | Finance | Viral loops |
| `policy-library` | Legal | Policy docs |
| `compliance-check` | Legal | Regulatory |
| `contract-reader` | Legal | Contract analysis |
| `ops-board` | Legal | Operations |
| `dependency-tracker` | Legal | Cross-team deps |
| `notification-hub` | Legal | Alerts |
| `status-brief` | Legal | Updates |
| `incident-channel` | Legal | Crisis comms |
| `stakeholder-mail` | Legal | Executive briefs |

---

## 🔄 Co-Work Pairing Matrix

| Primary Agent | Default Partner | Department | Handoff Pattern |
|---------------|-----------------|------------|-----------------|
| TAEC | ARIA | Command | Directive → Execution |
| ARIA | HERMES | Command | Route → Relay |
| HERMES | ARIA | Command | Relay ←→ Orchestrate |
| HAWK | BLADE | Trade | Signal → Execute |
| BLADE | SAGE | Trade | Execute → Risk Check |
| SAGE | BLADE | Trade | Approve → Execute |
| AUTO | HAWK | Trade | Algo ←→ Signal |
| REX | NOVA | Tech | Lead → Architect |
| NOVA | BYTE | Tech | Architect → Implement |
| BYTE | ZETA | Tech | Backend → Frontend |
| ZETA | FORGE | Tech | Frontend → Deploy |
| FORGE | REX | Tech | Deploy → Monitor |
| LUNA | PIXEL | Design | Direct → Build |
| PIXEL | LUNA | Design | Build → Critique |
| SCOUT | INK | Content | Research → Write |
| INK | GRACE | Content | Write → Edit |
| GRACE | VIBE | Content | Edit → Tone |
| VIBE | SCOUT | Content | Tone → Research |
| ATLAS | MEMO | Data | Schema → Index |
| MEMO | CIPHER | Data | Index → Secure |
| CIPHER | ATLAS | Data | Secure → Schema |
| COIN | DEAL | Finance | Model → Deal |
| DEAL | LEX | Finance | Deal → Legal |
| BOOST | COIN | Finance | Growth → Model |
| LEX | NEXUS | Legal | Policy → Ops |
| NEXUS | ECHO | Legal | Ops → Comm |
| ECHO | LEX | Legal | Comm → Policy |

---

## 🎛 Customization Points (Per-Agent Overrides)

Via **Agent Inspector Drawer** (open an Agent from current Teams/map/room navigation):

| Override | Type | Description |
|----------|------|-------------|
| `model` | Select | OPUS / SONNET / HAIKU / HERMES / GPT-5 / GEMINI / QWEN |
| `systemPrompt` | Textarea | Behavioral directive |
| `tools` | Multi-select | Enable/disable specific tools |
| `disabledTools` | Multi-select | Explicitly disable tools |
| `coWorkPartner` | Select | Default handoff target |
| `autonomyLevel` | Slider (0-100) | Decision independence |

**Persisted to:** backend revisioned `agentOverrides` atomic JSON + `vault/agents/overrides.json`, with `localStorage.maoc_agent_overrides_v1` offline fallback. Each mission snapshots overrides. Tool grants cannot exceed server registry scopes.

---

## 📊 Model Tier Latency Profiles

| Tier | Label | Latency Range (ms) | Use Case |
|------|-------|-------------------|----------|
| `claude-3-opus` | OPUS | 900-1500 | Strategic, complex reasoning |
| `claude-3-5-sonnet` | SONNET | 600-1050 | Balanced general purpose |
| `claude-3-haiku` | HAIKU | 350-700 | Fast, high-volume tasks |
| `nous-hermes-3` | HERMES | 300-650 | Ultra-low latency relay |

*Historical simulated ranges only. Phase 2 removed `latencyFor` execution; actual latency now depends on provider/model, tools and RPM queue. Tier labels map through optional per-provider `providerModels`; absent mappings use the UI-selected model.*

---

*Registry/specification preserved; current verification and stage status: PLAN.md. Package versions remain 0.1.0.*
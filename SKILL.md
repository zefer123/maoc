# MAOC - Agent Skills & Runtime Tool Boundaries

## Current Capability State

| Area | Status | Boundary |
| --- | --- | --- |
| Agent identity | Implemented | 27 existing Agent IDs / eight departments; registry prompts, model tiers and default co-work pairs unchanged. Each department receives a fictional report-format example in constructed mission prompts, not new capabilities. HUMAN is a workflow participant, not a 28th autonomous Agent. |
| Runtime execution | Implemented | Backend provider adapters and validated function tools; available tools are the intersection of registration, server grants, agent configuration/disablement and task context. GET /api/tools reports capabilities, not permission to execute every tool. Incomplete token usage is unreported, not zero usage or cost. AI handoff prompts label omitted or clipped deliverables. Execution traces publish only bounded operational summaries, separate from event previews and hidden model reasoning. |
| Local database foundation | Hardening candidate accepted on local SQLite | Five collections use the selected adapter; the code defaults to JSON. Schedules, templates, Analytics, HUD preferences and mission history remain server JSON. `INTERRUPTED` is history only; old gates stay invalid and nothing auto-replays. See the [backend checklist](PLAN.md#backend-hardening-before-frontend) and [recovery design](PLAN.md#task-human-and-approval-recovery-design). |
| Scoped roadmap (Phase 6 excluded from this audit) | Core implemented; gaps remain | Phase 1: 1.5–1.8 / 1.12 partial; local REST limit and root error boundary fixture-verified, CI steps rehearsed locally. Phase 2: 2.8 implemented on mock provider; 2.4 / 2.9 planned; 2.5 / 2.6 / 2.10 partial. Phase 3.1–3.10 implemented within scope; Phase 4.1–4.10, 5.1–5.10 and 7.1–7.10 planned. [Canonical inventory](PLAN.md#scoped-roadmap-inventory). |
| U.1–U.5 | Mixed; see PLAN.md | U.1/U.2 implemented within scope (no hard billing cap); U.3 partial (in-process registry only); U.4 vector/RAG planned; U.5 spec approved, runtime and grants pending. No new grants from Agent selection or report approval. [Canonical inventory](PLAN.md#scoped-roadmap-inventory). |
| CEO Quick Directive | Implemented; isolated acceptance | CEO is the human operator. ARIA and existing rosters run via validated DAG/REST only after explicit confirmation. Direct mode omits the optional pre-team HUMAN node, not existing report approval gates. Live Visualize observes execution and grants no additional tool or provider access. |
| CREW / ATTENTION | Intelligent 47 Slice 2 | CREW displays registry identities and observed runtime signals, not sample presence. ATTENTION separates actual failures/degradation, Report Approval, and HUMAN/interrupted waits. No new agents, tools or approval authority. |
| Admin / User Access Gate | Implemented; isolated acceptance | Operator credentials are distinct from AI provider keys and never grant Agent tools. Gate defaults off; with it enabled, authenticated Users share workspace data but cannot administer activation keys or change the shared AI provider. See [operator notes](docs/LOCAL-DATA-HUB.md#local-access-gate). |
| Intelligent 47 Slice 1–1.5 / frontend loading | Fixture-first; results in PLAN.md | Only the current category trigger is visible when closed. Five unnumbered categories and one nested list scroll inside the fixed desktop rail or under the mobile top menu bar without moving the workspace. The Home landing index opens existing routes only; Task/Log and Command Deck Status use canonical telemetry. Forecast is sample data. Parallax Stars is the default shared backdrop and never moves a canvas; manual orbit remains. Heavy panels stay on demand. No new grants or changes to confirmed directives. |
| Standalone Realm design concept | Simulated | Core-owned pages, optional motion, sample weather, appearance/units and Glossary; browser connectivity/local time are not backend/provider health. No tools, grants or dispatch. [Live scope](PLAN.md#current-state). |
| Control Panel / A + B1 + B1.1 + B2 / B3 mission–deliverable slice | Implemented; evidence in PLAN.md | B2 measured Analytics separates mission outcomes, AI-only sample-weighted performance, HUMAN waits and usage coverage. B3's approved first slice adds exact, reciprocal mission and deliverable links, even for retained archives without runtime. Remaining B3 Library knowledge/Team work and live acceptance are gated. No permission, persistence, provider, learning or Agent changes. |
| Cline development skills | Configured; host routing Unverified | 27 Matt Pocock Engineering/Productivity skills preserved with companions, pinned manifest and MIT notice. User-approved local Markdown tracker/default triage/single-context domain rules live in docs/agents; CLAUDE.md routes consumers. .clinerules governs 11 model-invoked / 16 explicit-only skills, Plan/Act and checkpoints. Fresh-chat host acceptance is pending; no runtime tool or Agent grants added. |
| Market analysis | Partially Implemented | market-data-feed reads BTCUSDT/ETHUSDT/PAXGUSDT 24h tickers; PAXG is tokenized gold, not spot XAU/USD. U.5 specification approved in docs/U5-MARKET-ANALYSIS.md; OHLCV/RSI/ATR/swings/FVG/zones remain Planned runtime capabilities. HAWK-only future analysis access is not yet granted. |
| Vector / RAG | Planned | vector-search, memory-index and citation-resolver specification names do not imply an implemented embedding/index/search pipeline. |
| Cline development MCP | Configured; local checks Verified; account/host acceptance Unverified | Context7, Playwright, Firecrawl and Sentry registered separately from the app; task-matched Skill routing and OAuth handoff in docs/agents/skill-routing.md. Playwright stdio/local browser fixture passed; remote OAuth challenges reachable. No blanket tool auto-approval; Sentry project selection, live OAuth and fresh-chat routing remain pending. Playwright installed outside app dependencies; no runtime grants or telemetry SDK added. |
| MCP | Partially Implemented | In-process schema/scoped registry and trusted registration only; external stdio/HTTP transport remains Planned. |
| Historical Agent design | Simulated | Historical latency, token/context, autonomy, venue and coverage claims are not runtime guarantees; see the [design catalog](docs/specs/agent-catalog.md). Measured evidence belongs to PLAN.md. |
| Paid provider / device acceptance | Unverified | No claim that configured keys, model IDs, live inference, visual acceptance or 60fps have been verified. Package versions remain 0.1.0; v4.0 is a roadmap label. |

## Implemented Tool Names & Safety

Registered core names: wikipedia-search, hn-search, web-search, news-sentiment,
vault-write, risk-engine, exposure-limit, market-data-feed, repo-insight,
code-sandbox, agent-registry, task-router, executive-dashboard, telemetry-bus,
signal-broadcaster, notification-hub, incident-channel, finance-model,
contrast-checker, consistency-lint, contract-reader, schema-designer.
agent-message additionally requires opted-in Custom DAG task/node context.

- Common research/vault-write tools remain available only under existing enablement rules;
  specialized tools keep server-granted scopes. HAWK owning market-data-feed does not grant
  it automatically to BLADE/SAGE. No grants or agent definitions changed during doc cleanup.
- web-search is Wikipedia/HackerNews retrieval, not unrestricted browsing; news-sentiment
  retrieves news for model analysis, not a measured sentiment score. Risk tools calculate
  unleveraged spot sizing, not trade approval. contract-reader is heuristic, not legal advice.
- repo-insight permits bounded allowlisted source reads, never secrets/arbitrary paths;
  code-sandbox parses JS syntax, never executes submitted code. Notification tools emit
  local telemetry, not external webhooks/mail. Registered names are not MCP connections.
- Unknown/unregistered/disabled tools fail explicitly. No live orders, secret vault,
  arbitrary shell, deployments or automatic external action grants. Tool list/schema,
  output bounds, budgets/RPM/deadlines and SAGE/LEX/CIPHER report review remain authoritative.
- HUMAN text/mail/Vault/tool results are untrusted reference data, not instructions or
  authority. HUMAN contribution is not report approval; neither grants external rights.
  Schedules/templates are user/backend capabilities, not model tools. Telemetry exposes
  execution summaries and actual returned usage, never hidden chain-of-thought.

<a id="reading-the-specification"></a>
## Customization Points (Per-Agent Overrides)

Via **Agent Inspector Drawer** (open an Agent from current Teams/map/room navigation):

| Override | Type | Description |
|----------|------|-------------|
| `model` | Select | OPUS / SONNET / HAIKU / HERMES / GPT-5 / GEMINI / QWEN |
| `systemPrompt` | Textarea | Behavioral directive |
| `tools` | Multi-select | Enable/disable specific tools |
| `disabledTools` | Multi-select | Explicitly disable tools |
| `coWorkPartner` | Select | Default handoff target |
| `autonomyLevel` | Slider (0-100) | Decision independence |

`agentOverrides` uses the revisioned collection envelope on the selected `atomic-json` or `sqlite` driver, the outbound `vault/agents/overrides.json` projection and `localStorage.maoc_agent_overrides_v1` for offline fallback. Each mission snapshots overrides; tools must still pass the runtime intersection above. A model/tier label is not a provider availability or latency guarantee.

[Design Specification, Not Runtime Grants](docs/specs/agent-catalog.md) preserves the full 27-agent roster, prompts, speculative tools, co-work pairings, override fields and simulated latency tables verbatim.

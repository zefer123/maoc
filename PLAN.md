# MAOC - Roadmap, Current State & Verification

## Local Data Hub checkpoint

- **Stage 2B.2:** Local, single-writer SQLite acceptance passed on November 20, 2026: five exact envelopes, retained original JSON and verified stopped whole-Vault backup, one approved shallow health check. This is not a current process check.
- **Stage 3:** Local SQLite Realtime rollout passed backup/restore, single-writer, capability, exact API parity and isolated read-only Library replay. Fixture two-tab writes did not touch Live Vault. `MAOC_COLLECTION_REALTIME` defaults off; the verified fallback is polling on the same Vault, not conversion or stale JSON restore.
- **Hardening #5:** Local SQLite candidate passed on November 21, 2026; isolated rollback preserved the latest revision. Paid-provider acceptance is separate. Never restart, probe or handle a live writer lock without separate approval.
- [Verification history](docs/archive/verification-history.md) preserves dated results, original paths and prior checkpoints. Follow the [Local Data Hub runbook](docs/LOCAL-DATA-HUB.md) for operations, not historical PIDs or launcher settings.

<a id="local-data-hub--stage-2b-cutover-checklist"></a>
<a id="stage-3-rollout-guard"></a>
[Stage 2B cutover checklist evidence](docs/archive/verification-history.md#local-data-hub--stage-2b-cutover-checklist) · [Stage 3 rollout and rollback](docs/LOCAL-DATA-HUB.md#stage-3-rollout-and-rollback).

## Current State

Verified means the named evidence, not production readiness. [System Map](docs/SYSTEM-MAP.md) indexes implementation; [CLAUDE.md](CLAUDE.md) owns runtime/security contracts and [SKILL.md](SKILL.md) owns capabilities.

| Area | Status and boundary |
| --- | --- |
| Release | Frontend and backend **0.1.0**. v3.5.0 is a historical baseline; v4.0 is a roadmap label, not a release. |
| Intelligent 47 / The Realm World - Slice 1–1.5 | Home Opening with sample forecast and route index; one trigger in a fixed 162 px desktop rail or anchored top menu at ≤760 px. Five unnumbered categories, stable geometry. Shared Parallax Stars by default; Cyber-Link, Meteor and Minimal remain selectable. Pause/Reduce Motion leaves manual orbit. Realm Intelligence 3D is a Canvas preview, not WebGL. The standalone `src/components/cc/realm-prototype.html` is not production. |
| Intelligent 47 - Slice 2 | CREW shows 27 IDs / 8 departments and observed signals. ATTENTION separates failures, degraded state, report approvals, HUMAN and interrupted history. One exact-ID in-place overlay; existing Bell/toasts and live `pending_approvals` remain distinct from `human_inputs` and retained events. No new grants. |
| B3 - Mission ↔ Deliverable | Exact reciprocal hash links on fixture evidence; archive can outlast runtime. Initial sync, read failure and confirmed absence are distinct; cached matches remain readable. B3 Library knowledge and Team provenance/visual continuity stay gated. |
| Storage / Phase 1 / U.1 | Code defaults to atomic JSON; SQLite is opt-in for five collections. Launcher configuration alone is not runtime proof. Stage 2A `vault-admin.mjs` handles stopped whole-Vault backup/restore and fresh-path import/export with lock/junction/overlap/tamper checks. Explicit driver and first-boot scheduler settings do not grant a read-only API. |
| Orchestration / Phase 2–3 / U.2 | Bounded provider/tool execution, mock-verified report examples and Phase 3.1–3.10 within [architecture limits](CLAUDE.md#orchestration-contracts---phase-31-310). No hard billing cap. |
| UI / Access Gate | Cozy Pixel/Gothic shell, scoped Cyber accents, dossiers, SVG/CSS guild/map and measured B2 Analytics/AAR remain. CEO Quick Directive requires confirmation; separate report/HUMAN gates stand. Local Admin/User gate is default off, not multi-tenant or public hosting approval. |
| Git | Original baseline `47b6a78`; local `main` and its local `origin/main` tracking ref were at `186ca70` at inspection. Lazy-chunk wait fix is already in ancestor `cec1832`; hosted validation of the accumulated slices is separate. No further commit/push without the staged review gate. |

**Verification — current record (November 28, 2026):** Chat 1 reran `npm run verify`, exit `0`: **353/353 Node tests**, main JS **484.33 kB / 146.48 kB gzip** unchanged. Prior sequential Chromium fixtures: **88 checks / 101 layouts** each on `atomic-json` and `sqlite`, zero unexpected exceptions, not rerun for doc-only edits. Original reports: `%TEMP%/maoc-b3-20261128/` (`verify.log`, `atomic-json.json`, `sqlite.json`). No paid/live or device/GPU/60fps/formal accessibility acceptance.

## Active Execution Sequence

Queue order is not approval; one chat per vertical slice, fixture-first.

| Next work | Scope / release gate |
| --- | --- |
| Intelligent 47 Slice 3 - WebGL 3D | Separate approval for `three`/heavy vendor; retain 2.5D and define fallback, lazy boundary, resource disposal, accessibility and measured bundle budgets before code. |
| Intelligent 47 Slice 4 - Custom Agents + Sub-TabViews | Plan schema, dual-driver/CLI parity, revisions and exact route state; no default Agent identity or tool-grant expansion. |
| Intelligent 47 Slice 5 - Copilot 47 Voice/COMMS | Explicit mic/permission, failure and text fallback plan; no background access, external action or paid-provider approval implied. |
| Chat 2 - Static Analysis Tooling | Agree on lint/type/static verification scope and baseline before introducing tooling or dependencies. |
| Pending gates | Paid-provider hardening #6, hosted CI confirmation, Cline fresh-chat/OAuth/Sentry project selection, formal a11y, real-device/GPU/60fps/capacity, Phase 1 packaging/Docker/reporting/deployment. Public demo is separate; no Live Vault/cloud work authorized. |
| B3 remainder | Library knowledge and Team provenance/visual continuity; preserve exact IDs and retained artifact states. D.1 historical Library reload cause remains unproven. |
| U.5 Market Analysis | [Approved specification](docs/U5-MARKET-ANALYSIS.md) owns formulas, data/freshness, HAWK-only future access and test seams. Runtime remains BTC/ETH/PAXG 24h ticker only (PAXG is not spot XAU/USD); no OHLCV/RSI/ATR/FVG/zones, new grants or orders. |

Deferred proposals, not approvals: U.4 `server/src/vectorStore.js` requires Windows/Node review, local model/backend selection, canonical notes/deliverables, privacy, versioning, update/delete/reindex, retention and citations before search then optional bounded RAG. Demo or archived Markdown is not automatically authoritative; lexical-only retrieval is not semantic search. U.3 `server/src/mcpClient.js` requires explicit transport/server/command/origin allowlists, namespacing, schema/result validation, timeouts/cancellation/shutdown and grants. Cline MCP (Context7, Firecrawl, Sentry remote OAuth and Playwright MCP 0.0.85 outside app dependencies; empty autoApprove lists) is development-only; see [skill routing](docs/agents/skill-routing.md).

## Backend hardening (before frontend)

| Item | Current gate |
| --- | --- |
| 1. Shutdown | Refuse late body completions, cancel while scheduler drains, and hold the lock through tracked route settlement. Transport timeout does not bound stuck disk I/O. |
| 2. Backup/restore | Verified stopped whole-Vault backup/isolated restore with SQLite `quick_check` and five fingerprints; no automatic backup. [Checks and retention](docs/LOCAL-DATA-HUB.md#backup-checks-and-retention). |
| 3. Fault handling | `507 STORAGE_FULL` / `503 STORAGE_NOT_WRITABLE` leave committed revisions intact; missing/corrupt SQLite fails closed. Failed mission checkpoint degrades health; no live fault injection. |
| 4. Recovery | `GET /api/mission-history` exposes bounded metadata; recovered nonterminal state is `INTERRUPTED`, not executable. |
| 5. Local acceptance | Passed on local SQLite: accepted single writer, exact envelopes, Realtime, shallow health and isolated replay. No live test writes, migration, external probes or inference. |
| 6. End-to-end mission | Mock excerpt → summary → separate report/HUMAN → deliverable/Markdown/AAR on both drivers. History/archive/AAR survived restart without another provider call. Real provider pending. |

#### Task, HUMAN and approval recovery design

- **Admission:** REST and WS await `task.accepted`; `server.js` / `orchestrator.js` gate work on durable `RUNNING` before registration or provider calls. A lost acknowledgement does not permit retry.
- **Gates:** HUMAN and report approval have separate in-memory IDs; save waiting metadata before readiness/emission. Parallel waits may coexist (HUMAN has display precedence); waiting is not proof of a decision. Never reissue old IDs.
- **Boundary:** `missionHistory.js` owns server JSON `.maoc/state/mission-history.json` (v1; only `task_id`, `state`, `updated_at`; 200 rows / 128 KiB validation at load). Both drivers use the Vault lock and atomic sync/rename from `storageEngine.js`; `sqliteStorageEngine.js` owns only five browser collections. No prompts/answers/grants/credentials/payloads or shared transaction with deliverables/AAR.
- **Startup:** load under lock before serving; corrupt history fails closed. Terminals remain; orphaned `RUNNING`/`WAITING_HUMAN`/`WAITING_APPROVAL` project to `INTERRUPTED` with `last_state`. No task, approval, answer handler or telemetry reconstruction.
- **Operator:** Inspect history, deliverables/AAR and separately authorized provider records. An absent artifact/row does not prove no execution or charge. Review duplicate effects, cost and permissions before explicit new dispatch with fresh ID/gates. No automatic retry/replay; restart pauses non-exhausted schedules and Resume authorizes future slots only.
- **Acceptance:** [Mission recovery fixtures](server/test/missionRecovery.test.js) cover stale gates, failed admission, corrupt history and archive survival. Use both disposable drivers and spies around admission/gates/archive/final writes; no startup effects, false terminal state or repeated approved side effects.

## Scoped Roadmap Inventory

| Phase / task | Status | Remaining scope |
| --- | --- | --- |
| 1.1 / 1.2 / 1.3 / 1.4 / 1.11 | Implemented | Dependency-free logger, explicit validators (not Zod), health, shutdown and .env.example. Formal response-schema tooling remains Planned. |
| 1.9 / 1.10 | Implemented | Node built-in unit/integration and REST/WS coverage; not Jest/ts-jest. |
| 1.5-1.8 / 1.12 | Partially Implemented | Local REST rate limit and root React error boundary are fixture-verified. No claim about the current live process. GitHub CI #3 passed dependency install, Node tests and build, then failed a lazy-room Chromium assertion before root-error coverage. The locally verified interception wait fix is already in `cec1832`; hosted confirmation of the accumulated slices is pending. Docker, external Sentry reporting and deployment remain open. |
| 2.1-2.3 / 2.7 | Implemented | Backend inference/prompts/permitted tools and configured-provider failover. |
| 2.5 | Partially Implemented | Usage coverage now requires three valid provider counters; incomplete replies do not inflate Analytics, and valid totals still inform the reservation guard. No cost attribution or hard billing cap. |
| 2.6 | Partially Implemented | Bounded AI handoff context explicitly identifies omitted and clipped excerpts; no generated summaries or cross-task memory. |
| 2.10 | Partially Implemented | Deterministic execution summaries are separate from previews and validated at telemetry publication. Broader summary coverage remains open; no provider-generated summaries or hidden chain-of-thought. |
| 2.8 | Implemented | Static report-format examples for all eight departments passed mock-provider coverage of all 27 agents, with unchanged tool lists and approval gates. Real-provider report quality remains unverified. |
| 2.4 / 2.9 | Planned | Token-by-token/SSE streaming and persistent cross-task conversational memory. |
| 3.1 / 3.2 | Implemented | Validated dependency editor + SVG preview/layered parallelism, not drag-and-drop/dynamic agent-authored graphs. |
| 3.3 / 3.4 / 3.5 | Implemented | Bounded Swarm, opted-in forward-only AI reference mail and first-class HUMAN input. No live bidirectional chat or active execution recovery; the [candidate retains history only](#task-human-and-approval-recovery-design). |
| 3.6 / 3.7 / 3.8 | Implemented | Bounded UTC recurrence, immutable literal presets and fail-closed typed tool-result routing. |
| 3.9 / 3.10 | Implemented | Retained numeric terminal observations and sanitized deterministic reviews; not billing/quality/root-cause inference or full failed-output archive. |
| 4.1-4.4 / U.4 | Planned | Local vector index, RAG, completed-deliverable indexing and semantic notes search; embedded preference supersedes old Qdrant/Docker recommendation but no backend selected yet. |
| 4.5-4.10 | Planned | Knowledge graph, episodic/semantic memory, ingestion, institutional memory, decay and briefing generation. |
| 5.1-5.10 | Planned | Image generation, execution sandbox, live trading, voice, external knowledge/GitHub/chat integrations, alerts, webhook marketplace and skill packs; each needs independent security scope. U.5 is analysis-only and does not enable orders. |
| 6.1-6.10 | Planned | Multi-tenancy, RBAC, audit/compliance, SSO, encryption, horizontal scale, billing and admin tooling. Local origin checks are not authentication. |
| 7.1-7.10 | Planned | Ambient/predictive UX, council, XR, conversational controls, replay, simulation, collaboration, prompt evolution and appliance distribution. |
| U.1 / U.2 | Implemented | U.1 covers the approved JSON/filesystem variant; opt-in SQLite is a separate Local Data Hub stage. U.2 covers bounded queue/loop guards, not a hard billing cap. |
| U.3 | Partially Implemented | In-process tool registry exists; external MCP transport remains Planned. Cline development MCP is separate. |
| U.5 | Planned runtime; approved spec | [Market-analysis specification](docs/U5-MARKET-ANALYSIS.md) approved; ticker feed is not OHLCV or market-structure analysis. No new grants or live orders. |

Future goals (uptime, p99, RAG coverage, cost, quality, compliance) remain targets,
not measured results. TypeScript, global state frameworks, UI packages, OpenAPI,
i18n and new test frameworks are separate proposals, not prerequisites for current stages.

## Verification Commands & Checkpoint Policy

Run from workspace root using installed npm/Node; on stale Windows PATH prepend
C:/Program Files/nodejs and call npm.cmd. Use absolute paths in execution messages.

~~~powershell
$R = 'c:\Users\Gamer\OneDrive\เดสก์ท็อป\AI'
$G = 'C:\Program Files\Git\cmd\git.exe'
npm --prefix "$R" run verify
npm --prefix "$R" run test:dashboard:browser
node --check "$R\src\lib\dashboardModel.js"
node --check "$R\server\test\dashboard.test.js"
node --check "$R\server\scripts\dashboard-browser.mjs"
& $G -C $R --no-optional-locks status -u
& $G -C $R --no-pager diff --check
& $G -C $R --no-pager diff --stat
~~~

Keep test logs/screenshots outside the repo. Update live facts in place; move superseded evidence verbatim to the [archive](docs/archive/verification-history.md), retaining paths, hashes and limits. A code snapshot or browser export is not a full Vault backup.
When uncommitted work spans multiple verified slices, give a one-line checkpoint reminder. Stage only an exact allowlist after verification; check the staged diff for secrets, Live Vault, dependencies, builds, backups and local reports. Stop for review of `git diff --cached --name-only`; no commit or push without explicit approval.

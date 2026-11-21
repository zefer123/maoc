# MAOC System Map

Start here to find a feature, its data owner and the evidence for changing it.
This map indexes the implementation; [CLAUDE.md](../CLAUDE.md) owns architecture
and guardrails, [Local Data Hub](LOCAL-DATA-HUB.md) owns storage and recovery
contracts, [SKILL.md](../SKILL.md) owns capabilities, and [PLAN.md](../PLAN.md)
owns dated checks and approvals. Paths in the tables are relative to the
workspace unless marked `<Vault>` or `%LOCALAPPDATA%`.

## Request and data flows

```text
React UI / hash routes
  ├─ persistence client ⇄ GET/PUT /api/storage/:collection
  │                         └─ validate + compare revision + serialize write
  │                              ├─ atomic JSON (default) OR SQLite (opt-in)
  │                              └─ generated Markdown / overrides projection
  │
  ├─ telemetry hook ⇄ /ws snapshots and events + REST task/HUMAN/review APIs
  │                     └─ orchestrator ← scheduler
  │                          ├─ agent registry + LLM engine → providers
  │                          ├─ scoped tools → collection writes / archives
  │                          └─ terminal observations → performance JSON → AAR
  │
  └─ schedules / templates / analytics REST → server-owned JSON stores
```

Vite proxies `/api` and `/ws` to the local backend in dev and preview. Clients
that use `VITE_API_BASE_URL` can bypass that proxy; the Chromium fixture harness
checks that the workspace override is absent. Telemetry reconnect snapshots are
not collection snapshots. The browser syncs collections separately through REST:
cache and dirty edits, revision-aware three-way merge, explicit conflict handling
and a 15-second polling interval after a sync completes. `useTelemetry` requests
collection sync before mission submission, not on socket open. The server does
not push post-commit collection revisions. A connected socket does not prove
that a write committed or that a provider is reachable.

## Source map

| Location | Responsibility | Connects to | Durable data? |
| --- | --- | --- | --- |
| [src/main.jsx](../src/main.jsx), [src/App.jsx](../src/App.jsx), [CommandCenterView.jsx](../src/components/CommandCenterView.jsx) | Mount and compose the six dashboard sections: Overview, Missions, Teams, Library, Activity, Settings | Route hook, telemetry hook, persistence client and `cc/` panels | No for selection, unsubmitted drafts and notice read IDs |
| [useDashboardRoute.js](../src/hooks/useDashboardRoute.js), [dashboardRoute.js](../src/lib/dashboardRoute.js), [DashboardNavigation.jsx](../src/components/cc/DashboardNavigation.jsx) | Allowlisted hash routes, exact IDs and browser history | Task/artifact/team/room views; missing items stay explicit | Hash retains identifiers, not record content or editor state |
| [src/components/cc/](../src/components/cc/) | `DashboardPanels` / `DashboardTaskDetail` for missions; `TeamWorkspace`, `iso/` and `topology/` for team views; `DashboardLibrary` / `KnowledgeVaultView` for artifacts and notes; `DashboardActivity` for actions; `EngineSettingsModal` for engine and sync controls | Dashboard model, telemetry, collection helpers and analytics; spatial/registry metadata under [src/data/](../src/data/) | UI reads runtime or durable sources as appropriate; demo data is not execution evidence |
| [WorkflowBuilderModal.jsx](../src/components/cc/WorkflowBuilderModal.jsx), [workflowGraph.js](../src/lib/workflowGraph.js), [swarmGraph.js](../src/lib/swarmGraph.js) | Draft and validate mission structure; confirm before dispatch or save as a paused schedule | REST/WS mission submission, template and schedule clients; backend revalidates | Unsubmitted builder draft: no. Saved template or schedule: yes |
| [persistenceClient.js](../src/lib/persistenceClient.js), [departmentVault.js](../src/lib/departmentVault.js), [hudEngine.js](../src/lib/hudEngine.js) | Browser cache, dirty state and merge; collection-specific accessors | Notes from Library; deliverables/chats from department workspace; overrides/commands from HUD; `/api/storage/:collection` | Browser-local cache can survive reload but is not the authoritative store |
| [useTelemetry.js](../src/hooks/useTelemetry.js), [telemetryClient.js](../src/lib/telemetryClient.js), [eventBus.js](../server/src/eventBus.js) | Live tasks/events, HUMAN contributions and approvals; reconnect and bounded snapshots | `/ws`, REST task/HUMAN APIs, orchestrator and scheduler events | No durable event replay or active-work recovery |
| [vite.config.js](../vite.config.js), [server.js](../server/src/server.js), [config.js](../server/src/config.js) | Proxy, REST/WS composition, startup and graceful shutdown | Default loopback port `8787`; server validates origin/input and wires stores, scheduler, LLM and tools | Transport does not persist data; handlers delegate to owners below |
| [orchestrator.js](../server/src/orchestrator.js), [agentMailbox.js](../server/src/agentMailbox.js), [agentRegistry.js](../server/src/agentRegistry.js) | Sequential/DAG/Swarm execution, HUMAN/review gates, scoped Agent configuration and bounded in-task mail | Shares definitions/rules from `src/data/` and `src/lib/`; calls LLM/tools, emits telemetry and records terminal observations | Active work and waiting decisions: no. Archives and bounded terminal evidence: separate writes |
| [backendLlm.js](../src/lib/backendLlm.js), [llmConnector.js](../src/lib/llmConnector.js), [llmEngine.js](../server/src/llmEngine.js), [toolExecutor.js](../server/src/toolExecutor.js) | Backend provider bridge, queue/failover, validated tool dispatch and archive writes | `/api/llm/config`, `/api/llm/chat`, `/api/tools`; selected provider, scoped tools and Vault | Backend UI-supplied engine config is in memory; browser settings can persist locally. Tool-produced notes/archives use collection storage |
| [taskScheduler.js](../server/src/taskScheduler.js), [taskTemplateStore.js](../server/src/taskTemplateStore.js), [scheduleClient.js](../src/lib/scheduleClient.js), [templateClient.js](../src/lib/templateClient.js) | Schedules and literal presets; scheduler claims a slot before submitting a mission | `/api/schedules`, `/api/templates`, orchestrator and telemetry | Config/claims/templates: yes. An active mission is not replayed; restart requires explicit Resume for non-exhausted schedules |
| [performanceStore.js](../server/src/performanceStore.js), [afterActionEvidence.js](../server/src/afterActionEvidence.js), [afterActionReview.js](../src/lib/afterActionReview.js) | Retain bounded terminal measurements and build deterministic After Action Review (AAR) | `/api/analytics`, `/api/reviews`, Teams Analytics and exact review links | Yes, retained terminal evidence only; not a full event archive |
| [storageEngine.js](../server/src/storageEngine.js), [sqliteStorageEngine.js](../server/src/sqliteStorageEngine.js), [validation.js](../server/src/validation.js), [storageSettings.js](../server/src/storageSettings.js) | One writer per Vault, canonical collection envelopes, shared validation, adapter selection and projections | REST storage, tool/archive writes and atomic JSON writes for server-owned stores | Yes; SQLite replaces the storage of five collections only |
| [vault-admin.mjs](../server/scripts/vault-admin.mjs), [vaultMaintenance.js](../server/src/vaultMaintenance.js) | Operator-only stopped-Vault backup, restore, import and export | Whole Vault, hashes/manifests and fresh destinations | Copies are durable recovery artifacts, not another source for live writes |
| [server/test/](../server/test/), [dashboard-browser.mjs](../server/scripts/dashboard-browser.mjs), [PLAN.md](../PLAN.md) | Node behavior/contract tests and isolated Chromium regressions; evidence index | Reliability, SQLite, maintenance, workflow, scheduler and UI test fixtures | Reports and screenshots may be retained; not live data or live acceptance |

## Data ownership and recovery

`VAULT_DIR` names the whole Vault. The code default is the workspace `vault/`
with `atomic-json`. The configured Stage 2B candidate is
`%LOCALAPPDATA%\MAOC\vaults\2026-11-14-stage2b\live-sqlite`, outside OneDrive.
It is not the earlier OneDrive source, a fixture or a backup. Configuration and
file presence alone do not prove what a running process has opened.

| Location | What it owns | How it is used | Durable? |
| --- | --- | --- | --- |
| `<Vault>/.maoc/state/<collection>.json` **or** `maoc.sqlite` in the same directory | `notes`, `deliverables`, `agentOverrides`, `savedCommands`, `chats`; one canonical envelope per collection | GET returns `schemaVersion`, `revision`, `updatedAt`, `data`; PUT supplies current `revision` and replacement `data`; invalid input or stale revision is rejected | Yes, in the selected adapter; SQLite stores JSON payloads in its `collections` table |
| `<Vault>/.maoc/state/storage-driver.json`, `<Vault>/.maoc/writer.lock` | SQLite driver marker and current writer coordination | Marker/database block silent fallback to JSON; lock is not a backup item | Operational metadata, not user records |
| `<Vault>/.maoc/state/schedules.json`, `taskTemplates.json`, `performance.json` in the same directory | Server-owned schedule, template and terminal/AAR state | Atomic JSON even when the collection adapter is SQLite. Files may not exist before use | Yes; active mission state stays in memory |
| [missionHistory.js](../server/src/missionHistory.js), `<Vault>/.maoc/state/mission-history.json` | Bounded, server-owned lifecycle checkpoints in the hardening candidate | [Orchestrator](../server/src/orchestrator.js) writes checkpoints; `GET /api/mission-history` reads them | Yes for task ID, state and time only; interrupted work is not replayed |
| [accessKeys.js](../server/src/accessKeys.js), `<Vault>/.maoc/state/accessKeys.json` | Local Activation Key hashes, lifecycle and last use | REST and WebSocket authorization; Settings → Admin | Hash and metadata only; no plaintext key or browser projection |
| `<Vault>/notes/`, `<Vault>/deliverables/`, `<Vault>/agents/overrides.json` | Outbound Markdown/JSON projections | Readable exports regenerated from canonical envelopes, not edited back into the API | Files persist, but are not authoritative; projection failure can follow a successful commit |
| Browser origin storage and page memory | Collection cache/base/dirty metadata, local settings; separate unsubmitted drafts | Settings sync status can show queued edits, not whether an editor has unsaved text. Local credentials are sensitive; browser export is not a backup of the whole Vault | Cache/settings: browser-local; unsaved page drafts: no |
| Backend process memory | Live tasks, HUMAN waits, approvals, mailbox, transient events | REST list endpoints and `/ws` read bounded runtime state | No active-work resumption; checkpoints and archives do not reconstruct in-flight work |
| Stopped whole-Vault backup / restore / export into a fresh path | Point-in-time recovery including server JSON and non-projection files | Use the offline runbook; after SQLite writes, export **current** envelopes to a new JSON Vault before switching | Yes, subject to validation and retention; not an off-device recovery guarantee |

Runtime startup can reclaim a lock when its owner PID is absent. The maintenance
CLI refuses existing active **and** stale locks. Starting the backend is not a
read-only lock check: it can take the lock, regenerate projections and persist
restart-paused schedules. Even shallow `/api/health` writes a probe. The static
“Atomic JSON + Markdown” label in Settings is not runtime driver evidence.

## What is established, and what is not

| Evidence boundary | Takeaway | Do not infer |
| --- | --- | --- |
| Source and contracts | Local single-writer architecture, five compatible envelopes, bounded orchestration and offline/rollback seams are implemented | Public or multi-tenant readiness (the optional Admin/User gate protects a shared local workspace), active-task restart recovery, or provider availability |
| Stage 2B copied real data | All five envelopes matched on import; isolated Chromium covered hydration, notes, reconnect and conflict handling. `409`/`400` left data unchanged. SQLite restart and fresh JSON rollback retained the newest rehearsal data; all three boots released locks through graceful IPC shutdown | Rehearsal notes `13/rev 5` are not live counts; no live trial writes or cutover acceptance follow |
| Retained regression evidence | `PLAN.md` records 285 Node tests, successful production build and 69 Chromium checks / 94 layouts per adapter | Tests were not rerun for this map; fixture results do not certify paid providers, a personal browser profile or production hosting |
| Normal-port acceptance | The dated `PLAN.md` checklist records the sole writer and lock, exact parity of five API envelopes and a shallow health report of SQLite `ok` | Health alone does not prove the Vault path or scheduler timer; snapshot hydration is not standard Dashboard live acceptance |
| Backend hardening candidate | See the [six-item checklist](../PLAN.md#backend-hardening-before-frontend) for the isolated acceptance and new mission-history health check | The candidate has not been accepted on the live Vault; mock-provider tests do not establish real-provider availability |
| Capability limits | Registered, scoped in-process tools and provider adapters exist. Stage 3 post-commit notifications passed the local rollout; external MCP transport, RAG and U.5 market structure remain planned | Development MCP setup is not runtime Agent access. A tool in `/api/tools` is not a grant for every Agent or task |

The Stage 2B evidence root is
`%LOCALAPPDATA%\MAOC\backups\2026-11-14-local-sqlite-stage2b\`. Within it,
`rehearsal-browser-FYsdgM/` is the copied-data rehearsal;
`fixture-regression-vAE9Je/` and `fixture-regression-json-UwKz4m/` are isolated
SQLite and JSON fixture regressions. `node-final.*` and `build-final.*` retain
separate command results. Use [PLAN.md](../PLAN.md#local-data-hub--stage-2b-cutover-checklist)
for check status rather than promoting an evidence directory to a live Vault.

## Stability audit (Phase B)

Point-in-time, read-only runtime observation on 2026-11-20; application tests and
build were not rerun. The [Stage 2B checklist](../PLAN.md#local-data-hub--stage-2b-cutover-checklist)
owns the observation and open acceptance items.

| Priority | Finding and evidence | Decision / next check |
| --- | --- | --- |
| Before live acceptance | Loopback listener matched the candidate writer PID, and process metadata matched the relative server entry pattern. Five API envelopes matched the stopped backup exactly, but both adapters present the same API shape. SQLite files on disk and a PID/lock match support, but do not prove, the active driver and complete Vault identity. | No restart or lock removal for inspection. Confirm the launch context using operator-approved evidence and separately authorize the health probe for the driver; the health payload does not identify the Vault path. |
| Before live browser acceptance | [useTelemetry.js](../src/hooks/useTelemetry.js) calls `syncEngineConfig` on socket open, and [backendLlm.js](../src/lib/backendLlm.js) sends a config PUT. A fresh browser profile alone does not make the dashboard read-only. Dirty persisted edits and unsubmitted drafts are also different checks. | Ask the operator to check existing tabs without clearing or reloading them. For isolated hydration, first verify a read-only transport on a fixture: allow only intended GETs, exclude health, and prevent WebSocket and mutation requests from reaching live. Verify read-only Library hydration separately from telemetry. |
| Storage and recovery | [sqliteStorage.test.js](../server/test/sqliteStorage.test.js) covers commit failure and projection degradation after a successful commit; [vaultMaintenance.test.js](../server/test/vaultMaintenance.test.js) covers lock refusal, verified restore and rollback. The copied-data rehearsal passed restart and rollback with newer writes. Runtime startup can reclaim a missing-owner lock; the CLI refuses it. | Keep the current lock intact. For future rollback use a stopped whole-Vault export of current data into a new path. Local rehearsal does not establish off-device recovery or current backup freshness. |
| Before Stage 3 | [reliability.test.js](../server/test/reliability.test.js) covers offline retry, three-way merge and edits during an in-flight sync. The real-data copy recovered through polling after connectivity returned, not through a socket-triggered storage refresh. Two-tab convergence with post-commit notifications remains unverified. | Keep revision and conflict contracts; use isolated fixtures for two tabs, concurrent edits, lost notifications and reconnect/polling fallback before changing synchronization. |
| Before restart-dependent or public use | [taskScheduler.test.js](../server/test/taskScheduler.test.js) covers restart pause and no replay; a durable claim is not exactly-once execution. No active-task recovery, authentication or RBAC is provided. | Keep loopback-only; keep tasks/HUMAN/approvals separate from collection durability. Empty schedules and `stopped:false` are not evidence that the timer is off. |

## Where to extend safely

- **Ready for scoped changes:** presentation and routing, shared validation, and
  isolated fixture tests. Keep data ownership and existing API envelopes intact.
- **Local SQLite accepted:** see the [checkpoint](../PLAN.md#local-data-hub-checkpoint).
  No test writes to live or second writer; follow the runbook if the process changes.
- **With Stage 3 approval:** implement post-commit revision notifications,
  reconnect reconciliation and polling fallback around the existing merge. A
  durable task/HUMAN lifecycle is a different contract, not a storage-driver swap.
  Public hosting, cloud, runtime MCP and RAG are not prerequisites for this work.
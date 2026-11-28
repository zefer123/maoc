# MAOC - Architecture & Guardrails

## Current State

| Boundary | Status | Canonical implementation |
| --- | --- | --- |
| Release identity | Verified | Frontend and backend package versions are both **0.1.0**. Historical v3.5.0 / v4.0 labels describe the baseline / upgrade roadmap, not a published v4.0 release. |
| Scoped roadmap (Phase 6 excluded from this audit) | Core implemented; gaps remain | Phase 1: 1.5–1.8 / 1.12 partial; local REST limit and root error boundary fixture-verified. Phase 2: 2.8 implemented on mock provider; 2.4 / 2.9 planned; 2.5 / 2.6 / 2.10 partial. Phase 3.1–3.10 implemented within scope; Phase 4.1–4.10, 5.1–5.10 and 7.1–7.10 planned. [Canonical inventory](PLAN.md#scoped-roadmap-inventory). |
| Presentation | Intelligent 47 Slice 1–1.5/2 and first B3 slice, fixture-verified | Home Opening, fixed responsive Core rail, shared atmosphere, lazy samples, CREW/ATTENTION and one exact-ID in-place overlay; Bell/toasts reflect observed state. Mission ↔ Deliverable links use exact IDs even for retained archives without runtime. Cozy Pixel/Gothic shell, data-only Cyber accents, system reading font/mono data, Command Deck cards/board, 2.5D guild, hash routes and dossiers retain 27 IDs / 8 departments. No WebGL yet; no new engine or persistent world. |
| Storage | Implemented; Stage 2B local SQLite accepted | Default revisioned JSON/Markdown/offline cache retained. Opt-in SQLite for five collections; explicit launcher settings and stopped full-Vault backup/restore/import/export CLI. See [Local Data Hub](docs/LOCAL-DATA-HUB.md) for contracts and [PLAN.md](PLAN.md#local-data-hub-checkpoint) for runtime evidence and next gates. |
| Backend hardening | Candidate accepted on local SQLite; paid-provider acceptance pending | Realtime → polling retained the latest SQLite revision in the rehearsal. `INTERRUPTED` is neither permission to resume nor proof of provider outcome. Old HUMAN/approval IDs are not restored. See the [backend checklist](PLAN.md#backend-hardening-before-frontend) and [recovery design](PLAN.md#task-human-and-approval-recovery-design). |
| CEO Quick Directive | Implemented; isolated acceptance | Shared Builder panel previews a scoped DAG and dispatches only on confirmation. `201` plus a Task ID keeps the origin view visible and adds a Mission Detail link. Ambiguous responses are never automatically retried. Room notes are not AI runs. See [PLAN.md](PLAN.md#active-execution-sequence). |
| U.1–U.5 | Mixed; see PLAN.md | U.1/U.2 implemented within scope (no hard billing cap); U.3 partial (in-process registry only); U.4 vector/RAG planned; U.5 [spec approved](docs/U5-MARKET-ANALYSIS.md), runtime and grants pending. [Canonical inventory](PLAN.md#scoped-roadmap-inventory). |
| Verification ownership | Implemented | Root `npm run verify` runs the backend suite and production build. The read-only Windows workflow at `.github/workflows/ci.yml` also runs both isolated Chromium fixtures and the root-error case. Dispatch checks wait for backend admission; the sender tab waits for the fixture document before writing once; lazy-loading checks wait for both the loading UI and the matching DevTools request. Hosted confirmation is pending; evidence belongs to PLAN.md. |

## Agent skills

- [Issue tracker](docs/agents/issue-tracker.md): local Markdown, only on request; read for ticket/spec creation, fetching or review baselines. Stage approval is separate.
- [Triage labels](docs/agents/triage-labels.md): read before state changes; readiness is not execution authority.
- [Domain docs](docs/agents/domain.md): single context; read before naming or domain exploration and create glossary/ADRs only when needed. [Skill routing](docs/agents/skill-routing.md) owns invocation compatibility, task-matched MCP selection/auth and fresh-chat acceptance; `.clinerules` owns safety. Cline Context7/Playwright/Firecrawl/Sentry registrations add no runtime transport, Agent grants, telemetry SDK or U.5 authority.

## Stack, Ownership & Entry Points

See [System Map](docs/SYSTEM-MAP.md) for cross-stack flows and data ownership.

React 18, Vite 6, Tailwind 3, lucide-react; ESM JavaScript, Node >=22, Express, ws and cors. No added state/test framework, npm database dependency or MCP SDK. Opt-in SQLite uses lazy `node:sqlite` (tested on Node v26.13.0, not certified across the full range); default JSON stays independent.

**Performance & Bundle Budget:** Main JS baseline is **484.33 kB / 146.48 kB gzip**. Keep heavy panels lazy and WS selectors stable. Defer `vite.config.js` `manualChunks` until Slice 3 introduces an approved heavy vendor such as `three`; measure the initial shell and route chunks then. On unmount, cancel animation frames, dispose owned WebGL/Three.js resources, disconnect `ResizeObserver`, abort requests and detach listeners. Preserve geometry, focus and Reduce Motion across lazy states.

| Entry point | Responsibility / authority |
| --- | --- |
| src/components/CommandCenterView.jsx + src/components/cc/HomeOpening.jsx | Home Opening is the workspace landing: sample weather and forecast, compact Task/Log from canonical telemetry, and a scrollable index of existing destinations. The index animation obeys app pause and Reduce Motion. The Realm World remains an explicit mode selector. Canvas, map, rooms, topology, analytics and first-open Builder are lazy. |
| src/components/cc/WorkspaceAtmosphere.jsx + src/components/cc/RealmScene.jsx + src/components/cc/WorkspaceStatus.jsx | One decorative, pointer-transparent shell background persists across page routes. Parallax Stars is the three-depth default; Cyber-Link, Meteor and Minimal remain selectable. Mouse parallax moves its layers only, never the Weather or Nexus canvases. Those canvases are samples/previews, not telemetry. Web Status separates browser connectivity, WebSocket status and local time; none verifies provider health. Atmosphere and pause are session-only. OS Reduce Motion or app pause stops automatic motion, not manual orbit. |
| src/components/cc/DashboardNavigation.jsx + src/lib/dashboardPresentation.js | The fixed-width left rail shows only the route's category trigger when closed. At 760px and below, the same trigger is in a permanent top menu row and opens an anchored, bounded panel. Opening, switching or closing leaves content geometry unchanged. The five category names are unnumbered and only the selected category exposes nested destinations. Category selection and hover never navigate. ArrowDown reaches destinations, Escape returns focus to the trigger, and outside interaction or navigation closes the frame. Analytics belongs to Dashboards, Glossary to Armory. |
| src/hooks/useTelemetry.js | Canonical live task/event/HUMAN/review state and reconnect snapshots; browser transport is not provider-health verification. |
| src/components/cc/OverviewDock.jsx | Command Deck alone reserves a compact Status control showing Running and Needs You when live, or connection state otherwise. The expanded panel retains backend and task details; Bell opens Notices without navigating. CommandCenterView owns panel selection and ephemeral read IDs. |
| src/components/cc/DashboardPanels.jsx | Overview/Missions/Teams projections; Overview counts follow current search, pending actions use global runtime. Situation cards open exact RUNNING/COMPLETED/failure filters or action inbox; board prioritizes awaiting/running then recent retained work without mutating tasks. Realm/directory/analytics shortcuts select explicit existing views. |
| src/components/cc/TeamWorkspace.jsx + src/lib/teamWorkspace.js | Department dossier distinct from map/room: actual registry members, related retained missions, departmental saved artifacts and bounded event signals. Relations use routing tags, workflow/swarm members or retained source/target events; neither lifetime completeness nor provider health. Static ONLINE/sample metrics are not evidence. |
| src/components/cc/DashboardTaskDetail.jsx | Node/events/artifact links and AAR detail; absent retained runtime is explicit, never replaced by another mission. |
| src/components/cc/DashboardActivity.jsx | HUMAN contributions, separate report actions, notice read IDs and bounded mailbox/Chronicle views. |
| src/components/cc/DashboardLibrary.jsx | Actual retained deliverables; demo registry/sample text is not execution evidence. |
| src/components/cc/WorkflowBuilderModal.jsx | Goal/Method/Timing/Review/Templates; explicit confirm before dispatch; loaded on first opening, then mounted while closed to retain draft. |
| src/components/cc/LazyPanel.jsx | Shared Suspense/error fallback; spatial host reserves geometry, notices reserve minimum height. Modal fallback reuses useDialogFocus for Tab/Escape/opener restoration; page reload is explicit and warns about unsaved drafts. AAR stays lazy from both detail/history paths. |
| src/main.jsx | Root React render-error fallback; no raw error details or reporting service. Reload is explicit, warns about drafts and does not submit a mission. |
| src/components/cc/EngineSettingsModal.jsx | Provider/limits/webhook/data tabs; existing useDialogFocus hook contains focus for settings/inspector. |
| server/src/server.js | Validated REST/WS composition, lifecycle and dedicated storage/schedule/template/analytics/review APIs. |
| server/src/orchestrator.js | Sequential/DAG/Swarm routing, guarded execution, HUMAN/review waits, bounded private tool-result references and terminal observations. |
| server/src/agentRegistry.js | Server scopes, prompts, tiers and bounded overrides; shares metadata with src/data/agents.js and src/data/agentSkills.js. |
| server/src/llmEngine.js | Backend-only provider requests, queue/failover, memory-only keys/settings, model mapping and actual returned usage. |
| server/src/toolExecutor.js | Input validation, server-granted tools, safe reads/syntax checks, research and note/artifact writes; schemas/annotations are not an MCP connection. |
| src/lib/backendLlm.js | Browser-to-backend inference bridge; llmConnector.js retains configuration and explicitly separate legacy synthesis/webhook/backup helpers. |
| src/lib/persistenceClient.js | Revision-aware sync/offline queue; departmentVault.js and hudEngine.js use existing collection boundaries. |

Submission flows through REST POST /api/tasks or WS SUBMIT_TASK into the
orchestrator, shared graph validation, provider queue and permissioned tool loop.
Report review remains separate from HUMAN input. Backend archives successful outputs;
WS summaries update the UI. Optional legacy browser webhooks are separate from tool rights.
No hidden chain-of-thought, fabricated usage, or automatic agent webhook authority.
`reasoning_trace` is an execution summary: planning, deliverable completion and
local tool notifications use operational text rather than copying event previews.
The telemetry bus publishes only `kind: execution_summary` and a non-blank
`summary` of at most 512 UTF-16 units; malformed traces become `null`.
Existing `payload_summary` previews are unchanged; this is not event redaction.

## Security & Execution Locks

- Local-only backend, default 127.0.0.1:8787; allowlisted REST/WS origins. Optional Admin/User
  [Access Gate](docs/LOCAL-DATA-HUB.md#local-access-gate) defaults off. No per-user data isolation,
  general RBAC or encryption-at-rest guarantee. Do not expose publicly.
- Access Gate rejects old/invalid credentials with HTTP/upgrade `401` and closes affected sockets with `4401`. Revision conflicts are `409`; capacity/unwritable collection writes fail with `507`/`503` before revision or notice advances. See the [storage diagnostic contract](docs/LOCAL-DATA-HUB.md#storage-fault-diagnostics).
- No live orders, arbitrary shell/code execution, deployment or secret-access tools.
  code-sandbox invokes Node syntax checking only. Tool overrides cannot exceed server scopes;
  unknown/disabled tools fail explicitly. Existing risk sizing is unleveraged spot analysis,
  not trade approval; PAXGUSDT is a tokenized-gold proxy, not spot XAU/USD.
- Legacy browser AI provider credentials still reside in sensitive unencrypted localStorage;
  Admin and Activation Keys are memory-only in the browser. Backend UI keys
  are memory-only; headless keys may come from root .env. Never add credentials to Vault,
  telemetry, authored IDs, rules, schedule/template text or exports. Redaction is heuristic.
- Defaults: 10 RPM/provider, eight active missions, 12 handoffs, four tool rounds/agent,
  24 tool calls/mission, 60,000 conservative token reservation, 1,600 max output tokens,
  300-second mission deadline. Reservations are not exact tokenizers or billing caps.
- The local REST process shares one fixed window of 600 `/api` requests/minute by
  default (`MAOC_REST_REQUESTS_PER_MINUTE`). Excess requests receive `429` with
  `Retry-After` before body parsing. Separate from WS and provider quotas; not
  designed for public ingress or per-user isolation.
- Provider adapters: Gemini/OpenRouter/OpenAI/loopback Ollama. Configured failover on
  429/connectivity/selected 5xx respects Retry-After; 400/401/403 do not silently fail over.
  Tier labels are not provider availability promises; optional providerModels maps tiers,
  otherwise use the selected model. Live paid inference remains separately unverified.

## Orchestration Contracts - Phase 3.1-3.10

| Capability | Bounds that must survive later stages |
| --- | --- |
| DAG / parallel | Shared src/lib/workflowGraph.js; 1-16 nodes, <=32 edges, one final sink, concurrency 1-4 (default 2). Edges obey maxHandoffs. Layer/batch barriers; ancestor-only context (last six outputs, up to 6000 UTF-16 units of text each). AI prompts label omitted or clipped source material without a separate model call; original reports and HUMAN context are unchanged. Reserve budgets before requests. Failure cancels/drains siblings; completed tool side effects are not rolled back. |
| HUMAN | First-class DAG node, not a 28th autonomous Agent/tool owner. Question 1-2000 characters; answer 1-12000. No HUMAN-node provider charge; downstream AI may transmit text. Deadlines continue; cancel fails mission. Pending inputs survive browser reconnect, not server restart; no identity attribution. |
| Swarm | Shared src/lib/swarmGraph.js; 2-6 distinct AI members, selected synthesizer (default HERMES; may also be a member), concurrency 1-4. No sibling prompt reports; tools/Vault shared, not sandboxed. Synthesis sees <=6000 characters/member. No voting, quorum, multi-round debate or Swarm messaging. |
| Messaging | Custom DAG messaging:true only. agent-message addresses node IDs; RUNNING AI sender to PENDING AI recipient in strictly later layer, including cross-branch. No HUMAN/sequential/Swarm/self/backward/cross-task mail. 2000 characters, 4/sender, 6/recipient, 24/task; mail plus edges obey maxHandoffs. Untrusted reference data, not instructions/grants. DELIVERED means context assembly, not read/provider success. Pending mail cancels on termination; successful archives retain provenance, failed missions lack full mail archives. |
| Scheduling | src/lib/schedule.js and server/src/taskScheduler.js; interval 5-43200 whole minutes, daily/weekly UTC, no full cron/DST. <=20 schedules, 1-100 attempts (default 10), <=2 active scheduled missions, no per-schedule overlap including waits. Start PAUSED; explicit Resume authorizes recurring charges. Busy/>60s-late slots skip without replay; failure pauses future dispatch. Pause is not active cancellation. Immutable config; exhausted cannot rearm. Durable CLAIMED precedes submit, not exactly-once execution; restart pauses non-exhausted schedules and requires Resume. Disk failure stops scheduling closed. |
| Templates | src/lib/taskTemplates.js and server/src/taskTemplateStore.js; <=50 immutable presets, 16 parameters, 128 occurrences, 2000 characters/value. Literal single-pass {{name}} only in description/HUMAN question; no eval/path/expression/topology/settings/grants expansion. All own string values required, extras rejected; final 12000/2000 limits revalidated. Reject TEAM/COWORK marker injection; not semantic prompt-injection isolation. Load/render never executes, resets timing to Run now; explicit dispatch/save-paused-schedule required. Schedule holds independent expanded text. No version history/dynamic recurrence parameters/template-ID provenance. |
| Conditional branching | Last actual named tool result of a direct AI dependency, not model prose; strict eq/neq and numeric gt/gte/lt/lte. One comparison/node, own-property path <=8 segments/200 characters, no prototype keys/coercion/eval. Missing/error/type mismatch fails closed, not ELSE. Unselected/dependency-blocked paths SKIPPED; queued mail cancelled. join all/any resolves after barriers, never races or swallows failures. Final sink must remain reachable. SAGE/LEX/CIPHER cannot be conditional or have conditional ancestors. Private bounded/redacted routing results clear on termination; persisted rules/decisions are not raw outputs. |
| Review authority | SAGE/LEX/CIPHER report gates and sensitive-department HERMES fallback remain. HUMAN contribution is not report approval; report approval never grants external execution rights. |
| Workspace attention | `SNAPSHOT.pending_approvals` projects actual in-memory gates independently of `human_inputs` and retained events. It is not persisted or replayed on restart. Home, Bell and ATTENTION open exact IDs in one modal without changing routes. Only live gates allow action through the existing endpoints; notice read/dismiss never resolves a gate. |

## Persistence & Recovery

- `server/src/sqliteStorageEngine.js` is a compatibility-first opt-in adapter for
  five browser collections through `createApplication({ storageDriver: 'sqlite' })`.
  It reuses validation/lock/queue/projections and preserves API envelopes. Existing
  JSON import needs explicit `sqliteImportJson: true`; never silently reimports or
  falls back. SQLite database/marker block default JSON startup on that Vault.
  Database and marker live under the selected Vault's .maoc/state; real cutover
  must relocate the full Vault outside OneDrive with backup/restore acceptance.
  Default startup still uses JSON; `MAOC_STORAGE_DRIVER` explicitly selects the
  adapter, `VAULT_DIR` selects the whole Vault and `MAOC_SCHEDULER_AUTOSTART=false`
  disables the timer for first boot (not a read-only API). Offline CLI
  `server/scripts/vault-admin.mjs` backs up/restores/converts only stopped Vaults
  into new paths, refuses existing locks/junctions and checks hashes/envelopes.
  No implicit serving import, real-data migration, new push sync or runtime
  recovery is included. Migration/rollback contracts: docs/LOCAL-DATA-HUB.md.
- server/src/storageEngine.js owns one writer lock, serialized atomic rename/fsync and strict
  startup validation; corruption fails without reset/overwrite. Graceful shutdown drains writes
  before lock release. Forced kill is not graceful and may lose in-flight/uncommitted work.
- Five browser-sync collections: notes, deliverables, agentOverrides, savedCommands, chats
  under vault/.maoc/state/*.json. GET returns schemaVersion/revision/updatedAt/data;
  PUT requires revision, stale writes return 409. Three-way merge preserves independent edits;
  conflicting edits remain local until Settings resolves Browser vs Local Vault. Debounced
  background sync retries every 15s; legacy migration only into never-written collections.
- Markdown in vault/notes and vault/deliverables is generated outbound projection, not
  bidirectional Obsidian ingestion. Deleted records may retain archived Markdown. Overrides
  project to vault/agents/overrides.json. Backend archives headlessly; browser avoids duplicates.
- schedules.json, taskTemplates.json and performance.json are separate server-owned state,
  outside five browser collection writes/import/backup/reset. Schedules/templates preserve
  authored text verbatim and must not contain secrets. They grant no model scheduling tools.
- `GET/PUT /api/hud-preferences` uses strict schema v1 and an expected revision (stale → `409`).
  Theme, accent and tactical grid live in `.maoc/state/hud-preferences.json` on both drivers,
  protected by the existing Access Gate and writer lock. Writes serialize and drain; corruption
  fails startup. Authorized WS `HUD_PREFERENCES_UPDATED` carries only the committed revision,
  independent of the five-collection Stage 3 switch. Browser cache is a display fallback, never
  an automatic overwrite on reconnect. Operator name stays browser-local.
- Runtime tasks are RAM-only (bounded 200), events ring bounded 500; reconnect snapshots
  hydrate pending state independently of ring history. No backend-restart recovery of active
  tasks, HUMAN inputs, approvals or mail; no durable complete failed-mission/run ledger.

## Analytics & After Action Review

server/src/performanceStore.js retains <=1000 terminal missions in commit order,
64 MiB startup bound, existing envelope v1 with optional after_action evidence v1.
Numeric observations and sanitized AAR share one atomic terminal commit. Legacy records
remain legacy_metrics_only, without fabricated replay/backfill. Back up before rollback:
pre-3.10 binaries reject extended records. Persistence failures keep bounded memory-only
records, expose degraded health and retry next append/graceful close without altering outcome.

Distinct execution IDs separate repeated agents, AI/HUMAN runs, skips and unstarted nodes.
Monotonic durations: AI excludes report wait, HUMAN includes input wait, mission includes waits;
parallel intervals may overlap, so do not invent a critical path or sum of waits. Completion
is executor success, not report approval/quality. Rates exclude cancelled/skipped; latency
samples include started failed/cancelled runs. Usage is returned provider metadata with
coverage, not exact billing, failed intermediate HTTP attempts or quality/cost estimation.

server/src/afterActionEvidence.js allows only bounded validated categorical/reference context:
stop phase/category/status, archive observation, topology/join/branch selection, execution/skip
references, report decisions and HUMAN/report wait durations. No prompts/model prose,
mission/questions/answers, raw error text/body, credentials, raw tools or branch comparison values.
IDs remain identifying metadata. src/lib/afterActionReview.js generates deterministic evidence,
limitations and non-executing suggestions; never auto-retry or infer root cause/quality/cost.

Read-only /api/analytics filters window/team/agent; dashboard polls every 15s while visible.
Read-only /api/reviews validates outcome/offset (0-1000)/limit (default 25, max 50);
/api/reviews/:taskId returns detail or unavailable 404. Analytics hosts independent paginated
AAR history; mission detail can read retained reviews without runtime. Explicit abortable AAR
refresh and terminal transitions prevent stale writes; event-before-commit can need manual
refresh. Preserve legacy/empty/loading/error/offline/memory-only states and contained tables.
B2 presentation uses src/lib/performancePresentation.js: AI-only completion is computed
from summed completed/failed counts; mean duration is sample-weighted, excludes HUMAN
and skipped steps, and includes started failures/cancellations. No pooled p50/p95 is
inferred from per-Agent percentiles. HUMAN contribution wait remains separate, never
report-approval time. New responses count as reported only when prompt, completion and
total token counters are non-negative safe integers; explicit zero counts remain valid.
Incomplete responses are unreported without discarding their answer. A valid total may
still tighten mission reservations, without being counted in Analytics. Retained records
are not reclassified. No billing, quality score or trend inference.
PerformanceDashboard keeps the existing API/filter/polling contracts and exact mission/AAR
routes; responsive cards retain semantic table headers and keyboard Agent inspectors.
Analytics/Reviews endpoint 404 is an integration failure, distinct from empty collections
and a missing retained AAR. Existing detail/pagination/offline/degraded contracts remain.
Mission Results and Library detail use exact hash links in both directions. The archive
projection normalizes explicit task IDs (conflicting fields do not link) or falls back to
the `task-<id>` archive convention. Keep matching archives visible even without runtime;
use the existing deliverables sync state to distinguish loading, failure and absence.

## Cozy Guild / Overview A Locks

- `docs/THE-REALM-DESIGN-BLUEPRINT.md` owns design provenance, source-vs-proposal colors and follow-ups. The operator approved Stage 1 knowledge capture and B1.1 menu colors on 2026-11-14; scoped B1.1 and B2 evidence is [archived](docs/archive/verification-history.md). No Supabase, multiple runtimes or automatic RAG.
- Keep eight departments/27 IDs, names, coordinates, camera focus, room callbacks and palettes
  in src/data/cozyGuild.js. SVG/CSS scenes and pixel sprites, not a twelve-realm MMORPG,
  NPC simulation, imported engine or persistent world. Legacy room chat/artifact behavior is
  unchanged and decorative samples are not live market/agent integration evidence.
- IsometricMap mounts on demand in Command Deck, Realm World 2.5D and the legacy Teams map; TradeFloorRoom and TopologyTreeView
  remain reachable. GuildBackdrop/Ground/Props are fixed bounded decorative layers,
  aria-hidden and pointer-transparent. Causeways are not workflow edges. GuildBuilding
  has eight silhouettes; shared PixelAgent outfits and Gothic CozyRoomScene preserve IDs.
- Actual event buckets/expiring source-target links from spatialModel.js drive telemetry,
  never static registry status or random samples. Ambient scans/mist/sample candles are
  decoration; Topology demo is explicit opt-in, not dispatch, provider work or measured latency.
- Motion follows OS with mount-local pause/enable/system overrides; no persistence. Explicit
  opt-in only bypasses reduced-motion CSS inside its stage; demo progression remains separate.
- cozyGuild.css scopes spatial materials; main.jsx loads overview.css afterward. Keep 44px
  controls, keyboard entrance/desk access, pan/zoom/Fit, native room/agent selectors and
  responsive containment. Fit reserves 24px vertical control offset; tiny mobile sprites
  require zoom/selectors. No real-device/60fps/formal accessibility certification implied.
- Control Panel B1 uses Cozy Pixel insignia, Gothic material framing and Cyber only for
  measured data/status. Native system reading font supports Thai fallback; mono stays in
  IDs/numbers/short labels, no new font service or dependency. Summary cards remain readable;
  scene/mission board share desktop space, stack below 1400px, four cards become 2x2 on phones.
  Workbench/archive and collapsible native field guide follow; offline/pending banners remain.
  B1.1 Realm per-section accents in overview.css use shell data-dashboard-section and
  navigation data-section; active states retain category identity/markers/weight, never
  all Gold. Primary actions/insignia remain Gold; department palettes/statuses stay distinct.
  Team directory titles/dossier eyebrows retain team accent. No fake ranks/XP/trends.
  OverviewDock reserves Status only on Command Deck.
  One topbar Bell opens the non-modal Notices preview across the workspace without moving to Activity;
  Bell badge is unread notices only, while Activity retains pending-action badges/controls.
  Latest five from the existing 60-item feed; shared ephemeral read IDs, no new persistence.
  Opening never reads/approves. Explicit read, mission/View All links only; no approval controls.
  Heading focus/Escape restoration; toast stacks above an open preview; menu/inspector/dialogs
  suspend disclosures. Existing non-Overview toast behavior remains when no preview is open.
  English scope is shell labels/tooltips/accessible names and Settings entry/close controls,
  not mission/report/user content or system safety warnings. CSS owner is
  src/components/cc/overview.css; keep previews clear of topbar, Status and mobile navigation.
- Department dossiers use existing guild palettes/pixel identities with no new art dependency.
  Teams directory opens a team-specific dossier; room/mission/archive links preserve exact IDs.
  Rooms exit to their team's dossier. Existing map/topology/analytics remain explicit views.
  Blank hash opens Home Opening; `#/home/realm` is the selector, and `#/overview` still opens Command Deck without rewriting the bookmark. Browser reload restores only the URL view,
  not drafts/runtime durability. Skip-to-content focuses main without replacing the hash route.
  Missing team/mission/artifact and malformed route states must never select a substitute.

## Run / Verify / Documentation Sync

- `npm run verify` runs correctness-only lint (warnings do not fail the run), no-emit `checkJs`, fast `node --test` frontend helper tests (routing, performance presentation and workflows), server tests, then the production build. `jsconfig.json` lists four browser entry points and TypeScript follows their local imports; the Node browser harness is outside the typecheck and runs separately on fixtures. No `@types/node` is required.
- Workspace root: `npm run dev` (Vite 5173), `npm --prefix server start` (backend 8787), `npm --prefix server test`, `npm run build`, `npm run test:dashboard:browser`. The harness uses deterministic transport, `MAOC_CHROME` or standard Chrome, writes local artifacts and pins proxies to the fixture. Legacy live `selftest.js` can authorize test reports; do not run it with paid keys for offline verification.
- The [archive](docs/archive/verification-history.md) identifies the code/config snapshot and its RECOVERY.md; it excludes live Vault, secrets and browser state. Browser workspace export does not include templates/schedules/analytics/reviews/runtime. Never overwrite a running Vault or restore `writer.lock`; require coordinated shutdown and isolated restore. No automatic Git staging.
- Root `.env` loads regardless of backend cwd; process environment wins. Never use `VITE_` for secrets. Vite proxies `/api` and `/ws`; separate hosting needs an equivalent proxy or non-secret `VITE_API_BASE_URL`. Deep health uses cached read-only external probes (3s deadline/30s cache), not paid inference or webhook sends. SIGINT/SIGTERM or supported Windows IPC shutdown abort/drain before storage release.
- [PLAN.md](PLAN.md) owns current stage/verification/roadmap; [SKILL.md](SKILL.md) owns runtime Agent/tool capabilities. Consolidate in place and archive old evidence. Doc cleanup implies no release bump, registry/grant change, dependency migration or unrelated refactor.

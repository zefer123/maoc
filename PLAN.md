# MAOC - Roadmap, Current State & Verification

## Local Data Hub checkpoint

2026-11-20 — **Stage 2B.2 local SQLite operational acceptance passed.** The single writer on `127.0.0.1:8787` matched the Vault lock, all five API envelopes matched the verified backup and canonical pre-stop fingerprints twice, and the approved shallow health probe returned `200` with no probe file left behind. Details: [cutover checklist](#local-data-hub--stage-2b-cutover-checklist).

2026-11-20 — **Stage 3 realtime rollout passed on the local SQLite backend.** The approved rollout passed backup/restore, single-writer, WebSocket capability, exact API parity and read-only Library snapshot checks. Live test writes were not performed; two-tab writes were verified on fixtures. See [rollout guard and evidence](#stage-3-rollout-guard). The hardening candidate now passes [isolated acceptance](#backend-hardening-before-frontend); a later read-only port check found `8787` not listening. No live Vault restart or external integration was attempted in that round.

2026-11-21 — **Backend hardening item 5 passed local Live Acceptance.** After a verified stopped backup and isolated restore, the single candidate writer retained all five collections, advertised Realtime and passed the one approved shallow health probe and isolated Library replay. Paid-provider acceptance (backend item 6), external integration and the remaining [scoped roadmap](#scoped-roadmap-inventory) are separate; roadmap Phase 6 is excluded from this work.

## Current State

Status vocabulary: Verified | Implemented | Partially Implemented | Simulated | Planned | Unverified.
Verified means the named check/evidence, not a claim of production readiness.
For the source, data and evidence index, see [System Map](docs/SYSTEM-MAP.md).

| Area | Status | Current boundary / evidence |
| --- | --- | --- |
| Package version | Verified | Frontend **0.1.0**, backend **0.1.0**. No version bump in documentation work. v3.5.0 is historical baseline; v4.0 is the upgrade roadmap, not an official release. |
| Phase 1 core + U.1 | Implemented | Logging, validators, health, graceful shutdown, env config and JSON/Markdown retained. SQLite is opt-in for five collections; atomic JSON is the code default. The local launcher is configured for the SQLite candidate; launcher configuration is not runtime proof. No npm dependency installed. |
| Local Data Hub - Stage 1 | Accepted; opt-in adapter verified | User selected 1 to continue. Compatibility adapter/import/rollback and API/offline tests retained. Node v26.13.0; no real migration/restart or new live sync. docs/LOCAL-DATA-HUB.md owns contracts. |
| Local Data Hub - Stage 2A | Implemented; verification recorded below; at checkpoint | Stopped full-Vault hash backup/restore and new-path SQLite import/current JSON export CLI; active/stale-lock/junction/overlap/tampering guards. Explicit MAOC_STORAGE_DRIVER and scheduler first-boot toggle, default JSON. Generated fixture rehearsals, not real-Vault backup. |
| Local Data Hub - Stage 2B / 3 | SQLite Stage 3 and hardening candidate accepted locally | Original JSON and verified whole-Vault backup retained. See the [checkpoint](#local-data-hub-checkpoint) for dated runtime evidence. |
| Phase 2 / U.2 | Phase 2 partially implemented; U.2 implemented | Server-side provider adapters, 27-agent prompts/scopes, function tools, bounded context and queue/failover/loop guards. Phase 2.8 report examples cover all eight departments and are verified on a mock provider. See the [inventory](#scoped-roadmap-inventory) for remaining gaps. No hard billing cap or paid-provider acceptance. |
| Phase 3.1-3.10 | Implemented | Bounded DAG/parallel, Swarm, forward messaging, HUMAN, UTC scheduling, literal templates, typed branching, measured analytics and deterministic AAR. Contracts in CLAUDE.md. |
| Cozy / Control Panel A + B1 + B1.1 + B2 | Implemented | Eight departments/27 IDs and SVG/CSS guild/rooms retained. Stage A routing/dossiers and B1 shell/Overview with accepted six-category B1.1 colors. B2 measured Analytics, AI/HUMAN separation, usage coverage, responsive cards and mission/AAR evidence links implemented. Cozy Pixel/Gothic/Cyber identity preserved; no invented metrics. B3 remains gated. |
| Stage 1: documentation | Verified | Consolidated architecture/roadmap/capability summaries; removed contradictory stacked checkpoints. Runtime/grants/schemas unchanged; user approved proceeding to Stage 2. |
| Stage 2: bundle splitting | Verified | Main JS 423.89 kB / 128.60 kB gzip, down from 535.95 / 156.06 kB; all JS chunks <500 kB with warning threshold unchanged. User selected D to proceed with safety/spec/workflow stages; no production/device acceptance implied. |
| U.5 market structure | Planned | Specification approved in docs/U5-MARKET-ANALYSIS.md (A/D/A/A and six detailed rule groups). Runtime remains BTC/ETH/PAXG 24h ticker only; no OHLCV/RSI/ATR/FVG/zones or new grants. PAXG is not spot XAU/USD. |
| Phase 4.1-4.4 / U.4 | Planned | No embedded vector store, semantic retrieval, deliverable auto-index or RAG context injection. |
| U.3 MCP | Partially Implemented | Schema/scoped in-process registry and trusted registration exist; external stdio/HTTP client transport is Planned. |
| Cline development MCP | Configured; local verification Verified; account/host acceptance Unverified | Option A: Context7/Firecrawl/Sentry remote OAuth plus Playwright MCP 0.0.85 outside app dependencies; all autoApprove lists empty. Task-matched Skill routing in docs/agents/skill-routing.md. User OAuth/Sentry project selection and Cline live/fresh-chat routing pending; not MAOC U.3 transport or runtime grants. |
| Git | Verified | Initial baseline `47b6a78` was pushed under one-time authorization; local `main` tracks `origin/main` in `zefer123/maoc`. Live Vault data, `.env`, backups and local test reports/images are not in the commit. Further commits and pushes need separate approval. |
| Live/device acceptance | Unverified | Paid inference/key validity, formal accessibility/screen-reader review, real-device/GPU/60fps and full-capacity profiling. |

## Local Data Hub — Stage 2B cutover checklist

Verified on 2026-11-20. Evidence root: `C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-local-sqlite-stage2b/`. The directory date identifies the migration batch, not the final verification date.

### Data & recovery

- [x] Back up the stopped original outside OneDrive and keep both the original and verified backup. Restore to a fresh path, import to SQLite, and compare all five envelopes. Baseline counts/revisions: notes **12/2**, deliverables **12/1**, agent overrides **4/2**, saved commands **0/0**, chats **0/1**. Counts for maps include entries inside their lists, not bucket names.
- [x] After rehearsal writes, restart SQLite and export into a **new** JSON Vault. Boot that JSON copy and compare all five current envelopes; notes **13/rev 5** persisted without reverting data. The export verified projections and unchanged non-projection files. Test writes were confined to the rehearsal copy. Evidence: `rehearsal-browser-FYsdgM/`.
- [ ] On any rollback after real SQLite writes, gracefully stop the actual writer and export the current live SQLite Vault into a new JSON destination. Verify it before switching; never roll back by pointing at the old OneDrive source.

### Backend lifecycle

- [x] Verify SQLite health and API `409`/`400` without mutation on the copied data. All three rehearsal boots exited `0` through IPC, logged `server.shutdown_completed`, and released their locks. Real-data schedules count was zero; restart-pause behavior with an actual schedule is covered by the fixture suite.
- [x] Phase B and 2B.2 read-only recheck on 2026-11-20: a single loopback listener `127.0.0.1:8787` matched Node PID `15672` in the candidate `live-sqlite` writer lock. The command line matched the `src/server.js` entry pattern, but the exact checkout, working directory, Vault path and scheduler setting were not confirmed. All five collection GETs returned `200`; their full envelopes matched the stopped JSON backup, using the default empty `savedCommands` for its absent backup file. Schedules, tasks and HUMAN inputs were empty; `stopped:false` does not prove timer state. No health probe, restart, lock change or browser in this check. See [Phase B audit](docs/SYSTEM-MAP.md#stability-audit-phase-b); do not act on historical lock observations.
- [x] Follow-up evidence on 2026-11-20: Node PID `15672` on `127.0.0.1:8787` matched the writer lock, ran `src/server.js` from this checkout's `server` directory, and used `%LOCALAPPDATA%/MAOC/vaults/2026-11-14-stage2b/live-sqlite/.maoc/state/maoc.sqlite`. The single separately approved `GET /api/health?deep=false` returned `200`, SQLite storage and Markdown `ok`, five collections, and no external checks. The health probe verified the driver, not the Vault path or scheduler setting.
- [x] Scheduler launch provenance: `unknown` remains the historical value for PID `15672`. The approved controlled launch set `MAOC_SCHEDULER_AUTOSTART=false` for Node PID `19944`, created at `2026-11-20T11:08:16.6760320Z`; the listener and Vault writer lock matched before and after parity verification. Empty schedules, `stopped:false`, health `ok` and the current shell's value are not launch evidence.
- [x] Runtime health verified on the accepted writer PID `4520`, not the superseded PID `19944`. One separately approved `GET /api/health?deep=false` at `12:22:26 UTC` returned `200`; SQLite, Markdown and analytics were `ok`, five collections were loaded, and no probe file remained. External checks were `not_checked`. The sole listener and writer lock matched before and after. Evidence: `health-once-attempt.json` and `health-once-result.json` in the operator-resume evidence directory below.

### Frontend data safety

- [x] Earlier user confirmation covered saved tabs with no pending/conflict at the original shutdown. On a fresh isolated profile, verify exact hydration and Library rendering, offline retry on reconnect, and conflict resolution through Settings. Never test-write to `live-sqlite`.
- [x] 2B.1 fixture-only Chromium passed on SQLite and atomic JSON: fresh profiles hydrated all five collections, exact API envelope comparison and Library note rendering passed, and only the five collection GET routes reached the fixture. Four blocked HTTP cases and the backend WebSocket upgrade returned `403`; collection envelopes and engine config were unchanged. Both final runs exited `0` and shut down gracefully. Evidence: `%TEMP%/maoc-2b1-evidence-71eeae34f4f6408dbafbf34df9a6501b/`. The first runs reached hydration but failed on the test's WebSocket response argument; the final runs corrected the probe without relaxing assertions. No normal-port contact.
- [x] 2B.2 isolated Library check against a live API snapshot: `node server/scripts/dashboard-readonly-browser.mjs --live-snapshot` captures five fixed loopback collection GETs and serves a static copy to a fresh Chromium profile. Chromium hydrated all five collections and rendered a captured note; the replay gateway denied mutations, health and WebSocket with `403`. A second five-GET capture matched exactly; listener/lock and process creation time were unchanged. No live Vault opened by the runner, no live probe or mutation, no browser connection to live. Both fixture modes passed again, and the Node suite passed 288/288. Evidence: `%TEMP%/maoc-2b2-evidence-5127ca84b82341f081fbf87b69638dc2/`.
- [x] Operator confirmed no pending edits, conflicts or unsubmitted drafts for this checkpoint. Do not open the ordinary Dashboard for a read-only check: socket open sends a backend config PUT. Settings' static storage label and the WebSocket badge are not runtime driver evidence.

### Full-stack regression & observability

- [x] 285 Node tests and production build passed. With the browser harness isolated from the workspace `VITE_API_BASE_URL`, SQLite and JSON each passed 69 Chromium checks / 94 layouts, exit `0`, no unexpected browser exceptions. Earlier failed runs and proxy warnings are retained. Evidence: `fixture-regression-vAE9Je/`, `fixture-regression-json-UwKz4m/`, `node-final.*` and `build-final.*`.
- [x] Record the normal-port acceptance and stop at Stage 2B. This covers local SQLite operations and isolated Library snapshot hydration, not standard Dashboard live acceptance or uptime guarantees. Stage 3 still requires separate implementation approval.

### 2B.2 maintenance — local SQLite accepted

Goal: establish launch provenance for a single writer on the existing SQLite Vault without migrating data or changing application code. The operator approved the window, confirmed that saved tabs were closed, and observed `server.shutdown_completed` in the owning terminal. Port, process and lock were confirmed clear. The backup at `%LOCALAPPDATA%/MAOC/backups/2026-11-20-stage2b2-JCb4Oq/` was independently checked against both trees and the completed manifest (32 files, 13 directories; CLI exit was not captured). Controlled launch and full-envelope SHA-256 parity were verified after relaunch; schedules, tasks and pending HUMAN inputs remained empty. Evidence: `%TEMP%/maoc-2b2-maintenance-JCb4Oq/` (`before.json`, `backup-verified.json`, `launch.json`, `after.json`).

Recovery: after PID `19944` was absent and the SQLite file matched the verified backup, an approved attempt archived its lock and started PID `14988` with the same settings. Listener and lock matched, all five API envelopes matched the archived SQLite rows, and no schedules, tasks or HUMAN inputs were returned. The initial hash comparison used unsorted JSON (`after.json` in `%LOCALAPPDATA%/MAOC/backups/2026-11-20-stage2b2-recovery-JCb4Oq/`). Offline verification reproduced all five pre-stop hashes from the archived rows by recursively sorting object keys, preserving array order and hashing compact UTF-8 JSON. Evidence: `%TEMP%/maoc-2b2-canonical-parity-a45e978f88614e8a85d77462914d71e9.json`. No health probe, restore, external calls or live test writes were performed.

Final observation: Windows no longer saw PID `14988` or a listener on `8787`; its writer lock remained and the launcher had not recorded an exit code. The recovery attempt stopped at this gate. Neither data corruption nor the cause of the process exit is established by these observations.

Launcher rehearsal: the tool-started separate process tree stopped without an exit record; the attached control and operator-opened PowerShell fixture passed over 90 seconds. Fixture evidence: `%TEMP%/maoc-2b2-foreground-fixture-n20-01/operator-run-9njchZ/` (`verification.json`, `progress.jsonl`).

Approved foreground recovery: the operator reported `server.ready` at `2026-11-20T12:05:29.684Z` and later confirmed closing the hosting PowerShell window. At `12:06:31 UTC`, Node PID `13412` and the listener were gone; follow-up found no launcher or exit record. The lock remained and SQLite matched the verified backup SHA-256. Evidence: `%LOCALAPPDATA%/MAOC/backups/2026-11-20-stage2b2-operator-recovery/`. The operator closure explains this interruption, not the earlier unattended stops. No API parity or health check was possible for this writer.

Foreground resume: Node PID `4520` started at `2026-11-20T12:16:18.8731278Z`; the parent matched the operator's launcher record. That record specifies the intended checkout, SQLite Vault and `MAOC_SCHEDULER_AUTOSTART=false`; Windows did not independently confirm the command line. The sole listener and writer lock matched before and after API reads at `12:18:06` and `12:18:18 UTC`. Both rounds matched all five full envelopes to the archived SQLite rows and the canonical pre-stop hashes. Schedules, tasks and pending HUMAN inputs were empty. Evidence: `%LOCALAPPDATA%/MAOC/backups/2026-11-20-stage2b2-operator-resume/` (`launch-request.json`, `readonly-verification.json`). No health probe, provider calls, live test writes or restart were performed during verification.

1. **Agree on a maintenance window.** Before shutdown, re-identify the current listener, process creation time, writer lock, checkout and Vault; do not rely on historical PID `15672`. Confirm tabs have no pending edits, conflicts or drafts, and that there are no active tasks, HUMAN inputs, reviews or scheduled runs. Ask users to stop editing and keep ordinary Dashboard tabs closed during the window. Capture the current five full collection envelopes for a private before/after comparison; retain only revisions, counts and comparison results in the checkpoint. If identity or readiness cannot be established, stop before shutdown.
2. **Stop gracefully and back up the entire Vault.** Use Ctrl+C in the owning terminal or the known IPC launcher. Require clean shutdown, a released port and no remaining writer or writer lock. Then use `vault-admin.mjs backup` from the verified checkout with the complete `live-sqlite` source and a fresh destination outside OneDrive. Require successful hash/inventory checks and the completed manifest before relaunch. Never force-kill, bypass a lock or overwrite the current Vault with the old JSON backup.
3. **Launch once with explicit settings.** In the trusted launcher, use the verified checkout's `server` directory and `node src/server.js` with `HOST=127.0.0.1`, `PORT=8787`, the same absolute `VAULT_DIR`, `MAOC_STORAGE_DRIVER=sqlite` and `MAOC_SCHEDULER_AUTOSTART=false`. Confirm the port and lock are still absent before starting. Record only these non-secret launch settings and tie them to the new PID, creation time, SQLite database path and matching writer lock. Do not dump the environment, resume schedules, or treat the launch flag as an HTTP read-only mode.
4. **Revalidate before acceptance.** Compare the five current envelopes with the immediate pre-stop baseline and account for schedules and any unexpected differences. If repeating browser hydration, use only the approved snapshot replay runner, with no browser connection to live. The old health result is historical and does not verify the new process; the runbook's new-process runtime health check requires explicit approval of one `GET /api/health?deep=false` (it writes a Vault probe). No retries, external checks, provider calls or live test writes. If anything fails or approval is missing, leave 2B.2 open and report the exact blocker; no automatic retry, restore or fallback. With the evidence recorded and acceptance complete, stop before Stage 3 and request separate implementation approval.

## Local Data Hub — Prioritized roadmap (Phase C)

Phase C sets the order; it does not approve live checks or implementation. The
annotations below refer to Local Data Hub stages, not the functional-track phases.
Scope: one local writer, the same five collections and REST envelopes, both
storage adapters, and the existing revision/conflict rules. See the
[stability audit](docs/SYSTEM-MAP.md#stability-audit-phase-b) for findings and the
[operational runbook](docs/LOCAL-DATA-HUB.md#stage-2b-operational-runbook-rehearsal-verified-cutover-pending)
for recovery contracts.

| Order / status | Deliverable | Exit check |
| --- | --- | --- |
| **2B.1 — Fixture only; verified** | [Browser runner](server/scripts/dashboard-readonly-browser.mjs) fixture modes and [read-only transport](server/scripts/dashboard-readonly-transport.mjs) use fresh temporary profiles and Vaults, a pinned ephemeral upstream and an in-memory dashboard build without workspace API-base overrides. | Both drivers passed Chromium and the [transport test](server/test/dashboardReadonlyTransport.test.js) passed. See Frontend data safety above. No product code changes or live acceptance. |
| **2B.2 — Normal-port acceptance; verified** | Single SQLite writer, two exact API parity rounds, and one approved shallow health probe passed. Previous Library hydration used snapshot replay. | Accepted for local use only. Keep the owning console open while the backend is needed. No automatic retry, restore or Stage 3 implementation. |
| **3.1 — Connected clean tabs; verified on fixtures** | After a durable commit and in-memory revision update, `/ws` sends only the collection name and revision. Clean receivers read that collection through REST. REST and internal archives share the commit path. | Both adapters passed two-tab Chromium and focused Node coverage: no notice for `400`/`409` or failed commits; committed archives notify even with degraded Markdown; a pending full sync is not skipped. Not rolled out to the live backend. |
| **3.2 — Reconnect and fallback; verified on fixtures** | On socket open, read all five collections through the existing REST path without sending pending writes from that reconnect check. Keep periodic polling. Coalesce notices by collection and retain a bounded follow-up for notices received during sync. | Focused Chromium recovered a missed commit before polling on both adapters. Node coverage verified fallback without WebSocket, coalescing during a slow read, and no clean revision regression on a stale reconnect response. |
| **3.3 — Dirty tabs and release gate; verified on fixtures** | Preserve pending edits through merges and conflicts. When the merged data already matches the server, acknowledge that revision without sending another PUT. | Both adapters passed independent/overlapping edits, deletion versus edit, edits during a write, own-write notices, dirty reconnect and explicit conflict choices. Chromium confirmed Settings shows the conflict and choosing Vault data does not create another revision. See the rollout record below for live acceptance limits. |

Stage 3.1 evidence: 293 Node tests and a production build passed. Both drivers passed focused Chromium (`%TEMP%/maoc-stage31-focused-rk4yWW/`). Initial full runs hit the 95-second cap (`%TEMP%/maoc-stage31-chromium-Um8wut/`); superseded by the Stage 3.3 full results below.

Stage 3.2 evidence: 297 Node tests (`%TEMP%/maoc-stage32-node-xw9sLy/run.log`), production build and focused Chromium on both drivers (`%TEMP%/maoc-stage32-focused-vBNhJM/`) passed.

Stage 3.3 evidence: 301 Node tests (`%TEMP%/maoc-stage33-node-B9uDYz/run.log`) and production build (445.00 kB main JS) passed. Full Chromium on JSON and SQLite each exited `0` with 72 checks, 94 layouts and no unexpected exceptions (`%TEMP%/maoc-stage33-full-4lOvn5/`). These runs used isolated Vaults; the live SQLite writer was not restarted or used for tests.

### Stage 3 rollout guard

- `MAOC_COLLECTION_REALTIME` defaults to `false`. Only `true` enables revision notices and socket-open reconciliation; the frontend requires the server's explicit snapshot capability on each connection. Both modes retain task telemetry, REST writes, conflict rules and the 15-second polling fallback. See [rollout and rollback steps](docs/LOCAL-DATA-HUB.md#stage-3-rollout-and-rollback).
- Fixture verification: 308 Node tests, production build (main JS 445.12 kB), focused Chromium in both modes on both drivers, and full Chromium with realtime enabled on both drivers (72 checks / 94 layouts each, zero unexpected exceptions). Restarting from realtime to polling preserved the latest test commit on the same Vault in both drivers. Full runs attempted in parallel timed out; sequential runs passed. No live health probe, restart or test write.
- Evidence: `%TEMP%/maoc-stage3-guard-final-node-dcb46f63480c402bba0eb30b51341199/`; `%TEMP%/maoc-guard-{json-off-3wXeQi,sqlite-off-HSA6AC,json-on-a7jqRS,sqlite-on-xbtj4f,full-single-json-L1OwG5,full-single-sqlite-qSaV8M}/`. Verified 137-file source-only snapshot: `%LOCALAPPDATA%/MAOC/backups/stage3-guard-code-BGWD16/` (not a Vault backup or a prior release).
- Live rollout (2026-11-20): verified stopped Vault backup and isolated restore (32 files, SQLite quick check, five pre-stop envelopes). Launched the tested entry in a separate foreground PowerShell with scheduler autostart disabled. Single loopback listener and writer lock matched PID `21760` after more than 90 seconds. WebSocket advertised `collection_realtime: true`; all five API envelopes matched pre-stop fingerprints twice. Chromium displayed a Library note from an isolated replay of live GETs; no live browser writes, live test commits, external calls or health probe. Evidence: `%LOCALAPPDATA%/MAOC/backups/stage3-live-maintenance-0tTwVr/`.

**Stop and recovery rules.** If launch provenance, Vault identity, scheduler state,
browser isolation or the expected data cannot be established, stop and record the
mismatch. Do not take over the lock, boot another writer, or repair on sight. If
rollback after real SQLite writes is separately authorized, coordinate graceful
shutdown, export current data to a fresh JSON Vault and validate it in isolation
before switching. Never restore the old OneDrive Vault over newer work. If Stage 3
notification checks fail, do not roll it out; polling is the unchanged baseline,
and notification problems alone do not call for a Vault conversion.

### Backend hardening (before frontend)

| Order | Status | Acceptance |
| --- | --- | --- |
| 1. Shutdown safety | Fixture regression passed; candidate activated | Reject requests whose bodies finish after shutdown starts, cancel missions while the scheduler drains, and hold the writer lock until tracked routes settle. The transport timeout does not bound stuck disk operations. No live in-flight-task injection. |
| 2. Backup and recovery operations | Fresh whole-Vault backup and isolated restore verified; no automatic backups | Verified 32 files and 13 directories before launch and again afterward. Stopped source, backup and restore SQLite bytes matched; restore passed `quick_check` and five pre-stop API fingerprints. See [backup checks and retention](docs/LOCAL-DATA-HUB.md#backup-checks-and-retention). |
| 3. Storage fault handling and diagnostics | Fixture faults verified; live shallow health passed | Full/unwritable collection writes report `507 STORAGE_FULL` or `503 STORAGE_NOT_WRITABLE` without advancing the committed revision. Missing/corrupt SQLite fails closed. A failed mission checkpoint reports degraded health. No live fault injection. |
| 4. Task/HUMAN/approval recovery | Metadata baseline verified on fixtures; live startup health passed | `GET /api/mission-history` exposes bounded metadata. A recovered nonterminal checkpoint reads `INTERRUPTED` with its last recorded state. No active task, answer or approval is restored or replayed; failed admission prevents provider work. See the [recovery design](#task-human-and-approval-recovery-design). |
| 5. Backend candidate acceptance | Passed on local SQLite (2026-11-21) | After the operator reported graceful shutdown, the first two checks still saw the old writer; a later check confirmed PID, listener and lock released before backup. The new writer PID 25220 matched `127.0.0.1:8787` and the Vault lock after 112 seconds; scheduler autostart disabled, Realtime on. Two live comparisons matched all five backup fingerprints. One shallow health returned `200` with no probe left, and snapshot replay hydrated Library without direct browser access to live. No live test data writes, migration, external checks or inference. |
| 6. End-to-end mission | Mock provider passed on SQLite and JSON; real provider pending | Document excerpt → mock summary → separate report approval and HUMAN input → deliverable, Markdown and AAR. History, deliverable and AAR survived restart with no additional provider call. No paid inference or UI acceptance. |

#### Task, HUMAN and approval recovery design

**Decision: recover history for inspection, not executable state.** After a crash the local checkpoint cannot establish which provider requests were received, completed or billed. Resuming a DAG cursor or replaying an ambiguous submission could repeat charges or tool effects. This design adds no runtime, schema, API or UI changes.

| Boundary | Existing behavior and recovery rule |
| --- | --- |
| Admission | `server.js` awaits `task.accepted` for REST and WS. `orchestrator.js` commits the `RUNNING` checkpoint before registering or executing the task. Failed checkpoint admission must not start provider work. A lost acknowledgement is ambiguous, not permission to retry. |
| HUMAN and report approval | Separate in-memory IDs, handlers and decisions. Save the waiting checkpoint before marking a gate ready for input or emitting it. A mission-level waiting label is not a per-node log: parallel waits may coexist and HUMAN takes precedence in that label. Do not reissue an old gate or treat the last recorded wait as a recorded answer, approval or rejection. |
| Persistent boundary | `missionHistory.js` stores only `task_id`, `state` and `updated_at` in bounded server-owned `.maoc/state/mission-history.json` (schema v1, 200 rows / 128 KiB validation limits at load). Both adapters use the same Vault writer lock and inherited temporary-file sync + atomic rename from `storageEngine.js`; `sqliteStorageEngine.js` owns only the five browser collections. No prompts, answers, grants, credentials or provider payloads are added; no shared transaction with deliverables or AAR. |
| Startup and display | `server.js` loads history under the writer lock before serving. Saved terminal rows retain their state; saved `RUNNING`, `WAITING_HUMAN` and `WAITING_APPROVAL` rows without a current task project to `INTERRUPTED` with `last_state`. Corrupt history fails startup rather than being reset. History is not an execution input; no pending task, approval, answer handler or telemetry is reconstructed. |
| Operator action | Inspect the history, deliverables, AAR and separately authorized provider records when needed. An artifact may exist even if terminal history was not written; an absent row/artifact does not prove no execution or charge. If another run is needed, review cost, permissions and duplicate effects first, then explicitly confirm a **new** task with a new ID and fresh gates. No automatic resubmit on restart, reconnect, timeout or unknown result. Scheduler startup pauses non-exhausted schedules; missed/claimed runs are not replayed, and explicit Resume authorizes future runs only. |

**Acceptance boundary:** Keep [mission recovery fixtures](server/test/missionRecovery.test.js) authoritative for stale HUMAN/approval IDs, failed checkpoint admission, corrupt history and archived missions across restart. For future changes, exercise crashes around admission, gate decisions and archive/final-write boundaries using disposable JSON/SQLite Vaults and provider/tool spies: zero calls at startup, no live gates for old IDs, no false terminal state and no repeat of approved side effects. No Live Vault or paid provider test is part of this design.

Shutdown test evidence: `%TEMP%/maoc-backend-hardening-shutdown-575feb48275747e98c926f5ee1e6d93c.log`.
Backup evidence: 317 Node tests passed (`%TEMP%/maoc-backup-hardening-4cf1fa45030545ada321584e199df15c.log`); restore drill receipt: `%TEMP%/maoc-restore-drill-1TOjJl/verification.json`. No live restart, Vault health probe or archive deletion.
Storage fault evidence: 321 Node tests passed (`%TEMP%/maoc-storage-faults-823cc2c2e99549fab10f75877bcf0e10.log`). Four fixture cases covered injected JSON capacity/permission errors and native SQLite page-limit/query-only errors, with API readback and restart after recovery. No live test writes, health probe or restart.
Current candidate evidence (2026-11-21 UTC): 336/336 Node tests, exit `0` (`%TEMP%/maoc-hardening-5-node-h3YLD2/node.log`); synthetic SQLite restore and mode-switch receipt (`%TEMP%/maoc-hardening-5-fixture-FNXr4F/verification.json`). Backup and source were unchanged; no external fetch attempts in the rehearsal. The initial receipt (`%TEMP%/maoc-hardening-5-fixture-NtbZaB/verification.json`) compared PUT-only `projectionStatus` against a GET envelope; the rerun checked the projection separately. Prior candidate: 327/327 and isolated rollout/rollback (`%TEMP%/maoc-backend-six-LpgX11/node.log`, `%TEMP%/maoc-backend-six-launch-NO7wDE/verification.json`). No live Vault access, health probe or restart in this rerun; no frontend build or browser check.

## Verification - Single Current Record

| Check | Status | Evidence / limits |
| --- | --- | --- |
| Live maintenance preflight (2026-11-21) | Server-side preflight and fixture checks verified | Loopback port and SQLite Vault lock matched PID 25024 at capture; recheck after the maintenance handoff. Two GET rounds, no `/api/health`, provider calls or live writes. Evidence: `%TEMP%/maoc-live-preflight-parity-87d1380ea9c24042b9c0793a2245a043.json`. Isolated checks: Node 336/336, Vite build (main JS 457.75 kB), read-only Chromium on SQLite and atomic JSON (all five collections hydrated; mutations and upgrade denied). Logs: `%TEMP%/maoc-live-preflight-{node-4f10f6c87fee4a4695a105012523b6f3,build-0516c799deae4029b1a8b66b373d49ab,browser-e12c8cf4bee4493489bb5f1c702e54e7}/`. |
| Backend hardening live acceptance (2026-11-21) | Verified on local SQLite | Backup/restore, stopped byte parity, five full-envelope fingerprints before and after launch, WebSocket Realtime capability, one shallow health and Chromium snapshot replay passed. Evidence: `%LOCALAPPDATA%/MAOC/backups/backend-live-acceptance-db523d7d5cba40c0b95fe18d8654d3b3/` (`sqlite-parity.json`, `live-checks.json`, `browser.log`, `verify-after.json`, `runtime-recheck.json`). Windows denied a direct hash of the open live DB; acceptance uses the stopped hash and live API parity, not a byte hash of the open DB. |
| Phase 1 local REST limit (2026-11-21) | Verified on fixtures; not activated on live writer | Shared fixed-window `/api` limit of 600 requests/minute by default, before JSON parsing, with `429` and `Retry-After`. Does not change WS or provider limits. RED: over-limit malformed body returned `400`; GREEN and full 337/337 Node suite passed. Vite build and Chromium 75 checks / 94 layouts on each driver passed, no unexpected browser errors. Evidence: `%TEMP%/maoc-phase1-rest-{node-dd5bad703c8143c6bf8cd3a79e32cc3e,build-85796fa38e024863bdec456163ca0908,browser-7091d7ebcdc9435881316fe00c8f1fb0}/`. |
| Phase 1 frontend error boundary (2026-11-21) | Verified on isolated Chromium | An injected App render error first left no recoverable UI; the root boundary now shows a Thai alert without raw error details. Reload requires confirmation, warns about drafts and issues no backend write. Existing lazy-panel boundaries are unchanged; no Sentry SDK. Final combined regression: 337/337 Node, 75 Chromium checks / 94 layouts on each driver, no unexpected browser errors, and Vite build (main JS 458.92 kB). Evidence: `%TEMP%/maoc-root-error-{red-56aa3dcef8d54004851b3e61465f7de1,green-968043784ae247e0ae7422f1d0543596,build-3f3ef4189e9047e4951d0331c0881dbb}/` and `%TEMP%/maoc-phase1-final-{node-53444bc098ff4e64a3b3d6ec39e55ebb,browser-cb4ff088c394480db2a677a530ccb1c9}/`. |
| Phase 1 CI verification (2026-11-21) | Hosted run #3 failed; lazy-chunk harness fix verified locally | Run #1 (`47b6a78`) failed at conditional dispatch; `8734d4e` waits for backend admission. Run #2 (`8734d4e`, ID `44882669756`) failed at sender-tab save; `aaabd60` waits for the sender document and writes once. Run #3 (`aaabd60`, ID `44884960392`) passed Node and build, then failed `assert.ok(heldChunks.size > 0)` at line 363 in the regular Chromium invocation, before `--root-error-only`. Delaying room chunk interception in a fixture reproduced the failure. All seven lazy-chunk call sites now independently wait for the named intercepted request, without dropping loading-state or layout checks. The focused room check passed with the same delay; a full all-chunks-delayed stress run did not produce a terminal report. Normal Chromium passed 75 checks / 94 layouts per driver, root-error passed 2 checks, and `npm run verify` passed 347/347 and build 458.92 kB. Evidence: `%TEMP%/maoc-chunk-red-daed9907a9b742bc90b2d9645e5ad636/`, `%TEMP%/maoc-room-confirm-3c2feb9775a64e5092eedd95a7ce8e3c/`, `%TEMP%/maoc-chunk-normal-04417f3300704d989ca2204dc591b4c7/`, `%TEMP%/maoc-chunk-verify-780155ac06554cef8de2827559d9f3a0/`. Lazy-chunk fix not pushed; hosted confirmation pending. |
| Phase 2.8 report examples (2026-11-21) | Implemented; verified on mock provider | All 27 agents across eight departments receive one department-specific fictional input/report example in the existing system message, separate from actual mission evidence. The test bounds each labeled example to 256 UTF-8 bytes and checks the existing tool lists and review gates, including LEX on Finance and Hermes routes via existing partners. RED showed the missing Command example. Full Node 338/338 and build 458.92 kB passed. Evidence: `%TEMP%/maoc-28-all-red-13fdd0160359456eb9577784712bafe8.log`, `%TEMP%/maoc-28-all-final-6ae9e57e01604172bf1cf93d25b58167/`, `%TEMP%/maoc-28-all-build-85a8b8885a374e10812df65b5a925c3c/`. No live restart, inference or report-quality claim. |
| Phase 2.5 usage coverage (2026-11-21) | Verified on mock providers | Missing, partial, and malformed counts are unreported; explicit zero is retained. A valid total still tightens mission reservation independently of analytics coverage. RED reproduced false coverage, GREEN passed 7 focused cases across four adapters, mission budget and Analytics. `npm run verify`: Node 344/344, build 458.92 kB. Evidence: `%TEMP%/maoc-25-verify-686fc4dab0fc4ff5abe693879163bfbe/`. No live restart or reclassification of historical records. |
| Phase 2.6 handoff context (2026-11-21) | Verified on mock provider | AI handoffs label omitted earlier deliverables and clipped excerpts, preserving the six-output / 6000 UTF-16 unit content bounds and avoiding split surrogate pairs at the boundary. DAG fixture verifies ancestor scope, stable order, original output preservation and one provider response per node. RED reproduced the missing label; workflow tests 14/14, `npm run verify` Node 345/345 and build 458.92 kB. Evidence: `%TEMP%/maoc-26-verify-364207c5eb6b49b2bf191c6a83f8d161/`. No live restart, added inference, or HUMAN context change. |
| Phase 2.10 execution summaries (2026-11-21) | Verified on fixtures and mock provider | Planning, deliverable completion and local notifications describe operations without duplicating their previews. At publication the telemetry bus retains only `kind: execution_summary` and a non-blank `summary` of at most 512 UTF-16 units; invalid traces become `null`. RED reproduced forwarding an extra field; GREEN checked subscribers, snapshots and unchanged previews. `npm run verify`: Node 347/347, build 458.92 kB. Evidence: `%TEMP%/maoc-trace-verify-c9962abfd81d45da9602823522febd8b/`. No provider-generated summary, content redaction guarantee or live restart. |
| Local DB Stage 2A | Verified scoped regressions | 285 Node tests (273 retained +12 maintenance), 0 failed/skipped; production build passed, main JS unchanged 444.06 kB /134.02 kB gzip. SQLite and JSON Chromium each passed first run: 69 checks/94 layouts, zero unexpected browser exceptions. Proxy ECONNABORTED/ECONNREFUSED warnings retained in stderr; not a warning-free or proven root-cause claim. Full generated-Vault backup/restore, latest SQLite rollback, corrupt/locked/stale-lock/junction/overlap/tamper guards, paused schedules and normal-entry IPC shutdown tested on Node v26.13.0. Seven expected existing files changed/four additions; frontend/dependencies unchanged. Evidence: C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-local-sqlite-stage2/verification.json. No real-Vault backup/cutover, browser-draft or off-device acceptance. |
| Local DB Stage 1 | Verified scoped regressions | 273 Node tests (260 existing +13 SQLite), 0 failed/skipped; build passed, main JS unchanged 444.06 kB. SQLite browser-third and JSON browser-second each passed 69 checks/94 layouts, exit 0, no unexpected runtime exceptions. Five syntax checks; 132-file scoped snapshot: 126 unchanged, six expected edits, three additions; raw Git-index inventory and historical PNGs preserved. Earlier interrupted/timeout browser attempts retained, causes unproven. No live-data migration/restart or new storage push sync. Evidence: C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-local-sqlite-stage1/verification.json. |
| Node suite | Verified | B2: 260 passed, 0 failed, exit 0; four new display-projection tests cover empty/unknown usage, sample weighting, skipped/cancelled and HUMAN-only inputs. Existing 256 tests retained. Deterministic transports, no paid inference. |
| Build / syntax | Verified | B2 build exit 0: main JS 444.06 kB / 134.02 kB gzip; Analytics lazy chunk 14.38 kB. All JS chunks <500 kB, no oversized-chunk warning. Final scoped verifier checks edited JSX transforms/harness/helper/test syntax and preservation hashes. No measured load-time/device-performance claim. |
| Chromium | Verified scoped regressions | B2 third run: 69/69, exit 0; 94 layouts, zero unexpected exceptions. Existing B1/B1.1/Bell/Status/deep-link/keyboard/offline scenarios retained. New AI/HUMAN summary, missing Analytics/Reviews endpoints including detail, slow refresh, prior snapshot, degraded/recovery, direct AAR links and seven widths 320–1600px. Mobile semantic table snapshot inspected via Playwright; not formal screen-reader/a11y certification. Historical B1.1 42 menu cases/min 6.90:1 and isolated 12-note reload evidence retained, not rerun as B2-specific color certification. D.1/dev-backend root cause remains open. |
| Safety snapshot | Verified | 204 code/config/Matt-skill files copied and SHA-256 checked, then restored as byte-identical copies in an isolated Temp directory; no restored-app boot. Source unchanged before documentation sync. Not a complete workspace/Vault backup or off-device recovery test. |
| D.2 specification | Verified | Approved scope and six rule groups consolidated in docs/U5-MARKET-ANALYSIS.md; documentation checks and SHA-256 audit exit 0: 207/210 baseline files unchanged, only PLAN.md/CLAUDE.md/SKILL.md changed, one specification added. Runtime/tests/config/grants/Skills preserved. No runtime tests or live API calls rerun. Evidence: C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-u5-spec/verification.json. |
| D.3 workflow | Verified configuration; host routing Unverified | Local Markdown tracker/default labels/single-context lazy domain docs approved and configured in docs/agents. Static/SHA-256 audit exit 0: 207/211 baseline files unchanged, only .clinerules/CLAUDE.md/PLAN.md/SKILL.md changed, four config docs added; all 79 source files across 27 Skills match manifest, with 11 model-invoked / 16 explicit-only flags. Fresh-chat Cline routing remains Unverified; checklist in docs/agents/skill-routing.md. No runtime test rerun/external setup/tickets. Evidence: C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-skills-workflow/verification.json. |
| Development MCP setup | Verified local checks; authenticated/host routing Unverified | Playwright install exit 0 with scripts/browser download disabled; 0.0.85 lock integrity matches registry. Stdio initialize/tools list (25 tools) and isolated Chrome local-fixture navigate/click/snapshot passed, no MAOC actions. Three remote endpoints returned unauthenticated 401/Bearer challenges and public OAuth metadata; no account tool or paid Firecrawl call. 218-file snapshot: 213 unchanged, only .clinerules plus four docs changed; 79/79 Skill-source hashes preserved. Two failed verifier attempts retained (host-added OAuth preparation state; file-linked rather than inline snapshot), then passing third attempt. Setup itself reran no app checks; newer Stage A results are above. Evidence: C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-development-mcp/verification.third.json; final static audit in verification.json. |
| Historical evidence | Verified | server/overview-a-verification.json and server/overview-a-build.log record 248 Node / 47 Chromium and 535.95 kB main JS. Historical 246/42 or earlier checkpoint counts are not the current rerun result. |
| Preservation | Verified B2 hash audit | 363-file immutable snapshot: 355 unchanged, eight existing files changed (three presentation, harness, four docs); two display helper/test files added. Backend runtime/API/storage/registry, dependencies/grants/artwork/installed Skills preserved. No-index manual review, no Git HEAD/sub-agent claim. Harness screenshots redirected to external evidence when an evidence directory is supplied; old workspace images/reports preserved. Generated build excluded. |

Stage 2 historical verification date: 2026-11-14 (local). Pre-edit snapshot:
C:/Users/Gamer/AppData/Local/Temp/maoc-stage2-baseline/.
Evidence in the same Temp directory: maoc-stage2-verification.json,
maoc-stage2-final.diff, maoc-stage2-node-final.log, maoc-stage2-browser-final.log
and maoc-stage2-slice2-build.log. Current browser evidence is the B2 directory below;
server/dashboard-browser.log remains an earlier retained report.
Main JS reduced 20.91%; lazy chunks: room 37.32, topology 18.84, Builder 33.46,
AAR 16.98 and Analytics 11.14 kB (pre-gzip). This is initial-load code splitting,
not a promise of reduced total code or measured load-time/60fps improvement.
Browser checks use the Vite dev server, not production-hosting acceptance.
Stage 1 evidence remains under maoc-stage1-*; its documentation reduction was
approximately 66% by UTF-8 bytes, not a tokenizer measurement.

Retain existing evidence files; do not rewrite old verification JSON as if rerun today.
Other scope-specific references: server/aar-verification.json,
server/analytics-verification.json, server/cozy-verification.json and
server/fantasy-verification.json. Older counts describe those scopes, not current status.
Browser harness writes server/dashboard-browser.log and existing screenshot outputs;
regenerated artifacts are not runtime source changes or a new visual acceptance claim.

Safety-stage evidence (2026-11-14): C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-safety-ybSQco/.
manifest.json owns snapshot hashes; audit.json and per-command logs/results retain checks.
browser-first-report.json retains the failed run; standalone rerun remains distinct evidence.
RECOVERY.md explains selective recovery. Excluded: secrets/.env (except .env.example),
live Vault/writer.lock, browser localStorage/drafts/keys, dependencies/build/logs and old
third-party skill bundles. Ignore rules verified for ten secret/runtime path examples;
.env.example and vault/README.md remain trackable. No add/commit/push or live restore.
Existing browser export covers selected browser collections, not server templates,
schedules, analytics/reviews or active runtime. Full data backup requires coordinated
writer shutdown, private storage and isolated restore acceptance; not performed here.

## Active Execution Sequence

| Stage | Status | Scope / exit gate | Version impact |
| --- | --- | --- | --- |
| 1 - Docs | Verified | Canonical summaries replaced stacked checkpoints; guardrails/specifications retained. User approved Stage 2 through Q1=A, Q2=D, Q4=D. | Packages remain 0.1.0; no runtime phase increment. |
| 2 - Bundle | Verified | Lazy room/topology/Analytics/AAR both paths; Builder first-open loading then retained instance. Loading/error/focus/Escape/drafts verified; eager Overview map unchanged. User selected D for next staged sequence. | Packages remain 0.1.0; no dependency/config/grant changes or commit. |
| 3 - Functional track | Planned | U.5 analysis-only specification approved; implementation remains separately gated after D.3/D.4. U.4/U.3 remain deferred. | No automatic v4.0 release or live orders. |
| D.1 - Safety baseline | Verified | Code snapshot/hash and isolated copy-restore passed; 248 Node, build, three syntax and standalone 55 Chromium checks passed (exit 0). First-run reload/navigation failure retained as an open finding. User approved proceeding to D.2. No full live-data backup. | No runtime, permissions, dependency or Git changes. |
| D.2 - U.5 specification | Verified | A/D/A/A and all six detailed rule groups approved; canonical scope, formulas, lifecycle, freshness and public test seams in docs/U5-MARKET-ANALYSIS.md. User approved proceeding to D.3. | Specification only; no runtime edits, live API calls or Agent grants. |
| D.3 - Skills workflow | Partially Implemented | Configuration complete and statically Verified in docs/agents; installed source/companions preserved. Fresh-chat Cline routing remains Unverified because no new-chat host tool is available; checklist retained. User approved D.4 while keeping this acceptance boundary visible. | Development tooling/docs only; no tickets, external issues, runtime tools or grants. |
| D.4 - Control Panel | Verified scoped regressions | Original Bell/Status shell work: 249 Node / 57 Chromium; preserved by Stage A. Historical evidence below remains unchanged. | Packages remain 0.1.0; no engine/library migration, grants, new persistence, U.5 implementation or Git actions. |
| UI A - Navigation and department dossiers | Verified; user approved next stage | Hash deep links/history for sections/details/tabs, distinct team dossiers, linked retained work/archive/rooms and missing states. Historical 254 Node/60 Chromium; retained by B1. | No new dependency, runtime grant, storage schema, U.5 or Git action. |
| UI B1 - Guild shell and Overview | Verified scoped regressions; retained by B1.1 | Grouped/contextual shell and Overview retained; historical 256 Node/63 Chromium, build/hash review passed. Color refinement implemented separately below. | No claim of final visual acceptance; package 0.1.0 retained. |
| Realm Stage 1 - Blueprint & Knowledge | Verified scoped capture; user approved B1.1 | Option A: design document + three curated Knowledge notes in existing Local Vault. Nine old notes preserved, count 9→12, revision 1→2; storage/projections verified; rehearsal 409/400 and 17 reliability tests passed. B1.1 additionally reads all three notes/reloads in isolated copy fixture. | No additional real Vault writes in B1.1; historical proposal note not silently rewritten. Original dev-backend UI acceptance/root causes remain open. |
| UI B1.1 - Semantic Colors | Verified scoped regressions; user accepted and approved B2 | Six category HEX tokens, navigation label/icon/active marker, headings/header/tabs; independent team accents, status/Gold actions/artwork/layout preserved. Historical 256 Node/build/64 Chromium/87 layouts plus 42 focused cases retained. | No U.4/U.5/migration/runtime grant/continuous-learning implementation. |
| UI B2 - Measured Analytics | Implemented; scoped checks passed; at checkpoint | User approved next stage on 2026-11-14. Actual outcomes, weighted AI duration/completion, distinct HUMAN wait, usage coverage, responsive semantic cards and exact mission/AAR links. 260 Node/build/69 Chromium/94 layouts. Dev APIs now return 200 directly and through Vite; previous failure cannot be reproduced, not claimed repaired. | No backend/API/schema/dependency/provider/grant changes or learning implementation. Stop for B2 acceptance before B3. |
| UI B3 - Detail finish | Planned; separately gated | Mission/library/team provenance and visual continuity, missing/loading/error and keyboard/deep-link preservation. D.1 Library reload historical root cause remains open. | No authorization for migrations, extra runtimes, external services or game systems. |
| CEO Quick Directive | Implemented; isolated full-stack checks passed | Overview/Missions, Team Dossier and 2.5D room open the shared Builder panel. CEO confirms before `POST /api/tasks`; ARIA starts the selected eight-department route, with optional pre-team HUMAN review and Senior Dev handoff. Existing report gates remain independent. Room notes do not dispatch or create reports. | No runtime permission, registry, dependency or version changes; no live Vault or paid-provider run. |
| Live Visualize 2.5D | Implemented; isolated full-stack checks passed | Confirmed directives leave the originating view in place and show a receipt with a Task ID link. Map and desks use task snapshots, Tool start/result events, HUMAN waits and report approvals. Only recent directed mission `HANDOFF` events light the separate telemetry layer; decorative causeways never signal work. | Existing palettes, SVG/CSS scenes and tool grants retained; no live Vault, paid-provider run or Backend acceptance. |
| Admin / User Access Gate | Implemented; verified in isolation | Default-off gate with REST Bearer and authenticated WebSocket; Settings → Admin is lazy-loaded and admin-only. Issue, rotate, revoke and reactivate keys without returning hashes. Old credentials fail HTTP/upgrade with `401`; connected sockets close with `4401`. | Local shared workspace only; not multi-tenant or public-ready. [Operator notes](docs/LOCAL-DATA-HUB.md#local-access-gate). No live activation. |

CEO Directive evidence: 331/331 Node tests; Chromium 74 checks / 94 layouts on each of SQLite and JSON with zero unexpected browser exceptions; production build largest JS 447.83 kB (135.75 kB gzip), all JS chunks below 500 kB. Eight department workflows were executed through REST with deterministic provider responses, including existing Trade/Data/Legal report gates. Evidence: `%TEMP%/maoc-ceo-final-node-rW19vd/`, `%TEMP%/maoc-ceo-final-browser-5Jtg9J/`. This is not live backend or provider acceptance.

Live Visualize evidence: `npm --prefix server test` 332/332; Chromium 75 checks / 94 layouts per driver (SQLite and JSON), zero unexpected browser exceptions; `npm run build` main JS 451.83 kB / 137.35 kB gzip. REST and WS checks use isolated Vaults and deterministic providers. Logs: `%TEMP%/maoc-visual-final-browser-y8IfEF/`.

Access Gate evidence: Node 336/336 (`%TEMP%/maoc-access-node-info-768a378797b4495292e7ed7eca23c739/`); Chromium full gate-off 75 checks / 94 layouts and focused gate-on checks passed on both SQLite and JSON with zero unexpected browser exceptions (`%TEMP%/maoc-access-final-browser-DxuP4y/`). Build: main JS 457.75 kB, lazy Admin Console 6.02 kB. No dependency, live Vault or `.env` changes.

IDE diagnostic follow-up: targeted `checkJs` reported 0 diagnostics in `dashboard-browser.mjs` and `useTelemetry.js` after fixing fixture types and loading Vite env declarations. Regression: Node 336/336, Chromium 75 checks / 94 layouts per fixture driver, main JS 457.75 kB. The open VS Code Problems panel was not inspected directly.

B2 evidence (2026-11-14):
C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-dashboard-b2/.
manifest.json/snapshot own the immutable baseline; verification.json owns the final audit.
node-first/build-second/browser-third exit records and reports are retained; browser-first
also passed but screenshots were taken before paint settled. Explicit two-frame paint
readiness and a mobile-card image were added without weakening assertions. Four display
unit tests added; no aggregate/API/storage changes. Missing detail endpoint vs missing AAR
was found in manual review, fixed and checked in browser-second. Review was in this session,
not independent sub-agents (host has no sub-agent tool). First hash audit caught three
overwritten legacy screenshot paths: generated images preserved externally, originals
restored from checked snapshot, all paths routed externally and browser-third passed.
Second verifier index check exposed LF/PowerShell-CRLF serialization; original PowerShell
hash still matched, verifier serialization corrected. Failed audits remain retained.
Screenshot denied outside MCP roots
and direct-shell exit-capture failures are documented in attempts.md; reruns use captured
spawn exit records. Expected proxy errors after deliberate fixture shutdown are not runtime
exceptions. No real Vault PUT, task dispatch on original runtime, restart, commit or deploy.
Dev API finding: current backend process started 2026-11-14 19:24:10 local (12:24:10Z),
source server.js predates it. Read-only direct/proxied health/analytics/reviews returned 200,
zero retained missions and 28 rows. Earlier endpoint-not-found mechanism remains unproven;
do not label it fixed or attribute it to a stale process without historical proof.

Realm Stage 1 evidence (2026-11-14):
C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-realm-knowledge/.

B1.1 evidence (2026-11-14):
C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-dashboard-b11/.
361-file immutable snapshot/hash baseline excludes dependencies/Git/build/env files.
node-first/build-second/browser-third passed; before/after images and focused menu
evidence retained. Browser-first exposed real sidebar font-weight precedence (fixed);
second exposed the new header assertion reading before route rendering settled
(explicit expected route/color readiness added, no dropped assertion/retry).
Private attempts.md records preview/test-tool setup errors separately. Temporary
preview uses loopback/temp Vault, deterministic LLM and schedulerAutoStart:false;
never original runtime, live paid inference or new app grants. B1.1 changes only
presentation metadata/CSS, browser expectations and current-status docs.
baseline.json, rehearsal.json, apply.json, storage-tests.log/exit and verification.json
own scoped evidence. Private vault-before is a notes-maintenance backup, not a tested
full-runtime disaster recovery. First source-path attempt failed before storage init;
both source files were subsequently located in workspace root with identical hashes.
No full backend restart, scheduler change, paid call or browser UI verification claimed.

Stage 2 changed: src/components/CommandCenterView.jsx,
src/components/cc/DashboardTaskDetail.jsx, src/components/cc/PerformanceDashboard.jsx
and server/scripts/dashboard-browser.mjs; added src/components/cc/LazyPanel.jsx.
No art/provider/persistence refactor. Acceptance met: main JS <500 kB, no oversized
replacement, all existing scenarios retained plus cold loading, both AAR paths,
modal close-before-load/reopen/draft/focus and contained chunk failures. Failed imports
offer explicit page reload with unsaved-draft warning; no automatic task retry.

D.4 evidence (2026-11-14): C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-control-panel/.
Baseline exit 0 and manifest verified before resuming edits; snapshot is not overwritten.
verification.json and preservation.json own final hashes/results; d4-review.diff records
manual no-index review (no parallel sub-agent tool available). d4-final-* records Node,
build and syntax; d4-browser-sixth-* and d4-confirm-* are separate standalone passes.
The first five browser failures remain in their original per-run logs/reports:
1. Enter fixture omitted CDP text; helper now matches the existing Status key sequence.
2. Latest-five fixture assumed enough retained events after reload; six local schedule
   notices now explicitly seed the scenario, including escaped HTML text.
3. Seed linked backend taskId instead of id; fixture corrected and exact mission checked.
4. Real 390px preview overlapped Status; Overview-only max height now reserves that lane.
5. Reload could match the outgoing Connected element; harness now requires a new
   performance.timeOrigin before connection readiness. No retry or skipped assertion.
Prior D.1 Library reload/navigation failure remains an open retained finding; this
harness synchronization and two D.4 passes do not prove that application issue resolved.
Snapshot excludes live Vault/secrets/browser state/dependencies/build/generated artifacts;
this is not a full backup/restore test. English shell changes do not translate mission,
report or user content, or system safety warnings; Activity actions remain separate.

Control Panel Stage A evidence (2026-11-14):
C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-dashboard-navigation/.
manifest.json is the immutable pre-edit code snapshot; verification.json owns final
hashes/results and verify-stage-a.mjs is the retained local verifier. node-final,
build-final, syntax.json and browser-confirm logs/reports are separate evidence.
stage-a-review.diff uses explicit Git executable/no-index because shell PATH lacks Git;
manual standards/spec review used no unavailable sub-agent. Desktop/mobile dossier
screenshots retained. Initial shell completion reporting was unreliable, so child-process
exit JSON/logs establish test results. Prior D.1 Library reload finding stays open.
Snapshot excludes live Vault/browser state/secrets; no full-data backup or live restore.
Hash URLs retain identifiers only, not drafts/search/provider keys; backend restart
still does not recover runtime. Broader visual acceptance awaits the user's checkpoint.

Control Panel B1 evidence (2026-11-14):
C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-dashboard-b1/.
manifest.json preserves immediate pre-edit copies; verify-b1.mjs chains Stage A hashes
and owns final audit requirements. node-last/build-last and browser-stable passed;
browser-fifth also passed; browser-confirm failed a moving View All pointer target.
Before/after desktop/mobile, workbench/context screenshots
and b1-review.diff retained. Early build failure from an overly fuzzy JSX patch was fixed;
all changed JSX subsequently transformed and built. Browser attempts 1/3 exposed missing
Builder-ready waits, 2 failed a transformed desk pointer check, 4 inspected the prior
conditional task before new dispatch settled. Explicit readiness/hover/dispatch-settlement
waits added without dropping scenarios or changing backend. Stable geometric sampling
then required three consecutive settled pointer samples before clicking; no assertion
retry/skip. Earlier failures stay retained. review.md separates Standards/Spec findings;
no scoped blocker, while formal a11y/visual user acceptance remains unverified.
MCP real pointer checks separately opened all 27 desks; shared font and target changes
passed focused checks at 320/360/390/768/1024/1440/1600. Long-running localhost:5173 backend
returned endpoint not found for analytics/reviews; not repaired or root-caused in B1.
Isolated current backend passed analytics/AAR regression; no claim of live deployment,
full-data recovery, authenticated access, paid provider work or visual user acceptance.

U.5 approved specification: docs/U5-MARKET-ANALYSIS.md owns formulas, data/freshness,
HAWK-only future access and acceptance seams. No implementation or connectivity check
has occurred. Ordinary engineering details follow existing conventions; ask only about
material architecture/permission/cost/safety/scope decisions, not resolved choices.

Deferred proposals, NOT approved parameters or installed dependencies:
- U.4: server/src/vectorStore.js plus existing server/storage/tool boundaries; choose
  local embedding model/runtime and index backend only after Windows/Node compatibility
  review. Canonical notes/deliverables first; define privacy, hash/model versioning,
  update/delete/reindex, retention and citation rules before indexing. Archived Markdown
  and demo defaults are not automatically authoritative corpus. Search first, optional
  bounded RAG context next; never call lexical-only retrieval semantic vector search.
- U.3: server/src/mcpClient.js plus existing server/tool lifecycle; choose transport,
  explicit server/command/origin allowlists, namespacing, schema/result validation,
  timeouts/cancellation/shutdown and grants before integration. No automatic scope growth.

## Scoped Roadmap Inventory

| Phase / task | Status | Remaining scope |
| --- | --- | --- |
| 1.1 / 1.2 / 1.3 / 1.4 / 1.11 | Implemented | Dependency-free logger, explicit validators (not Zod), health, shutdown and .env.example. Formal response-schema tooling remains Planned. |
| 1.9 / 1.10 | Implemented | Node built-in unit/integration and REST/WS coverage; not Jest/ts-jest. |
| 1.5-1.8 / 1.12 | Partially Implemented | Local REST rate limit and root React error boundary are fixture-verified. The running backend predates the limiter. GitHub CI #3 passed dependency install, Node tests and build, then failed a lazy-room Chromium assertion before root-error coverage. The interception wait fix passed locally and awaits hosted confirmation. Docker, external Sentry reporting and deployment remain open. |
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

Ruling: Start the local Phase 2.8 slice while Phase 1 packaging remains open — the workstation has no container engine or WSL to verify Docker, and external reporting and deployment are separate — Docker acceptance remains outstanding; no dependency or live-runtime change is inferred from this reordering.

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
& $G -C $R --no-optional-locks status --short
& $G -C $R --no-pager diff --check
& $G -C $R --no-pager diff --stat
~~~

For untracked files compare pre/post copies/hashes as well; never stage/commit secrets
or entire vault automatically. Do not reset/delete user files or old evidence.
CLAUDE.md owns architecture/security contracts; SKILL.md owns capabilities/specification.
Update relevant sections in-place, never append dated essays. Baseline .clinerules locks
remain in force; recorded counts there are historical, not a reason to drop newer checks.

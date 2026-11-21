# Local Data Hub - staged implementation

## Decision and current boundary

The user chose local database stabilization before external integrations. A future
local-plus-cloud workspace is a direction, not an implemented synchronization
contract. No Cloud account, credentials, paid inference, MCP transport, autonomous
learning, Agent grants or automatic code changes are authorized by this stage.

Stage 1's opt-in SQLite adapter is accepted. Stage 2A added stopped-Vault maintenance
and controlled launcher settings; the code default remains atomic JSON. Stage 2B
verified a real-data backup, restore, SQLite import, isolated Chromium and rollback
with newer writes. The original JSON Vault is retained. Stage 2B.2 accepted the
single local SQLite writer after normal-port API parity and shallow health passed.
See the [Stage 2B checklist](../PLAN.md#local-data-hub--stage-2b-cutover-checklist)
for dated evidence and [System Map](SYSTEM-MAP.md) for data ownership.

## Ownership, not duplicate databases

| Data | Stage 1 owner | Destination in the interface |
| --- | --- | --- |
| notes, deliverables | Selected storage driver, one canonical envelope per collection | Library; exact existing artifact links |
| agentOverrides | Selected storage driver; existing server permission ceiling unchanged | Teams / existing inspector |
| savedCommands, chats | Selected storage driver | Existing workspace controls |
| Markdown notes/deliverables, agents/overrides.json | Generated outbound projections, never a second writer | Local file access; existing Library |
| schedules, taskTemplates, performance/AAR | Existing server-owned atomic JSON, same Vault lock | Missions / Teams Analytics / exact review links |
| mission checkpoint history | Server-owned atomic JSON (`.maoc/state/mission-history.json`), same Vault lock | `GET /api/mission-history` on the hardening candidate; no new UI |
| activation key records | Server-owned atomic JSON (`.maoc/state/accessKeys.json`), same Vault lock | Admin-only list and lifecycle controls; no Markdown or browser-collection projection |
| active tasks, HUMAN questions, approvals, transient events | Existing bounded process memory | Missions / Activity; not re-created after restart |
| browser data | Existing offline cache, dirty edits and revision metadata | Existing pages; not an independent authoritative database |
| AI keys and connection credentials | Existing security boundary, not a new secret store | Future Connections status must never expose key contents |

No Local/Cloud/MCP duplicate content menus. Preserve Overview, Missions, Teams,
Library, Activity and Settings. A later Settings Connections surface can group
connection setup/status while data remains classified by purpose. No UI redesign
is included in Stage 1.

The hardening candidate keeps up to 200 mission checkpoints containing only task ID,
last recorded state and update time. It writes the admission checkpoint before
dispatch. After restart, nonterminal records are exposed as `INTERRUPTED` with
`last_state`; the checkpoint is not proof of the provider's outcome. It contains no
prompts, credentials, inputs or approval IDs and cannot resume or replay work.
History, deliverables and AAR are separate writes. A failed history write leaves the
prior checkpoint intact. History reports `persistence: degraded` and `/api/health`
reports HTTP `503` with `checks.missionHistory.status: degraded` until restart,
even if the collections are healthy. Inspect the archive/AAR and logs when the
outcome is uncertain. Corrupt history fails startup
without rewriting the file. Current verification and live status are in [PLAN.md](../PLAN.md#backend-hardening-before-frontend).

## Local Access Gate

- Default: `MAOC_ACCESS_GATE=false`. With no `MAOC_ADMIN_KEY`, a directly connected loopback owner may use Settings → Admin. If a key is configured while the gate is off, use **Switch access key** in Settings to become Admin; normal workspace routes are still open.
- To enforce the gate, configure a strong random `MAOC_ADMIN_KEY` (32–128 URL-safe characters; 32 random bytes encoded as base64url is recommended) in the root `.env`, set `MAOC_ACCESS_GATE=true`, and restart only during approved maintenance. Keep the Dashboard and API on loopback. Do not expose either via a public reverse proxy or tunnel.
- `GET /api/access` reports gate state and the verified role. Protected REST uses `Authorization: Bearer`; browser WebSockets authenticate before receiving snapshots or updates. Plaintext Activation Keys are returned only on issue or Re-key and are not persisted by MAOC. Revoke and Reactivate change access without showing the key again. Expired keys require Re-key with a fresh expiry.
- Admin/User is a local workspace permission boundary, not per-user records or mission ownership. Rotation/revocation closes affected WebSockets and rejects subsequent requests; it does not cancel already admitted work or erase data already downloaded. Session counts are open authorized WebSockets, not a count of unique people.
- Whole-Vault backups include the credential hash records; restrict access to backups too. Restoring an older backup may restore previously valid keys. Keep the latest verified access records or reissue affected keys before reopening access after a restore. Never publish backup files or add secrets to `VITE_*` variables.

## Adapter contract

- `createApplication({ vaultDir, storageDriver: 'sqlite' })` is an explicit
  programmatic seam. Default remains `atomic-json`; unsupported drivers fail.
  Normal launcher selection is `MAOC_STORAGE_DRIVER=atomic-json|sqlite`; invalid
  values fail startup. `VAULT_DIR` selects the COMPLETE Vault. Import is not an
  environment option: perform it offline into a new destination first.
  `MAOC_SCHEDULER_AUTOSTART=false` suppresses the timer during first-boot checks;
  it is not an HTTP maintenance/read-only mode. Existing restart pause still applies.
- `SqliteStorageEngine` reuses the existing validation, serialized write queue,
  writer lock, revision-conflict behavior, Markdown projection and shutdown.
- Database: `<vaultDir>/.maoc/state/maoc.sqlite`; marker:
  `<vaultDir>/.maoc/state/storage-driver.json`. The complete real-data candidate
  and rehearsal copies are outside OneDrive. Do not move only the database file.
- One STRICT `collections` table stores compatible JSON payloads plus name,
  schema version, revision and updated timestamp. This is a compatibility-first
  database foundation, NOT normalized per-document tables, full-text/vector
  search or a completed all-data migration.
- New database creation imports all five validated envelopes transactionally.
  Existing JSON requires `sqliteImportJson: true` explicitly. It preserves IDs,
  revisions, timestamps and source JSON bytes. Existing databases never reimport
  stale JSON, even when the import flag is passed again.
- SQLite writes use bound values and a revision-qualified UPDATE. Cache is
  updated only after a successful database write. Projection failure retains the
  committed data and reports degraded Markdown status, as before.
- Database identity/schema, integrity and collection contents are checked at
  startup. Corrupt, incompatible or missing marked databases fail closed. JSON
  startup refuses a SQLite database/marker instead of reading stale JSON.
- Lazy `node:sqlite` import avoids an added npm dependency and keeps the default
  JSON path independent of it. Tested Node version: v26.13.0. SQLite mode is not
  certified on all versions accepted by the existing Node >=22 package range.
  Built-in SQLite is a release-candidate API in the consulted Node documentation.
- SQLite calls are synchronous; no unmeasured latency, throughput or production
  readiness claim. Retain existing collection size/validation bounds. Load tests
  and worker-thread decisions are separate future work.

## Migration and rollback gates

1. Inspect pending browser edits and active tasks/HUMAN/review/scheduler work.
   Do not restart automatically: runtime state cannot recover after restart.
2. Coordinate graceful shutdown and flush/drain. Back up the WHOLE Vault and
   record hashes/counts/revisions. A code snapshot or browser export is not a
   complete data backup. Never restore a live writer.lock.
3. Rehearse on a separate copy outside OneDrive; explicitly import JSON once.
   Compare all five envelopes, projections and server-owned JSON. Retain the
   untouched source and test startup/restart, browser hydration, stale revision
   409, invalid input 400 and offline recovery. Start copied schedules paused.
4. Only after acceptance, switch the launcher/config and complete Vault path.
   Keep exactly one authoritative backend writer. Verify health identifies the
   selected driver; do not silently fall back if SQLite cannot start.
5. Rollback before any new writes can restore the verified pre-cutover backup
   into a fresh path. After new SQLite writes, old JSON is STALE: export the
   current five envelopes (including revisions/timestamps) to a NEW JSON Vault,
   copy consistent server-owned state/attachments while stopped, validate and
   boot that isolated path before switching. Never just delete the marker or
   point an old binary at the migrated Vault.

Stage 2A supplies `server/scripts/vault-admin.mjs`, without loading application
config/secrets or booting providers/schedules. The commands accept explicit absolute
paths; destination must not exist, overlap the source or traverse symlinks/junctions.
Destination parent must already exist. Active AND stale writer locks are refused;
the tool never kills a process or removes an existing lock. The tool's own temporary
maintenance lock excludes backend writers while hashing/copying the source.

| Command | Result and verification |
| --- | --- |
| `backup` | Whole stopped Vault to `<destination>/vault`, excluding only writer.lock. Includes binary attachments, generated projections, server JSON and empty directories. SHA-256/size/path inventory checked against source before/after and copy. `manifest.json` is written last as completion marker. |
| `verify` | Read-only check of an idle backup's inventory and age; no destination, lock creation, or access to the original Vault. This can run while the live backend is up. |
| `restore` | Re-hash a completed backup and copy to a new Vault; corrupt/incomplete backups or copied locks fail. No in-place restore. |
| `import-sqlite` | Copy stopped JSON Vault to new path, explicitly import five exact envelopes, verify generated projections, reopen/recompare revisions/timestamps/data and verify non-projection files unchanged. |
| `export-json` | Copy stopped SQLite Vault to new path, export CURRENT five envelopes and remove SQLite files only in the copy. Reopen/recompare and preserve attachments/server-owned state. Never revert the source to stale JSON. |

Failure may leave an incomplete destination for inspection; never point the launcher
at it. Conversion command exit/report is its acceptance signal, not the mere existence
of a folder. These are local logical backups, not encrypted/off-device/disaster-recovery
certification. SHA-256 checks detect mismatch, not authenticity against an attacker who
can rewrite the manifest. File bytes/directories are covered, not NTFS ACL/ADS/timestamps.
Trusted local operators and no concurrent out-of-band file editors are assumed.

### Backup checks and retention

Run `node server/scripts/vault-admin.mjs verify --source <absolute backup directory> [--max-age-hours <positive integer>]` from the project root. Exit `0` means verified and within the age limit (168 hours by default); `2` means verified but stale; `1` means invalid or unreadable. Age comes from the backup's recorded creation time; a passing result does not show whether newer live edits are backed up or whether the backup can boot.

Recommended manual routine: make a stopped-Vault backup weekly and before maintenance; verify each completed backup; retain at least four weekly copies and three monthly copies, plus relevant pre-maintenance copies. Rehearse restore monthly into a new path, boot only the restored copy on a separate loopback port with scheduler disabled and no provider calls, compare all five collection envelopes, and verify lock release after shutdown. Do not schedule live downtime, delete backups, or restore in place automatically. This is local retention, not off-device recovery.

### Storage fault diagnostics

A collection write that hits a capacity or permission error returns `507 STORAGE_FULL` or `503 STORAGE_NOT_WRITABLE` without advancing the cached revision or sending a commit notice. Keep the pending edit, fix the underlying condition, and recheck the current revision before retrying. A committed write with a failed Markdown projection is separate and still reports `projectionStatus: degraded`.

`/api/health?deep=false` still writes a temporary Vault probe. It separates process status, storage status and backup (`not_checked`; use the CLI). `storage.write_failures` tracks outstanding commit failures per collection since startup; a successful commit of the same collection clears its entry. This is not a persistent incident log or a guarantee about the physical disk. On corrupt or missing SQLite startup, do not recreate the Vault or fall back to stale JSON; inspect and restore a verified copy to a new path.

<a id="stage-2b-operational-runbook-rehearsal-verified-cutover-pending"></a>

### Stage 2B operational runbook

1. Confirm every user tab has no dirty/conflict status AND no unsaved in-memory
   drafts; Settings sync status cannot prove an unsubmitted editor is empty.
   Inspect tasks/HUMAN/review approvals/schedules before downtime. Re-confirm tabs
   before cutover if time has elapsed since the original shutdown.
2. Stop using the owning terminal's Ctrl+C or its known IPC parent. Verify graceful
   completion, listener release and absent writer.lock. Do not substitute taskkill,
   force kill or automatic stale-lock removal. If a lock remains, stop and inspect
   it manually; an absent PID by itself is not permission to bypass the guard.
3. Run `backup` against the entire stopped source, outside OneDrive. Keep that
   completed backup unchanged. Run `restore` into a fresh isolated path, then
   `import-sqlite` from the restored path to another fresh path. Capture stdout,
   stderr and exit code for each command; compare all five reported revisions/counts.
4. Start the candidate with explicit `VAULT_DIR`, `MAOC_STORAGE_DRIVER=sqlite` and
   `MAOC_SCHEDULER_AUTOSTART=false` on a different loopback port, without provider
   calls. Use an isolated browser profile with the frontend pinned to the rehearsal
   proxy; never let a workspace `VITE_API_BASE_URL` route tests to the normal port.
   Test hydration, 409/400, offline recovery, conflict resolution, restart and paused
   schedules. Stop the rehearsal copy, run `export-json` into a fresh directory,
   and boot that JSON copy to compare current envelopes, attachments and server state.
5. After rehearsal and operator approval, inspect an existing normal-port
   listener before considering startup; never launch a second writer to check its
   lock. If an approved startup is needed and the listener/writer/lock are absent,
   start only the SQLite candidate with the complete Vault path and scheduler
   autostart disabled. Keep the old source stopped. With approval, verify runtime
   driver/health (`/api/health` writes a Vault probe), all five envelopes, schedules
   and isolated frontend hydration without test-writing to live. Persisted schedules
   require explicit Resume; `stopped:false` does not show whether the timer is running.
6. If new SQLite writes exist before rollback, gracefully stop it and export CURRENT
   state to a NEW JSON Vault; validate/boot that copy before changing paths. Do not
   restore an old backup over new work or point an old launcher at the stale source.

CLI help (absolute executable script path for this workspace):

```powershell
node 'C:/Users/Gamer/OneDrive/เดสก์ท็อป/AI/server/scripts/vault-admin.mjs' --help
```

## Later live sync and external connections

### Stage 3 rollout and rollback

`MAOC_COLLECTION_REALTIME=false` (or unset) keeps collection polling and task telemetry. `true` adds post-commit revision notices and reconnect reconciliation. The frontend treats missing capability as polling-only. This is a backend launch setting, not a hot switch. WebSocket connected does not mean collections are synced or the AI provider is healthy.

On separately approved maintenance: check all tabs for drafts/conflicts and inspect in-flight work; capture the five API envelopes; stop the sole writer gracefully; verify lock release and a fresh full-Vault backup; start the tested code with the same SQLite Vault and scheduler autostart disabled. Verify the active mode from startup logs, the sole writer, exact API parity and snapshot-replay Library hydration. Normal Dashboard startup may send engine settings; do not substitute it for the read-only check. Do not test-write to the live Vault.

If realtime misbehaves, pause changes, check pending work and gracefully restart with `MAOC_COLLECTION_REALTIME=false` on the **same** SQLite Vault. Verify the latest envelopes, not the pre-launch backup. Do not change the driver or restore older data just to disable realtime. If the writer, backup or data cannot be verified, stop and investigate instead of force-killing or clearing a lock.

External connectors must be explicitly selected/authenticated and start read-only.
Source plus external ID identifies repeat imports; similar content from different
sources is not silently merged. Record provenance, freshness and errors. Treat
connector text as untrusted data, not tool authority. Bidirectional edits,
deletion/tombstones, attachment policy, schema evolution, sync cursor/outbox and
idempotent task claims need contracts/tests before local-cloud sync. Database
contents do not automatically stay identical merely by connecting two services.

### Recommended next phases and acceptance gates

1. **Stage 2B - local SQLite operational acceptance:** complete for the documented
   writer; the runbook remains applicable to future recovery or migration.
2. **Stage 3 - local live synchronization:** post-commit collection/revision
   invalidations only, no content/secrets; bounded notification coalescing;
   reconnect reconciles all revisions even if messages were missed. Keep polling
   fallback and existing three-way merge/conflict decisions. Cover two tabs,
   dirty edits during requests, disconnect/reconnect, own-write events, deleted
   records and slow clients. WebSocket readiness is not durable/synced status.
3. **Local operations hardening:** bounded in-flight work at shutdown, truthful
   per-collection sync/backup age/degraded status, recurring backup retention and
   isolated restore drills, permissions/disk-full/corruption tests and measured
   read/write latency. The hardening candidate passed local live acceptance;
   checkpoint recovery and fault injection remain fixture evidence. Never silently
   redispatch chargeable work.
4. **Read-only external integration (U.3):** explicitly choose one connector,
   account, scope and cost boundary; provenance/external IDs/idempotency/cursor,
   deletion and attachment policy before two-way sync. Settings Connections
   manages credentials/status; data stays under existing purpose-based menus.
5. **Retrieval (Phase 4.1-4.4 / U.4):** source-versioned local indexing, citation
   validation, index rebuild/deletion rules and evaluation before RAG injection.
   Embedding providers/cost need separate approval. Retrieval is not autonomous
   learning, tool authority or permission to rewrite source code.

U.5 market implementation, paid inference, external writes and autonomous changes
are not authorized by this roadmap. Do not expand the next stage automatically.

## Evidence

`C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-local-sqlite-stage1/`
owns the pre-edit code snapshot, raw Git-index inventory, captured test/build/
browser exits and final preservation audit. It is not a live Vault backup.
`PLAN.md` owns final check counts; retain failed attempts, if any.

Stage 2A evidence: `C:/Users/Gamer/AppData/Local/MAOC/backups/2026-11-14-local-sqlite-stage2/`.
Its `baseline.json`/snapshot are code/config evidence, NOT a real-Vault backup.
Maintenance tests use generated fixtures outside OneDrive, including attachments,
all five envelopes, full backup/restore and latest-data rollback. Real-Vault
cutover, personal drafts and off-device recovery remain unverified.

Primary references consulted: Node.js SQLite documentation (`nodejs.org/api/sqlite.html`)
for built-in API/stability and SQLite appropriate-uses documentation
(`sqlite.org/whentouse.html`) for application-local storage. Installed-version
execution evidence, not documentation alone, establishes the checks in PLAN.md.

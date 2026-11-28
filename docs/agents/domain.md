# Domain documentation

Single-context layout approved for D.3 on 2026-11-14. Frontend and backend belong
to this same project vocabulary; separate package.json files alone do not require
per-package glossaries or a new documentation architecture.

## Read on demand

Before exploring a topic, read the root GLOSSARY.md if present and only relevant
ADRs in docs/adr/. If either is absent, proceed without creating placeholder files.
Current implementation remains the first source of facts; CLAUDE.md owns runtime
architecture/security, PLAN.md owns live scope and verification, and SKILL.md owns runtime capabilities.
When changing U.5 rules or reviewing its future implementation, also read
docs/U5-MARKET-ANALYSIS.md; the approved formulas stay there, not in the glossary.

## Write only when a decision needs it

- **Home Opening** is the root landing and monitoring page. Its scrollable workspace index links to Command Deck, 2.5D and the Nexus without dispatching work. **The Realm World** is a separate mode selector, not a theme. Keep `#/overview` as a Command Deck bookmark.
- **ATTENTION** groups Blocked, Degraded, Report Approval and Waiting; an `INTERRUPTED` entry is history only. **CREW** shows the roster with observed activity, not modeled presence. Opening a notification or action never changes page, resolves a gate, or replays a toast on reconnect.
- **Mission results** show only deliverables with the exact Task ID. A stored deliverable can outlast runtime and links back to that same mission when provenance is known. Sync failure is not proof a deliverable is missing.
- **Core rail** shows only the current category by default (Home at root). The desktop rail stays 162px wide; at 760px and below the trigger is in a permanent top row with a bounded dropdown. Open, switch and close never shift the workspace. One scrollable frame shows five unnumbered names and only the selected category's nested destinations. Selecting a category does not navigate. Analytics belongs to Dashboards and Glossary to Armory. **Forecast** remains a five-day sample; Task/Log and Command Deck Status use canonical telemetry. **Web Status** separates browser connectivity, WebSocket and local time from provider health.
- **Parallax Stars** (default), Cyber-Link, Meteor and Minimal are modes of one shared background behind all workspace pages, not a Home Opening stage or Visualizer canvas. Mouse parallax moves only this background. **Realm Intelligence 3D** remains at `#/home/visualizer`. System Reduce Motion and app pause stop automatic motion without disabling manual orbit.
- **Workspace HUD preferences** are shared non-secret display settings backed by the Vault. `kali-cyber` defaults; `realm-cyber` and `realm-guild` are user choices. Operator name and microphone permission stay device-local; offline display edits never auto-upload.
- **Pre-code engineering contract:** In Plan Mode record data/schema and `atomic-json`/`sqlite`/`vault-admin.mjs` parity, a fail-closed failure/fallback matrix, and render/cleanup invariants (or an explicit, reasoned N/A); rehearse with disposable fixtures before live acceptance.
- **Enterprise performance budget:** Protect the initial shell with measured lazy boundaries and stable high-frequency WS selectors. Defer `manualChunks` until heavy vendors are authorized; dispose or cancel owned graphics, frames, observers, requests and listeners on unmount.
- **SSOT and checkpoints:** Consolidate live docs in place, archive superseded evidence verbatim, and keep design intent outside runtime grants. When verified slices accumulate uncommitted, give a one-line checkpoint reminder; verification and review of the exact staged allowlist are required before Git approval.

- Public demo means the standalone, read-only `demo/` with invented data and no API, browser storage, or app source in the deployed files. The authorized GitHub Pages source is the root of `gh-pages` in the public `zefer123/maoc` repository, not `main`. Do not publish the backend or Vault, purchase a plan, or change publishing destinations without approval.

- GLOSSARY.md: create at the first resolved domain term that needs shared naming.
  Terms describe domain meaning and distinctions, not formulas, implementation
  instructions, approval statuses or a duplicate specification.
- docs/adr/NNNN-<slug>.md: create an ADR when a real trade-off is costly to reverse
  and would be surprising without context. Use the next unused number, preserving
  existing decisions. Routine implementation choices do not need an ADR.
- Use glossary terms consistently in issues, tests and reports. Surface a conflict
  with an existing ADR/spec before replacing it; ask only for consequential scope,
  architecture, authority, cost or safety decisions, not already settled details.

The domain-modeling format companions remain in .cline/skills/domain-modeling/.
Invoke skills only under .clinerules. Creating domain files requires writable mode
and task scope; setup does not populate glossary entries, ADRs or a GLOSSARY-MAP.md.
Revisit multi-context layout only if actual independently modeled contexts emerge.
# Domain documentation

Single-context layout approved for D.3 on 2026-11-14. Frontend and backend belong
to this same project vocabulary; separate package.json files alone do not require
per-package glossaries or a new documentation architecture.

## Read on demand

Before exploring a topic, read the root GLOSSARY.md if present and only relevant
ADRs in docs/adr/. If either is absent, proceed without creating placeholder files.
Current implementation remains the first source of facts; CLAUDE.md owns runtime
architecture/security, PLAN.md owns scope/evidence, and SKILL.md owns capabilities.
When changing U.5 rules or reviewing its future implementation, also read
docs/U5-MARKET-ANALYSIS.md; the approved formulas stay there, not in the glossary.

## Write only when a decision needs it

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
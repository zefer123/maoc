# Triage labels

Local Markdown mapping, approved for D.3 on 2026-11-14. No external labels created.

| Canonical role | Local Status value | Meaning |
| --- | --- | --- |
| needs-triage | needs-triage | Maintainer evaluation required. |
| needs-info | needs-info | Essential information missing; record the exact question. |
| ready-for-agent | ready-for-agent | Sufficiently specified for possible delegated work, not execution approval. |
| ready-for-human | ready-for-human | Human implementation, judgment or access required. |
| wontfix | wontfix | Not actioned; record the reason and supporting evidence. |

Ordinary tickets carry exactly one of these Status values and one Type category:
`bug` or `enhancement`. Reconcile conflicting states with the maintainer rather
than guessing. Completion uses a separate Resolution/evidence field, not wontfix.
Wayfinding child tickets use their own operational Status and a separate Triage
field, as described in docs/agents/issue-tracker.md.

`ready-for-agent` does not invoke a user-only skill, switch Plan/Act, authorize
implementation, cross a stage checkpoint, or grant MAOC runtime tool access.
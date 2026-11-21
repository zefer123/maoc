# Issue tracker: Local Markdown

User-approved D.3 configuration (2026-11-14). Issues live in this workspace, not
GitHub/GitLab. External PR intake: disabled. No remote, CLI account or service setup
is implied. Resolve paths below relative to the workspace root; use absolute paths
in tool calls and user-facing file references.

## Work ownership

- PLAN.md owns stage order, current verification and approval checkpoints.
- A canonical specification already under docs/ stays there. In particular,
  docs/U5-MARKET-ANALYSIS.md remains authoritative; link to it, never copy its rules.
- Local tickets describe approved work; their existence/status does not authorize
  execution. Plan/Act, approved scope and the current stage remain authoritative.
- Setup creates configuration only. Create tickets on the user's explicit request;
  ticket/triage creation in Plan mode is a proposed draft, not a filesystem write.

## File conventions

- One feature directory: `.scratch/<feature-slug>/`.
- New specifications without an existing canonical owner:
  `.scratch/<feature-slug>/spec.md`. For an existing spec, record its path in tickets
  or a short pointer file rather than introducing a second copy.
- One implementation ticket per file:
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` per feature.
  Choose an unused number, never overwrite or combine unrelated tickets.
- Header fields: Title, Type (`bug` / `enhancement`), Status (triage role from
  docs/agents/triage-labels.md), Spec, Stage and Blocked by (explicit ticket paths).
- Body: purpose, scope/non-goals, acceptance checks, known evidence/limitations.
  Add discussion under `## Comments`; consolidate resolved decisions into the
  current brief without discarding first-failure evidence or earlier approvals.
- Triage-generated tickets/comments retain the installed triage disclaimer.
- A bare number is not unique across features. Use a full path, or ask which
  feature only if the caller's context cannot resolve it. Never assume `#42`
  identifies an external issue.

## Skill instructions translated to local actions

| Skill action | Local behavior |
| --- | --- |
| Publish a spec/issue | Write the appropriate local file only within approved scope and writable mode. No network command. |
| Fetch/read a ticket | Read its referenced local path and canonical spec. Missing directory means no local tickets yet. |
| Apply a label | Update the local field using docs/agents/triage-labels.md. Never call external label APIs. |
| Close an issue | Record the disposition and reason locally. Completion is a separate `Resolution: completed` field with test evidence; `wontfix` means not actioned, not implemented. |
| Review changes | Use a resolvable baseline. With no commits/untracked files use approved snapshot hashes and no-index comparisons; never manufacture HEAD/commits. |

## Wayfinding compatibility

If the user explicitly requests the installed wayfinding workflow, use
`.scratch/<effort>/map.md` and one child per file in its `issues/` directory.
Wayfinding Type is `research` / `prototype` / `grilling` / `task` and its Status is
`open` / `claimed` / `resolved`. Keep optional triage categorization in separate
`Category:` and `Triage:` fields; never mix the two state machines.

Use `Blocked by:` ticket paths. The frontier is the first numbered open, unclaimed
child whose blockers are resolved. Claim before work only in writable mode and
within an approved stage. Resolution records `## Answer` and a short pointer in
the map; it is not permission to start the next stage or a user-only skill.

## Safety

Keep secrets, provider keys, live Vault/browser state and private backups out of
tickets. Do not stage/commit/push, dispatch missions, implement U.5, or create
external issues from a ticket status. No tracker scaffold/tickets are created
until needed. All skills obey the invocation rules in .clinerules and the static
versus fresh-chat verification boundary in docs/agents/skill-routing.md.
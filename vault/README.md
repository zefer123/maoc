# MAOC Local Vault

Open this directory as an Obsidian vault. MAOC creates `notes/`,
`deliverables/`, `agents/`, and `.maoc/state/` on backend startup.

`.maoc/state/*.json` is the canonical, versioned persistence store. Writes use
temporary files, file sync, and atomic rename. Keep this entire directory in
your backups, not just the Markdown files. Only one backend process may own a
vault at a time; a second process is refused by the vault lock.

Markdown files are generated projections, with stable ID-based filenames.
Edits made in MAOC regenerate the affected projection. External Markdown edits
are not imported into MAOC in Phase 1. Removed records retain their Markdown
files as an archive; MAOC never recursively deletes your vault content.

No provider API keys are saved here. JSON persistence is implemented in Phase 1;
SQLite and embedded vector indexing are not installed or claimed as complete.
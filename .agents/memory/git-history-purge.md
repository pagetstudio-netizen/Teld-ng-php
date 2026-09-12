---
name: Git history backup for shallow repositories
description: Preserve shallow-boundary metadata with bundle backups so rewritten history can be restored faithfully.
---

When backing up a shallow repository before a history rewrite, preserve both the Git bundle and the repository’s shallow-boundary file or commit IDs.

**Why:** A bundle can verify as complete while a normal clone still fails if the original shallow boundary is not restored; the boundary tells Git which missing parent history is intentional.

**How to apply:** Save the shallow commit IDs beside the bundle, verify the bundle, and restore those IDs before using the backup as a repository.
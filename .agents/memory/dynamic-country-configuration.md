---
name: Dynamic country configuration
description: Persistence and runtime behavior for administrator-managed countries and operators.
---

Country activation and operator lists are administrator-managed database configuration. Bootstrap seeding may create missing supported defaults, but must not overwrite existing names, operators, activation state, or custom country records.

**Why:** Re-running the application must not undo a country deactivation or restore an operator that an administrator removed.

**How to apply:** Read country and operator options from the API after loading; treat an empty API result as authoritative rather than falling back to defaults. Country removal is a safe deactivation that preserves historical records, and operator removal must stop new use without deleting history.
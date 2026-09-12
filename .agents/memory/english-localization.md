---
name: English localization
description: Durable rules for keeping TELD user-facing text and persisted defaults in English
---

User-facing application text, validation errors, notifications, server messages, metadata, and date/number formats should use English (`en-US`).

**Why:** Existing database defaults are intentionally preserved by the seed process, so translating source code alone can leave current users seeing legacy French labels.

**How to apply:** Preserve API routes, database identifiers, provider names, payment commands, and asset paths. When defaults change, translate only exact known legacy values during startup; do not overwrite administrator-customized values.
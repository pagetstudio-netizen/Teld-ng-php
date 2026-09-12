---
name: Country currency boundary
description: Durable rules for the Philippines/Nigeria currency model and multi-country amounts.
---

All monetary values in the existing ledger remain PHP base units. Country-facing screens and payment providers use the member's local currency, with conversion and whole-unit rounding only at the boundary.

**Why:** This preserves existing balances, products, commissions, deposits, withdrawals, and bonus calculations without a destructive data migration while allowing Nigeria to use NGN.

**How to apply:** Convert local input to PHP before storage or business calculations; convert PHP to local currency for user/admin records tied to a member and for provider requests. Keep aggregate platform statistics explicitly labeled as PHP base. User phone uniqueness is scoped to country plus phone so the same number can exist in separate country accounts.
---
name: Automatic deposit verification
description: The deposit verification policy for country-specific payment flows.
---

Deposits are automatic provider flows only. Manual recipient numbers and payment screenshots are not a supported fallback; if a country has no configured automatic provider, the flow must fail explicitly.

**Why:** The requested operating model removes manual number/capture handling and avoids creating deposits that cannot be verified automatically.

**How to apply:** Keep provider availability country-scoped. Preserve the PHP ledger boundary and local-currency display, and configure a real provider before enabling automatic deposits for a new country.
---
name: WestPay payment correlation
description: Safety requirement before relying on WestPay automatic credits in production.
---

Do not rely on a browser redirect parameter alone to associate a WestPay transaction with a deposit. Automatic crediting must require a signed provider notification or server-to-server verification containing a merchant-created order identifier and the expected amount/currency.

**Why:** A browser-controlled payment reference can be attached to a different pending deposit by the same user before the signed webhook arrives, which can lead to an incorrect credit.

**How to apply:** Before enabling WestPay automatic deposits for real payments, confirm the provider's webhook or verification API returns a signed merchant order/reference and amount/currency. Bind that order to the pending deposit at checkout creation, validate it in the webhook, and keep provider transaction IDs unique.
---
name: SeaPay pay-in support
description: Durable SeaPay integration boundaries, callback URL, and operator-code requirements.
---

Nigeria support is enabled only through explicit country configuration. SeaPay's published NG payout routing codes are usable for the selected bank set, but NGN pay-in `pay_type` values remain merchant-channel specific.

**Why:** SeaPay documents payout bank routing codes separately from pay-in channel codes; treating one as the other can misroute deposits or fail withdrawals.

**How to apply:** Keep credentials in Replit Secrets, use `SEAPAY_PAY_TYPES` only for merchant-supplied pay-in channels, use published or merchant-supplied payout bank codes for withdrawals, use platform-owned merchant order references, and configure both callback URLs from `PUBLIC_APP_URL`.

For Philippines pay-ins, SeaPay channel assignment is authoritative: GCash uses
pay type `101` and PayMaya uses pay type `102`.

**Why:** SeaPay can otherwise fall back to GCash when `pay_type` is missing, or
an old deployment mapping can route PayMaya to the wrong channel.

**How to apply:** Preserve this PH mapping in the server logic; do not rely on
an environment override for these two operators.
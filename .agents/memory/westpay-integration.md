---
name: WestPay Integration
description: WestPay hosted-payment flow integrated alongside SendavaPay — deposit via redirect, webhook confirmation, per-country API keys for withdrawals.
---

## Architecture

**Deposit flow (redirect-based):**
1. User selects WestPay channel → "westpay" step in deposit.tsx
2. POST /api/deposits with `{ useWestpay: true }` → server creates deposit (status: "pending"), builds redirect URL
3. Frontend redirects to `https://westpay.cfd/pay?merchant=SLUG&amount=X&country=NAME&redirect=CALLBACK`
4. WestPay redirects back to GET /api/westpay/callback?depositId=X&status=success&ref=OP-xxx
5. Server stores westpayReference = ref, redirects to /deposit?wp_status=success
6. Webhook POST /api/webhooks/westpay (X-RobotPay-Signature HMAC-SHA256) confirms → approve deposit

**Withdrawal capability:**
- The WestPay transfer helper supports `POST https://westpay.cfd/api/merchant/transfer` with an `X-API-KEY` header.
- The current application approval path remains manual: admin/banker approval changes the withdrawal state but does not automatically invoke the transfer helper.
- Each country has its own secret when automatic transfers are later enabled; the RDC-only deployment only needs the CD key.

## Secrets required (all in Replit Secrets, never in code/DB)
- WESTPAY_MERCHANT_SLUG — merchant slug for payment URL
- WESTPAY_WEBHOOK_SECRET — single webhook secret (env takes priority over DB setting)
- WESTPAY_API_KEY_{CC} — per-country key for withdrawals (TG, CM, BJ, BF, SN, CI, ML, GN, CD, CG, GA, NE, KE, GH, NG)

## Settings keys (in platformSettings DB table)
- westpayEnabled: "true"/"false"
- westpayChannelName: display name (default "WestPay")
- westpayCountries: comma-separated codes, empty = all countries
- westpayWebhookSecret: fallback if WESTPAY_WEBHOOK_SECRET is not set

## Key files
- server/westpay.ts — all WestPay logic (buildPaymentUrl, transfer, verifyWebhookSignature, formatMsisdn)
- server/routes.ts — /api/westpay/callback (GET) + /api/webhooks/westpay (POST) + deposit handler
- shared/schema.ts — deposits.westpayReference column
- server/storage.ts — getDepositByWestpayReference()
- client/src/pages/deposit.tsx — "westpay" step, wpInitiateMutation, wp_status handling
- client/src/components/admin/settings.tsx — WestPay card with toggle and countries; secrets remain server-only

**Why:**
WestPay uses X-RobotPay-Signature (not x-westpay-signature) in webhook headers.
The webhook signature is HMAC-SHA256 of the raw JSON body (not stringified twice).
Webhook secret is single/global; API keys are per-country for withdrawals.

## Administration controls
Keep the WestPay and SendavaPay cards visible in the admin settings so an administrator can enable or disable each payment aggregator at runtime.

**Why:** Operations need to stop or resume a provider without a deployment, while credentials must never be exposed through the browser or stored in settings.

**How to apply:** The cards may edit activation, display name, and supported-country settings only. Keep API keys and webhook secrets exclusively in server environment secrets.

## Deposit routing priority
When WestPay is active for RDC, confirming a deposit amount sends the user through `/robotpay` and redirects directly to WestPay. This takes precedence over manual payment numbers. SendavaPay uses the `/robotpay` SDK flow when WestPay is unavailable or disabled; manual numbers are the fallback in that same flow.

**Why:** The user requested no WestPay confirmation page after entering an amount, while retaining one central `/robotpay` path for manual and SDK-based deposits.

**How to apply:** Do not reintroduce a separate WestPay confirmation screen. Preserve WestPay’s automatic priority and keep manual-number selection inside `/robotpay`.

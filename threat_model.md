# Threat model

## Scope

This document covers the web application, its authenticated API, the internal PHP
ledger, manual and automated payment callbacks, administrative operations, and the
network edge in front of the application.

The application currently serves users in the configured Philippines and Nigeria
countries. The application-level geographic allowlist is prepared for Togo,
Philippines, Nigeria, and Côte d’Ivoire, but a country must not be activated for
payments until its currency, exchange rate, operators, and provider codes have
been verified.

## Assets

- User accounts, passwords, sessions, phone numbers, wallets, and identity data.
- The internal ledger balance and all deposit, withdrawal, bonus, staking, and
  commission records.
- Payment-provider credentials, signed requests, callbacks, and payout state.
- Administrative privileges, administrator PINs, country configuration, and
  payment-number configuration.
- Deposit screenshots and provider/customer payment references.

## Trust boundaries

1. Browser to the Replit edge/proxy.
2. Edge/proxy to the Node.js application.
3. Browser/API to the authenticated session.
4. Application to PostgreSQL.
5. Application to payment providers and their callbacks.
6. Administrator/operator to privileged API routes.

The edge is the only trusted source for client IP and country information. A
browser-supplied forwarding or country header is not a security control.

## Main threats and mitigations

| Threat | Impact | Current mitigation |
| --- | --- | --- |
| SQL injection through user input | Data disclosure or ledger manipulation | Database access uses Drizzle parameterized queries; dynamic values are not concatenated into SQL. |
| Session fixation or session theft | Account takeover | Session ID is regenerated after login and registration; cookies are HttpOnly, secure in production, and SameSite=Lax. |
| Cross-site request forgery | Unauthorized balance or account changes | State-changing API requests require a same-origin Origin/Referer check; signed provider webhooks are exempt. |
| Brute-force login or admin PIN guessing | Account/admin takeover | IP-based login and PIN throttling; PINs are bcrypt hashes, with legacy plaintext values upgraded after successful verification. |
| Banned user retaining access | Continued abuse or withdrawals | Authenticated requests reload the account and reject banned users; `/auth/me` destroys banned sessions. |
| Sensitive data in API responses | Privacy breach | Public user serialization removes passwords and administrator PINs; admin/banker lists remove nested user credentials. |
| Double credit or double refund | Ledger inflation | Deposit approval, withdrawal rejection, gift-code claims, bonuses, earnings, staking release, and withdrawal debit use conditional updates or transactions. |
| Provider callback forgery | Unauthorized credit or payout state change | Provider signatures and merchant identifiers are verified before processing; callbacks use idempotent state claims. |
| Excessive request/body/resource usage | Denial of service | JSON and URL-encoded body limits, screenshot format/size validation, bounded admin pagination, and bounded polling paths. |
| Clickjacking and browser policy abuse | UI redress or data exfiltration | CSP in production, frame denial, MIME sniffing protection, strict referrer policy, permissions policy, and cross-origin isolation headers. |
| VPN/proxy/Tor bypass | Geographic or fraud-control bypass | Not reliably solvable in application code alone. Enable `GEO_ENFORCE=true` only behind a trusted edge that overwrites the configured country header; use a WAF/IP-intelligence service for VPN/Tor risk scoring. |

## Geographic enforcement

The application allowlist is `TG`, `PH`, `NG`, and `CI`. Network enforcement is
disabled unless `GEO_ENFORCE=true`. In production, the edge must:

1. Determine the country from the connecting IP using a maintained IP database or
   provider.
2. Strip any client-supplied country header.
3. Write the trusted country result to the configured `GEOIP_COUNTRY_HEADER`.
4. Reject disallowed countries before forwarding requests where possible.

If the edge cannot guarantee those steps, application header checking must not be
described as reliable geographic enforcement. VPN blocking requires a maintained
proxy/VPN/Tor intelligence feed or WAF policy; HTTPS certificate removal would
reduce security and is not part of this threat model.

## Payment security requirements

- Keep provider keys and secrets in Replit Secrets only; never place them in
  source code, browser storage, database rows, logs, or API responses.
- Verify callback signatures over the provider's raw request body.
- Verify merchant/account identifiers, order references, status transitions, and
  expected amounts before crediting.
- Treat a provider reference as an identifier, not proof of payment.
- Use an internal signed order and stored ledger amount as the source of truth.
- Make approval and refund transitions conditional and idempotent.
- Keep the ledger in PHP base units and convert only at country/provider
  boundaries.
- Do not enable a provider/country combination until the provider's official
  currency, operator, pay type, and payout fields are confirmed.

## Residual risks and operational requirements

- In-memory throttling is not distributed. A multi-instance deployment needs a
  shared limiter at the edge or in a shared datastore.
- IP and country enforcement depends on correct proxy configuration. Direct access
  to the application port must remain unavailable.
- Provider outages and ambiguous statuses require reconciliation and alerting;
  a timeout must not be treated as success.
- Database backups, access controls, and production migration procedures must be
  reviewed separately.
- Uploads should eventually move to private object storage with content scanning
  if screenshots are retained or made accessible beyond the short cleanup window.
- Security scans and regression tests should run before each production release.

## Verification checklist

- `npm run check`
- `npm run build`
- Dependency audit, SAST, and HoundDog scans
- Confirm production proxy overwrites the country header and blocks direct access
- Test login/session rotation, CSRF rejection, banned-session rejection, PIN
  throttling, concurrent claims, concurrent withdrawals, duplicate callbacks, and
  failed payout refunds
---
name: Transactional security
description: Security decisions for ledger mutations, provider callbacks, and trusted network metadata.
---

Financial callbacks and user claims must first win a database conditional state
transition or transaction; only the winner may credit, debit, or refund. Read-
modify-write balance updates are unsafe under concurrent callbacks or requests.

**Why:** Provider retries, browser polling, and multiple app instances can
arrive at the same time, so in-memory checks and a prior read do not prevent
double ledger mutations.

**How to apply:** Add a unique/conditional database gate before every credit,
refund, claim, or payout transition, and keep the ledger update and its
transaction record in the same database transaction where possible. Refunds
must create a positive ledger transaction as part of the same transaction that
restores the balance.

Account-opening credits such as sign-up bonuses must follow the same rule:
create the account, grant the balance, and write the bonus transaction together.

**Why:** A failure between account creation and history insertion otherwise
leaves a funded account with an incomplete ledger.

**How to apply:** Keep onboarding balance initialization and its transaction
record inside one database transaction.

First-investment referral commissions also need a database uniqueness gate keyed
by source user, referral level, and product, with conflict-safe insertion. A
pre-check alone can race when two purchase requests arrive together.

**Why:** Both requests can observe “no previous investment” before either
transaction commits, which would otherwise pay the same commission twice.

**How to apply:** Keep the unique index, conflict-safe insert, and
commission/history transaction in lockstep whenever referral payout logic
changes.

Geographic headers are only meaningful when a trusted edge strips client
versions and writes the result; application code cannot reliably identify VPN,
Tor, or proxy traffic from browser headers alone.

**Why:** A client can forge any ordinary request header, while VPN intelligence
and accurate country attribution require the network edge and a maintained data
source.

**How to apply:** Keep the application allowlist fail-closed when explicitly
enabled behind a trusted proxy, and use a WAF/IP-intelligence service for VPN
and Tor enforcement. Never remove HTTPS certificates as a “security” fix.
# GitHub → Plesk deployment

This project is prepared for a Plesk Node.js application. The committed `dist`
directory is the production build that Plesk must run after each pull.

## 1. Build and push from the project root

Run these commands locally or in the Replit Shell:

```bash
npm ci
npm run check
npm run build
git status
git add .
git commit -m "Prepare production deployment"
git push origin main
```

Use the branch configured in Plesk instead of `main` if the deployment branch
has another name.

The build command replaces `dist/` and regenerates:

- `dist/index.cjs` — production Node.js startup file;
- `dist/public/` — compiled frontend and static files;
- `dist/public/.htaccess` — Apache fallback for frontend routes.

`dist/` is intentionally versioned. Do not add it to `.gitignore`, and do not
commit any `.env` file or secret value.

## 2. Plesk Node.js application settings

In **Websites & Domains → Node.js**, create or edit the application using the
following values:

| Plesk setting | Value |
|---|---|
| Application root | The Git checkout directory containing `package.json`, `dist/`, and `node_modules/` |
| Document root | `dist/public` relative to the application root |
| Application startup file | `dist/index.cjs` |
| Application mode | `Production` |
| Node.js version | Node.js 20 or newer |
| Package manager | npm |

Example layout:

```text
<application root>/
├── package.json
├── package-lock.json
├── dist/
│   ├── index.cjs
│   └── public/
└── ...
```

The application root is not `dist/`. The startup file is relative to the
application root. If Plesk does not install packages automatically after a
pull, run this from the application root:

```bash
npm ci --omit=dev
```

The equivalent production command is:

```bash
NODE_ENV=production node dist/index.cjs
```

Do not use `npm run dev` in Plesk.

## 3. Environment variables in Plesk

Add variables in Plesk's **Custom environment variables** section. Mark
secrets as protected when Plesk offers that option. These values belong in
Plesk's environment configuration, never in GitHub.

### Required for every production instance

| Variable | Value |
|---|---|
| `SUPABASE_DATABASE_URL` | The PostgreSQL connection string from the Supabase project. This is the primary application and session database. |
| `SESSION_SECRET` | A long, random, production-only secret. Do not reuse a development secret. |
| `NODE_ENV` | `production` |
| `PORT` | Usually leave unset so Plesk supplies the port. The server listens on Plesk's supplied port. |

`DATABASE_URL` is only a technical fallback for environments that do not have
`SUPABASE_DATABASE_URL`. Do not point it at the old Replit database in Plesk,
and do not set two different production databases.

### Recommended for the public domain and country detection

| Variable | Value |
|---|---|
| `PUBLIC_APP_URL` | The final HTTPS origin, for example `https://app.example.com`, without a path or trailing slash. Used for payment returns, notifications, and administration links. |
| `GEOIP_COUNTRY_HEADER` | `cf-ipcountry` when Cloudflare is the trusted proxy in front of Plesk. |
| `GEO_ENFORCE` | `true` only when the Plesk/Cloudflare proxy reliably supplies the configured country header; otherwise `false`. |

The app trusts the country header only when `GEO_ENFORCE=true`. Do not enable
enforcement while users can reach Node.js directly without the trusted proxy.
The browser's own geolocation is not used for country security.

Do not set `REPLIT_DEV_DOMAIN` in Plesk. It is a Replit development value. The
payment return URL uses `PUBLIC_APP_URL` first.

### Initial administrator provisioning

| Variable | Use |
|---|---|
| `ADMIN_PASSWORD` | Secret used to create or rotate the super administrator password. |
| `ADMIN_PHONE` | Secret phone identifier for the super administrator. |
| `ADMIN_PIN` | Secret PIN for the super administrator. |

All three values must be stored as protected Plesk environment variables. The
application never uses a default administrator phone number or PIN in source
code. Existing administrator records are preserved during startup, and the
password/PIN are stored hashed in the database.

### Optional Telegram administration notifications

Set both variables to enable Telegram notifications:

| Variable | Use |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token. |
| `TELEGRAM_CHAT_ID` | Destination chat ID. |

### Payment provider variables

Only configure a provider that is enabled in the administration settings.
Provider secrets are server-side values and must not be exposed to the
frontend.

#### SeaPay

| Variable | Required when used | Notes |
|---|---:|---|
| `SEAPAY_PH_MERCHANT_ID` | PH pay-in/payout | Philippines merchant identifier; store as a server Secret. |
| `SEAPAY_PH_API_KEY` | PH pay-in | Philippines server API key; store as a server Secret. |
| `SEAPAY_PH_API_SECRET` | PH payouts/webhooks | Philippines payout signing secret; store as a server Secret. |
| `SEAPAY_NG_MERCHANT_ID` | NG pay-in/payout | Nigeria merchant identifier; store as a server Secret. |
| `SEAPAY_NG_API_KEY` | NG pay-in | Nigeria server API key; store as a server Secret. |
| `SEAPAY_NG_API_SECRET` | NG payouts/webhooks | Nigeria payout signing secret supplied by SeaPay; store as a server Secret. |
| `SEAPAY_PH_API_BASE` / `SEAPAY_NG_API_BASE` | No | Country-specific API base; falls back to `SEAPAY_API_BASE`, then `https://api.seapayglb.me`. |
| `SEAPAY_ENABLED` | No | Set to `true` to allow environment-level enabling. |
| `SEAPAY_COUNTRIES` | No | Comma-separated country codes; defaults to `PH`. |
| `SEAPAY_PAYOUT_COUNTRIES` | No | Comma-separated payout country codes; defaults to `NG`. |
| `SEAPAY_PH_PAY_TYPES` / `SEAPAY_NG_PAY_TYPES` | When configuring operator channels | Valid JSON mapping of country/operator pay types. Never use payout bank routing codes as pay-in types. |
| `SEAPAY_PH_PAYOUT_BANK_CODES` / `SEAPAY_NG_PAYOUT_BANK_CODES` | When overriding payout mappings | Valid JSON mapping of country/payment method bank codes. |
| `SEAPAY_PH_NOTIFY_URL` / `SEAPAY_NG_NOTIFY_URL` | When pay-in is enabled | Country-specific HTTPS deposit callback URL. |
| `SEAPAY_PH_PAYOUT_NOTIFY_URL` / `SEAPAY_NG_PAYOUT_NOTIFY_URL` | When payouts are enabled | Country-specific HTTPS payout callback URL. |
| `SEAPAY_NOTIFY_URL` / `SEAPAY_PAYOUT_NOTIFY_URL` | Legacy fallback | Shared callback URLs used only when a country-specific URL is absent. |

Set the callback URLs explicitly on Plesk so callbacks do not use the legacy
default domain.

#### WestPay

| Variable | Required when used | Notes |
|---|---:|---|
| `WESTPAY_MERCHANT_SLUG` | Pay-in and payouts | Merchant slug. |
| `WESTPAY_WEBHOOK_SECRET` | Webhook verification | Server webhook secret. |
| `WESTPAY_API_KEY_TG` ... `WESTPAY_API_KEY_GH` | Country-specific payouts | Add the key matching each enabled country. |
| `WESTPAY_API_KEY_NG` | Nigeria payouts | Country-specific Nigeria withdrawal key. |

The supported country-specific key suffixes are:
`TG`, `BJ`, `BF`, `CI`, `SN`, `ML`, `CM`, `CG`, `CD`, `GA`, `GN`, `NE`,
`KE`, `GH`, and `NG`.

#### SendavaPay

| Variable | Required when used | Notes |
|---|---:|---|
| `SENDAVAPAY_API_KEY` | Yes | Server API key. |
| `SENDAVAPAY_WEBHOOK_SECRET` | Webhook verification | Server webhook secret. |
| `SENDAVAPAY_API_BASE` | No | Defaults to `https://sendavapay.com/api/sdk/v1`. |

#### AshtechPay

| Variable | Required when used | Notes |
|---|---:|---|
| `ASHTECHPAY_API_KEY` | Yes | Server API key. |
| `ASHTECHPAY_API_BASE` | No | Defaults to `https://ashtechpay.top`. |

#### OmniPay and SoleasPay

| Variable | Required when used | Notes |
|---|---:|---|
| `OMNIPAY_API_KEY` | Yes | Server API key. |
| `SOLEASPAY_API_KEY` | Yes | Server API key. |

The provider names above are configuration identifiers only. They are not
required in user-facing payment labels.

## 4. Pull, deploy, and restart in Plesk

After a new commit is pushed:

1. Open the Git repository connected to the Plesk application.
2. Click **Pull** to fetch the new commit.
3. Confirm the updated `dist/index.cjs` and `dist/public/` are present.
4. Click **Deploy Now** so Plesk installs the lockfile dependencies and updates
   the application files.
5. Return to the Node.js application page and click **Restart App**.

Do not run database migration scripts as part of every deployment. The
Supabase schema and data migration have already been completed. Only run a
schema change deliberately, from a controlled maintenance operation, against
the intended database.

## 5. Post-deploy smoke check

Check the public HTTPS domain:

```bash
curl -I https://app.example.com/
curl -i https://app.example.com/api/countries
```

Expected results:

- `/` returns the compiled application;
- `/api/countries` returns HTTP 200;
- protected API endpoints return HTTP 401 when no session is supplied;
- payment callbacks remain on HTTPS and use the configured public domain.

If the page is blank, first verify the application root, `dist/public`
document root, startup file, and Plesk Node.js logs. The server requires
`SUPABASE_DATABASE_URL` and `SESSION_SECRET` at startup, so a missing value
will prevent the application from coming online.
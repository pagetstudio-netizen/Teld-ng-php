---
name: Plesk GitHub deployment
description: Production deployment uses a committed dist build and a Node.js startup file relative to the application root.
---

For this project, Plesk must pull the versioned `dist` directory from GitHub; the production server starts `dist/index.cjs` and serves static files from `dist/public`.

**Why:** Plesk does not automatically see the Replit workspace build, and a missing or incorrect document root causes either “startup file not found” or a 403 response.

**How to apply:** Keep `dist` tracked for Plesk pulls, use `/dist/public` as the document root relative to the application root, use `dist/index.cjs` as the startup file, and provide `SUPABASE_DATABASE_URL` (or `DATABASE_URL`) plus `SESSION_SECRET` as server environment variables.

Production payment return URLs must come from `PUBLIC_APP_URL`; the Replit
development domain is only a fallback for development environments.

**Why:** A payment provider can otherwise redirect customers back to a stale
Replit or legacy domain after the app is moved to Plesk.

**How to apply:** Set `PUBLIC_APP_URL` to the final HTTPS origin in Plesk
before enabling any provider that sends browser return URLs.

When GitHub has been synchronized through its API, the local Git branch may still report an ahead/behind divergence even after the repository files are already identical.

**Why:** The local and remote commits can have different ancestry despite carrying the same tree. A normal push may be rejected, while a force-push could unnecessarily rewrite the remote history.

**How to apply:** Compare the local and remote Git trees before attempting another push. If every local file has the same blob on the remote branch, do not create an empty commit or force-push; Plesk can pull the existing remote version.

Plesk can serve the document root before Node.js sees a request, so direct refreshes of React routes such as `/login` need an Apache SPA fallback in `dist/public`.

**Why:** Express already returns `index.html` for unknown client routes, but Plesk's static layer can return its own 404 first.

**How to apply:** Keep a `.htaccess` in the built public directory that rewrites only non-API, non-file paths to `index.html`. Exclude `/api` with rewrite conditions, not a terminal `RewriteRule - [L]`, which causes Plesk to return 404 before Node.js handles the API.
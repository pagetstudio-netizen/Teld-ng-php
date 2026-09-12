---
name: Vite dependency cache
description: Environment-specific recovery for stale Vite optimized dependencies after npm lockfile changes.
---

After changing the npm lockfile or dependency graph, a running Vite preview can serve stale optimized modules and show a blank page with `504 Outdated Optimize Dep`. Restarting the application workflow rebuilds the optimized dependency cache and restores the preview.

**Why:** The preview can fail before React mounts even when the TypeScript check and production build succeed.

**How to apply:** Restart the existing application workflow once after package or lockfile changes before diagnosing the page as a frontend rendering bug.
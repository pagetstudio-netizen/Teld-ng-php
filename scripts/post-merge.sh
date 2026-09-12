#!/bin/bash
set -e

# Keep post-merge setup non-interactive and safe for the imported database.
# `drizzle-kit push` can detect the existing session table as a data-loss
# change when it is not represented in the app schema, so migrations must be
# reviewed and run manually rather than applied automatically here.
npm install --no-audit --no-fund
npm run build

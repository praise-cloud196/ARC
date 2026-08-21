/**
 * Runs scripts/backup.ts against production (.env.production) instead of
 * dev (.env.local) — what the scheduled Windows Task Scheduler job
 * (scripts/run-backup.cmd) actually invokes. `dev` is disposable and not
 * worth backing up long-term; the precious data lives on `main`
 * (docs/milestone-4.1-fixes.md §1).
 *
 * Sets process.env directly (not just for a child process) so
 * lib/db.ts's ensureEnvLoaded — which only ever loads .env.local, and
 * only when DATABASE_URL isn't already set — skips its own load and uses
 * these values instead. ARC_ALLOW_PRODUCTION_WRITE=1 lives in
 * .env.production itself, so lib/db-guard.ts's check passes.
 */
process.loadEnvFile(".env.production");
import("./backup");

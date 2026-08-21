/**
 * Guards scripts and tests against writing to the production database
 * (docs/milestone-4.1-fixes.md §1). "Everything else in this project is
 * recoverable. The real log is not" — the event log is append-only, so a
 * mistake against production has no undo, unlike a mistake against `dev`
 * (freely reset — see scripts/migrate.ts's own destructive-migration
 * guard, which this mirrors).
 *
 * Identifies the connected database by querying `neon.branch_id` directly
 * — Postgres itself exposes this as a session setting on Neon — rather
 * than pattern-matching the connection string, since the branch id is the
 * actual source of truth for "which database is this" and a connection
 * string's exact shape (pooler vs. direct, query params) isn't guaranteed
 * to stay match-able.
 */
import type { Pool } from "pg";

export async function getBranchId(pool: Pool): Promise<string | null> {
  const result = await pool.query<{ branch_id: string | null }>(
    "SELECT current_setting('neon.branch_id', true) AS branch_id"
  );
  return result.rows[0]?.branch_id ?? null;
}

/**
 * Throws if the connected database is ARC_PRODUCTION_BRANCH_ID, unless
 * ARC_ALLOW_PRODUCTION_WRITE=1 — deliberately not a casual flag, set once
 * in the environment of whatever legitimately needs to run against
 * production (the deployed app itself never calls this at all; the
 * production backup job's own environment sets it permanently alongside
 * its production DATABASE_URL). If ARC_PRODUCTION_BRANCH_ID isn't
 * configured yet, there's nothing to compare against, so this is a no-op —
 * that's the state before the dev/prod split exists.
 */
export async function assertNotProduction(pool: Pool, context: string): Promise<void> {
  if (process.env.ARC_ALLOW_PRODUCTION_WRITE === "1") return;

  const productionBranchId = process.env.ARC_PRODUCTION_BRANCH_ID;
  if (!productionBranchId) return;

  const branchId = await getBranchId(pool);
  if (branchId === productionBranchId) {
    throw new Error(
      `${context} refuses to run against the production database (branch ${branchId}). ` +
        "The event log is irreplaceable and this operation can't guarantee it's safe. " +
        "Set ARC_ALLOW_PRODUCTION_WRITE=1 to proceed anyway."
    );
  }
}

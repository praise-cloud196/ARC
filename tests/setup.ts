/**
 * Runs once before the whole test suite. No test should ever write to the
 * production database — this is the highest-risk automated path in the
 * project (docs/milestone-4.1-fixes.md §1), so it's checked before a
 * single test file even loads, not per-test.
 */
import { getPool } from "../lib/db";
import { assertNotProduction } from "../lib/db-guard";

export default async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) return; // Tests skip themselves via hasDb; nothing to guard.
  const pool = getPool();
  try {
    await assertNotProduction(pool, "the test suite");
  } finally {
    // globalSetup runs in its own process/module context, separate from
    // the test files that follow — this Pool isn't reused by them, so it
    // must be closed here or the setup process won't exit.
    await pool.end();
  }
}

/**
 * Runs the boundary job (lib/boundary-job.ts) for "today" — the logical day
 * as of now. This standalone script is for local/manual use only; in
 * production the job runs through app/api/cron/boundary (Vercel Cron), not
 * this file — that route is "the running app" and isn't guarded the way
 * this script is (docs/milestone-4.1-fixes.md §1).
 */
import { getPool } from "../lib/db";
import { assertNotProduction } from "../lib/db-guard";
import { runBoundaryJob } from "../lib/boundary-job";
import { computeLogicalDay, getTimezone } from "../lib/logical-day";

async function main(): Promise<void> {
  const pool = getPool();
  await assertNotProduction(pool, "npm run boundary-job");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const asOfLogicalDay = computeLogicalDay(new Date(), getTimezone());
    const result = await runBoundaryJob(client, asOfLogicalDay);
    await client.query("COMMIT");
    console.log(
      `Boundary job closed ${result.closedLogicalDay}: ${result.missedCommitmentIds.length} commitment(s) missed, ` +
        `rollup rebuilt for ${result.rollup.length} day(s).`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

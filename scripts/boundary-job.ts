/**
 * Runs the boundary job (lib/boundary-job.ts) for "today" — the logical day
 * as of now. Invoked by the Vercel Cron job configured in vercel.json in
 * production; runnable manually here for local use.
 */
import { getPool } from "../lib/db";
import { runBoundaryJob } from "../lib/boundary-job";
import { computeLogicalDay, getTimezone } from "../lib/logical-day";

async function main(): Promise<void> {
  const pool = getPool();
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

/**
 * Vercel Cron's HTTP target for the boundary job (milestone-4-spec.md §6 —
 * "the only scheduled job in the product"). Same logic as
 * scripts/boundary-job.ts, wired for production instead of manual/local
 * invocation. Auth: Vercel signs cron requests with `Authorization: Bearer
 * ${CRON_SECRET}` (https://vercel.com/docs/cron-jobs/manage-cron-jobs) —
 * this route only proceeds if that header matches the configured secret,
 * so nothing else can trigger it.
 */
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { runBoundaryJob } from "@/lib/boundary-job";
import { computeLogicalDay, getTimezone } from "@/lib/logical-day";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const asOfLogicalDay = computeLogicalDay(new Date(), getTimezone());
    const result = await runBoundaryJob(client, asOfLogicalDay);
    await client.query("COMMIT");
    return NextResponse.json({
      closedLogicalDay: result.closedLogicalDay,
      missedCount: result.missedCommitmentIds.length,
      rollupDays: result.rollup.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

import { getPool } from "../lib/db";
import { rebuildDailyRollup } from "../lib/rollup";

async function main(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rows = await rebuildDailyRollup(client);
    await client.query("COMMIT");
    console.log(`Rebuilt ${rows.length} day(s) from the event log.`);
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

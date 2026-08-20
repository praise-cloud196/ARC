/**
 * Backs up the two irreplaceable tables (README.md "Backups" — `events` and
 * `attention_events`; everything else is derived or reconstructible from
 * them plus `db/migrations/*.sql`) to a single timestamped JSON file.
 *
 * A plain logical dump via the existing `pg` dependency, not `pg_dump` —
 * this machine doesn't have the Postgres client tools installed, and a
 * single-user personal project doesn't need pg_dump's schema/roles/indexes
 * coverage when the schema itself is already fully reproducible from
 * `db/migrations/*.sql`, which is in git. Only the data is at risk.
 *
 * Output defaults outside the repo (ARC_BACKUP_DIR, or ~/arc-backups) so a
 * problem with this checkout or this disk's project directory doesn't take
 * the backup down with it.
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPool } from "../lib/db";

const BACKUP_DIR = process.env.ARC_BACKUP_DIR ?? path.join(os.homedir(), "arc-backups");

async function main(): Promise<void> {
  const pool = getPool();

  const [events, attentionEvents] = await Promise.all([
    pool.query("SELECT * FROM events ORDER BY recorded_at ASC"),
    pool.query("SELECT * FROM attention_events ORDER BY recorded_at ASC"),
  ]);

  const dump = {
    generatedAt: new Date().toISOString(),
    events: events.rows,
    attentionEvents: attentionEvents.rows,
  };

  mkdirSync(BACKUP_DIR, { recursive: true });
  const fileName = `arc-backup-${dump.generatedAt.replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  writeFileSync(filePath, JSON.stringify(dump, null, 2), "utf-8");

  const { size } = statSync(filePath);
  console.log(
    `Backed up ${events.rows.length} event(s) and ${attentionEvents.rows.length} attention_events row(s) ` +
      `to ${filePath} (${(size / 1024).toFixed(1)} KB).`
  );

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

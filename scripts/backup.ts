/**
 * Backs up the two irreplaceable tables (README.md "Backups" — `events` and
 * `attention_events`; everything else is derived or reconstructible from
 * them plus `db/migrations/*.sql`) to a single timestamped, encrypted file.
 *
 * A plain logical dump via the existing `pg` dependency, not `pg_dump` —
 * this machine doesn't have the Postgres client tools installed, and a
 * single-user personal project doesn't need pg_dump's schema/roles/indexes
 * coverage when the schema itself is already fully reproducible from
 * `db/migrations/*.sql`, which is in git. Only the data is at risk.
 *
 * Output defaults to a OneDrive-synced folder (docs/milestone-3-spec.md
 * §0.1 — a backup on the same disk as everything else dies with that disk;
 * cloud sync is wrong for code and right for backups), overridable via
 * ARC_BACKUP_DIR. Encrypted (§0.2 — `attention_events` is the private layer
 * and must never sit as plaintext in a synced cloud folder) with
 * scripts/backup-crypto.ts using ARC_BACKUP_KEY from `.env.local`. Losing
 * that passphrase means losing the backups.
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPool } from "../lib/db";
import { assertNotProduction } from "../lib/db-guard";
import { encryptBackup } from "./backup-crypto";

// `||`, not `??`: an empty string (e.g. a blank ARC_BACKUP_DIR= left over
// from .env.local.example) must fall through to the default too, not be
// treated as a deliberate override.
const BACKUP_DIR = process.env.ARC_BACKUP_DIR || path.join(os.homedir(), "OneDrive", "arc-backups");

async function main(): Promise<void> {
  const passphrase = process.env.ARC_BACKUP_KEY;
  if (!passphrase) {
    throw new Error("ARC_BACKUP_KEY is not set. Add it to .env.local — the backup dump is encrypted with it.");
  }

  const pool = getPool();
  await assertNotProduction(pool, "npm run backup");

  const [events, attentionEvents] = await Promise.all([
    pool.query("SELECT * FROM events ORDER BY recorded_at ASC"),
    pool.query("SELECT * FROM attention_events ORDER BY recorded_at ASC"),
  ]);

  const dump = {
    generatedAt: new Date().toISOString(),
    events: events.rows,
    attentionEvents: attentionEvents.rows,
  };

  const encrypted = encryptBackup(JSON.stringify(dump), passphrase);

  mkdirSync(BACKUP_DIR, { recursive: true });
  const fileName = `arc-backup-${dump.generatedAt.replace(/[:.]/g, "-")}.json.enc`;
  const filePath = path.join(BACKUP_DIR, fileName);
  writeFileSync(filePath, encrypted);

  const { size } = statSync(filePath);
  console.log(
    `Backed up ${events.rows.length} event(s) and ${attentionEvents.rows.length} attention_events row(s) ` +
      `to ${filePath} (${(size / 1024).toFixed(1)} KB, encrypted).`
  );

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

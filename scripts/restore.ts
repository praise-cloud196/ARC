/**
 * Restores an encrypted scripts/backup.ts dump into a target database
 * (docs/milestone-3-spec.md §0.3 — "an untested backup is not a backup").
 *
 * Deliberately reads the target from RESTORE_DATABASE_URL, never
 * DATABASE_URL: every other script in this project treats DATABASE_URL as
 * the live database, and a restore script that could fall back to it is one
 * missing env var away from overwriting real data with old data. The target
 * database must already have the schema applied (`npm run migrate` run
 * against RESTORE_DATABASE_URL) before this runs — restore only inserts
 * rows, it never creates tables.
 *
 * Usage: RESTORE_DATABASE_URL=... npx tsx scripts/restore.ts <dump-file>
 */
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { decryptBackup } from "./backup-crypto";

interface DumpRow {
  [column: string]: unknown;
}

interface Dump {
  generatedAt: string;
  events: DumpRow[];
  attentionEvents: DumpRow[];
}

const EVENT_COLUMNS = [
  "id",
  "type",
  "occurred_at",
  "recorded_at",
  "logical_day",
  "timezone",
  "domain",
  "subject_id",
  "payload",
  "idempotency_key",
];

// attention_events has no `domain` column (db/migrations/0002_attention_split.sql
// — the Attention layer is deliberately not domain-scored).
const ATTENTION_EVENT_COLUMNS = EVENT_COLUMNS.filter((column) => column !== "domain");

async function insertRows(pool: Pool, table: string, rows: DumpRow[], columns: string[]): Promise<void> {
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  for (const row of rows) {
    const values = columns.map((column) => (column === "payload" ? JSON.stringify(row[column]) : row[column]));
    await pool.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`, values);
  }
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: RESTORE_DATABASE_URL=... npx tsx scripts/restore.ts <dump-file>");
  }

  const passphrase = process.env.ARC_BACKUP_KEY;
  if (!passphrase) {
    throw new Error("ARC_BACKUP_KEY is not set — needed to decrypt the dump.");
  }

  const targetUrl = process.env.RESTORE_DATABASE_URL;
  if (!targetUrl) {
    throw new Error(
      "RESTORE_DATABASE_URL is not set. Deliberately separate from DATABASE_URL so this can never " +
        "accidentally target the live database — point it at the restore target explicitly."
    );
  }

  const dump: Dump = JSON.parse(decryptBackup(readFileSync(filePath), passphrase));

  const pool = new Pool({ connectionString: targetUrl });
  try {
    await insertRows(pool, "events", dump.events, EVENT_COLUMNS);
    await insertRows(pool, "attention_events", dump.attentionEvents, ATTENTION_EVENT_COLUMNS);
  } finally {
    await pool.end();
  }

  console.log(
    `Restored ${dump.events.length} event(s) and ${dump.attentionEvents.length} attention_events row(s) ` +
      `from ${filePath} (generated ${dump.generatedAt}) into the target database.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

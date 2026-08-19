/**
 * Applies pending migrations from db/migrations/, in order, tracked in
 * `schema_migrations`. db/schema.sql is a generated reference of current
 * state, not something this script executes (docs/milestone-1.2-fixes.md
 * item 1).
 *
 * Guarded: the append-only triggers on `events` / `attention_events` block
 * UPDATE and DELETE, but nothing blocks a migration from dropping or
 * altering those tables destructively — a schema migration is not a write
 * through the normal path. So before applying anything, this refuses to run
 * at all if either table already holds data, unless
 * ARC_ALLOW_DESTRUCTIVE_MIGRATION=1 is set. This is deliberately blunt: it
 * blocks every migration, destructive or not, once real data exists, on the
 * theory that a conscious override beats a convenient one.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import { getPool } from "../lib/db";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const GUARDED_TABLES = ["events", "attention_events"] as const;

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedVersions(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ version: string }>("SELECT version FROM schema_migrations");
  return new Set(result.rows.map((row) => row.version));
}

function pendingMigrationFiles(applied: Set<string>): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .filter((file) => !applied.has(file));
}

/** Row count for `table`, or 0 if the table doesn't exist yet (fresh database). */
async function safeCount(pool: Pool, table: string): Promise<number> {
  const regclass = await pool.query<{ exists: string | null }>(
    "SELECT to_regclass($1)::text AS exists",
    [`public.${table}`]
  );
  if (!regclass.rows[0]?.exists) return 0;

  const count = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`);
  return count.rows[0]?.count ?? 0;
}

async function assertSafeToMigrate(pool: Pool): Promise<void> {
  if (process.env.ARC_ALLOW_DESTRUCTIVE_MIGRATION === "1") return;

  const counts = await Promise.all(GUARDED_TABLES.map((table) => safeCount(pool, table)));
  const nonEmpty = GUARDED_TABLES.map((table, i) => ({ table, count: counts[i] ?? 0 })).filter(
    ({ count }) => count > 0
  );

  if (nonEmpty.length === 0) return;

  const detail = nonEmpty.map(({ table, count }) => `${table}: ${count} row(s)`).join(", ");
  console.error(
    `Refusing to run migrations: ${detail}. The event log is irreplaceable and this script ` +
      "cannot guarantee a pending migration is non-destructive. Set " +
      "ARC_ALLOW_DESTRUCTIVE_MIGRATION=1 to proceed anyway."
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const pool = getPool();
  await ensureMigrationsTable(pool);

  // Guarded before checking what's pending, not after: "refuse and exit
  // non-zero" must hold on every invocation while real data exists, not
  // only on invocations that happen to have something to apply.
  await assertSafeToMigrate(pool);

  const applied = await appliedVersions(pool);
  const pending = pendingMigrationFiles(applied);

  if (pending.length === 0) {
    console.log("No pending migrations.");
    await pool.end();
    return;
  }

  for (const file of pending) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

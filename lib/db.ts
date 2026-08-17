import path from "node:path";
import { Pool, types } from "pg";

// Postgres `date` values default to being parsed into a JS Date at the
// Node process's local timezone, which silently shifts logical_day by a
// day depending on where the process runs. Keep it as the raw
// 'YYYY-MM-DD' string instead — ARC's own timezone handling lives in
// lib/logical-day.ts and should be the only place dates get interpreted.
types.setTypeParser(types.builtins.DATE, (value) => value);

function ensureEnvLoaded(): void {
  if (process.env.DATABASE_URL) return;
  try {
    process.loadEnvFile(path.join(process.cwd(), ".env.local"));
  } catch {
    // No .env.local present; DATABASE_URL may be provided another way
    // (e.g. the hosting platform's env config).
  }
}

// Runs at import time (not lazily inside getPool()) so that anything
// checking process.env.DATABASE_URL right after importing this module
// — e.g. a test deciding whether to skip — sees the loaded value.
// Next.js's own runtime already loads .env.local before this module is
// ever imported, so the guard above makes this a no-op there.
ensureEnvLoaded();

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in."
      );
    }
    // No explicit `ssl` override here: pg parses `sslmode` from the
    // connection string itself (Neon's includes sslmode=require) and
    // verifies the server certificate properly. Forcing
    // rejectUnauthorized: false would silently disable that verification.
    pool = new Pool({ connectionString });
  }
  return pool;
}

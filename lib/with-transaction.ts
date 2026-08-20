/**
 * Shared connection handling for Server Actions and Server Components —
 * every multi-statement write here goes through `withTransaction` so
 * "conduct is written before projections, in the same transaction"
 * (AGENTS.md hard rule 2) actually holds. Without it, a Server Action
 * calling e.g. lib/quests.ts's `recordOutcome` with the bare Pool would
 * have its SELECT/INSERT/appendEvent each grab a different pooled
 * connection, with no atomicity between them.
 */
import type { PoolClient } from "pg";
import { getPool } from "./db";

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** For read-only Server Components: a consistent snapshot across several queries, always rolled back (nothing to commit). */
export async function withReadTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("ROLLBACK");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

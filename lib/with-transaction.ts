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

/**
 * Checks out a client and opens a transaction on it, retrying with a fresh
 * connection if the checkout or BEGIN fails. After idle, Neon's compute may
 * be asleep or have dropped the socket a warm serverless instance still
 * holds — that failure always happens before `fn` runs, so retrying here
 * can never repeat a write.
 */
async function beginOnLiveClient(): Promise<PoolClient> {
  const pool = getPool();
  let lastError: unknown;
  for (let attempt = 0; attempt < BEGIN_ATTEMPTS; attempt++) {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      return client;
    } catch (err) {
      lastError = err;
      // Passing the error destroys the client instead of returning it to the pool.
      client?.release(err instanceof Error ? err : new Error(String(err)));
    }
  }
  throw lastError;
}

const BEGIN_ATTEMPTS = 3;

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await beginOnLiveClient();
  try {
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
  const client = await beginOnLiveClient();
  try {
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

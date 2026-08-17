import { readFileSync } from "node:fs";
import path from "node:path";
import { getPool } from "../lib/db";

async function main(): Promise<void> {
  const schema = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8");
  const pool = getPool();
  await pool.query(schema);
  console.log("Migration applied.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

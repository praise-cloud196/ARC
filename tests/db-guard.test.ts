/**
 * docs/milestone-4.1-fixes.md §1. Real database (to get a real branch id
 * back from `getBranchId`), but read-only — nothing is written. Skipped
 * automatically when DATABASE_URL is unset.
 */
import { afterEach, describe, expect, it } from "vitest";
import { getPool } from "../lib/db";
import { assertNotProduction, getBranchId } from "../lib/db-guard";

const hasDb = Boolean(process.env.DATABASE_URL);

afterEach(() => {
  delete process.env.ARC_PRODUCTION_BRANCH_ID;
  delete process.env.ARC_ALLOW_PRODUCTION_WRITE;
});

describe.skipIf(!hasDb)("assertNotProduction (docs/milestone-4.1-fixes.md §1)", () => {
  it("is a no-op when ARC_PRODUCTION_BRANCH_ID isn't configured", async () => {
    const pool = getPool();
    await expect(assertNotProduction(pool, "test")).resolves.toBeUndefined();
  });

  it("is a no-op when the connected branch doesn't match ARC_PRODUCTION_BRANCH_ID", async () => {
    process.env.ARC_PRODUCTION_BRANCH_ID = "br-not-the-real-one";
    const pool = getPool();
    await expect(assertNotProduction(pool, "test")).resolves.toBeUndefined();
  });

  it("throws when the connected branch matches ARC_PRODUCTION_BRANCH_ID", async () => {
    const pool = getPool();
    const realBranchId = await getBranchId(pool);
    expect(realBranchId).toBeTruthy(); // sanity: Neon actually exposes this

    process.env.ARC_PRODUCTION_BRANCH_ID = realBranchId as string;
    await expect(assertNotProduction(pool, "test context")).rejects.toThrow(/refuses to run/);
  });

  it("ARC_ALLOW_PRODUCTION_WRITE=1 overrides the block even when the branch matches", async () => {
    const pool = getPool();
    const realBranchId = await getBranchId(pool);

    process.env.ARC_PRODUCTION_BRANCH_ID = realBranchId as string;
    process.env.ARC_ALLOW_PRODUCTION_WRITE = "1";
    await expect(assertNotProduction(pool, "test")).resolves.toBeUndefined();
  });
});

/**
 * milestone-2-spec.md §2 / §8 DoD: levelForXp(xpToReachLevel(n)) === n for
 * n = 1..30. Pure arithmetic — no database needed.
 */
import { describe, expect, it } from "vitest";
import { levelForXp, xpToReachLevel } from "../lib/calibration";

describe("domain levels", () => {
  it("levelForXp(xpToReachLevel(n)) === n for n = 1..30", () => {
    for (let n = 1; n <= 30; n++) {
      expect(levelForXp(xpToReachLevel(n))).toBe(n);
    }
  });

  it("one XP short of the threshold for n stays at n - 1", () => {
    for (let n = 2; n <= 30; n++) {
      expect(levelForXp(xpToReachLevel(n) - 1)).toBe(n - 1);
    }
  });

  it("level 1 requires 0 XP and levels never go below 1", () => {
    expect(xpToReachLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
  });
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // These tests run several round trips against a real, remote Neon
    // database (append events, rebuild the rollup, sometimes twice) — the
    // 5000ms default has been marginal since milestone 1 and started
    // failing outright once milestone-1.2's truncate-guard migration added
    // one more trigger's worth of latency per statement.
    testTimeout: 20000,
    // Refuses the whole run if DATABASE_URL is the production branch
    // (docs/milestone-4.1-fixes.md §1) — checked once, before any test
    // file loads.
    globalSetup: ["./tests/setup.ts"],
  },
});

/**
 * Single-user auth gate (proxy.ts, lib/auth.ts). Pure functions, no database.
 */
import { describe, expect, it } from "vitest";
import { computeAuthToken, isValidAuthToken } from "../lib/auth";

describe("computeAuthToken / isValidAuthToken", () => {
  it("a token computed from the correct password validates against it", () => {
    const token = computeAuthToken("correct horse battery staple");
    expect(isValidAuthToken(token, "correct horse battery staple")).toBe(true);
  });

  it("a token computed from a different password does not validate", () => {
    const token = computeAuthToken("wrong password");
    expect(isValidAuthToken(token, "correct horse battery staple")).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(isValidAuthToken(undefined, "correct horse battery staple")).toBe(false);
    expect(isValidAuthToken(null, "correct horse battery staple")).toBe(false);
    expect(isValidAuthToken("", "correct horse battery staple")).toBe(false);
  });

  it("rejects a tampered or malformed token without throwing", () => {
    const token = computeAuthToken("correct horse battery staple");
    expect(isValidAuthToken(token + "x", "correct horse battery staple")).toBe(false);
    expect(isValidAuthToken(token.slice(0, -1), "correct horse battery staple")).toBe(false);
    expect(isValidAuthToken("not-hex-at-all", "correct horse battery staple")).toBe(false);
  });

  it("is deterministic — same password always produces the same token", () => {
    expect(computeAuthToken("same")).toBe(computeAuthToken("same"));
  });
});

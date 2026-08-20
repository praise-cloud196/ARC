/**
 * docs/milestone-3-spec.md §0.2. Pure functions, no database.
 */
import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "../scripts/backup-crypto";

describe("backup encryption round trip", () => {
  it("decrypts what it encrypted", () => {
    const plaintext = JSON.stringify({ events: [{ id: "1", payload: { tier: 3 } }] });
    const envelope = encryptBackup(plaintext, "correct horse battery staple");
    expect(decryptBackup(envelope, "correct horse battery staple")).toBe(plaintext);
  });

  it("produces a different envelope each time (fresh salt/iv)", () => {
    const plaintext = "same input";
    const a = encryptBackup(plaintext, "passphrase");
    const b = encryptBackup(plaintext, "passphrase");
    expect(a.equals(b)).toBe(false);
  });

  it("rejects the wrong passphrase", () => {
    const envelope = encryptBackup("secret contents", "right passphrase");
    expect(() => decryptBackup(envelope, "wrong passphrase")).toThrow();
  });

  it("rejects a tampered envelope (GCM auth tag)", () => {
    const envelope = encryptBackup("secret contents", "passphrase");
    const tampered = Buffer.from(envelope);
    const lastIndex = tampered.length - 1;
    tampered[lastIndex] = (tampered[lastIndex] ?? 0) ^ 0xff; // flip a byte in the ciphertext
    expect(() => decryptBackup(tampered, "passphrase")).toThrow();
  });
});

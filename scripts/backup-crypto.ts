/**
 * AES-256-GCM envelope for the backup dump (docs/milestone-3-spec.md §0.2).
 * `attention_events` is the private layer — this file must never sit as
 * plaintext in a synced cloud folder. Passphrase comes from ARC_BACKUP_KEY
 * in `.env.local`; losing it means losing the backups (README.md).
 *
 * Output layout: salt(16) || iv(12) || authTag(16) || ciphertext. Fixed-size
 * header, no JSON/base64 envelope needed — scrypt derives the AES key from
 * the passphrase + a fresh salt on every call, so the passphrase itself is
 * never used directly as a key.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export function encryptBackup(plaintext: string, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = scryptSync(passphrase, salt, KEY_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, ciphertext]);
}

export function decryptBackup(envelope: Buffer, passphrase: string): string {
  const salt = envelope.subarray(0, SALT_LENGTH);
  const iv = envelope.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = envelope.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16);
  const ciphertext = envelope.subarray(SALT_LENGTH + IV_LENGTH + 16);
  const key = scryptSync(passphrase, salt, KEY_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

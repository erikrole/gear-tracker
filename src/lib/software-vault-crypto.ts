import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

function vaultKey(): Buffer {
  const encoded = env.softwareVaultKey.trim();
  const key = Buffer.from(encoded, "base64");
  const canonical = key.toString("base64");
  const unpaddedEncoded = encoded.replace(/=+$/, "");
  const unpaddedCanonical = canonical.replace(/=+$/, "");
  if (key.length !== KEY_BYTES || unpaddedEncoded !== unpaddedCanonical) {
    throw new Error("SOFTWARE_VAULT_KEY must decode to exactly 32 bytes");
  }
  return key;
}

/** Encrypt a vault field. The returned value contains no plaintext. */
export function encryptSoftwareSecret(value: string): string {
  if (!value) throw new Error("Software vault values cannot be empty");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, vaultKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Decrypt a vault field and fail closed for malformed or tampered data. */
export function decryptSoftwareSecret(payload: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = payload.split(".");
  if (version !== VERSION || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Invalid software vault ciphertext");
  }

  const iv = Buffer.from(encodedIv, "base64url");
  const authTag = Buffer.from(encodedTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) {
    throw new Error("Invalid software vault ciphertext");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, vaultKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Invalid software vault ciphertext");
  }
}

/**
 * Shared edge-compatible crypto helpers.
 * Uses Web Crypto API only (no Node.js crypto).
 */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a random hex string of the given byte length. */
export function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return toHex(array.buffer);
}

/**
 * Lightweight crypto utilities — no heavy dependencies.
 * Extracted from auth.ts to avoid pulling bcrypt/cookies/prisma into asset routes.
 */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return toHex(array.buffer);
}

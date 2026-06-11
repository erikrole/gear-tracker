import type { FirmwareSourceType } from "@prisma/client";

/**
 * Shared source of truth for firmware watch identity normalization, supported
 * source types, and source URL validation. The runtime poller
 * (`src/lib/services/firmware-watch.ts`), the asset detail route
 * (`src/app/api/assets/[id]/route.ts`), and the seed script
 * (`scripts/seed-firmware-watch-targets.mjs`, which mirrors these rules in plain
 * JS) all depend on these rules agreeing. Treat this module as the authoritative
 * contract: change canonicalization or host policy here first, then mirror into
 * the seed script.
 *
 * This module is server-safe and type-only with respect to Prisma: it imports
 * only the `FirmwareSourceType` enum *type*, never the Prisma client, so it can
 * be consumed from server code without bundling the database client.
 */

/**
 * Firmware source types that the runtime poller can actually fetch and parse.
 * A type may exist in the Prisma `FirmwareSourceType` enum (schema-known)
 * without having a runtime parser yet -- those are intentionally excluded here
 * so unsupported targets fail clearly before any network fetch.
 */
const SUPPORTED_SOURCE_TYPES = new Set<FirmwareSourceType>(["SONY_SUPPORT"]);

/**
 * Allowed hosts per supported source type. Only listed here when a source type
 * is both supported (has a parser) and has an official host allowlist.
 *
 * `CANON_SUPPORT` is intentionally absent: it is schema-known but
 * runtime-unsupported until a Canon parser and host allowlist are implemented.
 */
const ALLOWED_HOSTS: Partial<Record<FirmwareSourceType, ReadonlySet<string>>> = {
  SONY_SUPPORT: new Set([
    "www.sony.com",
    "sony.com",
    "www.sony.co.uk",
    "sony.co.uk",
  ]),
};

/**
 * Returns true when the runtime poller has a parser for this source type.
 * Schema-known but parser-less types (e.g. `CANON_SUPPORT`) return false.
 */
export function isSupportedFirmwareSourceType(
  sourceType: FirmwareSourceType,
): boolean {
  return SUPPORTED_SOURCE_TYPES.has(sourceType);
}

/**
 * Normalize a brand string to its canonical firmware-watch form.
 * Currently only Sony is canonicalized; all other brands pass through trimmed.
 */
export function normalizeFirmwareBrand(value: string): string {
  const brand = value.trim();
  if (/^sony$/i.test(brand)) return "Sony";
  return brand;
}

/**
 * Normalize a model string to its canonical firmware-watch form for a given
 * (already-normalized) brand. Applies Sony aliases:
 *   - strip a trailing `/B` color-variant suffix
 *   - convert a leading `LCE-` to `ILCE-`
 *   - convert `ILME-FX6` to `ILME-FX6V`
 */
export function canonicalFirmwareModel(brand: string, value: string): string {
  const model = value.trim().toUpperCase().replace(/\/B$/, "");
  if (brand === "Sony") {
    return model.replace(/^LCE-/, "ILCE-").replace(/^ILME-FX6$/, "ILME-FX6V");
  }
  return model;
}

/**
 * Canonicalize a raw brand/model pair into the identity used to match firmware
 * watch targets. Returns null when either side normalizes to an empty string.
 */
export function canonicalFirmwareIdentity(
  brandValue: string,
  modelValue: string,
): { brand: string; model: string } | null {
  const brand = normalizeFirmwareBrand(brandValue);
  const model = canonicalFirmwareModel(brand, modelValue);
  if (!brand || !model) return null;
  return { brand, model };
}

/**
 * Validate a firmware source URL for a given source type. Throws a descriptive
 * Error (caught by the poller and recorded on the target) when the source type
 * is unsupported, the URL is malformed, not HTTPS, or its host is not on the
 * official allowlist. Returns nothing on success.
 *
 * Unsupported source types are rejected first so a schema-known-but-parser-less
 * type fails before any URL or network work.
 */
export function validateFirmwareSourceUrl(
  sourceType: FirmwareSourceType,
  sourceUrl: string,
): void {
  if (!isSupportedFirmwareSourceType(sourceType)) {
    throw new Error(`Unsupported firmware source type: ${sourceType}`);
  }

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("Firmware source URL is invalid");
  }

  if (url.protocol !== "https:") {
    throw new Error("Firmware source URL must use HTTPS");
  }

  const hosts = ALLOWED_HOSTS[sourceType];
  if (!hosts?.has(url.hostname.toLowerCase())) {
    throw new Error(`Firmware source host is not allowed for ${sourceType}`);
  }
}

/**
 * Strip dangerous HTML patterns from user-supplied text.
 * Defense-in-depth: React escapes output, but this protects
 * server-rendered contexts, API consumers, and audit logs.
 */
export function sanitizeText(input: string): string {
  return input
    // Strip HTML tags (keeps text content)
    .replace(/<[^>]*>/g, "")
    // Strip javascript: URIs
    .replace(/javascript\s*:/gi, "")
    // Strip data: URIs (can embed scripts)
    .replace(/data\s*:[^,]*;base64/gi, "")
    // Collapse excessive whitespace (prevents layout attacks)
    .replace(/\s{20,}/g, " ".repeat(20));
}

export function sanitizeJsonStrings(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonStrings(item));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      out[key] = sanitizeJsonStrings(nested);
    }
    return out;
  }

  return value;
}

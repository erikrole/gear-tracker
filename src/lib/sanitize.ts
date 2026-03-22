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

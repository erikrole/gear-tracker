// Markdown snippet builders for the guide editor's insert tools.
//
// The reader renders GitHub-style alert callouts (src/lib/remark-callouts.ts)
// and safe video embeds (src/lib/media-embed.ts). These helpers build the
// exact source syntax so staff don't have to hand-type it.

export const CALLOUT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;

export type CalloutType = (typeof CALLOUT_TYPES)[number];

export const CALLOUT_LABELS: Record<CalloutType, string> = {
  NOTE: "Note",
  TIP: "Tip",
  IMPORTANT: "Important",
  WARNING: "Warning",
  CAUTION: "Caution",
};

/** Builds a GitHub-style alert callout blockquote, e.g. `> [!NOTE]`. */
export function buildCalloutSnippet(type: CalloutType, body = "Write your callout here."): string {
  return `> [!${type}]\n> ${body}\n`;
}

/** Builds a fenced ```embed block for an allowlisted video URL. */
export function buildEmbedSnippet(url: string): string {
  return `\`\`\`embed\n${url.trim()}\n\`\`\`\n`;
}

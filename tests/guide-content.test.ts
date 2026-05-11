import { describe, expect, it } from "vitest";
import {
  blockNoteToMarkdown,
  extractGuideText,
  markdownHeadings,
  summarizeGuideContent,
  summarizeMarkdown,
} from "@/lib/guide-content";

describe("guide content text extraction", () => {
  it("extracts searchable text from BlockNote-style content", () => {
    const content = [
      {
        id: "heading",
        type: "heading",
        content: [{ type: "text", text: "Server paths", styles: {} }],
      },
      {
        id: "paragraph",
        type: "paragraph",
        content: [
          { type: "text", text: "NAS: smb://creative-server/projects", styles: {} },
          { type: "text", text: " Contact engineering for access.", styles: {} },
        ],
      },
    ];

    expect(extractGuideText(content)).toBe(
      "Server paths NAS: smb://creative-server/projects Contact engineering for access.",
    );
  });

  it("summarizes long content without exposing the full document", () => {
    const content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "A".repeat(220), styles: {} }],
      },
    ];

    expect(summarizeGuideContent(content, 24)).toBe(`${"A".repeat(24)}...`);
  });

  it("converts legacy ordered lists into readable Markdown numbering", () => {
    const content = [
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Server restart", styles: {} }],
      },
      {
        type: "numberedListItem",
        content: [{ type: "text", text: "SSH into the app host.", styles: {} }],
      },
      {
        type: "numberedListItem",
        content: [{ type: "text", text: "Run pm2 restart gear-tracker.", styles: {} }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Confirm the health check returns 200.", styles: {} }],
      },
      {
        type: "numberedListItem",
        content: [{ type: "text", text: "Notify the requester.", styles: {} }],
      },
    ];

    expect(blockNoteToMarkdown(content)).toBe(
      [
        "## Server restart",
        "1. SSH into the app host.",
        "2. Run pm2 restart gear-tracker.",
        "Confirm the health check returns 200.",
        "1. Notify the requester.",
      ].join("\n\n"),
    );
  });

  it("converts legacy code blocks into explicit text fences", () => {
    const content = [
      {
        type: "codeBlock",
        content: [{ type: "text", text: "smb://creative-server/projects", styles: {} }],
      },
    ];

    expect(blockNoteToMarkdown(content)).toBe(
      ["```text", "smb://creative-server/projects", "```"].join("\n"),
    );
  });

  it("preserves legacy rich text, quotes, dividers, and tables", () => {
    const content = [
      {
        type: "quote",
        content: [
          { type: "text", text: "Examples:", styles: { bold: true } },
          { type: "text", text: "\n", styles: {} },
          { type: "text", text: "VB-20260423-MICH-MAO-013\nVB-20260908-MINN-KROMKE-183", styles: { code: true } },
        ],
      },
      { type: "divider" },
      {
        type: "table",
        content: {
          rows: [
            {
              cells: [
                { type: "tableCell", content: [{ type: "text", text: "Action", styles: { bold: true } }] },
                { type: "tableCell", content: [{ type: "text", text: "Hotkey", styles: { bold: true } }] },
              ],
            },
            {
              cells: [
                { type: "tableCell", content: [{ type: "text", text: "Save & next photo", styles: {} }] },
                { type: "tableCell", content: [{ type: "text", text: "⌘N", styles: { code: true } }] },
              ],
            },
          ],
        },
      },
    ];

    expect(blockNoteToMarkdown(content)).toBe(
      [
        "> **Examples:**",
        "> `VB-20260423-MICH-MAO-013`",
        "> `VB-20260908-MINN-KROMKE-183`",
        "",
        "---",
        "",
        "| **Action** | **Hotkey** |",
        "| --- | --- |",
        "| Save & next photo | `⌘N` |",
      ].join("\n"),
    );
  });

  it("summarizes Markdown without leaking formatting syntax", () => {
    expect(
      summarizeMarkdown(
        "## Contacts\n\n- **Studio:** [Front desk](tel:+15555551212)\n- `NAS`: smb://creative-server/projects",
      ),
    ).toBe("Contacts Studio: Front desk NAS: smb://creative-server/projects");
  });

  it("builds heading ids from visible rich Markdown heading text", () => {
    expect(markdownHeadings("## **Server** [Paths](https://example.com)")).toEqual([
      {
        id: "server-paths",
        level: 2,
        text: "Server Paths",
      },
    ]);
  });
});

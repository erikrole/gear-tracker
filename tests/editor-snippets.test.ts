import { describe, expect, it } from "vitest";
import {
  buildCalloutSnippet,
  buildEmbedSnippet,
  CALLOUT_LABELS,
  CALLOUT_TYPES,
} from "@/lib/editor-snippets";
import { parseEmbed } from "@/lib/media-embed";

describe("buildCalloutSnippet", () => {
  it.each(CALLOUT_TYPES)("builds a GitHub-style %s callout", (type) => {
    const snippet = buildCalloutSnippet(type);
    expect(snippet).toBe(`> [!${type}]\n> Write your callout here.\n`);
  });

  it("accepts a custom body", () => {
    expect(buildCalloutSnippet("TIP", "Label your cables.")).toBe("> [!TIP]\n> Label your cables.\n");
  });

  it("has a label for every callout type", () => {
    for (const type of CALLOUT_TYPES) {
      expect(CALLOUT_LABELS[type]).toBeTruthy();
    }
  });
});

describe("buildEmbedSnippet", () => {
  it("wraps the URL in a fenced embed block", () => {
    expect(buildEmbedSnippet("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "```embed\nhttps://youtu.be/dQw4w9WgXcQ\n```\n",
    );
  });

  it("trims whitespace around the URL", () => {
    expect(buildEmbedSnippet("  https://vimeo.com/123456  ")).toBe(
      "```embed\nhttps://vimeo.com/123456\n```\n",
    );
  });

  it("produces a snippet the reader's embed parser accepts", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const body = buildEmbedSnippet(url).split("\n")[1] ?? "";
    expect(parseEmbed(body)).toEqual(
      expect.objectContaining({ provider: "youtube", src: "https://www.youtube.com/embed/dQw4w9WgXcQ" }),
    );
  });
});

describe("embed dialog validation (parseEmbed reuse)", () => {
  it("rejects non-allowlisted hosts", () => {
    expect(parseEmbed("https://evil.example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("rejects non-URL input", () => {
    expect(parseEmbed("not a url")).toBeNull();
  });

  it("accepts vimeo player URLs", () => {
    expect(parseEmbed("https://player.vimeo.com/video/123456")?.provider).toBe("vimeo");
  });
});

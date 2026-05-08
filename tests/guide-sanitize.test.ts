import { describe, expect, it } from "vitest";
import { sanitizeJsonStrings } from "@/lib/sanitize";

describe("guide content sanitization", () => {
  it("strips scriptable strings recursively from BlockNote-style content", () => {
    const content = [
      {
        id: "block-1",
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "<script>alert(1)</script>Keep this",
            styles: {},
          },
        ],
        props: {
          url: "javascript:alert(1)",
          caption: "<img src=x onerror=alert(1)>Caption",
        },
      },
    ];

    expect(sanitizeJsonStrings(content)).toEqual([
      {
        id: "block-1",
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "alert(1)Keep this",
            styles: {},
          },
        ],
        props: {
          url: "alert(1)",
          caption: "Caption",
        },
      },
    ]);
  });

  it("drops prototype-pollution keys while preserving normal nested data", () => {
    expect(sanitizeJsonStrings({
      safe: "value",
      constructor: "bad",
      prototype: "bad",
      nested: { "__proto__": "bad", ok: "yes" },
    })).toEqual({
      safe: "value",
      nested: { ok: "yes" },
    });
  });
});

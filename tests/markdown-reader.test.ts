import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownReader } from "@/components/resources/MarkdownReader";

describe("MarkdownReader", () => {
  it("uses visible rich heading text for rendered heading ids", () => {
    const html = renderToStaticMarkup(createElement(MarkdownReader, {
      markdown: "## **Server** [Paths](https://example.com)",
    }));

    expect(html).toContain('id="server-paths"');
    expect(html).toContain('href="#server-paths"');
    expect(html).not.toContain("object-object");
  });
});

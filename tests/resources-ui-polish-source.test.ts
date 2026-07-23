import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("Resources interaction-detail contracts", () => {
  it("uses the shared tactile scale and 40px layout targets across the Guide library", () => {
    const page = source("src/app/(app)/resources/page.tsx");

    expect(page).not.toContain("scale-[0.99]");
    expect(page.match(/active:scale-\[0\.96\]/g)?.length).toBeGreaterThanOrEqual(3);
    expect(page.match(/aria-label="(?:Cards|List)" className="min-h-10 px-3"/g)).toHaveLength(2);
    expect(page).toContain("transition-[background-color,border-color,scale]");
  });

  it("keeps Guide reader navigation and editor commands keyboard-visible and tactile", () => {
    const reader = source("src/app/(app)/resources/[slug]/_components/GuideReader.tsx");

    expect(reader).toContain("transition-[background-color,color,scale]");
    expect(reader).toContain("focus-visible:ring-2 focus-visible:ring-ring");
    expect(reader.match(/className="h-10 shrink-0 active:scale-\[0\.96\] transition-transform"/g)).toHaveLength(2);
    expect(reader).toContain("flex min-h-11 flex-col gap-1");
  });

  it("animates copy-state icons without replaying them on initial render", () => {
    for (const path of [
      "src/components/resources/ServerPathCopy.tsx",
      "src/components/resources/MarkdownReader.tsx",
    ]) {
      const component = source(path);
      expect(component).toContain('<AnimatePresence initial={false} mode="popLayout">');
      expect(component).toContain('initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}');
      expect(component).toContain('transition={{ type: "spring", duration: 0.3, bounce: 0 }}');
    }
  });

  it("extends heading-link hit areas without changing their visible size", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain(".guide-heading-anchor::after");
    expect(css).toContain("inset: -0.5rem;");
    expect(css).toContain(".guide-heading-anchor:active");
    expect(css).toContain("scale: 0.96;");
  });

  it("wraps long inline paths without changing scrollable code blocks", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain(".guide-markdown-inline-code {\n  max-width: 100%;\n  overflow-wrap: anywhere;");
    expect(css).toContain(
      ".guide-markdown-code-block .guide-markdown-inline-code {\n  display: block;\n  background: transparent;\n  border-radius: 0;\n  color: inherit;\n  max-width: none;\n  overflow-wrap: normal;",
    );
  });
});

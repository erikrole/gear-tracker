import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Settings UI polish contracts", () => {
  it("splits overview entrance motion into the intro and staggered group cards", () => {
    const page = source("src/app/(app)/settings/page.tsx");

    expect(page).toContain('<FadeUp key={group} className="h-full" delay={index * 0.08}>');
    expect(page).toContain('<Card className="h-full min-w-0 overflow-hidden">');
    expect(page).not.toContain('<FadeUp>\n      <div className="flex flex-col gap-5">');
  });

  it("uses exact tactile feedback for overview destinations", () => {
    const page = source("src/app/(app)/settings/page.tsx");

    expect(page).toContain("active:scale-[0.96]");
    expect(page).not.toContain("active:scale-[0.99]");
    expect(page).toContain("transition-[background-color,scale]");
  });

  it("keeps search compact on small screens and command results touch sized", () => {
    const command = source("src/app/(app)/settings/SettingsCommand.tsx");

    expect(command).toContain('className="size-10 text-muted-foreground sm:w-auto sm:px-3"');
    expect(command).toContain('<span className="hidden sm:inline">Search settings</span>');
    expect(command).toContain('className="min-h-11 transition-[background-color,color]"');
  });

  it("gives blocked-route recovery an explicit desktop target", () => {
    const layout = source("src/app/(app)/settings/layout.tsx");

    expect(layout).toContain('<Button asChild variant="outline" className="h-10">');
    expect(layout).toContain('<Link href="/settings">Back to Settings</Link>');
  });
});

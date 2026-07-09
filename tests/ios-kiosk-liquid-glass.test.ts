import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS 26 kiosk Liquid Glass hierarchy", () => {
  it("uses native glass for shared interactive controls", () => {
    const components = source("ios/Wisconsin/Kiosk/KioskComponents.swift");

    expect(components).toContain("private struct KioskHeaderButton: View");
    expect(components).toContain("struct KioskCompletionButton: View");
    expect(components).toContain(".buttonStyle(.glass)");
    expect(components).toContain(".buttonStyle(.glassProminent)");
    expect(components).toContain(".tint(Color.kioskRed)");
  });

  it("keeps glass on actions rather than operational content", () => {
    const detail = source("ios/Wisconsin/Kiosk/KioskCheckoutDetailSheet.swift");

    expect(detail).toContain(".buttonStyle(.glass)");
    expect(detail).toContain(".buttonStyle(.glassProminent)");
    expect(detail).not.toContain(".glassEffect(");
    expect(detail).not.toContain(".kioskGlassSurface(");
    expect(detail).toContain('Label("Remove", systemImage: "minus.circle.fill")');
    expect(detail).toContain(".buttonStyle(.bordered)");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS trade board action recovery", () => {
  it("keeps failed claim and cancel actions recoverable in the sheet", () => {
    const sheet = source("ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift");

    expect(sheet).toContain("@State private var actionError: String?");
    expect(sheet).toContain("@State private var actionErrorHaptic = 0");
    expect(sheet).toContain(".safeAreaInset(edge: .top)");
    expect(sheet).toContain("TradeBoardActionErrorBanner(");
    expect(sheet).toContain("Button(\"Refresh\", action: onRefresh)");
    expect(sheet).toContain("Task { await vm.load() }");
    expect(sheet).toContain(".sensoryFeedback(.error, trigger: actionErrorHaptic)");
    expect(sheet).not.toContain(".alert(\"Error\"");
  });
});

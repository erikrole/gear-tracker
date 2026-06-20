import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function sliceBetween(sourceText: string, start: string, end: string) {
  const startIndex = sourceText.indexOf(start);
  const endIndex = sourceText.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return sourceText.slice(startIndex, endIndex);
}

describe("iOS Scan result retry recovery", () => {
  it("wires result-sheet errors to retry the last scanned code", () => {
    const scanView = source("ios/Wisconsin/Views/ScanView.swift");
    const scannerSurface = sliceBetween(
      scanView,
      "private var scannerSurface: some View",
      "private var bottomOverlay: some View",
    );

    expect(scannerSurface).toContain("onRetry: retryLastScan");
    expect(scannerSurface).not.toContain("onRetry: { code in");
  });

  it("clears same-code dedupe before retrying the last failed lookup", () => {
    const scanView = source("ios/Wisconsin/Views/ScanView.swift");
    const retry = sliceBetween(
      scanView,
      "private func retryLastScan()",
      "private func refreshLookup",
    );

    expect(retry).toContain("guard let code = lastHandledCode else { return }");
    expect(retry).toContain("lastHandledCode = nil");
    expect(retry).toContain("lastHandledAt = .distantPast");
    expect(retry).toContain("handleScan(code)");
  });

  it("keeps error recovery in context before falling back to manual entry", () => {
    const scanView = source("ios/Wisconsin/Views/ScanView.swift");
    const resultSheet = sliceBetween(
      scanView,
      "struct ScanResultSheet: View",
      "private var resultRows: some View",
    );
    const tryAgainIndex = resultSheet.indexOf('Label("Try again", systemImage: "arrow.clockwise")');
    const typeCodeIndex = resultSheet.indexOf('Label("Type code instead", systemImage: "keyboard")', tryAgainIndex);

    expect(resultSheet).toContain("var onRetry: () -> Void");
    expect(tryAgainIndex).toBeGreaterThanOrEqual(0);
    expect(typeCodeIndex).toBeGreaterThan(tryAgainIndex);
    expect(resultSheet).toContain(".buttonStyle(.borderedProminent)");
  });
});

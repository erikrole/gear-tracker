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

describe("iOS create booking picker parity", () => {
  it("can scan equipment directly into the native booking picker", () => {
    const createSheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const picker = sliceBetween(
      createSheet,
      "private var equipmentPicker: some View",
      "private var reviewStep: some View",
    );

    expect(createSheet).toContain("@State private var showScanner = false");
    expect(createSheet).toContain("QRScannerSheet { assetId in");
    expect(createSheet).toContain("Task { await vm.addScannedAsset(id: assetId) }");
    expect(createSheet).toContain("func addScannedAsset(id: String) async");
    expect(createSheet).toContain("let detail = try await APIClient.shared.asset(id: id)");
    expect(createSheet).toContain("let asset = detail.asAsset");
    expect(picker).toContain("Label(\"Scan equipment\", systemImage: \"barcode.viewfinder\")");
    expect(picker).toContain("Text(\"Adding scanned item…\")");
  });

  it("treats counted supplies as first-class selected equipment", () => {
    const createSheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const review = sliceBetween(
      createSheet,
      "private var reviewStep: some View",
      "private func reviewFactRow",
    );

    expect(createSheet).toContain("var selectedBulkTotal: Int");
    expect(createSheet).toContain("selectedAssetIds.count + selectedBulkTotal");
    expect(createSheet).toContain("selectedBulkQuantities.values.reduce(0, +)");
    expect(createSheet).toContain("Text(\"Batteries & Counted Items\")");
    expect(createSheet).toContain("BulkQuantityRow(");
    expect(createSheet).toContain("SelectedBulkRow(");
    expect(review).toContain("Text(\"\\(vm.selectedEquipmentCount) item\\(vm.selectedEquipmentCount == 1 ? \"\" : \"s\")\")");
    expect(review).toContain("ForEach(Array(vm.selectedBulkSkus.enumerated()), id: \\.element.id)");
    expect(review).toContain("Text(\"×\\(vm.quantity(for: sku))\")");
  });

  it("submits selected bulk quantities through the shared API client", () => {
    const createSheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");

    expect(createSheet).toContain("bulkItems: selectedBulkRequests");
    expect(createSheet).toContain(".map { BulkReservationRequest(bulkSkuId: $0.key, quantity: $0.value) }");
    expect(apiClient).toContain("struct BulkReservationRequest: Encodable, Equatable");
    expect(apiClient).toContain("bulkItems: [BulkReservationRequest] = []");
    expect(apiClient).toContain("bulkItems: bulkItems");
  });
});

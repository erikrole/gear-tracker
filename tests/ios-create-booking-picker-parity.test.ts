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

  it("lets native reservation creation link upcoming events", () => {
    const createSheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const details = sliceBetween(
      createSheet,
      "private var detailsForm: some View",
      "private var detailHeaderSubtitle",
    );
    const eventCard = sliceBetween(
      createSheet,
      "private struct EventLinkingCard: View",
      "private struct EventPickRow: View",
    );

    expect(createSheet).toContain("var events: [ScheduleEvent] = []");
    expect(createSheet).toContain("var selectedEventIds: [String] = []");
    expect(createSheet).toContain("func loadEvents() async");
    expect(createSheet).toContain("events = try await APIClient.shared.calendarEvents(includePast: false, limit: 60)");
    expect(createSheet).toContain("guard selectedEventIds.count < 3");
    expect(createSheet).toContain("sortSelectedEventIds()");
    expect(createSheet).toContain("applySelectedEventsToDetails()");
    expect(createSheet).toContain("eventIds: selectedEventIds");
    expect(createSheet).toContain("eventId: selectedEventIds.isEmpty ? prefillEventId : nil");
    expect(apiClient).toContain("eventIds: [String] = []");
    expect(apiClient).toContain("let eventIds: [String]?");
    expect(apiClient).toContain("eventIds: eventIds.isEmpty ? nil : eventIds");
    expect(details).toContain("EventLinkingCard(");
    expect(eventCard).toContain("Text(\"Link events\")");
    expect(eventCard).toContain("Text(\"Up to 3 upcoming events\")");
    expect(eventCard).toContain("EventChip(event: event)");
    expect(eventCard).toContain("EventPickRow(");
  });

  it("keeps the native review screen event-aware", () => {
    const createSheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const review = sliceBetween(
      createSheet,
      "private var reviewStep: some View",
      "private func reviewFactRow",
    );

    expect(createSheet).toContain("var linkedEventLabel: String?");
    expect(createSheet).toContain("private struct ReviewEventRow: View");
    expect(createSheet).toContain("private extension ScheduleEvent");
    expect(createSheet).toContain("var shortBookingEventTitle: String");
    expect(createSheet).toContain("var bookingEventSubtitle: String");
    expect(review).toContain("calendar.badge.checkmark");
    expect(review).toContain("reviewFactRow(label: vm.linkedEventCount > 1 ? \"Events\" : \"Event\")");
    expect(review).toContain("Text(vm.selectedEvents.count == 1 ? \"Linked Event\" : \"Linked Events\")");
    expect(review).toContain("ReviewEventRow(event: event)");
  });
});

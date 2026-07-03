import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function createBookingSource() {
  return [
    "ios/Wisconsin/Views/CreateBookingSheet.swift",
    "ios/Wisconsin/Views/CreateBooking/CreateBookingViewModel.swift",
    "ios/Wisconsin/Views/CreateBooking/CreateBookingEventViews.swift",
    "ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentRows.swift",
    "ios/Wisconsin/Views/CreateBooking/CreateBookingFormRows.swift",
    "ios/Wisconsin/Views/CreateBooking/CreateBookingPickers.swift",
    "ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentPicker.swift",
  ].map(source).join("\n");
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
    const createSheet = createBookingSource();
    const sheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");

    expect(createSheet).toContain("@State private var showScanner = false");
    // Continuous scanning: the scanner stays open between hits and both
    // serialized assets and bulk families land in the reservation.
    expect(createSheet).toContain("QRScannerSheet(resolve: { match in");
    expect(createSheet).toContain("case .asset(let assetId):");
    expect(createSheet).toContain("let outcome = await vm.addScannedAsset(id: assetId)");
    expect(createSheet).toContain("case .itemFamily(let family):");
    expect(createSheet).toContain("let outcome = vm.addScannedFamily(family)");
    expect(createSheet).toContain(".continueScanning(message: outcome.message, success: outcome.success)");
    expect(createSheet).toContain("func addScannedAsset(id: String) async");
    expect(createSheet).toContain("let detail = try await APIClient.shared.asset(id: id)");
    expect(createSheet).toContain("let asset = detail.asAsset");
    // Scan is reachable from the equipment step's toolbar.
    expect(sheet).toContain("Image(systemName: \"barcode.viewfinder\")");
    expect(sheet).toContain(".accessibilityLabel(\"Scan equipment\")");
  });

  it("treats counted supplies as first-class selected equipment", () => {
    const createSheet = createBookingSource();
    const sheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const review = sliceBetween(
      sheet,
      "private var reviewStep: some View",
      "private func reviewFactRow",
    );

    expect(createSheet).toContain("var selectedBulkTotal: Int");
    expect(createSheet).toContain("selectedAssetIds.count + selectedBulkTotal");
    expect(createSheet).toContain("selectedBulkQuantities.values.reduce(0, +)");
    expect(createSheet).not.toContain("Batteries & Counted Items");
    expect(createSheet).toContain("BulkQuantityRow(");
    expect(createSheet).toContain("BulkResultRow(");
    expect(review).toContain("Text(\"\\(vm.selectedEquipmentCount) item\\(vm.selectedEquipmentCount == 1 ? \"\" : \"s\")\")");
    expect(review).toContain("ForEach(Array(vm.selectedBulkSkus.enumerated()), id: \\.element.id)");
    expect(review).toContain("Text(\"×\\(vm.quantity(for: sku))\")");
  });

  it("submits selected bulk quantities through the shared API client", () => {
    const createSheet = createBookingSource();
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");

    expect(createSheet).toContain("bulkItems: selectedBulkRequests");
    expect(createSheet).toContain(".map { BulkReservationRequest(bulkSkuId: $0.key, quantity: $0.value) }");
    expect(apiClient).toContain("struct BulkReservationRequest: Encodable, Equatable");
    expect(apiClient).toContain("bulkItems: [BulkReservationRequest] = []");
    expect(apiClient).toContain("bulkItems: bulkItems");
  });

  it("sorts the available equipment picker by the displayed product name", () => {
    const assetsRoute = source("src/app/api/assets/route.ts");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const createSheet = createBookingSource();

    expect(assetsRoute).toMatch(/name:\s*\[\{\s*brand:\s*"asc"\s*\},\s*\{\s*model:\s*"asc"\s*\},\s*\{\s*assetTag:\s*"asc"\s*\}\]/);
    expect(apiClient).toContain("sort: String? = nil");
    expect(apiClient).toContain('items.append(.init(name: "sort", value: sort))');
    // Browse leads with popularity; explicit searches stay alphabetical.
    expect(createSheet).toContain('sort: capturedSearch.isEmpty ? "popular" : "name"');
  });

  it("groups native available equipment by category from a bounded location fetch", () => {
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const createSheet = createBookingSource();
    const picker = source("ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentPicker.swift");
    const loadAvailableAssets = sliceBetween(
      createSheet,
      "func loadAvailableAssets(reset: Bool = false) async",
      "func toggleAsset",
    );

    expect(apiClient).toContain("locationId: String? = nil");
    expect(apiClient).toContain('items.append(.init(name: "location_id", value: locationId))');
    expect(createSheet).toContain("private let assetPickerLimit = 300");
    expect(loadAvailableAssets).toContain("locationId: selectedLocationId.isEmpty ? nil : selectedLocationId");
    expect(loadAvailableAssets).toContain("limit: assetPickerLimit");
    expect(loadAvailableAssets).toContain("offset: 0");
    expect(loadAvailableAssets).toContain("availableAssets = resp.data");
    expect(createSheet).toContain("struct AssetCategoryGroup: Identifiable");
    expect(createSheet).toContain("var availableAssetGroups: [AssetCategoryGroup]");
    expect(createSheet).toContain("return categoryName?.isEmpty == false ? categoryName! : \"Uncategorized\"");
    // The picker renders the displayed groups (popular-first browse, category
    // chips, or grouped search results) as native sections.
    expect(createSheet).toContain("var displayedAssetGroups: [AssetCategoryGroup]");
    expect(picker).toContain("ForEach(vm.displayedAssetGroups) { group in");
    expect(picker).toContain("ForEach(group.assets) { asset in");
    expect(picker).toContain("Section(group.title)");
    expect(picker).toContain("More equipment exists. Search to narrow results.");
    expect(picker).not.toContain("Task { await vm.loadAvailableAssets() }");
  });

  it("keeps attachment categories out of native reservation equipment browsing", () => {
    const createSheet = createBookingSource();

    expect(createSheet).toContain("private func isReservablePickerAsset(_ asset: Asset) -> Bool");
    expect(createSheet).toContain("private func isHiddenAttachmentCategory(_ title: String?) -> Bool");
    expect(createSheet).toContain("availableAssets.filter(isReservablePickerAsset)");
    expect(createSheet).toContain("normalized == \"accessories\"");
    expect(createSheet).toContain("normalized == \"camera accessories\"");
    expect(createSheet).toContain("normalized.hasSuffix(\"/accessories\")");
    expect(createSheet).toContain("if !isHiddenAttachmentCategory(title) { titles.insert(title) }");
    expect(createSheet).toContain("let visibleSkus = availableBulkSkus.filter { !isHiddenAttachmentCategory(bulkCategoryTitle($0)) }");
  });

  it("makes native reservation picker rows match their visible full-row hit targets", () => {
    const pickers = source("ios/Wisconsin/Views/CreateBooking/CreateBookingPickers.swift");

    expect(pickers.match(/\.contentShape\(Rectangle\(\)\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("shows battery/counted-item photos in the native picker", () => {
    const formOptions = source("src/app/api/form-options/route.ts");
    const models = source("ios/Wisconsin/Models/FormModels.swift");
    const createSheet = createBookingSource();
    const bulkRow = createSheet.slice(createSheet.indexOf("struct BulkQuantityRow"));

    expect(formOptions).toContain("imageUrl: true");
    expect(formOptions).toContain("imageUrl: s.imageUrl");
    expect(models).toContain("let imageUrl: String?");
    expect(bulkRow).toContain("BookingBulkThumbnail(imageUrl: sku.imageUrl)");
    expect(createSheet).toContain("AsyncImage(url: url)");
  });

  it("lets native reservation creation link upcoming events", () => {
    const createSheet = createBookingSource();
    const sheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const details = sliceBetween(
      sheet,
      "private var detailsForm: some View",
      "private var detailHeaderSubtitle",
    );
    const eventCard = sliceBetween(
      createSheet,
      "struct EventLinkingCard: View",
      "struct EventPickRow: View",
    );

    expect(createSheet).toContain("var events: [ScheduleEvent] = []");
    expect(createSheet).toContain("var selectedEventIds: [String] = []");
    expect(createSheet).toContain("var prefillEvent: ScheduleEvent?");
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

  it("keeps all-day linked event reservation headers date-only", () => {
    const sheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");

    expect(sheet).toContain("private var selectedAllDayWindowText: String?");
    expect(sheet).toContain("let events = selected.isEmpty ? vm.prefillEvent.map { [$0] } ?? [] : selected");
    expect(sheet).toContain("events.allSatisfy(\\.displayAllDay)");
    expect(sheet).toContain("return \"\\(shortDate(start))-\\(shortDate(end)), All day\"");
    expect(sheet).toContain("if !vm.userEditedWindow, let allDayWindow = selectedAllDayWindowText");
    expect(sheet).toContain("private var reviewPickupText: String");
    expect(sheet).toContain("private var reviewReturnText: String?");
    expect(sheet).toContain("return \"Return after event\"");
    expect(sheet).toContain("Text(reviewPickupText)");
  });

  it("keeps the native review screen event-aware without a separate linked-event card", () => {
    const createSheet = createBookingSource();
    const sheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const review = sliceBetween(
      sheet,
      "private var reviewStep: some View",
      "private func reviewFactRow",
    );

    expect(createSheet).toContain("var linkedEventLabel: String?");
    expect(createSheet).toContain("extension ScheduleEvent");
    expect(createSheet).toContain("var shortBookingEventTitle: String");
    expect(createSheet).toContain("var bookingEventSubtitle: String");
    expect(createSheet).not.toContain("struct ReviewEventRow: View");
    expect(review).toContain("calendar.badge.checkmark");
    expect(review).toContain("reviewFactRow(label: vm.linkedEventCount > 1 ? \"Events\" : \"Event\")");
    expect(review).toContain("Label(linked, systemImage: \"calendar.badge.checkmark\")");
    expect(review).not.toContain("Linked Event");
    expect(review).not.toContain("ReviewEventRow(event: event)");
  });

  it("uses showtime-ready event titles, pickup copy, and thumbnail-led review rows", () => {
    const createSheet = createBookingSource();
    const sheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");
    const viewModel = source("ios/Wisconsin/Views/CreateBooking/CreateBookingViewModel.swift");
    const formRows = source("ios/Wisconsin/Views/CreateBooking/CreateBookingFormRows.swift");
    const equipmentRows = source("ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentRows.swift");
    const review = sliceBetween(
      sheet,
      "private var reviewStep: some View",
      "private func reviewFactRow",
    );

    expect(formRows).toContain("return \"\\(code) \\(prefix) \\(opponent)\"");
    expect(formRows).toContain("let prefix = isHome == false ? \"at\" : \"vs\"");
    expect(formRows).not.toContain("sportLabel(sportCode)");
    expect(formRows).not.toContain("(Neutral)");
    expect(viewModel).toContain("title = first.shortBookingEventTitle");
    expect(viewModel).not.toContain("title = \"Gear - \\(first.summary)\"");
    expect(viewModel).not.toContain("first.location?.id");
    expect(sheet).toContain("title: \"Pickup location\"");
    expect(sheet).toContain("label: \"Pickup\"");
    expect(sheet).toContain("Select pickup");
    expect(review).toContain("Text(\"Pickup\")");
    expect(review).toContain("Text(reviewPickupText)");
    expect(review).toContain("if let reviewReturnText");
    expect(sheet).toContain("return \"Return \\(vm.endsAt.formatted(date: .abbreviated, time: .shortened))\"");
    expect(review).toContain("BookingAssetThumbnail(imageUrl: asset.imageUrl, size: 40, cornerRadius: 8)");
    expect(review).toContain("BookingBulkThumbnail(imageUrl: sku.imageUrl, size: 40, cornerRadius: 8)");
    expect(equipmentRows).toContain("struct BookingAssetThumbnail");
    expect(equipmentRows).toContain("struct BookingBulkThumbnail");
    expect(createSheet).not.toContain("Ends ");
  });
});

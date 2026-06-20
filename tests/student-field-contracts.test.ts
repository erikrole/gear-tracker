import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function createBookingSource() {
  return [
    "ios/Wisconsin/Views/CreateBookingSheet.swift",
    "ios/Wisconsin/Views/CreateBooking/CreateBookingViewModel.swift",
    "ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentRows.swift",
  ].map(source).join("\n");
}

describe("student field mobile contracts", () => {
  it("keeps iOS active checkouts scoped to open and pending-pickup work", () => {
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");

    expect(apiClient).toContain("statusList: activeOnly ? [.open, .pendingPickup] : nil");
    expect(apiClient).toContain(".init(name: \"status_in\", value: statusList.map(\\.rawValue).joined(separator: \",\"))");
  });

  it("keeps iOS booking edits on the optimistic-lock contract", () => {
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const models = source("ios/Wisconsin/Models/Models.swift");
    const detail = source("ios/Wisconsin/Views/BookingDetailView.swift");

    expect(models).toContain("let updatedAt: Date?");
    expect(apiClient).toContain("updatedAt: Date? = nil");
    expect(apiClient).toContain("forHTTPHeaderField: \"If-Unmodified-Since\"");
    expect(apiClient).toContain("httpDateString(updatedAt)");
    expect(detail).toContain("updatedAt: booking.updatedAt");
  });

  it("keeps iOS booking tabs and toolbar buttons field-readable", () => {
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift");
    const bookingsView = source("ios/Wisconsin/Views/BookingsView.swift");

    expect(appTab).toContain("isStaffOrAdmin ? \"Bookings\" : \"My Gear\"");
    expect(appTab).toContain("if isStaffOrAdmin");
    expect(bookingsView).toContain("mineOnly = currentUserRole == \"STUDENT\"");
    expect(bookingsView).toContain("vm.tab == .reservations ? \"No Reservations\" : \"No Checkouts\"");
    expect(bookingsView).toContain("Label(vm.mineOnly ? \"Mine\" : \"All\"");
    expect(bookingsView).toContain("Label(\"New\", systemImage: \"plus\")");
    expect(bookingsView).toContain("Picker(\"Booking type\"");
  });

  it("keeps iOS Schedule controls self-describing", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(scheduleView).toContain("scheduleControlStrip");
    expect(scheduleView).toContain("Picker(\"Schedule view\"");
    expect(scheduleView).toContain("\"My shifts\"");
    expect(scheduleView).toContain("FilterChip(");
    expect(scheduleView).toContain("\"Past events\"");
    expect(scheduleView).toContain("Label(\"Trades\", systemImage: \"arrow.left.arrow.right\")");
    expect(scheduleView).toContain("Label(\"Calendar\", systemImage: isSubscribing ? \"calendar\" : \"calendar.badge.plus\")");
    expect(scheduleView).not.toContain("Switch to calendar view");
    expect(scheduleView).not.toContain("Switch to list view");
  });

  it("keeps iOS Schedule detail and trade actions self-describing", () => {
    const eventDetail = source("ios/Wisconsin/Views/EventDetailSheet.swift");
    const tradeBoard = source("ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift");
    const postTrade = source("ios/Wisconsin/Views/Schedule/PostTradeSheet.swift");

    expect(eventDetail).toContain("Label(\"Add shift\", systemImage: \"plus.circle\")");
    expect(eventDetail).toContain("Label(\"Assign person\", systemImage: \"plus.circle.fill\")");
    expect(eventDetail).toContain("Label(\"Request shift\", systemImage: \"hand.raised.fill\")");
    expect(eventDetail).toContain("Button(\"Approve \\(assignment.user.name)\")");
    expect(eventDetail).toContain("Button(\"Decline \\(assignment.user.name)\")");
    expect(tradeBoard).toContain("Label(\"Post trade\", systemImage: \"plus\")");
    expect(tradeBoard).toContain("Text(\"\\(shift.area.shiftAreaLabel) shift\")");
    expect(tradeBoard).toContain("Text(\"Claim this shift\")");
    expect(postTrade).toContain("Section(\"Choose Shift to Trade\")");
    expect(postTrade).toContain("Text(\"Post Trade\").fontWeight(.semibold)");
  });

  it("keeps iOS Items controls self-describing", () => {
    const itemsView = source("ios/Wisconsin/Views/ItemsView.swift");

    expect(itemsView).toContain("itemsControlStrip");
    expect(itemsView).toContain("Label(\"Favorites\"");
    expect(itemsView).toContain("AssetStatusFilterMenu(selected: $vm.selectedStatuses)");
    expect(itemsView).toContain("selected.isEmpty ? \"All statuses\" : \"\\(selected.count) statuses\"");
    expect(itemsView).not.toContain("ToolbarItem(placement: .topBarTrailing)");
    expect(itemsView).not.toContain("Showing favorites");
    expect(itemsView).not.toContain("Show favorites");
  });

  it("keeps iOS Booking Detail edit state self-describing", () => {
    const detail = source("ios/Wisconsin/Views/BookingDetailView.swift");

    expect(detail).toContain("Label(\"Edit\", systemImage: \"pencil\")");
    expect(detail).toContain("BookingEditLockedNotice");
    expect(detail).toContain("Text(\"Editing locked\")");
    expect(detail).toContain("Use Extend Return Date");
    expect(detail).toContain("pickup and return stay at a kiosk");
    expect(detail).toContain("if canActOnBooking && !canEditBooking");
    expect(detail).not.toContain("Image(systemName: \"pencil\")");
  });

  it("keeps iOS Profile controls self-describing", () => {
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");
    const notifications = source("ios/Wisconsin/Views/NotificationSettingsView.swift");
    const availability = source("ios/Wisconsin/Views/AvailabilityView.swift");

    expect(notifications).toContain("Text(\"Pause alerts\")");
    expect(notifications).toContain("Text(\"Pause \\(label)\")");
    expect(notifications).toContain("title: \"Email alerts\"");
    expect(notifications).toContain("title: \"Push alerts\"");
    expect(notifications).toContain("title: \"Delivery status\"");
    expect(profile).toContain("title: \"Theme\"");
    expect(profile).toContain("title: \"My Availability\"");
    expect(availability).toContain("Label(\"Add availability block\", systemImage: \"plus\")");
    expect(availability).toContain("Label(\"Add block\", systemImage: \"plus\")");
  });

  it("keeps iOS Create Booking actions and selected equipment recoverable", () => {
    const createSheet = createBookingSource();

    expect(createSheet).toContain("selectedAssetSnapshots: [String: Asset]");
    expect(createSheet).toContain("selectedBulkQuantities: [String: Int]");
    expect(createSheet).toContain("var selectedAssets: [Asset]");
    expect(createSheet).toContain("var selectedEquipmentCount: Int");
    expect(createSheet).toContain("var selectedBulkRequests: [BulkReservationRequest]");
    // Three-step flow mirroring web: Equipment requires a selection before
    // Review, and the Confirm step owns the single primary action.
    expect(createSheet).toContain("Button(\"Review\") { step = 3 }");
    expect(createSheet).toContain(".disabled(vm.selectedEquipmentCount == 0 || vm.isSubmitting)");
    expect(createSheet).toContain("Text(\"Reserve for later\")");
    expect(createSheet).toContain("Text(vm.title.isEmpty ? \"Review your reservation\" : vm.title)");
    expect(createSheet).toContain("Text(\"Selected Equipment\")");
    expect(createSheet).toContain("Text(\"Equipment\")");
    expect(createSheet).not.toContain("Batteries & Counted Items");
    expect(createSheet).toContain("Label(\"Scan equipment\", systemImage: \"barcode.viewfinder\")");
    expect(createSheet).toContain("SelectedEquipmentRow");
    expect(createSheet).toContain("SelectedBulkRow");
    expect(createSheet).toContain("BulkQuantityRow");
    expect(createSheet).toContain("BookingAssetThumbnail");
    expect(createSheet).toContain("BookingBulkThumbnail");
    expect(createSheet).toContain("Label(\"Remove\", systemImage: \"xmark.circle.fill\")");
    expect(createSheet).toContain("Remove anything you do not want before creating the reservation.");
    expect(createSheet).toContain("func removeSelectedAsset(_ asset: Asset)");
    expect(createSheet).toContain("func removeSelectedBulk(_ sku: FormBulkSku)");
  });

  it("keeps my-shifts gear context aligned with dashboard event work", () => {
    const route = source("src/app/api/my-shifts/route.ts");

    expect(route).toContain("\"PENDING_PICKUP\"");
    expect(route).toContain("if (status === \"PENDING_PICKUP\") return \"pickup_ready\"");
    expect(route).toContain("{ events: { some: { eventId: { in: eventIds } } } }");
    expect(route).toContain("{ shiftAssignmentId: { in: assignmentIds } }");
    expect(route).toContain("{ shiftAssignment: { shift: { shiftGroup: { eventId: { in: eventIds } } } } }");
  });

  it("returns real dashboard event-work all-day state instead of a hardcoded value", () => {
    const route = source("src/app/api/dashboard/route.ts");

    expect(route).toContain("allDay: true");
    expect(route).toContain("allDay: ev.allDay");
    expect(route).not.toContain("allDay: false");
  });
});

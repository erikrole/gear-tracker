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

  it("keeps iOS Home on the lean dashboard payload", () => {
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const route = source("src/app/api/dashboard/route.ts");

    expect(apiClient).toContain(".init(name: \"scope\", value: \"ios-home\")");
    expect(route).toContain("const isIosHomeScope = scope === \"ios-home\"");
    expect(route).toContain("isIosHomeScope");
    expect(route).toContain("? Promise.resolve([])");
    expect(route).toContain("db.calendarEvent.findMany");
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

  it("keeps iOS bookings unified and toolbar buttons field-readable", () => {
    const appTab = source("ios/Wisconsin/Views/AppTabView.swift");
    const bookingsView = source("ios/Wisconsin/Views/BookingsView.swift");

    expect(appTab).toContain("isStaffOrAdmin ? \"Bookings\" : \"My Gear\"");
    expect(appTab).toContain('Tab("Browse", systemImage: "square.grid.2x2", value: 2)');
    expect(appTab).toContain('Tab("Users", systemImage: "person.2", value: 5)');
    expect(appTab).not.toMatch(/if isStaffOrAdmin \{[\s\S]*?Tab\("Users"/);
    expect(bookingsView).toContain("mineOnly = currentUserRole == \"STUDENT\"");
    expect(bookingsView).toContain('BookingListSection(title: "Checkouts"');
    expect(bookingsView).toContain('BookingListSection(title: "Reservations"');
    expect(bookingsView).toContain('"Search bookings..."');
    expect(bookingsView).toContain("APIClient.shared.checkouts(");
    expect(bookingsView).toContain("APIClient.shared.reservations(");
    expect(bookingsView.match(/activeOnly: true/g)?.length).toBeGreaterThanOrEqual(2);
    expect(bookingsView).toContain("Label(vm.mineOnly ? \"Mine\" : \"All\"");
    expect(bookingsView).toContain("Label(\"New\", systemImage: \"plus\")");
    expect(bookingsView).not.toContain("Picker(\"Booking type\"");
    expect(bookingsView).not.toContain("enum BookingTab");
  });

  it("keeps iOS Schedule controls self-describing", () => {
    const scheduleView = source("ios/Wisconsin/Views/ScheduleView.swift");

    expect(scheduleView).toContain("scheduleControlStrip");
    expect(scheduleView).toContain("Picker(\"Schedule view\"");
    expect(scheduleView).toContain("@State private var showFilters = false");
    expect(scheduleView).toContain("activeFilterSummary");
    expect(scheduleView).toContain("private struct ScheduleFilterSheet");
    expect(scheduleView).toContain("\"My shifts\"");
    expect(scheduleView).toContain("\"Past events\"");
    expect(scheduleView).toContain("Picker(\"Venue\"");
    expect(scheduleView).toContain("Picker(\"Sport\"");
    expect(scheduleView).toContain("Image(systemName: \"arrow.left.arrow.right\")");
    expect(scheduleView).toContain("Image(systemName: isSubscribing ? \"calendar\" : \"calendar.badge.plus\")");
    expect(scheduleView).toContain("accessibilityLabel(activeFilterCount > 0 ? \"Filters, \\(activeFilterCount) active\" : \"Filters\")");
    expect(scheduleView).toContain("accessibilityLabel(\"Subscribe to shifts in Calendar\")");
    expect(scheduleView).not.toContain("Switch to calendar view");
    expect(scheduleView).not.toContain("Switch to list view");
  });

  it("keeps iOS Schedule detail and trade actions self-describing", () => {
    const eventDetail = source("ios/Wisconsin/Views/EventDetailSheet.swift");
    const tradeBoard = source("ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift");
    const postTrade = source("ios/Wisconsin/Views/Schedule/PostTradeSheet.swift");

    expect(eventDetail).toContain("Label(\"Add shift\", systemImage: \"plus\")");
    expect(eventDetail).toContain("Label(\"Assign person\", systemImage: \"plus.circle.fill\")");
    expect(eventDetail).toContain("Label(\"Request shift\", systemImage: \"hand.raised.fill\")");
    expect(eventDetail).toContain("Button(\"Approve \\(assignment.user.name)\")");
    expect(eventDetail).toContain("Button(\"Decline \\(assignment.user.name)\")");
    expect(eventDetail).toContain("Text(\"Event\")");
    expect(eventDetail).toContain("title: \"Reserve gear now\"");
    expect(eventDetail).not.toContain("ToolbarItem(placement: .bottomBar)");
    expect(eventDetail).not.toContain("Label(\"Prep gear\", systemImage: \"archivebox\")");
    expect(tradeBoard).toContain("Label(\"Post trade\", systemImage: \"plus\")");
    expect(tradeBoard).toContain(".navigationTitle(\"Open Work\")");
    expect(tradeBoard).toContain("APIClient.shared.scheduleOpenWork()");
    expect(tradeBoard).toContain("Staff Review");
    expect(tradeBoard).toContain("Available Now");
    expect(tradeBoard).toContain("Approval Required");
    expect(tradeBoard).toContain("My Posts");
    expect(tradeBoard).toContain("Waiting or Blocked");
    expect(tradeBoard).toContain("item.action == \"request\" ? \"Request shift\" : \"Claim shift\"");
    expect(tradeBoard).toContain("context == .staffReview ? \"Review\" : \"Claim this shift\"");
    expect(tradeBoard).toContain("Text(\"Review request\")");
    expect(tradeBoard).toContain("Text(\"Cancel post\")");
    expect(tradeBoard).toContain("Canceling removes the post; the shift stays assigned to you.");
    expect(tradeBoard).toContain("You will be assigned immediately.");
    expect(postTrade).toContain("Section(\"Choose Shift to Trade\")");
    expect(postTrade).toContain("Text(\"Post Trade\").fontWeight(.semibold)");
  });

  it("keeps iOS Items controls self-describing", () => {
    const itemsView = source("ios/Wisconsin/Views/ItemsView.swift");

    expect(itemsView).toContain(".searchable(text: $vm.searchText, prompt: \"Search tag, model, serial, location\")");
    expect(itemsView).toContain("ToolbarItemGroup(placement: .topBarTrailing)");
    expect(itemsView).toContain("Label(\"Favorites\", systemImage: vm.favoritesOnly ? \"star.fill\" : \"star\")");
    expect(itemsView).toContain("AssetStatusFilterMenu(selected: $vm.selectedStatuses)");
    expect(itemsView).toContain("ItemSortMenu(selected: $vm.sortOption)");
    expect(itemsView).toContain("selected.isEmpty ? \"All statuses\" : \"\\(selected.count) statuses\"");
    expect(itemsView).not.toContain("itemsControlStrip");
    expect(itemsView).not.toContain("ItemControlPill(");
    expect(itemsView).not.toContain("Showing favorites");
    expect(itemsView).not.toContain("Show favorites");
  });

  it("keeps iOS Booking Detail edit state self-describing", () => {
    const detail = source("ios/Wisconsin/Views/BookingDetailView.swift");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const extendSheet = source("ios/Wisconsin/Views/ExtendBookingSheet.swift");

    expect(detail).toContain("BookingDetailsSection(");
    expect(detail).toContain("Label(\"Edit Details\", systemImage: \"pencil\")");
    expect(detail).toContain(".accessibilityLabel(\"Edit booking details\")");
    expect(detail).toContain(".navigationTitle(\"Edit Details\")");
    expect(detail).toContain("Text(\"Equipment changes, pickup, and return stay in kiosk workflows. This sheet edits booking details only.\")");
    expect(detail).toContain("booking.kind == .reservation");
    expect(detail).toContain("OptionPickerView(");
    expect(detail).toContain("title: \"Pickup Location\"");
    expect(detail).toContain("locationId: canEditLocation && locationId != booking.location.id ? locationId : nil");
    expect(apiClient).toContain("locationId: String? = nil");
    expect(apiClient).toContain("let locationId: String?");
    expect(apiClient).toContain("locationId: locationId");
    expect(detail).toContain("TextEditor(text: $notes)");
    expect(detail).toContain("accessibilityLabel(\"Booking notes\")");
    expect(detail).toContain("notes.trimmingCharacters(in: .whitespacesAndNewlines)");
    expect(detail).not.toContain("notes.isEmpty ? nil : notes");
    expect(detail).toContain("Equipment is read-only in this detail view. Kiosk pickup verifies the physical handoff.");
    expect(detail).toContain("BookingEditLockedNotice");
    expect(detail).toContain("Text(\"Editing locked\")");
    expect(detail).toContain("Use Extend Return Date");
    expect(detail).toContain("pickup and return stay at a kiosk");
    expect(detail).toContain("if canActOnBooking && !canEditBooking");
    expect(detail).toContain("if isSaving { return }");
    expect(detail).toContain("if isActioning { return }");
    expect(extendSheet).toContain("if isLoading { return }");
    expect(detail).not.toContain("Image(systemName: \"pencil\")");
  });

  it("keeps iOS Profile controls self-describing", () => {
    const profile = source("ios/Wisconsin/Views/ProfileView.swift");
    const notifications = source("ios/Wisconsin/Views/NotificationSettingsView.swift");
    const availability = source("ios/Wisconsin/Views/AvailabilityView.swift");
    const models = source("ios/Wisconsin/Models/Models.swift");
    const scheduleModels = source("ios/Wisconsin/Models/ScheduleModels.swift");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    const meRoute = source("src/app/api/me/route.ts");
    const auth = source("src/lib/auth.ts");
    const userPage = source("src/app/(app)/users/[id]/page.tsx");
    const availabilityRoute = source("src/app/api/users/[id]/availability/route.ts");

    expect(notifications).toContain("Text(\"Pause alerts\")");
    expect(notifications).toContain("Text(\"Pause \\(label)\")");
    expect(notifications).toContain("title: \"Email alerts\"");
    expect(notifications).toContain("title: \"Push alerts\"");
    expect(notifications).toContain("title: \"Delivery status\"");
    expect(profile).toContain("title: \"Theme\"");
    expect(profile).toContain("title: \"My Availability\"");
    expect(profile).toContain("private var isStudentWorker: Bool");
    expect(profile).toContain("session.currentUser?.staffingType == \"ST\"");
    expect(models).toContain("let staffingType: String?");
    expect(auth).toContain("staffingType: session.user.staffingType");
    expect(meRoute).toContain("return ok({");
    expect(userPage).toContain("profile.staffingType === \"ST\"");
    expect(availabilityRoute).toContain("target.staffingType !== \"ST\"");
    expect(scheduleModels).toContain("let intent: String?");
    expect(scheduleModels).toContain("let status: String?");
    expect(scheduleModels).toContain("let date: String?");
    expect(scheduleModels).toContain("let reviewNote: String?");
    expect(availability).toContain("AvailabilityEditorIntent");
    expect(availability).toContain("case prefer = \"PREFER\"");
    expect(availability).toContain("case dislike = \"DISLIKE\"");
    expect(availability).toContain("case timeOff = \"TIME_OFF\"");
    expect(availability).toContain("AvailabilityEditorKind");
    expect(availability).toContain("case adHoc = \"AD_HOC\"");
    expect(availability).toContain("Blocking time off");
    expect(availability).toContain("Advisory signals");
    expect(availability).toContain("Preferred windows");
    expect(availability).toContain("One-time requests and exceptions");
    expect(availability).toContain("Pending staff review");
    expect(availability).toContain("Label(\"Add availability block\", systemImage: \"plus\")");
    expect(availability).toContain("Label(\"Add block\", systemImage: \"plus\")");
    expect(apiClient).toContain("kind: String = \"WEEKLY\"");
    expect(apiClient).toContain("intent: String = \"CANNOT_WORK\"");
    expect(apiClient).toContain("date: String? = nil");
    expect(apiClient).toContain("kind: kind");
    expect(apiClient).toContain("intent: intent");
    expect(apiClient).toContain("date: kind == \"AD_HOC\" ? date : nil");
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

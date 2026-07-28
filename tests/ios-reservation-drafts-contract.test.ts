import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const store = readFileSync("ios/Wisconsin/Core/ReservationDraftStore.swift", "utf8");
const sheet = readFileSync("ios/Wisconsin/Views/CreateBookingSheet.swift", "utf8");
const composer = readFileSync("ios/Wisconsin/Views/CreateBooking/CreateBookingViewModel.swift", "utf8");
const shell = readFileSync("ios/Wisconsin/Views/AppTabView.swift", "utf8");
const card = readFileSync("ios/Wisconsin/Views/Components/ReservationDraftCard.swift", "utf8");
const api = readFileSync("ios/Wisconsin/Core/APIClient.swift", "utf8");
const app = readFileSync("ios/Wisconsin/App/WisconsinApp.swift", "utf8");

const CALL_SITES = [
  "ios/Wisconsin/Views/BookingsView.swift",
  "ios/Wisconsin/Views/ItemsView.swift",
  "ios/Wisconsin/Views/ItemDetailView.swift",
  "ios/Wisconsin/Views/EventDetailSheet.swift",
  "ios/Wisconsin/Views/DevTools/ScannerDebuggerView.swift",
];

describe("iOS reservation drafts use the shared server contract", () => {
  it("talks to /api/drafts rather than persisting locally", () => {
    expect(api).toContain('func bookingDrafts() async throws -> [BookingDraftSummary]');
    expect(api).toContain('func bookingDraft(id: String) async throws -> BookingDraftDetail');
    expect(api).toContain("func saveBookingDraft(");
    expect(api).toContain('request(path: "/api/drafts", method: "POST")');
    expect(api).toContain('request(path: "/api/drafts/\\(id)", method: "DELETE")');
    // The route only accepts RESERVATION or CHECKOUT; iOS composes reservations.
    expect(api).toContain('kind: "RESERVATION"');
  });

  it("re-uses an existing draft row instead of piling up new ones", () => {
    expect(composer).toContain("var serverDraftId: String?");
    expect(composer).toContain("id: serverDraftId,");
    expect(composer).toContain("markDraftSaved(id: id)");
  });

  it("removes the draft once the reservation itself exists", () => {
    expect(composer).toContain("if let draftId = serverDraftId {");
    expect(composer).toContain("try? await APIClient.shared.deleteBookingDraft(id: draftId)");
  });
});

describe("iOS reservation composer survives leaving the sheet", () => {
  it("keeps the composer in the store, not in sheet state", () => {
    expect(store).toContain("private(set) var composer: CreateBookingViewModel?");
    expect(store).toContain("var step = 1");
    expect(sheet).toContain("@Environment(ReservationDraftStore.self) private var drafts");
    expect(sheet).toContain("private var step: Int { drafts.step }");
    expect(sheet).not.toContain("@State private var vm");
    expect(sheet).not.toContain("@State private var step");
  });

  it("treats swipe-down as minimize and never blocks it", () => {
    expect(sheet).toContain(".interactiveDismissDisabled(vm.isSubmitting)");
    expect(shell).toContain("set: { if !$0 { drafts.minimize() } }");
    expect(store).toContain("func minimize() {");
  });

  it("offers a visible minimize control alongside the gesture", () => {
    expect(sheet).toContain('drafts.minimize()');
    expect(sheet).toContain('Image(systemName: "chevron.down")');
    expect(sheet).toContain('.accessibilityLabel("Minimize reservation")');
  });

  it("exits through a keep-or-discard choice instead of discard-only", () => {
    expect(sheet).toContain('"Save this reservation as a draft?"');
    expect(sheet).toContain('Button("Save Draft")');
    expect(sheet).toContain('Button("Discard", role: .destructive)');
    expect(sheet).toContain('Button("Keep Editing", role: .cancel)');
    expect(sheet).not.toContain('"Discard reservation?"');
  });

  it("only prompts when there is work worth keeping", () => {
    expect(sheet).toContain("if vm.hasUnsavedInput && vm.isWorthSavingAsDraft {");
    expect(composer).toContain("var isWorthSavingAsDraft: Bool");
    expect(composer).toContain("func captureBaselineIfNeeded()");
  });
});

describe("iOS reservation draft card", () => {
  it("hangs off the tab shell so it outlives any one screen", () => {
    expect(shell).toContain(".tabViewBottomAccessory {");
    expect(shell).toContain("if drafts.showsCard {");
    expect(shell).toContain("ReservationDraftCard(");
    expect(card).toContain("@Environment(\\.tabViewBottomAccessoryPlacement) private var placement");
  });

  it("routes the card's close control back through the same choice", () => {
    expect(shell).toContain("onClose: { showDraftCloseOptions = true }");
    expect(shell).toContain('Button("Save Draft") { Task { await drafts.saveAndClose() } }');
    expect(shell).toContain('Button("Discard", role: .destructive) { Task { await drafts.discard() } }');
  });

  it("restores the newest saved reservation draft as a resume target", () => {
    expect(store).toContain("func loadSavedDraft() async {");
    expect(store).toContain("first(where: { $0.isReservation })");
    expect(shell).toContain("await drafts.loadSavedDraft()");
  });

  it("persists on backgrounding and clears on sign-out", () => {
    expect(app).toContain("Task { await drafts.autosave() }");
    expect(app).toContain("drafts.clearForSignOut()");
    expect(store).toContain("func autosave() async {");
  });
});

describe("iOS reservation entry points hand off to the store", () => {
  it("no longer presents the sheet per call site", () => {
    for (const path of CALL_SITES) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toContain("CreateBookingSheet(");
      expect(source, path).toContain("drafts.start(");
    }
  });

  it("routes creation centrally because the composer outlives its origin", () => {
    expect(store).toContain("func finish(bookingId: String) {");
    expect(shell).toContain("appState.pendingBookingDetailId = bookingId");
    const bookings = readFileSync("ios/Wisconsin/Views/BookingsView.swift", "utf8");
    expect(bookings).toContain("private func consumePendingBookingDetail() {");
    expect(bookings).toContain("navigationPath.append(bookingId)");
  });

  it("arbitrates a second reservation instead of dropping either one", () => {
    expect(store).toContain("private(set) var pendingStart: PendingStart?");
    expect(shell).toContain('Button("Save Draft & Start New")');
    expect(shell).toContain('Button("Discard & Start New", role: .destructive)');
  });
});

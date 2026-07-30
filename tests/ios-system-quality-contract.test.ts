import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativeFile: string) =>
  readFileSync(path.join(process.cwd(), relativeFile), "utf8");

describe("iOS system quality contracts", () => {
  it("parses guide Markdown once per article and gives blocks stable source identities", () => {
    const guides = source("ios/Wisconsin/Views/GuidesView.swift");

    expect(guides).toContain("private let blocks: [MarkdownBlock]");
    expect(guides).toContain("init(markdown: String)");
    expect(guides).toContain("struct ID: Hashable");
    expect(guides).toContain("let sourcePosition: Int");
    expect(guides).toContain("let kind: Kind");
    expect(guides).toContain("return blocks.enumerated().map { sourcePosition, block in");
    expect(guides).not.toContain("let id = UUID()");
    expect(guides).not.toContain("private var blocks: [MarkdownBlock]");
  });

  it("keeps the scanner inspector interactive only in debug builds", () => {
    const identity = source("ios/Wisconsin/Kiosk/KioskIdentityView.swift");

    expect(identity).toContain("#if DEBUG");
    expect(identity).toContain("Button { showInspector = true } label: { scannerStatusLabel }");
    expect(identity).toContain(".sheet(isPresented: $showInspector) { KioskFlowInspector() }");
    expect(identity).toContain("#else");
    expect(identity).toContain('accessibilityLabel("Scanner status: \\(store.scanner.statusText)")');
  });

  it("gives the identity roster complete loading, error, empty, and search states", () => {
    const identity = source("ios/Wisconsin/Kiosk/KioskIdentityView.swift");

    expect(identity).toContain('ProgressView("Loading roster")');
    expect(identity).toContain('Label("Couldn’t load the roster", systemImage: "wifi.exclamationmark")');
    expect(identity).toContain('Button("Retry") { Task { await loadRoster() } }');
    expect(identity).toContain('Label("No people available", systemImage: "person.2.slash")');
    expect(identity).toContain('Label("No matching people", systemImage: "magnifyingglass")');
    expect(identity).toContain('Button("Clear Search")');
    expect(identity).toContain(".accessibilityLabel(user.name)");
    expect(identity).toContain('.accessibilityHint("Select \\(user.name)")');
  });

  it("lets only the latest identity scan route the kiosk", () => {
    const identity = source("ios/Wisconsin/Kiosk/KioskIdentityView.swift");
    const identify = identity.slice(
      identity.indexOf("private func identify"),
      identity.indexOf("private func cancelIdentityFlow"),
    );
    const ownership = identity.slice(
      identity.indexOf("private func ownsIdentityRequest"),
      identity.indexOf("private func finishIdentityRequest"),
    );
    const cancellation = identity.slice(
      identity.indexOf("private func cancelIdentityRequest"),
      identity.indexOf("\n    }\n}", identity.indexOf("private func cancelIdentityRequest")),
    );

    expect(identity).toContain("@State private var identifyTask: Task<Void, Never>?");
    expect(identity).toContain("@State private var identifyRequests = LatestRequestGeneration()");
    expect(identify).toContain("let requestToken = identifyRequests.begin()");
    expect(identify).toContain("try Task.checkCancellation()");
    expect(identify.match(/guard ownsIdentityRequest\(requestToken\) else \{ return \}/g)).toHaveLength(3);
    expect(ownership).toContain("identifyRequests.owns(requestToken)");
    expect(ownership).toContain("store.scanner.owner == .identity");
    expect(ownership).toContain("case .identity = store.screen");
    expect(cancellation).toContain("identifyTask?.cancel()");
    expect(cancellation).toContain("identifyRequests.invalidate()");
  });

  it("cancels identity work and scanner ownership before Cancel leaves the screen", () => {
    const identity = source("ios/Wisconsin/Kiosk/KioskIdentityView.swift");
    const cancelFlow = identity.slice(
      identity.indexOf("private func cancelIdentityFlow"),
      identity.indexOf("private func choose"),
    );

    expect(identity).toContain('Button("Cancel") { cancelIdentityFlow() }');
    expect(cancelFlow).toContain("cancelIdentityRequest()");
    expect(cancelFlow).toContain("store.scanner.release(.identity)");
    expect(cancelFlow).toContain("store.screen = .idle");
    expect(cancelFlow.indexOf("cancelIdentityRequest()")).toBeLessThan(
      cancelFlow.indexOf("store.screen = .idle"),
    );
    expect(cancelFlow.indexOf("store.scanner.release(.identity)")).toBeLessThan(
      cancelFlow.indexOf("store.screen = .idle"),
    );
  });

  it("makes the full sleep surface a wake button and honors Reduce Motion", () => {
    const sleep = source("ios/Wisconsin/Kiosk/KioskSleepModeView.swift");

    expect(sleep).toContain("@Environment(\\.accessibilityReduceMotion) private var reduceMotion");
    expect(sleep).toContain("Button(action: onWake)");
    expect(sleep).toContain(".frame(maxWidth: .infinity, maxHeight: .infinity)");
    expect(sleep).toContain(".offset(reduceMotion ? .zero : pixelShiftOffset(for: context.date))");
    expect(sleep).toContain('.accessibilityHint("Wake the kiosk")');
    expect(sleep).not.toContain(".onTapGesture { onWake() }");
  });

  it("resets kiosk timers without republishing unchanged visible state on every touch", () => {
    const store = source("ios/Wisconsin/Kiosk/KioskStore.swift");
    const reset = store.slice(
      store.indexOf("func resetInactivity()"),
      store.indexOf("func dismissInactivityWarning()"),
    );

    expect(reset).toContain("if isDeviceIdle {");
    expect(reset).toContain("if inactivityWarningVisible {");
    expect(reset).toContain("if self.inactivityWarningVisible {");
  });

  it("routes dense native equipment and search thumbnails through the bounded downsampler", () => {
    const equipment = source(
      "ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentRows.swift",
    );
    const search = source("ios/Wisconsin/Views/Search/SearchResultRow.swift");

    expect(equipment.match(/CachedThumbnail\(url: url, size: size\)/g)).toHaveLength(2);
    expect(equipment).not.toContain("AsyncImage");
    expect(search).toContain("CachedThumbnail(url: url, size: size)");
    expect(search).not.toContain("AsyncImage");
  });
});

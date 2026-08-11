import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("GearOps macOS menu bar contracts", () => {
  it("stays a separate menu-only macOS target", () => {
    const project = source("macos/project.yml");
    const app = source("macos/GearOps/GearOpsApp.swift");
    const plist = source("macos/GearOps/Supporting/Info.plist");
    const icon = source("macos/GearOps/WisconsinCreativeIcon.swift");

    expect(project).toContain('platform: macOS');
    expect(project).toContain('deploymentTarget: "15.0"');
    expect(project).not.toContain("../ios/Wisconsin/Views");
    expect(project).not.toContain("../ios/Wisconsin/Core");
    expect(app).toContain("MenuBarExtra");
    expect(app).toContain(".menuBarExtraStyle(.window)");
    expect(app).toContain('Image(systemName: "shippingbox.fill")');
    expect(project).toContain("PRODUCT_NAME: Wisconsin Creative");
    expect(project).toContain("../ios/Wisconsin/AppIcons/AppIcon.icon");
    expect(project).toContain("ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon");
    expect(icon).toContain("NSApplication.shared.applicationIconImage");
    expect(plist).toMatch(/<key>LSUIElement<\/key>\s*<true\/>/);
  });

  it("uses only the external companion projection after explicit enrollment", () => {
    const client = source("macos/GearOps/GearOpsClient.swift");
    const model = source("macos/GearOps/GearOpsModel.swift");

    expect(client).toContain('path: "/api/companion/projection"');
    expect(client).toContain('refreshFromSource ? "POST" : "GET"');
    expect(client).toContain('makeRequest(path: "/api/companion/devices", method: "POST")');
    expect(client).toContain("companion: true");
    expect(client).not.toContain('/api/dashboard/stats');
    expect(client).not.toContain('/api/kiosk-devices');
    expect(client).not.toContain('/api/me');
    expect(client).not.toContain('/api/checkouts');
    expect(client).not.toContain('/api/bookings/changes');
    expect(client).not.toContain('/api/db-diagnostics');
    expect(model).toContain("credentialStore.loadToken()");
    expect(model).toContain("client.companionProjection(");
    expect(model).toContain("refreshFromSource: fromSource");
    expect(model).toContain("Task.sleep(for: .seconds(60))");
    expect(model).toContain("await self?.restoreSession()");
    expect(model).not.toContain("startPolling");
    expect(model).not.toContain('method: "PATCH"');
    expect(source("macos/GearOps/MenuBarContentView.swift")).toContain("refresh(fromSource: true)");
  });

  it("keeps every automatic companion read outside Neon", () => {
    const projectionRoute = source("src/app/api/companion/projection/route.ts");
    const deviceRoute = source("src/app/api/companion/devices/route.ts");
    const store = source("src/lib/companion-store.ts");
    const publisher = source("src/lib/services/companion-projection.ts");
    const api = source("src/lib/api.ts");
    const app = source("macos/GearOps/GearOpsApp.swift");
    const entitlements = source("macos/GearOps/Supporting/GearOps.entitlements");

    expect(projectionRoute).toContain("withHandler");
    expect(projectionRoute).not.toContain("withAuth");
    expect(projectionRoute).not.toContain("@/lib/db");
    expect(projectionRoute).toContain("refreshCompanionProjection({ notify: false })");
    expect(deviceRoute).toContain("requireCompanion(req)");
    expect(deviceRoute).not.toContain("@/lib/db");
    expect(store).toContain("UPSTASH_REDIS_REST_URL");
    expect(store).toContain('createHmac("sha256"');
    expect(store).toContain('decoded["generatedAt"] > ARGV[2]');
    expect(publisher).toContain("writeCompanionProjection(projection)");
    expect(publisher).toContain("if (!installed)");
    expect(publisher).toContain("sendCompanionInvalidation(");
    expect(api).toContain("deferCompanionProjectionRefresh(req, response)");
    expect(app).toContain("@NSApplicationDelegateAdaptor(GearOpsAppDelegate.self)");
    expect(entitlements).toContain("com.apple.developer.aps-environment");
  });

  it("publishes kiosk heartbeats only after the existing database touch commits", () => {
    const auth = source("src/lib/auth.ts");
    const deferredActivity = auth.slice(
      auth.indexOf("after(async () =>"),
      auth.indexOf("return kioskContext;", auth.indexOf("after(async () =>"))
    );

    expect(deferredActivity).toContain("await db.kioskDevice.update");
    expect(deferredActivity).toContain("await refreshCompanionProjection({ notify: true })");
    expect(deferredActivity.indexOf("await db.kioskDevice.update"))
      .toBeLessThan(deferredActivity.indexOf("await refreshCompanionProjection"));
  });

  it("renders open bookings then conditional pickups before health without summary cards", () => {
    const view = source("macos/GearOps/MenuBarContentView.swift");

    expect(view.indexOf("openBookingsList")).toBeLessThan(view.indexOf("systemHealth"));
    expect(view.indexOf("pendingPickupsList")).toBeLessThan(view.indexOf("systemHealth"));
    expect(view).toContain('sectionTitle("Open bookings")');
    expect(view).toContain('sectionTitle("Waiting for pickup")');
    expect(view).toContain("OpenBookingRow(booking: booking, now: now)");
    expect(view).toContain("PickupBookingRow(booking: booking, now: now)");
    expect(view).not.toContain("MetricCard");
  });

  it("keeps the popover compact without multiplying timeline or layout work", () => {
    const view = source("macos/GearOps/MenuBarContentView.swift");

    expect(view).toContain("onGeometryChange(for: CGFloat.self");
    expect(view).toContain("maximumContentHeight: CGFloat = 500");
    expect(view).not.toContain(".frame(height: 500)");
    expect(view.match(/TimelineView\(/g)).toHaveLength(1);
    expect(view).toContain("LazyVStack(spacing: 8)");
  });

  it("uses interactive Liquid Glass only for booking actions with a fallback", () => {
    const view = source("macos/GearOps/MenuBarContentView.swift");

    expect(view).toContain("#available(macOS 26.0, *)");
    expect(view).toContain("GlassEffectContainer(spacing: 8)");
    expect(view).toContain(".glassEffect(");
    expect(view).toContain(".interactive()");
    expect(view).toContain(".regular.tint(Color.red.opacity(0.12)).interactive()");
    expect(view).not.toContain("Color.blue.opacity(0.08)");
    expect(view).toContain("Color.primary.opacity(0.045)");
  });

  it("shows requester profile images with an initials fallback", () => {
    const view = source("macos/GearOps/MenuBarContentView.swift");
    const avatar = source("macos/GearOps/UserAvatarView.swift");
    const models = source("macos/GearOps/Models.swift");

    expect(view.match(/UserAvatarView\(/g)).toHaveLength(2);
    expect(view).toContain("avatarUrl: booking.requester.avatarUrl");
    expect(avatar).not.toContain("AsyncImage(");
    expect(avatar).toContain("CGImageSourceCreateThumbnailAtIndex");
    expect(avatar).toContain("NSCache<NSString, NSImage>");
    expect(avatar).toContain(".returnCacheDataElseLoad");
    expect(avatar).toContain("initialsCircle");
    expect(avatar).toContain(".clipShape(Circle())");
    expect(models).toContain("let avatarUrl: String?");
  });

  it("never falls through from the external projection to Neon-backed reads", () => {
    const model = source("macos/GearOps/GearOpsModel.swift");
    const refresh = model.slice(model.indexOf("func refresh("), model.indexOf("func openDashboard()"));
    const pickupDerivation = model.slice(
      model.indexOf("func pendingPickupBookings"),
      model.indexOf("func restoreSession")
    );

    expect(refresh).toContain("client.companionProjection(");
    expect(refresh).not.toContain("dashboardStats");
    expect(refresh).not.toContain("openBookings()");
    expect(refresh).not.toContain("activeBookingActivity()");
    expect(refresh).not.toContain("kioskDevices()");
    expect(model).toContain("Showing the last confirmed data");
    expect(model).toContain("activeBookingActivity = sortedActivity");
    expect(pickupDerivation).not.toContain(".sorted(");
  });

  it("places aggregate severity with health and prioritizes kiosk heartbeat age", () => {
    const view = source("macos/GearOps/MenuBarContentView.swift");

    expect(view).toContain("WisconsinCreativeIcon(size: 30)");
    expect(view).toContain("Label(model.healthLabel, systemImage: model.healthSeverity.symbol)");
    expect(view).toContain('title: model.kioskAccess == .available ? "Kiosks" : "Kiosk access"');
    expect(view).toContain('return "\\(device.location.name) · Last seen');
    expect(view).toContain("device.pendingPickupCount");
    expect(view).toContain("device.openCheckoutCount");
    expect(view).toContain("freshnessLabel(at: now)");
    expect(view).toContain('title: "Companion data"');
    expect(view).toContain(".help(buildHelp)");
  });

  it("delivers visible booking change notifications without sound", () => {
    const notifications = source("macos/GearOps/BookingNotifications.swift");
    const model = source("macos/GearOps/GearOpsModel.swift");

    expect(notifications).toContain("content.interruptionLevel = .active");
    expect(notifications).toContain("content.sound = nil");
    expect(notifications).toContain('case .open: "Booking checked out"');
    expect(notifications).toContain('case .completed: "Booking checked in"');
    expect(notifications).toContain('title = "Booking extended"');
    expect(model).toContain("CompanionPushBridge.shared.events");
    expect(model).toContain("case .projectionChanged:");
    expect(model).toContain("startAutomaticRefresh()");
    expect(model).toContain("knownBookingActivity");
  });

  it("keeps active checkouts and handoff lanes aligned with the external projection", () => {
    const projection = source("src/lib/services/companion-projection.ts");
    const models = source("macos/GearOps/Models.swift");

    expect(projection).toContain("booking.kind === BookingKind.CHECKOUT");
    expect(projection).toContain("booking.status === BookingStatus.OPEN");
    expect(projection).toContain("pendingPickupTotal: pendingPickups.length");
    expect(models).toContain("let checkedOut: Int");
    expect(models).toContain("let pendingPickupTotal: Int");
  });

  it("preserves cached truth and exact kiosk heartbeat thresholds", () => {
    const model = source("macos/GearOps/GearOpsModel.swift");
    const health = source("macos/GearOps/Health.swift");

    expect(model).toContain("persistCache()");
    expect(model).toContain("Failure preserves the trusted");
    expect(model).toContain("KioskAccessState(rawValue:");
    expect(health).toContain("if age <= 5 * 60 { return .online }");
    expect(health).toContain("if age <= 24 * 60 * 60 { return .stale }");
    expect(health).toContain('.caseInsensitiveCompare("Sim iPad")');
    expect(model).toContain("kioskDevices.filter(\\.isIncludedInMonitoring)");
  });
});

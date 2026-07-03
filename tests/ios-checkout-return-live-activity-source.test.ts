import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS checkout return Live Activity source contract", () => {
  it("wires ActivityKit, the widget extension, and booking deep links into the project", () => {
    const project = source("ios/project.yml");
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");
    const tabs = source("ios/Wisconsin/Views/AppTabView.swift");

    expect(project).toContain("NSSupportsLiveActivities: true");
    expect(project).toContain("WisconsinLiveActivities:");
    expect(project).toContain("com.apple.widgetkit-extension");
    expect(project).toContain("CFBundleURLSchemes:");
    expect(project).toContain("- wisconsin");
    expect(app).toContain('url.host == "booking"');
    expect(app).toContain("appState.pendingExtendBookingId = bookingId");
    expect(tabs).toContain("routePendingBookingPush()");
    expect(tabs).toContain("appState.selectedTab = 0");
  });

  it("keeps focused Live Activity surfaces on seconds while lock-screen surfaces stay minute-only", () => {
    const attributes = source("ios/Wisconsin/LiveActivities/CheckoutReturnActivityAttributes.swift");
    const manager = source("ios/Wisconsin/LiveActivities/CheckoutReturnLiveActivityManager.swift");
    const widget = source("ios/WisconsinLiveActivities/CheckoutReturnLiveActivityWidget.swift");

    expect(attributes).toContain("struct CheckoutReturnActivityAttributes: ActivityAttributes");
    expect(attributes).toContain("var nextNeedAt: Date?");
    expect(attributes).toContain("var allowsExtend: Bool");
    expect(attributes).toContain("var requesterAvatarUrl: String?");
    expect(attributes).toContain("enum Urgency");
    expect(widget).toContain("ActivityConfiguration(for: CheckoutReturnActivityAttributes.self)");
    expect(widget).toContain("CheckoutReturnCard(context: context, showsSeconds: false, now: timeline.date)");
    expect(widget).toContain("CheckoutReturnCard(context: context, showsSeconds: true, now: timeline.date)");
    expect(widget).toContain("TimelineView(.periodic(from: .now, by: 60))");
    expect(widget).toContain("TimelineView(.periodic(from: .now, by: 1))");
    expect(widget).toContain("timerInterval: timerRange");
    expect(widget).toContain("context.state.minuteLabel(at: timeline.date)");
    expect(widget).toContain("context.state.urgency(at: now)");
    expect(widget).toContain(".minimumScaleFactor(0.72)");
    expect(widget).toContain(".activityBackgroundTint(.clear)");
    expect(widget).toContain(".frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)");
    expect(widget).toContain(".clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))");
    expect(attributes).toContain("func minuteLabel(at date: Date) -> String");
    expect(attributes).toContain("? \"\\(minutes) min overdue\"");
    expect(manager).toContain("requesterAvatarUrl: candidate.booking.requester.avatarUrl");
    expect(widget).toContain("AsyncImage(url: url)");
    expect(widget).toContain("LiveActivityAvatar(");
    expect(widget).toContain("fallback");
  });

  it("uses availability next-need insight to start early, intensify urgency, and gate Extend", () => {
    const api = source("ios/Wisconsin/Core/APIClient.swift");
    const manager = source("ios/Wisconsin/LiveActivities/CheckoutReturnLiveActivityManager.swift");
    const detail = source("ios/Wisconsin/Views/BookingDetailView.swift");
    const widget = source("ios/WisconsinLiveActivities/CheckoutReturnLiveActivityWidget.swift");

    expect(api).toContain("struct CheckoutReturnInsight");
    expect(api).toContain("let upcomingCommitments: [UpcomingCommitment]?");
    expect(api).toContain("excludeBookingId: booking.id");
    expect(manager).toContain("private let defaultLeadTime: TimeInterval = 30 * 60");
    expect(manager).toContain("private let maxNextNeedLeadTime: TimeInterval = 60 * 60");
    expect(manager).toContain("let smartLead = nextNeedGap.map");
    expect(manager).toContain("allowsExtend: !insight.hasUpcomingNeed");
    expect(widget).toContain('URLQueryItem(name: "action", value: "extend")');
    expect(widget).toContain("Needed next");
    expect(detail).toContain("returnInsight.hasUpcomingNeed");
    expect(detail).toContain("showExtend = true");
  });

  it("keeps one urgent checkout activity and dismisses locally when the checkout is no longer open", () => {
    const manager = source("ios/Wisconsin/LiveActivities/CheckoutReturnLiveActivityManager.swift");
    const detail = source("ios/Wisconsin/Views/BookingDetailView.swift");
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");
    const home = source("ios/Wisconsin/Views/HomeView.swift");
    const bookings = source("ios/Wisconsin/Views/BookingsView.swift");

    expect(manager).toContain("limit: 5");
    expect(manager).toContain("$0.status == .open");
    expect(manager).toContain("candidates.sorted(by: candidateSort).first");
    expect(manager).toContain("activity.attributes.bookingId != candidate.booking.id");
    expect(manager).toContain("dismissalPolicy: .immediate");
    expect(manager).toContain("Activity.request(attributes: attributes, content: content, pushType: .token)");
    expect(manager).toContain("activity.pushTokenUpdates");
    expect(manager).toContain("registerCheckoutReturnLiveActivity");
    expect(detail).toContain("booking.status != .open");
    expect(detail).toContain("CheckoutReturnLiveActivityManager.shared.endAll()");
    expect(app).toContain("CheckoutReturnLiveActivityManager.shared.endAll()");
    expect(home).toContain("CheckoutReturnLiveActivityManager.shared.reconcileCurrentUserCheckouts");
    expect(bookings).toContain("CheckoutReturnLiveActivityManager.shared.reconcileCurrentUserCheckouts");
  });

  it("stores Live Activity tokens separately and sends end pushes when checkout return completes", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source("prisma/migrations/0088_checkout_live_activity_tokens/migration.sql");
    const startMigration = source("prisma/migrations/0091_checkout_live_activity_push_to_start/migration.sql");
    const route = source("src/app/api/live-activities/checkout-return/route.ts");
    const startTokenRoute = source("src/app/api/live-activities/checkout-return/start-token/route.ts");
    const service = source("src/lib/services/live-activities.ts");
    const apns = source("src/lib/push/apns.ts");
    const checkin = source("src/lib/services/bookings-checkin.ts");

    expect(schema).toContain("model LiveActivityToken");
    expect(schema).toContain("model LiveActivityStartToken");
    expect(schema).toContain("model LiveActivityStart");
    expect(schema).toContain("@@map(\"live_activity_tokens\")");
    expect(schema).toContain("@@map(\"live_activity_start_tokens\")");
    expect(schema).toContain("@@map(\"live_activity_starts\")");
    expect(migration).toContain("CREATE TABLE \"live_activity_tokens\"");
    expect(startMigration).toContain("CREATE TABLE \"live_activity_start_tokens\"");
    expect(startMigration).toContain("CREATE TABLE \"live_activity_starts\"");
    expect(route).toContain("booking.requesterUserId !== user.id");
    expect(route).toContain("booking.status !== BookingStatus.OPEN");
    expect(startTokenRoute).toContain("registerCheckoutReturnLiveActivityStartToken");
    expect(startTokenRoute).toContain("revokeCheckoutReturnLiveActivityStartTokens");
    expect(startTokenRoute).toContain("export const DELETE = withAuth");
    expect(service).toContain("registerCheckoutReturnLiveActivity");
    expect(service).toContain("registerCheckoutReturnLiveActivityStartToken");
    expect(service).toContain("endCheckoutReturnLiveActivities");
    expect(service).toContain("updateCheckoutReturnLiveActivities");
    expect(apns).toContain('"apns-push-type": opts.pushType');
    expect(apns).toContain("push-type.liveactivity");
    expect(apns).toContain('event: "end"');
    expect(apns).toContain('event: "update"');
    expect(checkin).toContain("endCheckoutReturnLiveActivities(bookingId)");
    expect(checkin).toContain("endCheckoutReturnLiveActivities(args.bookingId)");
  });

  it("pushes Live Activity updates for server-known checkout changes without requiring app launch", () => {
    const lifecycle = source("src/lib/services/bookings-lifecycle.ts");
    const service = source("src/lib/services/live-activities.ts");

    expect(lifecycle).toContain("updateCheckoutReturnLiveActivities({");
    expect(lifecycle).toContain("endCheckoutReturnLiveActivities(bookingId)");
    expect(service).toContain("updateCheckoutReturnLiveActivityTokens");
    expect(service).toContain("endsAt: args.endsAt");
  });

  it("registers push-to-start tokens and keeps the server start route available for Pro/manual schedulers", () => {
    const api = source("ios/Wisconsin/Core/APIClient.swift");
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");
    const session = source("ios/Wisconsin/Core/SessionStore.swift");
    const manager = source("ios/Wisconsin/LiveActivities/CheckoutReturnLiveActivityManager.swift");
    const service = source("src/lib/services/live-activities.ts");
    const apns = source("src/lib/push/apns.ts");
    const cron = source("src/app/api/cron/live-activities/route.ts");
    const vercel = source("vercel.json");

    expect(api).toContain("registerCheckoutReturnLiveActivityStartToken");
    expect(api).toContain("revokeCheckoutReturnLiveActivityStartTokens");
    expect(app).toContain("prepareRemoteStartRegistration()");
    expect(session).toContain("revokeCheckoutReturnLiveActivityStartTokens()");
    expect(manager).toContain("pushToStartTokenUpdates");
    expect(manager).toContain("Activity<CheckoutReturnActivityAttributes>.activityUpdates");
    expect(manager).toContain("activity.pushToken");
    expect(manager).toContain("registerCheckoutReturnLiveActivityStartToken(token)");
    expect(manager).toContain("registerCheckoutReturnLiveActivity(");
    expect(service).toContain("startDueCheckoutReturnLiveActivities");
    expect(service).toContain("liveActivityStartTokens");
    expect(service).toContain("liveActivityStarts");
    expect(apns).toContain("startCheckoutReturnLiveActivityTokens");
    expect(apns).toContain('event: "start"');
    expect(apns).toContain('"attributes-type": "CheckoutReturnActivityAttributes"');
    expect(apns).toContain('"input-push-token": 1');
    expect(cron).toContain("withCron");
    expect(cron).toContain("startDueCheckoutReturnLiveActivities");
    expect(vercel).not.toContain("/api/cron/live-activities");
    expect(vercel).not.toContain("*/5 * * * *");
    expect(vercel).not.toContain("*/15 * * * *");
  });
});

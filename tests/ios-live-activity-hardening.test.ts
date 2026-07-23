import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function slice(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe("Live Activity extend affordance", () => {
  it("wires the Extend button end to end instead of leaving allowsExtend inert", () => {
    const widget = source("ios/WisconsinLiveActivities/CheckoutReturnLiveActivityWidget.swift");
    const app = source("ios/Wisconsin/App/WisconsinApp.swift");
    const detail = source("ios/Wisconsin/Views/BookingDetailView.swift");

    // The widget has to actually emit the action; a plain booking deep link
    // opens the checkout but never reaches the extend flow.
    expect(widget).toContain('checkoutReturnDeepLink(bookingId: String, action: String? = nil)');
    expect(widget).toContain('URLQueryItem(name: "action", value: action)');
    expect(widget).toContain("struct ExtendGearLink");
    expect(widget).toContain('action: "extend"');

    // Gated on the flag the server computes, so gear another booking needs
    // next never offers Extend.
    expect(widget).toContain("context.state.allowsExtend");

    // The receiving half already existed and must stay wired.
    expect(app).toContain('$0.name == "action" && $0.value == "extend"');
    expect(app).toContain("appState.pendingExtendBookingId = bookingId");
    expect(detail).toContain("appState.pendingExtendBookingId == booking.id");
  });

  it("re-derives Dynamic Island urgency from its own timeline", () => {
    const widget = source("ios/WisconsinLiveActivities/CheckoutReturnLiveActivityWidget.swift");
    const leading = slice(
      widget,
      "DynamicIslandExpandedRegion(.leading)",
      "DynamicIslandExpandedRegion(.trailing)",
    );
    // Reading `.now` outside a TimelineView froze this region's tint while
    // every sibling recolored on schedule.
    expect(leading).toContain("TimelineView(.periodic(from: .now, by: 60))");
    expect(leading).toContain("context.state.urgency(at: timeline.date)");
    expect(leading).not.toContain("urgency(at: .now)");
  });
});

describe("Live Activity content fidelity", () => {
  it("computes nextNeedAt and allowsExtend server-side rather than hardcoding them", () => {
    const service = source("src/lib/services/live-activities.ts");

    expect(service).toContain("async function checkoutReturnInsight(args: {");
    expect(service).toContain("checkUpcomingSerializedCommitments(db, {");
    // Mirrors the iOS rule: extend only when nothing is committed after return.
    expect(service).toContain("return { nextNeedAt, allowsExtend: nextNeedAt === null };");

    // No push path may still ship the placeholder pair, which wiped the
    // "Needed again" line and re-enabled Extend on spoken-for gear.
    expect(service).not.toContain("nextNeedAt: null,\n        allowsExtend: true,");
    expect(service).not.toContain("nextNeedAt: null,\n      allowsExtend: true,");
    expect(service).toContain("nextNeedAt: insight.nextNeedAt");
  });

  it("re-sends stale-date on updates, not only on start", () => {
    const apns = source("src/lib/push/apns.ts");

    expect(apns).toContain("function staleDateFor(endsAt: Date): number");
    const update = slice(
      apns,
      "export async function updateCheckoutReturnLiveActivityTokens",
      "return dispatch(tokens, notification, liveActivityOpts());",
    );
    // The stale date is part of the pushed content: omitting it on update
    // cleared the one `start` set, so a stalled activity never dimmed.
    expect(update).toContain('"stale-date": staleDateFor(state.endsAt)');
  });

  it("keeps the content-state contract tolerant of a missing now", () => {
    const attributes = source("ios/Wisconsin/LiveActivities/CheckoutReturnActivityAttributes.swift");

    // Nothing reads `now` — every display path takes its date from the
    // widget's TimelineView — so a required field could only ever cause a
    // whole update to be silently dropped.
    expect(attributes).toContain("var now: Date?");
    expect(attributes).not.toContain("var isOverdue: Bool { now >= endsAt }");
    expect(attributes).toContain("func isOverdue(at date: Date) -> Bool");
  });
});

describe("Live Activity lifecycle", () => {
  it("drives the overdue alert from the workflow, keeping the cron unregistered", () => {
    const workflow = source("src/workflows/checkout-return-live-activity.ts");
    const service = source("src/lib/services/live-activities.ts");
    const vercel = source("vercel.json");

    expect(workflow).toContain("markCheckoutReturnLiveActivityOverdueStep");
    expect(workflow).toContain("await sleep(endsAt)");
    expect(workflow).toContain('"use step"');

    expect(service).toContain("export async function markCheckoutReturnLiveActivityOverdue");
    // A superseded run must not declare gear overdue that was since extended.
    expect(service).toContain("endsAt: args.expectedEndsAt");
    expect(service).toContain('title: "Overdue"');

    // Remote start stays workflow-driven; the cron route remains available for
    // manual/Pro schedulers but is deliberately not scheduled.
    expect(vercel).not.toContain("/api/cron/live-activities");
  });

  it("ends per-activity tokens on sign-out, not just push-to-start tokens", () => {
    const service = source("src/lib/services/live-activities.ts");
    const route = source("src/app/api/live-activities/checkout-return/start-token/route.ts");

    expect(service).toContain("export async function endCheckoutReturnLiveActivitiesForUser");
    expect(service).toContain("activity: CHECKOUT_RETURN_ACTIVITY,\n        endedAt: null,");

    const del = slice(route, "export const DELETE = withAuth", "return ok({ success: true });");
    expect(del).toContain("revokeCheckoutReturnLiveActivityStartTokens(user.id)");
    expect(del).toContain("endCheckoutReturnLiveActivitiesForUser(user.id)");
  });

  it("tears down token observers instead of leaking one task per activity", () => {
    const manager = source("ios/Wisconsin/LiveActivities/CheckoutReturnLiveActivityManager.swift");

    expect(manager).toContain("private var tokenObservers: [String: Task<Void, Never>] = [:]");
    expect(manager).toContain("private func cancelAllObservers()");
    expect(manager).toContain("func forgetObserver(");
    // Sign-out ends the activities, so their observers go with them.
    const endAll = slice(manager, "func endAll() async {", "}");
    expect(endAll).toContain("cancelAllObservers()");

    // The old unbounded set must be gone.
    expect(manager).not.toContain("observedActivityIds");
  });
});

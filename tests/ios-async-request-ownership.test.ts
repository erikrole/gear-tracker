import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("iOS asynchronous request ownership", () => {
  it("prevents a stale session restore from repopulating local auth state", () => {
    const session = source("ios/Wisconsin/Core/SessionStore.swift");

    expect(session).toContain("private var authRequests = LatestRequestGeneration()");
    expect(session).toContain("private let authMutations = AuthMutationQueue()");
    expect(session).toContain("restoreSession(requestToken: restoreToken)");
    expect(session).toContain("guard authRequests.owns(requestToken) else { return }");
    expect(session).toMatch(/func login\(email: String, password: String\) async \{[\s\S]*?authMutations\.enqueue[\s\S]*?APIClient\.shared\.login[\s\S]*?await mutation\.value/);
    expect(session).toMatch(/func logout\(\) async \{[\s\S]*?authRequests\.invalidate\(\)[\s\S]*?currentUser = nil[\s\S]*?authMutations\.enqueue[\s\S]*?APIClient\.shared\.logout\(\)[\s\S]*?await mutation\.value/);
    const logout = session.slice(session.indexOf("func logout() async"), session.indexOf("func clearDeletedAccountLocally() async"));
    expect(logout.indexOf("authMutations.enqueue")).toBeLessThan(logout.indexOf("try? await APIClient.shared"));
  });

  it.each([
    ["Items", "ios/Wisconsin/Views/ItemsView.swift"],
    ["Bookings", "ios/Wisconsin/Views/BookingsView.swift"],
  ])("lets only the newest %s load mutate shared list state", (_name, path) => {
    const view = source(path);

    expect(view).toContain("private var loadRequests = LatestRequestGeneration()");
    expect(view).toContain("let requestToken = loadRequests.begin()");
    expect(view).toContain("guard loadRequests.owns(requestToken), !Task.isCancelled else { return }");
    expect(view).toContain("if loadRequests.owns(requestToken) { isLoading = false }");
    expect(view).not.toContain("if Task.isCancelled { isLoading = false; return }");
  });

  it("keys kiosk availability and completes against its own preflight response", () => {
    const checkout = source("ios/Wisconsin/Kiosk/KioskCheckoutView.swift");

    expect(checkout).toContain("@State private var availabilityRequests = LatestRequestGeneration()");
    expect(checkout).toContain("let requestToken = availabilityRequests.begin()");
    expect(checkout).toContain("guard availabilityRequests.owns(requestToken) else { return nil }");
    expect(checkout).toContain("guard let preflight = await refreshAvailability(for: cart, endsAt: endsAt)");
    expect(checkout).toContain("guard !preflight.hasBlockingIssue else");
  });
});

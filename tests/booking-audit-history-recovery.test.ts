import { describe, expect, it } from "vitest";
import {
  auditHistoryFailureMessage,
  auditHistoryRecoveryAction,
  normalizeAuditHistoryPage,
} from "@/components/booking-details/audit-history";

describe("booking audit history recovery", () => {
  it("normalizes valid audit pagination payloads", () => {
    const page = normalizeAuditHistoryPage({
      data: [{ id: "audit-1" }],
      nextCursor: "audit-1",
      hasMore: true,
    });

    expect(page).toEqual({
      entries: [{ id: "audit-1" }],
      nextCursor: "audit-1",
      hasMore: true,
    });
  });

  it("rejects malformed successful payloads so hidden history is not treated as complete", () => {
    expect(normalizeAuditHistoryPage({ data: undefined, hasMore: true })).toBeNull();
    expect(normalizeAuditHistoryPage(null)).toBeNull();
  });

  it("uses operator-facing copy for stale cursors, access changes, and server failures", () => {
    expect(auditHistoryFailureMessage(400)).toContain("sheet is out of date");
    expect(auditHistoryFailureMessage(403)).toContain("access changed");
    expect(auditHistoryFailureMessage(500)).toContain("older entries may be hidden");
    expect(auditHistoryFailureMessage(200)).toContain("response was incomplete");
  });

  it("uses refresh only when retrying the same cursor cannot recover", () => {
    expect(auditHistoryRecoveryAction(400)).toBe("refresh");
    expect(auditHistoryRecoveryAction(403)).toBe("refresh");
    expect(auditHistoryRecoveryAction(500)).toBe("retry");
    expect(auditHistoryRecoveryAction()).toBe("retry");
  });
});

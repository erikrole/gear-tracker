import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  auditPaginationErrorCopy,
  auditRefreshErrorCopy,
  isAuditResponsePayload,
} from "@/app/(app)/settings/audit/audit-pagination";

describe("settings audit pagination recovery", () => {
  it("uses copy that warns operators about partial audit history", () => {
    expect(auditPaginationErrorCopy("server")).toEqual({
      title: "Could not load older audit entries",
      description:
        "The audit trail above is still available, but older entries may be missing. Retry before treating this as complete history.",
    });

    expect(auditPaginationErrorCopy("network").description)
      .toContain("the network request failed");
  });

  it("uses copy that warns operators about stale auto-refresh data", () => {
    expect(auditRefreshErrorCopy("server")).toEqual({
      title: "Auto-refresh could not check for new entries",
      description:
        "The audit rows below are still available, but the live feed may be stale. Retry before treating this as the latest audit trail.",
    });

    expect(auditRefreshErrorCopy("network").description)
      .toContain("the network request failed");
  });

  it("rejects malformed audit pagination payloads", () => {
    expect(isAuditResponsePayload({
      data: [],
      hasMore: true,
      nextCursor: "cursor-1",
      retentionDays: 90,
    })).toBe(true);

    expect(isAuditResponsePayload({ data: null })).toBe(false);
    expect(isAuditResponsePayload({ data: [], nextCursor: 123 })).toBe(false);
    expect(isAuditResponsePayload({ data: [], hasMore: "yes" })).toBe(false);
    expect(isAuditResponsePayload({ data: [], retentionDays: "90" })).toBe(false);
  });

  it("keeps older-page failures inline and retryable in the page source", () => {
    const source = readFileSync("src/app/(app)/settings/audit/page.tsx", "utf8");

    expect(source).toContain("setPaginationError(kind)");
    expect(source).toContain("AlertDescription>{paginationCopy.description}</AlertDescription");
    expect(source).toContain('paginationError ? "Retry older entries" : "Load older entries"');
    expect(source).toContain("setPaginationError(null)");
  });

  it("keeps auto-refresh failures inline and retryable in the page source", () => {
    const source = readFileSync("src/app/(app)/settings/audit/page.tsx", "utf8");

    expect(source).toContain("setRefreshError(\"server\")");
    expect(source).toContain("setRefreshError(classifyError(err) === \"network\" ? \"network\" : \"server\")");
    expect(source).toContain("const refreshCopy = refreshError ? auditRefreshErrorCopy(refreshError) : null");
    expect(source).toContain("{autoRefresh && refreshCopy && (");
    expect(source).toContain("<AlertTitle>{refreshCopy.title}</AlertTitle>");
    expect(source).toContain("Retry now");
    expect(source).toContain("setRefreshError(null)");
    expect(source).toContain("useOperationalPollingActivity(autoRefresh)");
    expect(source).toContain('pollingState !== "active"');
    expect(source).toContain("void pollForNew()");
  });
});

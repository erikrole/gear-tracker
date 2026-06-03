export type AuditHistoryEnvelope<TEntry> = {
  data?: TEntry[];
  error?: string;
  nextCursor?: string | null;
  hasMore?: boolean;
};

export type AuditHistoryPage<TEntry> = {
  entries: TEntry[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type AuditHistoryRecoveryAction = "retry" | "refresh";

export function normalizeAuditHistoryPage<TEntry>(
  payload: AuditHistoryEnvelope<TEntry> | null | undefined,
): AuditHistoryPage<TEntry> | null {
  if (!payload || !Array.isArray(payload.data)) return null;

  return {
    entries: payload.data,
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : null,
    hasMore: payload.hasMore === true,
  };
}

export function auditHistoryFailureMessage(status?: number): string {
  if (status === 400) {
    return "Older history could not load because this sheet is out of date. Refresh the booking and try again.";
  }
  if (status === 401 || status === 403) {
    return "Your access changed before older history loaded. Refresh or sign in again before relying on older entries.";
  }
  if (typeof status === "number" && status >= 500) {
    return "Older history did not load because the server returned an error. Visible activity is current, but older entries may be hidden.";
  }
  if (status === 200) {
    return "Older history did not load because the response was incomplete. Visible activity is current, but older entries may be hidden.";
  }
  return "Older history did not load. Visible activity is current, but older entries may be hidden.";
}

export function auditHistoryRecoveryAction(status?: number): AuditHistoryRecoveryAction {
  if (status === 400 || status === 401 || status === 403) return "refresh";
  return "retry";
}

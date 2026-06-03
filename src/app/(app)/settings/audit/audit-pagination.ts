export type AuditPaginationErrorKind = "network" | "server";
export type AuditRefreshErrorKind = "network" | "server";
export type AuditFilters = {
  entityType: string;
  action: string;
  from: string;
  to: string;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

export function normalizeAuditFilters(filters: AuditFilters): AuditFilters {
  return {
    entityType: filters.entityType.trim(),
    action: filters.action.trim(),
    from: filters.from.trim(),
    to: filters.to.trim(),
  };
}

export function validateAuditFilters(filters: AuditFilters): {
  filters: AuditFilters;
  error: string | null;
} {
  const normalized = normalizeAuditFilters(filters);

  if (normalized.from && !isValidDateOnly(normalized.from)) {
    return { filters: normalized, error: "Enter a valid From date." };
  }

  if (normalized.to && !isValidDateOnly(normalized.to)) {
    return { filters: normalized, error: "Enter a valid To date." };
  }

  if (normalized.from && normalized.to && normalized.from > normalized.to) {
    return { filters: normalized, error: "From date must be on or before To date." };
  }

  return { filters: normalized, error: null };
}

export function auditPaginationErrorCopy(kind: AuditPaginationErrorKind) {
  if (kind === "network") {
    return {
      title: "Could not load older audit entries",
      description:
        "The audit trail above is still available, but older entries may be missing because the network request failed. Retry before treating this as complete history.",
    };
  }

  return {
    title: "Could not load older audit entries",
    description:
      "The audit trail above is still available, but older entries may be missing. Retry before treating this as complete history.",
  };
}

export function auditRefreshErrorCopy(kind: AuditRefreshErrorKind) {
  if (kind === "network") {
    return {
      title: "Auto-refresh could not check for new entries",
      description:
        "The audit rows below are still available, but the live feed may be stale because the network request failed.",
    };
  }

  return {
    title: "Auto-refresh could not check for new entries",
    description:
      "The audit rows below are still available, but the live feed may be stale. Retry before treating this as the latest audit trail.",
  };
}

export function isAuditResponsePayload(value: unknown): value is {
  data: unknown[];
  hasMore?: boolean;
  nextCursor?: string | null;
  retentionDays?: number;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    data?: unknown;
    hasMore?: unknown;
    nextCursor?: unknown;
    retentionDays?: unknown;
  };

  if (!Array.isArray(candidate.data)) return false;
  if (
    candidate.nextCursor !== undefined
    && candidate.nextCursor !== null
    && typeof candidate.nextCursor !== "string"
  ) {
    return false;
  }
  if (candidate.hasMore !== undefined && typeof candidate.hasMore !== "boolean") {
    return false;
  }
  if (candidate.retentionDays !== undefined && typeof candidate.retentionDays !== "number") {
    return false;
  }

  return true;
}

export const GUIDE_REVIEW_INTERVAL_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const UPDATED_AFTER_VERIFIED_TOLERANCE_MS = 5_000;

export type GuideFreshnessStatus = "verified" | "needs-review";

export type GuideFreshness = {
  status: GuideFreshnessStatus;
  label: string;
  detail: string;
  daysSinceVerified: number | null;
};

export function getGuideFreshness(
  guide: {
    updatedAt: Date | string;
    lastVerifiedAt?: Date | string | null;
  },
  now: Date = new Date(),
): GuideFreshness {
  if (!guide.lastVerifiedAt) {
    return {
      status: "needs-review",
      label: "Needs review",
      detail: "Never verified",
      daysSinceVerified: null,
    };
  }

  const verifiedAt = new Date(guide.lastVerifiedAt);
  const updatedAt = new Date(guide.updatedAt);

  if (Number.isNaN(verifiedAt.getTime())) {
    return {
      status: "needs-review",
      label: "Needs review",
      detail: "Verification date is invalid",
      daysSinceVerified: null,
    };
  }

  if (
    !Number.isNaN(updatedAt.getTime()) &&
    updatedAt.getTime() - verifiedAt.getTime() > UPDATED_AFTER_VERIFIED_TOLERANCE_MS
  ) {
    return {
      status: "needs-review",
      label: "Needs review",
      detail: "Updated after verification",
      daysSinceVerified: Math.max(0, Math.floor((now.getTime() - verifiedAt.getTime()) / DAY_MS)),
    };
  }

  const daysSinceVerified = Math.max(0, Math.floor((now.getTime() - verifiedAt.getTime()) / DAY_MS));

  if (daysSinceVerified >= GUIDE_REVIEW_INTERVAL_DAYS) {
    return {
      status: "needs-review",
      label: "Needs review",
      detail: `Verified ${daysSinceVerified} days ago`,
      daysSinceVerified,
    };
  }

  return {
    status: "verified",
    label: "Verified",
    detail: `Verified ${formatFreshnessDate(verifiedAt)}`,
    daysSinceVerified,
  };
}

export function formatFreshnessDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

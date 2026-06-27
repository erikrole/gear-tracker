export type OperationalHealthState = "active" | "down" | "fixing" | "idle";

export type OperationalHealthSummary = {
  state: OperationalHealthState;
  label: string;
  description: string;
};

export function summarizeOperationalHealth({
  cleanLabel = "Clean",
  criticalCount = 0,
  needsWorkCount = 0,
  partialFailureCount = 0,
}: {
  cleanLabel?: string;
  criticalCount?: number;
  needsWorkCount?: number;
  partialFailureCount?: number;
}): OperationalHealthSummary {
  if (criticalCount > 0) {
    return {
      state: "down",
      label: "Critical",
      description: `${criticalCount} critical check${criticalCount === 1 ? "" : "s"} need attention.`,
    };
  }

  if (needsWorkCount > 0) {
    return {
      state: "fixing",
      label: "Needs work",
      description: `${needsWorkCount} check${needsWorkCount === 1 ? "" : "s"} need follow-up.`,
    };
  }

  if (partialFailureCount > 0) {
    return {
      state: "fixing",
      label: "Partial data",
      description: `${partialFailureCount} check${partialFailureCount === 1 ? "" : "s"} used fallback data.`,
    };
  }

  return {
    state: "active",
    label: cleanLabel,
    description: "All visible checks are clean.",
  };
}

import { EQUIPMENT_SECTIONS, type EquipmentSectionKey } from "@/lib/equipment-sections";

export type AvailabilityWarningCounts = {
  conflictCount: number;
  upcomingCommitmentCount: number;
  turnaroundRiskCount: number;
  bulkTurnaroundRiskCount: number;
};

export type Step2PrimaryLabelInput = AvailabilityWarningCounts & {
  itemCount: number;
  unresolvedAssetCount: number;
  activeSection: EquipmentSectionKey;
};

export function getAvailabilityWarningTotal(counts: AvailabilityWarningCounts) {
  return (
    counts.conflictCount +
    counts.upcomingCommitmentCount +
    counts.turnaroundRiskCount +
    counts.bulkTurnaroundRiskCount
  );
}

export function getTurnaroundWarningTotal(counts: AvailabilityWarningCounts) {
  return counts.turnaroundRiskCount + counts.bulkTurnaroundRiskCount;
}

export function getStep2PrimaryActionLabel(input: Step2PrimaryLabelInput) {
  if (input.itemCount > 0) {
    const itemLabel = `${input.itemCount} item${input.itemCount !== 1 ? "s" : ""}`;
    if (getAvailabilityWarningTotal(input) > 0) return `Review with warnings (${itemLabel})`;
    return `Review (${itemLabel})`;
  }

  if (input.unresolvedAssetCount > 0) {
    return input.unresolvedAssetCount === 1
      ? "Remove unavailable item"
      : "Remove unavailable items";
  }

  const sectionIdx = EQUIPMENT_SECTIONS.findIndex((section) => section.key === input.activeSection);
  if (sectionIdx >= 0 && sectionIdx < EQUIPMENT_SECTIONS.length - 1) {
    return `Browse ${EQUIPMENT_SECTIONS[sectionIdx + 1]!.label}`;
  }

  return "Review";
}

export function buildAvailabilityReview(counts: AvailabilityWarningCounts) {
  const total = getAvailabilityWarningTotal(counts);
  if (total === 0) return null;

  const turnaroundCount = getTurnaroundWarningTotal(counts);
  const advisoryCount = counts.upcomingCommitmentCount + turnaroundCount;

  if (counts.conflictCount > 0) {
    return {
      tone: "conflict" as const,
      title: "Availability needs review",
      description:
        "Submit will re-check these items. If a hard conflict still overlaps, the wizard returns to Equipment with affected items removed.",
      total,
      advisoryCount,
      turnaroundCount,
    };
  }

  return {
    tone: "advisory" as const,
    title: "Availability warnings noted",
    description:
      "Next-use and turnaround warnings do not block creation, but pickup and return timing should be confirmed before handoff.",
    total,
    advisoryCount,
    turnaroundCount,
  };
}

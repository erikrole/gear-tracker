import type { BadgeProps } from "@/components/ui/badge";

export type BlastSeverity = "INFO" | "WARNING" | "URGENT";

/** Mirrors the iOS banner tones in ios/Wisconsin/Views/Components/BlastBanner.swift. */
export const SEVERITY_VARIANT: Record<BlastSeverity, BadgeProps["variant"]> = {
  INFO: "blue",
  WARNING: "orange",
  URGENT: "red",
};

export const SEVERITY_LABEL: Record<BlastSeverity, string> = {
  INFO: "Info",
  WARNING: "Warning",
  URGENT: "Urgent",
};

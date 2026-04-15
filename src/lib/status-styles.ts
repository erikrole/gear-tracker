import type { BadgeProps } from "@/components/ui/badge";

/** Maps a color key to dot + badge class strings (for the StatusDot pattern). */
export const STATUS_STYLES = {
  green: {
    badge: "border-none bg-[var(--green-bg)] text-[var(--green-text)]",
    dot: "bg-[var(--green-text)]",
  },
  blue: {
    badge: "border-none bg-[var(--blue-bg)] text-[var(--blue-text)]",
    dot: "bg-[var(--blue-text)]",
  },
  red: {
    badge: "border-none bg-[var(--red-bg)] text-[var(--red-text)]",
    dot: "bg-[var(--red-text)]",
  },
  purple: {
    badge: "border-none bg-[var(--purple-bg)] text-[var(--purple-text)]",
    dot: "bg-[var(--purple-text)]",
  },
  orange: {
    badge: "border-none bg-[var(--orange-bg)] text-[var(--orange-text)]",
    dot: "bg-[var(--orange-text)]",
  },
  gray: {
    badge: "border-none bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
} as const;

export type StatusColor = keyof typeof STATUS_STYLES;

/**
 * Maps a computed equipment status to a StatusColor key.
 * Use with STATUS_STYLES[statusColor(status)] for the dot+badge pattern.
 */
export function statusColor(
  computedStatus: string,
  isOverdue?: boolean,
): StatusColor {
  if (isOverdue) return "red";
  switch (computedStatus) {
    case "AVAILABLE":
      return "green";
    case "CHECKED_OUT":
      return "blue";
    case "RESERVED":
      return "purple";
    case "MAINTENANCE":
      return "orange";
    case "RETIRED":
      return "gray";
    default:
      return "gray";
  }
}

"use client";

import type { BadgeProps } from "@/components/ui/badge";
import {
  OperationalMetricCard,
  type OperationalMetricDelta,
} from "@/components/OperationalFeedback";

type MetricCardProps = {
  label: string;
  value: number | string;
  color?: string;
  badge?: { text: string; variant: BadgeProps["variant"] };
  tooltip?: string;
  /** Optional drill-down link (e.g., to a filtered checkouts list) */
  href?: string;
  /** Prior-period comparison. Omit when no comparable window exists. */
  delta?: OperationalMetricDelta;
  /** Recent trend points, oldest first. */
  sparkline?: number[];
  helper?: string;
};

export default function MetricCard({
  label,
  value,
  color,
  badge,
  tooltip,
  href,
  delta,
  sparkline,
  helper,
}: MetricCardProps) {
  return (
    <OperationalMetricCard
      label={label}
      value={value}
      badge={badge}
      tooltip={tooltip}
      href={href}
      delta={delta}
      sparkline={sparkline}
      helper={helper}
      valueStyle={color ? { color } : undefined}
      className="min-h-[108px]"
    />
  );
}

"use client";

import type { BadgeProps } from "@/components/ui/badge";
import { OperationalMetricCard } from "@/components/OperationalFeedback";

type MetricCardProps = {
  label: string;
  value: number | string;
  color?: string;
  badge?: { text: string; variant: BadgeProps["variant"] };
  tooltip?: string;
  /** Optional drill-down link (e.g., to a filtered checkouts list) */
  href?: string;
};

export default function MetricCard({ label, value, color, badge, tooltip, href }: MetricCardProps) {
  return (
    <OperationalMetricCard
      label={label}
      value={value}
      badge={badge}
      tooltip={tooltip}
      href={href}
      valueStyle={color ? { color } : undefined}
      className="min-h-[108px]"
    />
  );
}

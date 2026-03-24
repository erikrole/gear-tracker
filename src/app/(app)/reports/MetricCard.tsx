"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const card = (
    <Card className={`p-4 text-center${href ? " transition-colors hover:bg-muted/50 cursor-pointer" : ""}`}>
      <div className="text-3xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-sm text-muted-foreground">
        {badge ? (
          <Badge variant={badge.variant}>{badge.text}</Badge>
        ) : (
          label
        )}
      </div>
    </Card>
  );

  const wrapped = href ? (
    <Link href={href} className="no-underline">{card}</Link>
  ) : card;

  if (!tooltip) return wrapped;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{wrapped}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

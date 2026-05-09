"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    <Card
      className={cn(
        "min-h-[108px] justify-center",
        href && "cursor-pointer transition-[background-color,box-shadow,scale] hover:bg-muted/50 active:scale-[0.99]",
      )}
    >
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="text-sm font-medium text-muted-foreground text-pretty">
          {label}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="text-3xl font-semibold tracking-normal tabular-nums" style={color ? { color } : undefined}>
            {value}
          </div>
          {badge ? <Badge variant={badge.variant}>{badge.text}</Badge> : null}
        </div>
      </CardContent>
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

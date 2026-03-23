"use client";

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
};

export default function MetricCard({ label, value, color, badge, tooltip }: MetricCardProps) {
  const card = (
    <Card className="p-4 text-center">
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

  if (!tooltip) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

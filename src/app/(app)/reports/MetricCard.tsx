"use client";

import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type MetricCardProps = {
  label: string;
  value: number | string;
  color?: string;
  badge?: { text: string; variant: BadgeProps["variant"] };
};

export default function MetricCard({ label, value, color, badge }: MetricCardProps) {
  return (
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
}

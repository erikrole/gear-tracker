"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const VARIANT_COLORS: Record<string, string> = {
  green: "text-[var(--green-text)]",
  blue: "text-[var(--blue-text)]",
  red: "text-destructive",
  purple: "text-[var(--purple-text)]",
};

export function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: string;
}) {
  return (
    <Card className="p-4 text-center">
      <div className={cn("text-3xl font-bold", variant ? VARIANT_COLORS[variant] : "text-foreground")}>
        {value}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}

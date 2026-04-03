"use client";

import { Card } from "@/components/ui/card";

const VARIANT_COLORS: Record<string, string> = {
  green: "text-green-600 dark:text-green-400",
  blue: "text-blue-600 dark:text-blue-400",
  red: "text-destructive",
  purple: "text-purple-600 dark:text-purple-400",
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
      <div className={`text-3xl font-bold ${variant ? VARIANT_COLORS[variant] || "" : "text-foreground"}`}>
        {value}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}

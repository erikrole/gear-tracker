import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OperationalTone = "red" | "orange" | "green" | "muted";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function OperationalMetricCard({
  className,
  label,
  tone = "muted",
  value,
}: {
  className?: string;
  label: string;
  tone?: OperationalTone;
  value: number;
}) {
  const toneClass = {
    red: "text-[var(--red-text)]",
    orange: "text-[var(--orange-text)]",
    green: "text-[var(--green-text)]",
    muted: "text-foreground",
  }[tone];

  return (
    <Card className={cn("border-border/40 shadow-none", className)}>
      <CardContent className="p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass)}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export function OperationalPartialResultsAlert({
  className,
  failures,
  noun = "check",
  title = "Some checks did not load",
}: {
  className?: string;
  failures: string[];
  noun?: string;
  title?: string;
}) {
  if (failures.length === 0) return null;

  return (
    <Alert className={cn("border-[var(--orange)]/40 bg-[var(--orange-bg)]", className)}>
      <AlertTriangle className="size-4 text-[var(--orange-text)]" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        {pluralize(failures.length, noun)} could not finish. Refresh before treating a clean result as final.
        <span className="block pt-1 text-xs">
          Failed checks: {failures.join(", ")}.
        </span>
      </AlertDescription>
    </Alert>
  );
}

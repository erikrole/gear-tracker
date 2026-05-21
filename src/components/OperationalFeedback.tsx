import Link from "next/link";
import type { CSSProperties } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type OperationalTone = "red" | "orange" | "green" | "blue" | "purple" | "muted";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function OperationalMetricCard({
  badge,
  className,
  helper,
  href,
  label,
  tone = "muted",
  value,
  valueStyle,
  tooltip,
}: {
  badge?: { text: string; variant: BadgeProps["variant"] };
  className?: string;
  helper?: string;
  href?: string;
  label: string;
  tone?: OperationalTone;
  value: number | string;
  valueStyle?: CSSProperties;
  tooltip?: string;
}) {
  const toneClass = {
    red: "text-[var(--red-text)]",
    orange: "text-[var(--orange-text)]",
    green: "text-[var(--green-text)]",
    blue: "text-[var(--blue-text)]",
    purple: "text-[var(--purple-text)]",
    muted: "text-foreground",
  }[tone];

  const card = (
    <Card
      className={cn(
        "min-h-[104px] border-border/40 shadow-none",
        href && "cursor-pointer transition-[background-color,box-shadow,scale] hover:bg-muted/50 hover:shadow-xs active:scale-[0.99]",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col justify-center p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className={cn("text-2xl font-semibold tabular-nums", toneClass)} style={valueStyle}>
            {value}
          </div>
          {badge ? <Badge variant={badge.variant}>{badge.text}</Badge> : null}
        </div>
        {helper ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {helper}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const wrapped = href ? (
    <Link href={href} className="block min-h-10 rounded-md no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      {card}
    </Link>
  ) : card;

  if (!tooltip) return wrapped;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{wrapped}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
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

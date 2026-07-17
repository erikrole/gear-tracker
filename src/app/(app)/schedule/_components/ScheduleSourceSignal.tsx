import Link from "next/link";
import { AlertTriangleIcon, CalendarCheckIcon, CalendarClockIcon, InfoIcon } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ScheduleSourceSignal as ScheduleSourceSignalData } from "@/lib/calendar-source-freshness";

function signalIcon(signal: ScheduleSourceSignalData) {
  if (signal.status === "loading") return <CalendarClockIcon className="size-3.5" />;
  if (signal.severity === "attention") return <AlertTriangleIcon className="size-3.5" />;
  if (signal.severity === "ok") return <CalendarCheckIcon className="size-3.5" />;
  return <InfoIcon className="size-3.5" />;
}

function CountBadge({
  label,
  value,
  variant = "gray",
}: {
  label: string;
  value: number;
  variant?: BadgeProps["variant"];
}) {
  if (value <= 0) return null;
  return (
    <Badge variant={variant} size="sm">
      {label} {value}
    </Badge>
  );
}

export function ScheduleSourceSignal({ signal }: { signal: ScheduleSourceSignalData | null }) {
  if (!signal) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-10 gap-1.5 text-[13px]"
          aria-label={`Schedule source status: ${signal.label}`}
        >
          {signalIcon(signal)}
          <span className="max-sm:hidden">{signal.label}</span>
          {signal.manualEvents > 0 && (
            <Badge variant="gray" size="sm" className="ml-0.5">
              Manual {signal.manualEvents}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <Badge variant={signal.variant} size="sm" className="mt-0.5">
              {signal.label}
            </Badge>
            <p className="text-sm text-muted-foreground">{signal.detail}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <CountBadge label="Manual" value={signal.manualEvents} />
            <CountBadge label="Imported" value={signal.importedEvents} variant="green" />
            <CountBadge label="Healthy" value={signal.healthySourceCount} variant="green" />
            <CountBadge label="Stale" value={signal.staleSourceCount} variant="orange" />
            <CountBadge label="Never synced" value={signal.neverSyncedSourceCount} variant="orange" />
            <CountBadge label="Error" value={signal.errorSourceCount} variant="red" />
            <CountBadge label="Disabled" value={signal.disabledSourceCount} />
          </div>

          <Button variant="outline" size="sm" asChild className="h-10 w-fit">
            <Link href="/settings/calendar-sources">Open Calendar Sources</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import Link from "next/link";
import { useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OperationalActiveFilterChips, type OperationalActiveFilter } from "@/components/OperationalToolbar";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import {
  buildReportCsv,
  formatReportExportSuccess,
  reportExportFilename,
  reportLabelFromFilenameBase,
  type CsvValue,
} from "./report-export";

export const REPORT_CHART_COLORS = [
  "var(--report-chart-1)",
  "var(--report-chart-2)",
  "var(--report-chart-3)",
  "var(--report-chart-4)",
  "var(--report-chart-5)",
  "var(--report-chart-6)",
  "var(--report-chart-7)",
  "var(--report-chart-8)",
] as const;

export const REPORT_SEMANTIC_CHART_COLORS = {
  active: "var(--chart-1)",
  available: "var(--chart-2)",
  reserved: "var(--chart-3)",
  waiting: "var(--chart-4)",
  problem: "var(--chart-5)",
  neutral: "var(--text-muted)",
  activeSoft: "var(--report-chart-active-soft)",
} as const;

export const REPORT_OVERDUE_CHART_COLORS = [
  "var(--report-overdue-1)",
  "var(--report-overdue-2)",
  "var(--report-overdue-3)",
  "var(--report-overdue-4)",
  "var(--report-overdue-5)",
  "var(--report-overdue-6)",
  "var(--report-overdue-7)",
  "var(--report-overdue-8)",
  "var(--report-overdue-9)",
  "var(--report-overdue-10)",
] as const;

export function downloadReportCsv(
  filenameBase: string,
  rows: CsvValue[][],
  options?: { reportLabel?: string; rowCount?: number; scopeLabel?: string },
) {
  const blob = new Blob([buildReportCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = reportExportFilename(filenameBase);
  link.click();
  URL.revokeObjectURL(url);
  toast.success(formatReportExportSuccess({
    reportLabel: options?.reportLabel ?? reportLabelFromFilenameBase(filenameBase),
    rowCount: options?.rowCount ?? Math.max(0, rows.length - 1),
    scopeLabel: options?.scopeLabel,
  }));
}

export function ReportExportButton({
  ariaLabel,
  disabled,
  label = "Export visible rows",
  onClick,
}: {
  ariaLabel?: string;
  disabled?: boolean;
  label?: string;
  onClick: () => Promise<void> | void;
}) {
  const busyRef = useRef(false);
  const [exporting, setExporting] = useState(false);

  async function handleClick() {
    if (disabled || busyRef.current) return;
    busyRef.current = true;
    setExporting(true);
    try {
      await onClick();
    } finally {
      window.setTimeout(() => {
        busyRef.current = false;
        setExporting(false);
      }, 750);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || exporting}
      onClick={handleClick}
      aria-label={ariaLabel ?? label}
    >
      <Download data-icon="inline-start" />
      {exporting ? "Exporting..." : label}
    </Button>
  );
}

export function ReportToolbar({
  activeFilters = [],
  children,
  className,
  exportAction,
  lastRefreshed,
  loading,
  now,
  onRefresh,
}: {
  activeFilters?: OperationalActiveFilter[];
  children?: ReactNode;
  className?: string;
  exportAction?: ReactNode;
  lastRefreshed?: Date | null;
  loading?: boolean;
  now: Date;
  onRefresh: () => void;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-lg border bg-card/60 p-3 shadow-xs",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Refresh report">
                <RefreshCw className={cn(loading && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {lastRefreshed ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), now)}` : "Refresh"}
            </TooltipContent>
          </Tooltip>
          {exportAction}
        </div>
      </div>
      <OperationalActiveFilterChips filters={activeFilters} />
    </div>
  );
}

export function ReportToolbarGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function ReportSegmentedControl<TValue extends string | number>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue;
}) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(nextValue) => {
        if (!nextValue) return;
        const next = options.find((option) => String(option.value) === nextValue);
        if (next) onChange(next.value);
      }}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <ToggleGroupItem key={String(option.value)} value={String(option.value)}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function ReportMetricGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
      {children}
    </div>
  );
}

export function ReportSectionCard({
  children,
  className,
  contentClassName,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  title: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="gap-1 pb-3">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function ReportChartCard({
  children,
  className,
  contentClassName,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  title: string;
}) {
  return (
    <ReportSectionCard
      title={title}
      description={description}
      className={className}
      contentClassName={cn("pt-1", contentClassName)}
    >
      {children}
    </ReportSectionCard>
  );
}

export function ReportChartLoading({
  heightClassName = "h-[200px]",
  variant = "bar",
}: {
  heightClassName?: string;
  variant?: "bar" | "donut";
}) {
  return (
    <Card className="p-4">
      <div className={cn("flex w-full items-center justify-center", heightClassName)}>
        <Skeleton
          className={cn(
            variant === "donut" ? "size-[250px] rounded-full" : "h-full w-full",
          )}
        />
      </div>
    </Card>
  );
}

export function ReportLoadingState({
  metricCount = 2,
  rows = 5,
}: {
  metricCount?: number;
  rows?: number;
}) {
  return (
    <>
      <ReportMetricGrid>
        {Array.from({ length: metricCount }, (_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="mb-3 h-7 w-16" />
            <Skeleton className="h-4 w-24" />
          </Card>
        ))}
      </ReportMetricGrid>
      <Card className="p-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-4 py-2.5">
            <Skeleton className="h-4" style={{ width: `${65 - (i % 5) * 8}%` }} />
            <Skeleton className="ml-auto h-4 w-12" />
          </div>
        ))}
      </Card>
    </>
  );
}

export function ReportErrorState({
  error,
  onRetry,
  title,
}: {
  error?: string | null;
  onRetry: () => void;
  title: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span>
          {error === "network"
            ? "You appear to be offline. Check your connection and try again."
            : "Unable to load this report. Please try again."}
        </span>
        <Button variant="outline" size="sm" onClick={onRetry} className="w-fit">
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function ReportEmptyState({
  compact = false,
  description,
  icon = "chart",
  title,
}: {
  compact?: boolean;
  description?: string;
  icon?: "search" | "calendar" | "box" | "clipboard" | "bell" | "users" | "folder" | "chart" | "wifi-off" | "check";
  title: string;
}) {
  return (
    <EmptyState
      compact={compact}
      description={description}
      icon={icon}
      title={title}
    />
  );
}

export function ReportPaginationFooter({
  onNext,
  onPrevious,
  page,
  totalPages,
}: {
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground tabular-nums">
        Page {page + 1} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={onPrevious}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function ReportTableLink({
  children,
  className,
  href,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function ReportMobileCard({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-12 flex-col gap-2 border-b px-4 py-3 text-sm last:border-b-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ReportMobileCardLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-12 flex-col gap-2 border-b px-4 py-3 text-sm no-underline transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function ReportListRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 items-center justify-between gap-4 border-b px-4 py-3 text-sm last:border-b-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ReportMetaLine({
  className,
  items,
}: {
  className?: string;
  items: Array<ReactNode | null | undefined | false>;
}) {
  const visibleItems = items.filter(Boolean);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground", className)}>
      {visibleItems.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-2">
          {index > 0 ? <span aria-hidden="true" className="text-muted-foreground/50">/</span> : null}
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}

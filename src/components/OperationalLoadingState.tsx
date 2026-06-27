"use client";

import { SearchIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type OperationalLoadingStateProps = {
  title: string;
  description?: string;
  variant?: "page" | "sheet" | "inline" | "command";
  rows?: number;
  className?: string;
};

export function OperationalLoadingState({
  title,
  description,
  variant = "inline",
  rows = 4,
  className,
}: OperationalLoadingStateProps) {
  if (variant === "command") {
    return (
      <div
        className={cn("flex flex-col gap-2 px-3 py-3", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={title}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <SearchIcon className="size-3.5" aria-hidden="true" />
          <span>{title}</span>
        </div>
        {Array.from({ length: Math.max(1, rows) }, (_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-md px-1 py-1.5">
            <Skeleton className="size-8 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={cn("h-3.5", index % 2 === 0 ? "w-3/4" : "w-2/3")} />
              <Skeleton className={cn("h-3", index % 2 === 0 ? "w-1/2" : "w-1/3")} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const shellClass =
    variant === "page"
      ? "flex min-h-dvh items-center justify-center bg-background px-6 py-12"
      : variant === "sheet"
        ? "flex flex-col gap-4 px-6 py-5"
        : "flex flex-col gap-4 px-4 py-6";

  const body = (
    <div
      className={cn("flex w-full max-w-[520px] flex-col gap-4", variant === "sheet" && "max-w-none", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: Math.max(1, rows) }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={cn("h-4", index % 2 === 0 ? "w-3/4" : "w-2/3")} />
              <Skeleton className={cn("h-3", index % 2 === 0 ? "w-1/2" : "w-1/3")} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (variant === "page") {
    return <main className={shellClass}>{body}</main>;
  }

  return <div className={shellClass}>{body}</div>;
}

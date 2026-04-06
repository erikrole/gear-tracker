"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode; // Right-side actions
  className?: string;
}

/**
 * Standardized page header for all routes.
 * Gotham Black title, optional description, right-aligned actions.
 * Consistent 32px (mb-8) bottom spacing.
 */
export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-8",
        className
      )}
    >
      <div className="min-w-0 border-l-[3px] border-l-[var(--wi-red)] pl-3">
        <h1 className="truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0 mt-3 sm:mt-0">
          {children}
        </div>
      )}
    </div>
  );
}

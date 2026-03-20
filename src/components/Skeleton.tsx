"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton row: simulates a list item with avatar + two text lines */
export function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <Skeleton className="skeleton-circle" />
      <div className="skeleton-lines">
        <Skeleton className="skeleton-text w-[60%]" />
        <Skeleton className="skeleton-text-sm w-[40%]" />
      </div>
    </div>
  );
}

/** Skeleton card: simulates a dashboard card with header + rows */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="skeleton-text w-[120px]" />
      </CardHeader>
      <CardContent className="p-0 py-1">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-lines flex-1">
              <Skeleton className="skeleton-text" style={{ width: `${70 - i * 10}%` }} />
              <Skeleton className="skeleton-text-sm" style={{ width: `${45 - i * 5}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Skeleton stat strip: simulates the dashboard stat cards */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-strip">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="stat-card">
          <Skeleton className="skeleton-text-sm w-20" />
          <Skeleton className="skeleton-text-lg w-10 mt-2" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton table: simulates a data table */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {Array.from({ length: cols }, (_, i) => (
            <th key={i}><Skeleton className="skeleton-text-sm" style={{ width: `${60 + (i % 3) * 10}%` }} /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }, (_, c) => (
              <td key={c}><Skeleton className="skeleton-text" style={{ width: `${50 + ((r + c) % 4) * 10}%` }} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton row: simulates a list item with avatar + two text lines */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-[60%]" />
        <Skeleton className="h-3 w-[40%]" />
      </div>
    </div>
  );
}

/** Skeleton card: simulates a dashboard card with header + rows */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-[120px]" />
      </CardHeader>
      <CardContent className="p-0 py-1">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5" style={{ width: `${70 - i * 10}%` }} />
              <Skeleton className="h-3" style={{ width: `${45 - i * 5}%` }} />
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-10 mt-2" />
        </Card>
      ))}
    </div>
  );
}

/** Skeleton table: simulates a data table */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full">
      <div className="flex gap-4 px-4 py-2.5 border-b">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${60 + (i % 3) * 10}%`, flex: 1 }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b last:border-0">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="h-3.5" style={{ width: `${50 + ((r + c) % 4) * 10}%`, flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

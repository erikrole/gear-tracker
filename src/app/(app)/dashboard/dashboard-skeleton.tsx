"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-6 max-md:mb-4 max-md:flex-col max-md:items-start max-md:gap-3"><h1 className="text-[30px] tracking-[-0.03em] leading-none m-0 max-md:text-[22px]">Dashboard</h1></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center min-h-16 md:min-h-auto px-2 md:px-3 py-2.5 md:py-3.5 bg-[var(--panel)] border border-border rounded-[var(--radius)]">
            <Skeleton className="h-7 w-10 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
        <div className="flex flex-col gap-5">
          {[3, 3].map((rows, i) => (
            <Card key={i}>
              <CardHeader className="border-b border-border/50">
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="p-0 py-1">
                {Array.from({ length: rows }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4" style={{ width: `${70 + (j % 3) * 10}%` }} />
                      <Skeleton className="h-3" style={{ width: `${40 + (j % 2) * 15}%` }} />
                    </div>
                    <Skeleton className="size-6 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          {[4, 3].map((rows, i) => (
            <Card key={i}>
              <CardHeader className="border-b border-border/50">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="p-0 py-1">
                {Array.from({ length: rows }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4" style={{ width: `${65 + (j % 3) * 12}%` }} />
                      <Skeleton className="h-3" style={{ width: `${45 + (j % 2) * 10}%` }} />
                    </div>
                    <Skeleton className="size-6 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <>
      <div className="page-header"><h1>Dashboard</h1></div>
      <div className="stat-strip">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-strip-item">
            <Skeleton className="h-7 w-10 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="dashboard-split">
        <div className="dashboard-col dashboard-col-left">
          {[3, 3].map((rows, i) => (
            <Card key={i}>
              <CardHeader className="border-b border-border/50">
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="p-0 py-1">
                {Array.from({ length: rows }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-5 py-3" style={{ animationDelay: `${(i * rows + j) * 40}ms` }}>
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
        <div className="dashboard-col dashboard-col-right">
          {[4, 3].map((rows, i) => (
            <Card key={i}>
              <CardHeader className="border-b border-border/50">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="p-0 py-1">
                {Array.from({ length: rows }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-5 py-3" style={{ animationDelay: `${(i * rows + j) * 40}ms` }}>
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

"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton matching the event detail page layout */
export function EventSkeleton() {
  return (
    <div className="space-y-6">
      {/* PageHeader */}
      <Skeleton className="h-8 w-72" />

      {/* Badge strip */}
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Action CTA buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-11 w-52" />
        <Skeleton className="h-11 w-48" />
      </div>

      {/* Details card */}
      <Card>
        <CardHeader><Skeleton className="h-5 w-16" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>

      {/* Shift Coverage card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}

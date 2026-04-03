"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton matching the event detail page layout */
export function EventSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-72" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-52" />
        <Skeleton className="h-11 w-48" />
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-16" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    </div>
  );
}

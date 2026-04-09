"use client";

import { Suspense } from "react";
import { BookingWizard } from "@/components/booking-wizard/BookingWizard";
import { Skeleton } from "@/components/ui/skeleton";

function WizardSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="space-y-4 mt-8">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export default function NewReservationPage() {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <BookingWizard kind="RESERVATION" />
    </Suspense>
  );
}

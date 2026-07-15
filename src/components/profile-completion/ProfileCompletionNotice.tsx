"use client";

import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { openProfileCompletion } from "@/lib/profile-completion-events";
import type { ProfileCompletionField } from "@/lib/profile-completion";
import { useProfileCompletion } from "@/hooks/use-profile-completion";

const FIELD_LABELS: Record<ProfileCompletionField, string> = {
  campusEmail: "Campus login email",
  athleticsEmail: "Athletics email",
  personalPhone: "Personal phone",
  workPhone: "Work phone",
  wiscard: "Wiscard",
  clothingSize: "Clothing size",
  shoeSize: "Shoe size",
};

export function ProfileCompletionNotice() {
  const { data, isLoading, isError } = useProfileCompletion();
  if (isLoading || isError || !data) return null;

  if (data.completion.isComplete) {
    return (
      <Alert className="mb-4 hidden md:block">
        <CheckCircle2Icon />
        <AlertTitle>Profile details complete</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <p>Your contact, Wiscard, and apparel details are available for review.</p>
          <Button type="button" variant="outline" size="sm" onClick={openProfileCompletion}>
            Review details
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 hidden border-[var(--orange)]/50 bg-[var(--orange-bg)] md:block">
      <AlertCircleIcon />
      <AlertTitle>Complete your profile</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          {data.completion.completedCount} of {data.completion.totalCount} details are complete. Add the remaining information so contact, Wiscard, and apparel records stay useful.
        </p>
        <div className="flex flex-wrap gap-2" aria-label="Missing profile details">
          {data.completion.missingFields.map((field) => (
            <Badge key={field} variant="orange" size="sm">Needed: {FIELD_LABELS[field]}</Badge>
          ))}
        </div>
        <div>
          <Button type="button" size="sm" onClick={openProfileCompletion}>
            Complete profile
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

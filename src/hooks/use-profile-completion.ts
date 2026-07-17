"use client";

import { useQuery } from "@tanstack/react-query";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import type { ProfileCompletionField, ProfileCompletionStep } from "@/lib/profile-completion";
import type { GraduationTermValue, StudentYearValue } from "@/lib/student-profile";

export type ProfileCompletionResponse = {
  profile: {
    role: "ADMIN" | "STAFF" | "STUDENT" | "COLLABORATOR";
    email: string;
    athleticsEmail: string | null;
    phone: string | null;
    personalPhone: string | null;
    workPhone: string | null;
    workPhoneNotApplicable: boolean;
    wiscardCardNumber: string | null;
    wiscardIssueCode: string | null;
    studentYearOverride: StudentYearValue | null;
    gradYear: number | null;
    graduationTerm: GraduationTermValue | null;
    topSizeFit: "UNISEX" | "WOMENS" | "MENS" | null;
    topSize: string | null;
    shoeSizeSystem: "US_WOMENS" | "US_MENS" | null;
    shoeSize: string | null;
    profilePromptSnoozedUntil: string | null;
  };
  completion: {
    isComplete: boolean;
    isSnoozed: boolean;
    shouldPrompt: boolean;
    snoozedUntil: string | null;
    completedCount: number;
    totalCount: number;
    missingFields: ProfileCompletionField[];
    firstIncompleteStep: ProfileCompletionStep | null;
    completeByField: Record<ProfileCompletionField, boolean>;
  };
};

type ApiEnvelope = { data?: ProfileCompletionResponse };

export const PROFILE_COMPLETION_QUERY_KEY = ["profile-completion"] as const;

export function useProfileCompletion(enabled = true) {
  return useQuery<ProfileCompletionResponse | null>({
    queryKey: PROFILE_COMPLETION_QUERY_KEY,
    enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/me/profile-completion", { signal });
      if (handleAuthRedirect(response)) return null;
      if (!response.ok) throw new Error("Could not load profile completion");
      const json = await parseJsonSafely<ApiEnvelope>(response);
      if (!json?.data) throw new Error("Profile completion response was incomplete");
      return json.data;
    },
    staleTime: 30_000,
  });
}

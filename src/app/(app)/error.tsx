"use client";

import { useEffect } from "react";
import { ErrorRecoveryPanel } from "@/components/ErrorRecoveryPanel";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <ErrorRecoveryPanel
      title="This workspace page stopped responding"
      description="Retry before changing gear, booking, schedule, or settings data. If your session expired, sign in again and return to this workflow."
      reset={reset}
      retryLabel="Retry page"
      secondaryHref="/login"
      secondaryLabel="Sign in"
      secondaryIcon="login"
      digest={error.digest}
    />
  );
}

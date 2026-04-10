"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="px-10 text-center max-w-[480px] mt-20 mx-auto">
      <h1 className="text-2xl mb-3">Something went wrong</h1>
      <p className="text-muted-foreground mb-6">
        This may be caused by an expired session or a temporary loading issue.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <a href="/login">Sign in</a>
        </Button>
      </div>
    </div>
  );
}

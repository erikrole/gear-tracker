"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="mx-auto my-20 flex max-w-[480px] flex-col items-center gap-6 px-10 text-center font-sans">
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              Try refreshing the page, or sign in again if the issue persists.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button type="button" onClick={reset}>
              Try again
            </Button>
            <Button asChild variant="outline">
              <a href="/login">Sign in</a>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}

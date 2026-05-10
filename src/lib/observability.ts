import * as Sentry from "@sentry/nextjs";

export function captureBadgeError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  console.error("event=badge_evaluator_failed", {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  });

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: { area: "badges" },
      extra: context,
    });
  }
}

export function captureBadgeError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  console.error("event=badge_evaluator_failed", {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  });
}

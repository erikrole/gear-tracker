/**
 * Shared detection and retry for PostgreSQL serialization conflicts.
 *
 * `SERIALIZABLE` transactions abort with SQLSTATE 40001 when two callers race
 * the same rows. Prisma surfaces that as `P2034`, but the Neon adapter can also
 * pass the raw driver code through as `40001` (either on `code` or `meta.code`),
 * so both shapes must be treated as the same retryable outcome.
 *
 * Intentionally dependency-free: `http.ts` imports this, so any import back into
 * the app's Prisma or HTTP layers would create a cycle.
 */

const SERIALIZATION_FAILURE = "40001";
const PRISMA_SERIALIZATION_FAILURE = "P2034";

/** True when the error is a retryable serialization conflict. */
export function isSerializationConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const metaCode = (error as { meta?: { code?: unknown } }).meta?.code;
  return (
    code === PRISMA_SERIALIZATION_FAILURE
    || code === SERIALIZATION_FAILURE
    || metaCode === SERIALIZATION_FAILURE
  );
}

/**
 * Run `operation`, retrying once if it loses a serialization race.
 *
 * The retry re-runs the whole operation, so callers that buffer side effects
 * (emails, pushes, badge events) must reset those buffers in `onRetry` or they
 * will double-send on the second attempt.
 */
export async function withSerializationRetry<T>(
  operation: () => Promise<T>,
  options: { onRetry?: () => void } = {},
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isSerializationConflict(error)) throw error;
    options.onRetry?.();
    return operation();
  }
}

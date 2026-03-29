import { vi } from "vitest";

type MockModel = Record<string, ReturnType<typeof vi.fn>>;

/**
 * Create a mock transaction client with the given model mocks.
 * Each model should be an object of vi.fn() stubs.
 */
export function createMockTx(models: Record<string, MockModel>) {
  return models;
}

/**
 * Creates the full db mock object that includes $transaction and direct model access.
 * Returns { db, mockTx, transactionCalls }.
 */
export function createMockDb(models: Record<string, MockModel>) {
  const mockTx = createMockTx(models);
  const transactionCalls: Array<{ options: unknown }> = [];

  const db = {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
      transactionCalls.push({ options });
      return fn(mockTx);
    }),
    // Expose direct model access for non-transactional queries
    ...Object.fromEntries(
      Object.entries(models).map(([key, model]) => [key, model])
    ),
    // Internal: expose mockTx for direct access in tests
    _mockTx: mockTx,
  };

  return { db, mockTx, transactionCalls };
}

/**
 * Wires transactionCalls tracking via globalThis for modules
 * that use the globalThis.__transactionCalls pattern.
 */
export function setupTransactionTracking(transactionCalls: Array<{ options: unknown }>) {
  (globalThis as any).__transactionCalls = transactionCalls;
}

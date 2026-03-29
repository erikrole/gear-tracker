import { expect } from "vitest";

type TransactionCall = { options: unknown };

/**
 * Assert a specific transaction call used SERIALIZABLE isolation.
 */
export function expectSerializableIsolation(
  transactionCalls: TransactionCall[],
  callIndex = 0
) {
  expect(transactionCalls.length).toBeGreaterThan(callIndex);
  expect(transactionCalls[callIndex].options).toEqual({
    isolationLevel: "Serializable",
  });
}

/**
 * Assert a specific transaction call used NO isolation level (default).
 * This is the "bug proof" assertion — the transaction was called without
 * specifying an isolation level, which means READ COMMITTED by default.
 */
export function expectNoIsolation(
  transactionCalls: TransactionCall[],
  callIndex = 0
) {
  expect(transactionCalls.length).toBeGreaterThan(callIndex);
  expect(transactionCalls[callIndex].options).toBeUndefined();
}

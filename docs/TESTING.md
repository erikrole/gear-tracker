# Testing Guide

## Overview

The test suite uses **Vitest** with Node.js environment. Tests live in `tests/` and follow the naming convention `tests/<feature>.test.ts`.

**Current state:** As of 2026-06-11, `npm test` passes 196 test files and 1153 tests covering services, RBAC, API wrappers, route handlers, source contracts, and iOS guardrails. Treat these counts as a snapshot; run `npm test` for the current count.

## Running Tests

```bash
# Full suite
npm test

# Single file
npx vitest run tests/shift-trades.test.ts

# Watch mode
npx vitest tests/shift-trades.test.ts

# With coverage
npx vitest run --coverage
```

## Mock Pattern: `vi.mock("@/lib/db")` + `_mockTx`

Most service functions use `db.$transaction()`. The standard mock pattern intercepts transactions and provides a mock transaction client:

```ts
const transactionCalls: Array<{ options: unknown }> = [];

vi.mock("@/lib/db", () => {
  const mockTx = {
    booking: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    // ... add models as needed
  };

  return {
    db: {
      $transaction: vi.fn(async (fn, options?) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      _mockTx: mockTx,
    },
  };
});

import { db } from "@/lib/db";
const mockTx = (db as any)._mockTx;
```

### Key principles:
1. **`vi.mock` must be at module scope** — hoisted above imports
2. **`transactionCalls` tracks isolation levels** — verify SERIALIZABLE usage
3. **`_mockTx` exposes the tx for test assertions**
4. **`beforeEach` clears mocks and resets tracking**

## Transaction Isolation Verification

Use helpers from `tests/_helpers/assert-transaction.ts`:

```ts
import { expectSerializableIsolation, expectNoIsolation } from "./_helpers/assert-transaction";

// Assert a function uses SERIALIZABLE
expectSerializableIsolation(transactionCalls, 0);

// Assert a function uses NO isolation (bug proof)
expectNoIsolation(transactionCalls, 0);
```

## Data Factories

`tests/_helpers/factories.ts` provides override-friendly factories:

```ts
import { makeBooking, makeUser, makeBulkItem } from "./_helpers/factories";

const booking = makeBooking({ status: "COMPLETED" });
const user = makeUser({ role: "ADMIN" });
```

Available: `makeUser`, `makeBooking`, `makeSerializedItem`, `makeBulkItem`, `makeAsset`, `makeShiftTrade`, `makeShiftAssignment`, `makeShift`, `makeBulkSku`, `makeBulkStockBalance`.

## Testing Functions That Accept `tx`

Some functions (e.g., `checkAvailability`, `checkSerializedConflicts`) accept a transaction client as a parameter. These don't need `vi.mock("@/lib/db")` — create a local mock:

```ts
function createMockTx() {
  return {
    assetAllocation: { findMany: vi.fn() },
    asset: { findMany: vi.fn() },
  };
}

const tx = createMockTx();
const result = await checkSerializedConflicts(tx as any, { ... });
```

## Bug And Regression Documentation Convention

Use the `BUG:` prefix only for a test that intentionally proves a currently open bug. These tests should be rare, explicit, and tied to a tracked fix plan or risk entry.

```ts
it("BUG: password reset consumes the token inside a Serializable transaction", async () => {
  // ... test that asserts the intended hardening is still missing
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "Serializable",
  });
});
```

When the bug is fixed, rename the test around the expected behavior and keep it as regression coverage. Do not leave fixed behavior documented as a live `BUG:`.

Current regression examples:

| Regression | File | Expected behavior |
|------------|------|-------------------|
| `claimTrade` double-claim race | `shift-trades.test.ts` | Uses SERIALIZABLE isolation |
| Bulk scan TOCTOU gap | `bulk-scan-race.test.ts` | Re-reads guard state and increments in one SERIALIZABLE transaction |
| `markCheckoutCompleted` double-return | `mark-checkout-completed.test.ts` | Returns only the not-yet-checked-in quantity |
| CSRF bypass with missing or cross-site Origin | `api-wrapper.test.ts` | Blocks unsafe cross-origin mutating requests before the handler runs |

Current open bug proofs should still use `BUG:`. For example, `auth-hardening.test.ts` currently documents password-change and reset hardening gaps that must remain visible until the implementation catches up.

## Adding a New Test File

1. Create `tests/<feature>.test.ts`
2. Add `vi.mock("@/lib/db")` block with required models
3. Import the function under test **after** `vi.mock`
4. Add `beforeEach` to clear mocks and reset `transactionCalls`
5. Write tests using factories and assertion helpers
6. Run `npx vitest run tests/<feature>.test.ts` to verify

## File Structure

```
tests/
├── _setup.ts                    # Global beforeEach (clearAllMocks)
├── _helpers/
│   ├── mock-db.ts               # Reusable mock DB factory
│   ├── factories.ts             # Data factories
│   └── assert-transaction.ts    # Transaction isolation assertions
├── shift-trades.test.ts         # Shift trade lifecycle and isolation regressions
├── bulk-scan-race.test.ts       # Atomic bulk scan guard regressions
├── mark-checkout-completed.test.ts  # Checkout completion and stock return regressions
├── availability.test.ts         # Availability checking
├── create-booking.test.ts       # Booking creation
├── extend-booking.test.ts       # Booking extension
├── checkin-bulk-item.test.ts    # Bulk item check-in
├── rbac.test.ts                 # Role-based access control
├── api-wrapper.test.ts          # withAuth/withHandler + CSRF
├── auth-hardening.test.ts       # Current auth hardening bug proofs
├── ios-*.test.ts                # iOS source, API, and UX guardrails
├── role-escalation.test.ts      # Role change API route
├── transaction-safety.test.ts   # Scan transaction safety
└── ... (other existing tests)
```

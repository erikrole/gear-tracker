# Testing Guide

## Overview

The test suite uses **Vitest** with Node.js environment. Tests live in `tests/` and follow the naming convention `tests/<feature>.test.ts`.

**Current state:** 327 tests across 22 files covering services, RBAC, API wrappers, and route handlers.

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

## Bug Documentation Convention

Tests that prove known bugs use the `BUG:` prefix in both the test name and comments:

```ts
it("BUG: uses no transaction isolation level (double-claim possible)", async () => {
  // ... test that asserts the buggy behavior exists
  expectNoIsolation(transactionCalls, 0);
});
```

### Known Bugs Documented by Tests

| Bug | File | Test |
|-----|------|------|
| `claimTrade` missing isolation level | `shift-trades.test.ts` | "BUG: uses no transaction isolation level" |
| Bulk scan TOCTOU gap | `bulk-scan-race.test.ts` | "BUG: quantity guard reads outside the increment transaction" |
| `markCheckoutCompleted` double-return | `mark-checkout-completed.test.ts` | "BUG: returns checkedOutQuantity without subtracting checkedInQuantity" |
| CSRF bypass with missing Origin | `api-wrapper.test.ts` | "BUG: allows POST when Origin header is absent" |

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
├── shift-trades.test.ts         # Shift trade lifecycle
├── bulk-scan-race.test.ts       # Bulk scan TOCTOU bug proof
├── mark-checkout-completed.test.ts  # Completion + double-return bug
├── availability.test.ts         # Availability checking
├── create-booking.test.ts       # Booking creation
├── extend-booking.test.ts       # Booking extension
├── checkin-bulk-item.test.ts    # Bulk item check-in
├── rbac.test.ts                 # Role-based access control
├── api-wrapper.test.ts          # withAuth/withHandler + CSRF
├── role-escalation.test.ts      # Role change API route
├── transaction-safety.test.ts   # Scan transaction safety
└── ... (other existing tests)
```

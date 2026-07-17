# Plan 061: Centralize shift-trade post-commit side effects

> **Executor instructions**: Follow each step and gate. Preserve transaction boundaries. Stop on any STOP condition and report it. Update plan 061 in `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat 189ea5ab..HEAD -- src/lib/services/shift-trades.ts src/lib/services/shift-trade-emails.ts tests/shift-trades.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `189ea5ab`, 2026-07-16

## Why this matters

Five shift-trade transitions repeat the same post-transaction push dispatch and email dispatch. Claim and approval also construct identical schedule payloads twice, once for the durable in-app notification and again for push. The durable notification correctly belongs inside each SERIALIZABLE transaction; only the best-effort post-commit orchestration should be shared.

## Current state

- `shift-trades.ts` accumulates `pushJobs`, `emailJobs`, and sometimes `badgeJobs` while the transaction runs.
- Repeated post-commit shape at lines 206, 347, 440, 529, and 607:

```ts
await Promise.allSettled(pushJobs.map((job) =>
  sendPushToUser(job.userId, {
    title: job.title,
    body: job.body,
    payload: job.payload,
    category: "trade",
  }),
));
await sendShiftTradeEmails(emailJobs);
```

- Badge jobs are transition-specific and currently run after commit.
- `notify(...)` durable notification writes occur inside transactions and must stay there.
- `tests/shift-trades.test.ts` heavily mocks database and notification collaborators; extend those patterns rather than introducing network behavior.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/shift-trades.test.ts` | all pass |
| Typecheck | `npx tsc --noEmit --pretty false` | exits 0 |
| Lint | `npx eslint src/lib/services/shift-trades.ts src/lib/services/shift-trade-emails.ts tests/shift-trades.test.ts` | exits 0 |
| Build | `npm run build:app` | succeeds |

## Scope

**In scope**:

- `src/lib/services/shift-trades.ts`
- `tests/shift-trades.test.ts`
- `src/lib/services/shift-trade-emails.ts` only if a shared exported job type naturally belongs there

**Out of scope**:

- Trade state transitions, permissions, SERIALIZABLE isolation, assignment writes, or audit behavior
- Notification database schema, delivery provider, email templates, or push categories
- Moving durable notification creation outside transactions
- Converting this work to a queue/workflow system
- General refactoring of the 900-line service

## Git workflow

- Suggested branch: `codex/061-shift-trade-side-effects`
- Commit if requested: `refactor: centralize shift trade delivery side effects`

## Steps

### Step 1: Add focused regression coverage

In `tests/shift-trades.test.ts`, identify representative transitions that queue push/email with and without badges. Ensure tests prove:

- Push and email dispatch occur after a successful transaction.
- A rejected push promise does not prevent email dispatch or fail the completed transition.
- The payload handed to the durable notification and push is equal for claim/approval.
- Badge behavior remains unchanged.

Use existing mocks. Do not assert private helper names.

### Step 2: Define one private dispatcher

In `shift-trades.ts`, define named job types once and add a private helper such as:

```ts
async function dispatchTradeSideEffects({ pushJobs, emailJobs }: {
  pushJobs: TradePushJob[];
  emailJobs: ShiftTradeEmail[];
}) {
  await Promise.allSettled(/* push jobs */);
  await sendShiftTradeEmails(emailJobs);
}
```

Keep it private unless another module already needs the same contract. Do not include badge jobs unless doing so clearly reduces repetition without changing their failure semantics.

**Verify**: focused tests pass.

### Step 3: Reuse payload objects

In claim and approval paths, compute `scheduleNotificationPayload(...)` once, then pass the same object to `notify` and the push job. Apply the same cleanup anywhere else the exact same payload is constructed twice.

### Step 4: Replace repeated dispatch blocks

Replace all five copied push/email blocks with the helper. Preserve ordering relative to badge jobs and transaction completion. Do not run push or email inside the transaction.

**Verify**: `rg -n 'Promise\.allSettled\(pushJobs\.map|sendShiftTradeEmails\(emailJobs\)' src/lib/services/shift-trades.ts` → one pair of matches inside the shared helper.

### Step 5: Run full gates

Run focused tests, TypeScript, lint, `build:app`, and `git diff --check`. Inspect the diff for any mutation-path or copy change.

## Test plan

- Extend `tests/shift-trades.test.ts` using its current database transaction and delivery mocks.
- Cover post-commit ordering, best-effort push failure, email continuation, payload identity, and unchanged badge dispatch.
- No source-text tests.

## Done criteria

- [ ] One helper owns shift-trade push/email post-commit delivery.
- [ ] Durable notification creation remains transaction-owned.
- [ ] Serializable transaction options and trade state writes are unchanged.
- [ ] Duplicate schedule payload construction is removed.
- [ ] Focused tests, TypeScript, lint, app build, and diff check pass.
- [ ] Plan 061 status is updated.

## STOP conditions

- Existing tests show a transition intentionally uses different push/email failure semantics.
- The helper would move side effects into a transaction.
- A behavior change to notification copy, recipient, payload, or category is required.
- Verification fails twice.

## Maintenance notes

Keep state mutation and durable in-app notification creation explicit in each transition. The shared helper owns delivery mechanics only. If delivery later moves to a queue, this helper becomes the single replacement boundary.


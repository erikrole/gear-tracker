# Plan 047: Apply Step 3 bulk shortage recovery

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/components/booking-wizard/BookingWizard.tsx src/components/booking-wizard/flow-summary.ts tests/booking-create-ux.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Submit-time 409 recovery already removes serialized assets that the server reports as conflicting or unavailable. Bulk SKU shortages are only mentioned in the inline message, leaving the too-high bulk quantity selected when the user returns to Step 2. The user must infer and manually repair a state the server already described. This plan makes bulk shortage recovery match the serialized asset recovery pattern.

## Current state

- `BookingWizard.tsx` builds the create payload from the selected serialized asset ids and selected bulk items:

```tsx
// src/components/booking-wizard/BookingWizard.tsx:373-381
const payload: Record<string, unknown> = {
  title: form.title.trim(),
  requesterUserId: form.requester,
  locationId: form.locationId,
  startsAt: new Date(form.startsAt).toISOString(),
  endsAt: new Date(form.endsAt).toISOString(),
  serializedAssetIds: resolvedSelectedAssetIds,
  bulkItems: selectedBulkItems,
};
```

- `BookingWizard.tsx` parses 409 responses with `shortages`:

```tsx
// src/components/booking-wizard/BookingWizard.tsx:405-413
const json = await parseJsonSafely<{
  error?: string;
  data?: {
    id?: string;
    refNumber?: string | null;
    conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string }>;
    unavailableAssets?: Array<{ assetId: string; status: string }>;
    shortages?: Array<{ bulkSkuId: string; requested: number; available: number }>;
  };
}>(res);
```

- Serialized asset conflicts are automatically removed, but bulk shortages only add text to the message:

```tsx
// src/components/booking-wizard/BookingWizard.tsx:416-439
if (res.status === 409 && json?.data) {
  const msgs: string[] = [];
  const d = json.data;
  // Auto-remove conflicting/unavailable assets so user doesn't have to find them manually
  const tagFor = (id: string) => selectedAssetDetails.find((a) => a.id === id)?.assetTag || id;
  const conflictingAssetIds = new Set<string>([
    ...(d.conflicts?.map((c) => c.assetId) ?? []),
    ...(d.unavailableAssets?.map((u) => u.assetId) ?? []),
  ]);
  msgs.push(
    ...(d.conflicts?.map((c) => `${tagFor(c.assetId)} conflicts with another booking`) ?? []),
    ...(d.unavailableAssets?.map((u) => `${tagFor(u.assetId)} is ${u.status === "MAINTENANCE" ? "in maintenance" : u.status.toLowerCase()}`) ?? []),
    ...(d.shortages?.map((s) => `${bulkSkus.find((sk) => sk.id === s.bulkSkuId)?.name || s.bulkSkuId}: only ${s.available} available (requested ${s.requested})`) ?? []),
  );
  if (conflictingAssetIds.size > 0) {
    setSelectedAssetIds((prev) => prev.filter((id) => !conflictingAssetIds.has(id)));
  }
  const removedCount = conflictingAssetIds.size;
  const conflictMessage = msgs.length > 0 ? msgs.join(". ") : json?.error || "Availability conflict";
  const removalNote = removedCount > 0
    ? `${removedCount} item${removedCount !== 1 ? "s" : ""} removed from your selection.`
    : "";
  setCreateError(removalNote ? `${conflictMessage}. ${removalNote}` : conflictMessage);
  setStep(2);
}
```

The excerpt above paraphrases the quote characters around "another booking" to keep this plan ASCII-only; the logic and file location are the relevant facts.

- `tests/booking-create-ux.test.ts` already houses booking wizard pure helper tests for warning counts and labels.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npx vitest run tests/booking-create-ux.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/booking-wizard/flow-summary.ts` or a new small helper file under `src/components/booking-wizard/`
- `tests/booking-create-ux.test.ts`
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

**Out of scope**:
- Do not change server-side shortage detection.
- Do not change the 409 API response shape.
- Do not change serialized asset recovery except to share helper structure if that makes tests simple.
- Do not add a broad toast or modal flow for conflicts.

## Git workflow

- Branch: `advisor/047-step3-bulk-shortage-recovery`
- Commit style: conventional commit, for example `fix: adjust bulk quantities after booking conflict`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Extract a tiny 409 recovery helper

Move only the state-free parts of submit conflict recovery into a pure helper so it can be tested. The helper can live in `src/components/booking-wizard/flow-summary.ts` if it remains UI-flow related, or a new focused file such as `src/components/booking-wizard/conflict-recovery.ts`.

The helper should accept:

- current `selectedBulkItems`
- shortage rows from the server
- an optional SKU name lookup

It should return:

- `nextBulkItems`, where each shortage clamps the selected quantity to `available`, and removes the row if `available <= 0`
- a count of adjusted or removed bulk rows
- message fragments suitable for the existing inline error banner

Rules:
- Never increase a selected quantity.
- Ignore shortage rows for SKUs that are not currently selected.
- Treat negative `available` as 0.
- Preserve unrelated selected bulk rows.

**Verify**: `npx vitest run tests/booking-create-ux.test.ts` should still pass before wiring if you only added tests after the helper. If tests are added in the next step, use `npx tsc --noEmit` here instead.

### Step 2: Add helper tests

Add focused tests in `tests/booking-create-ux.test.ts`.

Cover:
- `requested: 5, available: 2` clamps the selected bulk quantity to 2.
- `available: 0` removes the selected bulk row.
- an unknown shortage SKU is ignored.
- unrelated selected bulk rows remain unchanged.

Use the existing test file style: `describe`, `it`, `expect` from Vitest, with small inline objects.

**Verify**: `npx vitest run tests/booking-create-ux.test.ts` exits 0 and includes the new tests.

### Step 3: Wire the helper into submit-time 409 handling

In `BookingWizard.tsx`, inside the `res.status === 409` branch:

- Keep the existing serialized asset removal behavior.
- When `d.shortages` exists, call the helper with `selectedBulkItems`.
- If `nextBulkItems` differs from the current selection, call `setSelectedBulkItems(nextBulkItems)`.
- Include a concise recovery note, for example `Bulk quantities adjusted to available stock.` or a specific count.
- Keep `setStep(2)` so the user lands back on Equipment with the corrected quantities visible.

Avoid stale-state bugs by using the selected bulk items from the current render for the helper result inside `handleSubmit`.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 4: Sync docs

Update the relevant change-log sections in:

- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Record that submit-time bulk shortages now return the user to Step 2 with selected bulk quantities clamped or removed based on server availability.

**Verify**: `rg -n "bulk|shortage|409|change log|Changelog" docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md` shows the new documentation entry.

## Test plan

- Add pure helper tests to `tests/booking-create-ux.test.ts`.
- Run `npx vitest run tests/booking-create-ux.test.ts`.
- Run `npx tsc --noEmit`.
- Run `git diff --check`.

## Done criteria

- [ ] Submit-time 409 serialized asset recovery still removes conflicting or unavailable serialized assets.
- [ ] Submit-time 409 bulk shortages clamp selected bulk quantities to server-reported availability.
- [ ] Bulk rows with `available <= 0` are removed.
- [ ] Unknown shortage SKUs do not mutate selected rows.
- [ ] The user returns to Step 2 with an inline message after recovery.
- [ ] `npx vitest run tests/booking-create-ux.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant checkout and reservation docs are updated.
- [ ] `plans/README.md` status row for plan 047 is updated.

## STOP conditions

Stop and report back if:

- The 409 response no longer includes `shortages` with `bulkSkuId`, `requested`, and `available`.
- Existing bulk selection state no longer lives in `selectedBulkItems` and `setSelectedBulkItems`.
- Fixing this requires changing server API contracts.
- The helper cannot be tested without rendering the full wizard.

## Maintenance notes

This plan intentionally keeps server authority intact. The client only applies the server's 409 shortage result to reduce manual correction work. Reviewers should check that clamping never increases a quantity and that the inline message names the affected bulk SKU clearly enough for staff.

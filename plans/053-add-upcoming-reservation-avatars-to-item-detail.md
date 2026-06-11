# Plan 053: Add upcoming-reservation avatars to item detail

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/app/api/assets/[id]/route.ts src/app/(app)/items/[id]/types.ts src/app/(app)/items/[id]/ItemBookingsTab.tsx src/components/BookingDetailsSheet.tsx src/components/booking-details/BookingOverview.tsx tests/item-detail-schedule-source.test.ts docs/AREA_ITEMS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

The item detail schedule contract says compact booking rows should use requester avatars where available. Past bookings and month agenda rows already have avatar data, and the booking details sheet renders requester and creator avatars. Upcoming reservations are the odd path out: the API selects only requester name, the type only exposes `requesterName`, and the UI can only render text. That makes the most operationally important upcoming list less scannable than older history.

## Current state

- `docs/AREA_ITEMS.md` says schedule rows should use requester avatars when available and booking previews should read as human activity.
- Past booking preview already uses `UserAvatar`:

```tsx
// src/app/(app)/items/[id]/ItemBookingsTab.tsx:195-201
<UserAvatar
  name={booking.requester.name}
  avatarUrl={booking.requester.avatarUrl}
  size="sm"
  className="shrink-0"
/>
```

- Month agenda rows also use `UserAvatar`:

```tsx
// src/app/(app)/items/[id]/ItemBookingsTab.tsx:623-629
<UserAvatar
  name={booking.requester.name}
  avatarUrl={booking.requester.avatarUrl}
  size="sm"
  className="shrink-0"
/>
```

- Upcoming reservations render only title, requester name, date, and status:

```tsx
// src/app/(app)/items/[id]/ItemBookingsTab.tsx:68-83
<div className="flex flex-col gap-0.5 min-w-0">
  <span className="text-sm font-medium truncate">{r.title}</span>
  <span className="flex items-center gap-1 text-xs text-muted-foreground">
    {r.requesterName} {"\u00b7"}{" "}
```

- The item detail API only selects requester name for upcoming reservations:

```ts
// src/app/api/assets/[id]/route.ts:168-177
include: {
  booking: {
    select: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      requester: { select: { name: true } },
```

- The serialized upcoming reservation payload also omits avatar URL:

```ts
// src/app/api/assets/[id]/route.ts:266-273
.map((r) => ({
  bookingId: r.booking.id,
  title: r.booking.title,
  status: r.booking.status,
  startsAt: r.booking.startsAt,
  endsAt: r.booking.endsAt,
  requesterName: r.booking.requester?.name ?? "Unknown",
}));
```

- The type mirrors that omission:

```ts
// src/app/(app)/items/[id]/types.ts:13-20
export type UpcomingReservation = {
  bookingId: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  requesterName: string;
};
```

- The booking details sheet already renders requester and creator avatars, so this plan does not need to change the sheet:

```tsx
// src/components/BookingDetailsSheet.tsx:673-679
<UserAvatar
  name={booking.requester?.name ?? "Unknown"}
  avatarUrl={booking.requester?.avatarUrl}
  size="md"
  className="mt-0.5 shrink-0"
/>
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused source contract | `npx vitest run tests/item-detail-schedule-source.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/app/api/assets/[id]/route.ts`
- `src/app/(app)/items/[id]/types.ts`
- `src/app/(app)/items/[id]/ItemBookingsTab.tsx`
- `tests/item-detail-schedule-source.test.ts` (create if absent)
- `docs/AREA_ITEMS.md`

**Out of scope**:
- Do not change `src/components/BookingDetailsSheet.tsx`; it already renders requester and creator avatars.
- Do not change booking detail API payloads.
- Do not redesign schedule cards, calendar bars, or booking tables.
- Do not add avatar upload or user profile behavior.

## Git workflow

- Branch: `advisor/053-item-detail-upcoming-reservation-avatars`
- Commit style: conventional commit, for example `fix: show requester avatars for upcoming item reservations`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Include avatar URL in the upcoming reservation payload

In `src/app/api/assets/[id]/route.ts`, update the upcoming reservation requester select:

```ts
requester: { select: { name: true, avatarUrl: true } },
```

Then include `requesterAvatarUrl` in the mapped payload:

```ts
requesterAvatarUrl: r.booking.requester?.avatarUrl ?? null,
```

Keep `requesterName` unchanged for compatibility with the current UI.

**Verify**: `npx tsc --noEmit` exits 0 after the type update in Step 2.

### Step 2: Update the client type

In `src/app/(app)/items/[id]/types.ts`, add:

```ts
requesterAvatarUrl: string | null;
```

to `UpcomingReservation`.

Do not replace `requesterName`; existing consumers should continue to read it.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Render avatars in upcoming reservation rows

In `UpcomingReservationsList` in `ItemBookingsTab.tsx`, add the existing `UserAvatar` component beside the row text.

Match the established schedule row grammar:

- `size="sm"`
- `name={r.requesterName}`
- `avatarUrl={r.requesterAvatarUrl}`
- `className="shrink-0"`

Preserve the click target, status badge, overdue styling, and responsive row height.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 4: Add source-contract coverage

Create `tests/item-detail-schedule-source.test.ts` modeled after existing source-contract tests.

Cover:

- The item detail API selects `avatarUrl` for upcoming reservation requesters.
- The API maps `requesterAvatarUrl`.
- `UpcomingReservation` includes `requesterAvatarUrl: string | null`.
- `UpcomingReservationsList` renders `UserAvatar` with `name={r.requesterName}` and `avatarUrl={r.requesterAvatarUrl}`.
- Booking details sheet remains out of scope because it already contains requester and creator avatar usage.

**Verify**: `npx vitest run tests/item-detail-schedule-source.test.ts` exits 0.

### Step 5: Sync docs

Update `docs/AREA_ITEMS.md` change log with a 2026-06-11 entry stating that item detail upcoming reservation rows now receive and render requester avatars, aligning them with past booking and agenda rows.

**Verify**: `rg -n "upcoming reservation|avatar|Schedule|Change Log" docs/AREA_ITEMS.md` shows the new entry.

## Test plan

- New source-contract test in `tests/item-detail-schedule-source.test.ts`.
- `npx tsc --noEmit`.
- `git diff --check`.

## Done criteria

- [ ] Upcoming reservation API payload includes `requesterAvatarUrl`.
- [ ] `UpcomingReservation` type includes `requesterAvatarUrl: string | null`.
- [ ] Upcoming reservation rows render `UserAvatar`.
- [ ] Past booking and month agenda avatar behavior is unchanged.
- [ ] Booking details sheet requester and creator avatar behavior is unchanged.
- [ ] `npx vitest run tests/item-detail-schedule-source.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant docs are updated.
- [ ] `plans/README.md` status row for plan 053 is updated.

## STOP conditions

Stop and report back if:

- The item detail API no longer owns upcoming reservation serialization.
- `UpcomingReservationsList` has been replaced by a shared booking row component.
- Adding avatar URLs requires exposing requester email or other PII.
- A current test already covers the exact upcoming-reservation avatar contract.

## Maintenance notes

This plan closes only the upcoming reservation data gap. If future schedule work extracts a shared booking row, keep the avatar prop optional and feed it from both history bookings and upcoming reservations.

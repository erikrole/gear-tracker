# Kiosk Check-In/Out Flows Improvement Audit
**Date**: 2026-04-29
**Target**: kiosk check-in and check-out flows (gated to KIOSK auth)
**Type**: System

> Per `docs/AREA_KIOSK.md` (2026-04-24), the web kiosk UI was deleted; the iOS app is the canonical kiosk surface. This audit therefore covers only the server side: `withKiosk` plumbing, `/api/kiosk/*` routes, and the checkout/check-in domain logic in `src/lib/services/bookings-checkin.ts` that the kiosk routes diverge from.

---

## What's Smart

- **Layered trust model is well-articulated and matched in code.** `requireKiosk()` (`src/lib/auth.ts:154-186`) keys off a hashed long-lived `kiosk_session` cookie tied to a `KioskDevice`; `device.active` is re-checked on every request, so an admin deactivation in `/api/kiosk-devices/[id]` invalidates instantly without needing to revoke tokens.
- **`createMany` + SERIALIZABLE for atomic checkout creation.** `src/app/api/kiosk/checkout/complete/route.ts:43-86` wraps booking + serialized items + allocations in one `Serializable` transaction with batched inserts — no N+1, no torn writes.
- **P2002 → 409 on the transactional boundary.** `checkout/complete/route.ts:109-116` correctly distinguishes the unique-constraint race from a generic 500, matching the lessons-file rule "TOCTOU on unique constraints."
- **`Promise.all` fan-out in read-heavy endpoints.** `student/[userId]/route.ts:18-91` and `dashboard/route.ts:13-78` parallelize independent queries — the dashboard especially benefits because the iOS idle screen polls every 30s.
- **Source stamping on every audit entry.** `kiosk_checkout`, `kiosk_checkin`, `kiosk_pickup` all carry `source: "KIOSK"` plus `kioskDeviceId` / `locationName` (`checkout/complete:97-100`, `pickup/[id]/confirm:46-51`, `checkin/[id]/complete:62-64`). Forensic trail is solid.
- **Activation flow audits the device, not a user.** `activate/route.ts:38-46` records `kiosk_activated` with `entityType: "kiosk_device"` + IP — correct shape for a no-user bootstrap event.
- **Fire-and-forget `lastSeenAt` update.** `requireKiosk()` lines 177-179 doesn't block the request on the heartbeat write. Smart for hot paths.
- **Idle-dashboard stats use a single raw aggregate.** `dashboard/route.ts:15-24` does one filtered scan of `bookings + booking_serialized_items` rather than three separate counts.

---

## What Doesn't Make Sense

- **`kiosk/checkin/[id]/complete` bypasses `bookings-checkin.ts` entirely and re-implements completion incorrectly.** `src/app/api/kiosk/checkin/[id]/complete/route.ts:33-44` computes `returnedItems` from the booking it loaded *before* the request, then conditionally updates `status: COMPLETED`. Compare to the canonical path in `src/lib/services/bookings-checkin.ts:19-77` (`maybeAutoComplete`) which: (a) re-reads inside the transaction, (b) handles bulk items, (c) deactivates remaining allocations, (d) closes scan sessions, (e) auto-marks lost numbered bulk units. The kiosk version skips all of that. Two concrete failures:
  1. A kiosk-checked-in booking that contains bulk items (possible if the booking was created via web wizard and is being returned at the kiosk) will be marked COMPLETED while bulk balances are *not* restored.
  2. No SERIALIZABLE wrapper — concurrent scan + complete races can leave the booking COMPLETED while `assetAllocation.active = true` for items that hadn't been returned at read time.
- **Critical: no concurrency guard against double-checkout of the same asset.** `assetAllocation` has only `@@index([assetId, active])` — no `@@unique` (`prisma/schema.prisma:346`). Two kiosks (or one kiosk + one staff via `/api/checkouts`) scanning the same `assetId` simultaneously will both pass `kiosk/checkout/scan/route.ts:61-74` (no-active-allocation check) and both succeed in `checkout/complete` because P2002 only fires on `BookingSerializedItem(bookingId, assetId)` — which is per-booking, not cross-booking. Net result: the same physical asset gets allocated to two open bookings.
- **`kiosk/users` returns the entire active roster, not the kiosk's location.** `src/app/api/kiosk/users/route.ts:7-16` filters only by `active: true`. `AREA_KIOSK.md:34` explicitly promises "Right panel: location-scoped student roster grid (`/api/kiosk/users`)". Mismatch between doc and code.
- **`kiosk/dashboard` checkouts are org-wide too.** `dashboard/route.ts:50-77` lists active checkouts globally, not scoped by `kiosk.locationId`. For multi-location deployments the idle screen will leak other counters' activity.
- **`kiosk/student/[userId]` does not verify the student belongs to the kiosk's location.** `student/[userId]/route.ts:7-15` only checks `user.active`. Once `kiosk/users` is location-scoped, this becomes the authoritative lookup — a hand-typed userId from another building should be rejected.
- **`refNumber` generation in `checkout/complete` lives *outside* the transaction.** `checkout/complete/route.ts:32-40` does a `findFirst` then `parseInt(...) + 1`. Two simultaneous kiosk completions read the same `lastSeq`, both attempt `CO-0042`, and `Booking.refNumber` is `@unique` so one trips P2002 → returns the misleading "items are no longer available" 409 (line 114). The error message lies; the failure mode is ref-number collision.
- **`refNumber` regex matches `RV-` but generation only emits `CO-`.** `checkout/complete/route.ts:38` does `replace(/^(CO|RV)-/, "")` so a recent reservation `RV-0099` will seed the next checkout as `CO-0100`, skipping numbers and letting `CO-` and `RV-` interleave. If there are separate counters by intent, the seed query is wrong.
- **`checkin/[id]/complete` defaults `actorRole: "STUDENT"` if user lookup fails.** `checkin/[id]/complete/route.ts:46-53` — silent fallback. A bad `actorId` should 404 (matching `pickup/[id]/confirm/route.ts:16-20`), not be smudged into an audit row claiming a STUDENT did the action.
- **`checkin/[id]/scan` is not transactional.** `checkin/[id]/scan/route.ts:80-93` does an `update` then a `updateMany` — if the second fails, `bookingSerializedItem.allocationStatus = "returned"` but `assetAllocation.active = true`. Asset is now "returned to the booking" yet still allocated.
- **`withKiosk` CSRF check is weaker than `withAuth`.** `src/lib/api.ts:71-80` only validates origin **if** the header is present. `withAuth` (`api.ts:30-44`) requires origin on mutating requests (with a Bearer-cron exception). The iOS app sets `Origin` automatically, so the gap exists only for raw curl/native fetch without Origin — but it's an unnecessary asymmetry.
- **`kiosk/checkout/complete` doesn't check `user.active`.** `checkout/complete/route.ts:22-26` selects `id, name, role` only. A deactivated user can still be picked from the avatar grid (until `kiosk/users` refresh) and their checkout will succeed.
- **24-hour fixed `endsAt` for kiosk checkouts.** `checkout/complete/route.ts:29` hard-codes `now + 24h`. There is no per-category, per-role, or per-asset due-by override. AREA doc doesn't define this; there's no decision recorded in `DECISIONS.md`.
- **`pickup/[id]/scan` is a write-free endpoint that pretends to validate.** `pickup/[id]/scan/route.ts:50-56` just looks up the booking-asset relation and returns `{success}`. The iOS UI tracks "scanned" state locally; the backend never records what was scanned. If a student exits without confirming, no record exists. This is acceptable per AREA, but the route shape (POST, transactional name) doesn't reflect that — it's effectively a GET.
- **Audit shape inconsistency.** `activate/route.ts:39-46` writes `db.auditLog.create` directly with `afterJson`; every other kiosk route uses `createAuditEntry({...after})`. Two helpers, two field names (`afterJson` vs `after`).
- **`heartbeat` is POST.** `heartbeat/route.ts:8` returns no mutation result; `requireKiosk` already updates `lastSeenAt` as a side effect. Making it POST adds an Origin check for what is logically a `GET /me`-shaped probe.

---

## What Can Be Simplified

- **Asset-by-scan-value lookup is duplicated four times.** Identical 8-line block:
  - `kiosk/checkout/scan/route.ts:18-46`
  - `kiosk/checkin/[id]/scan/route.ts:27-49`
  - `kiosk/pickup/[id]/scan/route.ts:26-44`
  - `kiosk/scan-lookup/route.ts:14-41`

  Extract to `src/lib/services/kiosk-scan.ts` → `findAssetByScanValue(scanValue, select)`. ~30 LOC saved + one fix point for the `bg://item/` regex.
- **`refNumber` allocation should be a service.** It also exists in the booking-create web path (likely; same `CO-####` shape). A single `nextBookingRef(tx, kind)` helper that uses a counter table or `SELECT ... FOR UPDATE` would fix both the TOCTOU and the regex bug.
- **`checkin/[id]/complete` should call `checkinItems` (or a thin wrapper) from `bookings-checkin.ts`.** That service already implements partial check-in correctly. The kiosk endpoint currently shells out to its own broken version. If the per-scan endpoint already updates allocation state (`checkin/[id]/scan`), `complete` could just delegate to `maybeAutoComplete` semantics.
- **`assetIds = body.items as Array<{ assetId: string }>` — no validation across all kiosk routes.** Add a single Zod schema for `{actorId: string, items: Array<{assetId: string}>}` etc. Right now a non-array or `null` body crashes with a 500 (TypeError on `.length`) instead of returning 400.
- **`checkin/[id]/complete:33-36` re-counts what the DB already knows.** Replace with `tx.bookingSerializedItem.count({where: {bookingId, allocationStatus: "active"}})` inside a transaction, and let SERIALIZABLE handle the race.
- **`kiosk/dashboard` raw SQL leaks column names.** The query references `b.ends_at`, `b.kind`, `bsi.allocation_status` — these are the `@@map` snake-case names. If a Prisma rename ever drifts, this breaks at runtime, not compile-time. Either co-locate with a comment "do not rename" or restructure as Prisma `groupBy`.

---

## What Can Be Rethought

- **Single source of truth for "complete a check-in".** Today: `bookings-checkin.ts:checkinItems` (web) and `kiosk/checkin/[id]/complete` (kiosk) live separately. Per `lessons.md`: *"Symmetric status guards on both complete functions"* — that lesson was about web routes; the kiosk endpoint is a third copy, even less guarded. Bigger bet: reduce to one entrypoint, have kiosk routes delegate.
- **Per-scan checkout instead of scan-then-complete.** Currently the booking is created only at `checkout/complete`. If the kiosk crashes mid-flow, scans are lost (they live only in iOS state). Alternative: create the booking on first scan (status `IN_PROGRESS`?) and append items per scan. Trade-off: more abandoned bookings to clean up. Worth a decision record.
- **Eliminate the `pickup/[id]/scan` round-trip.** Since it does no DB work, the iOS app could simply consult `GET /checkout/[id]` (which lists items) and validate locally, then call `confirm`. Saves a network call per scanned item.
- **Activation code rotation.** AREA doc notes admin must regenerate manually if cookie is wiped. A 30-day session that survives indefinitely if used (no re-auth on `lastSeenAt > Xd`) is fine for a counter iPad but worth documenting as a deliberate accepted risk in `GAPS_AND_RISKS.md`.

---

## Consistency & Fit

### Pattern Drift
- `kiosk/checkout/scan` returns `{success: false, error}` with HTTP 200 (lines 49, 52, 56, 76); other routes (e.g. `pickup/[id]/confirm`, `checkin/[id]/complete`) throw `HttpError` for failure cases. The kiosk-scan style is reasonable for "soft" errors (try the next scan) but the convention isn't documented and `scan-lookup/route.ts:44` throws 404 for the same condition. Pick one shape and apply uniformly.
- `withKiosk` CSRF policy ≠ `withAuth` CSRF policy (see "What Doesn't Make Sense").
- Audit helper inconsistency: `activate/route.ts:39` uses raw `db.auditLog.create({afterJson})`, every other route uses `createAuditEntry({after})`.

### Dead Code
- `kiosk/checkout/scan/route.ts:18-27` parses the QR but `tagSearch!` (line 44) is using non-null assertion on a value that is only `null` when `assetId` is set — fine, but the `tagSearch: string | null` typing is gratuitous. Pure stylistic — flag if you do an `as const` pass.
- `kiosk/me/route.ts` returns the same shape as the activation response. The iOS `KioskAPIClient` likely calls one of them at startup; if both, one is dead. Worth a grep in `ios/Wisconsin/Kiosk/KioskAPIClient.swift`.

### Ripple Map
- Any change to `kiosk/checkout/complete`'s response shape (`{bookingId, refNumber, itemCount, endsAt}`) ripples to `KioskCheckoutView` / `KioskAPIClient.swift`. Same for `dashboard` (consumed by `KioskIdleView`).
- `kiosk/student/[userId]` shape is consumed by `KioskStudentHubView`; adding location scoping (recommended) requires the iOS app to handle a 404 on cross-location lookup.
- `withKiosk` lives in `src/lib/api.ts`, which also exports `withAuth` — any change to the catch/`fail` pipeline affects every authenticated route.

### Navigation Integrity (kiosk app surface)
- N/A on web — surface is iOS. AC-15 in `AREA_KIOSK.md:80` confirms 401s from `heartbeat` / `dashboard` route iOS back to activation. No web fallback page exists for kiosk routes (correct — `src/app/(kiosk)/` was deleted 2026-04-24).

---

## Polish Checklist

| Area | Status | Notes |
|---|---|---|
| Empty states | n/a | API only — iOS owns UI |
| Skeletons | n/a | iOS-side |
| Silent mutations | ⚠ | `requireKiosk` `lastSeenAt` `.catch(() => {})` (`auth.ts:179`) swallows DB errors silently. OK for heartbeat, but worth logging |
| Confirmations | ⚠ | `kiosk/checkin/[id]/complete` updates `status: COMPLETED` without verifying `returnedItems` count under transaction |
| Mobile/touch | n/a | iOS |
| Error messages | ⚠ | `checkout/complete:114` claims "no longer available" on what may be a refNumber collision (misleading) |
| Button loading | n/a | iOS |
| Role/auth gating | ⚠ | `withKiosk` CSRF weaker than `withAuth`; `kiosk/users` not location-scoped; `student/[userId]` not location-scoped |
| Performance — N+1 | ✓ | `checkout/complete` uses `createMany`; `bookings-checkin.checkinItems` uses `updateMany` |
| Performance — over-fetch | ⚠ | `dashboard` fetches all org checkouts (should be location-scoped) |
| Performance — sequential awaits | ⚠ | `checkin/[id]/scan` does sequential `update` + `updateMany` — should be in one transaction; `checkout/complete` `findFirst` for refNumber is a sequential pre-write |
| Debug cleanup | ✓ | No stray console.log in audited routes |
| a11y | n/a | iOS |
| Validation | ✗ | No Zod across kiosk routes — bodies are cast with `as`. Bad input crashes with 500 |
| Audit completeness | ⚠ | `kiosk_checkin` doesn't include `before` snapshot (compare web `checkin_completed`) |
| Idempotency | ✗ | `pickup/[id]/confirm` is not idempotent — double-tap from a flaky network double-audits |

---

## Raise the Bar

Hot paths in this surface (idle dashboard polling, repeated scans on a busy counter) deserve the same rigor as the web booking flow:

1. **Every mutation transactional.** `checkin/[id]/scan` and `checkin/[id]/complete` must wrap their writes in `$transaction({isolationLevel: Serializable})`. The lessons file explicitly calls out *"SERIALIZABLE on all mutation transactions … audit the definition of 'all'"* — these are the blind spots.
2. **One canonical check-in service.** Three implementations (web partial, web full, kiosk) is two too many. Kiosk should call `checkinItems` / `markCheckoutCompleted` from `bookings-checkin.ts`.
3. **DB-level uniqueness for active allocations.** Add `@@unique([assetId])` on `AssetAllocation` rows where `active = true`, or use a partial unique index, so cross-flow double-checkout is impossible — not just unlikely.
4. **Zod schemas at the kiosk boundary.** Match the rigor used elsewhere; today bodies are `body.items as Array<...>`.
5. **Location scoping is enforced everywhere or removed everywhere.** Today it's a doc claim and a `kiosk.locationId` field that's barely used (`checkout/complete:15` defaults to it; `users` and `dashboard` ignore it; `student` doesn't validate). Pick a stance and apply it.

---

## Quick Wins (each <30 min, no schema changes)

1. **Location-scope `kiosk/users`.** Add `where: { active: true, locationId: kiosk.locationId }` (or the equivalent — verify User model has a location FK; if not, this becomes a Bigger Bet). `src/app/api/kiosk/users/route.ts:7-16`. Closes the AREA-doc-vs-code gap.
2. **Validate `user.active` in `checkout/complete`.** `src/app/api/kiosk/checkout/complete/route.ts:22-26` — add `active: true` to the where, throw 404. Prevents deactivated users from creating audited checkouts.
3. **Fix the misleading 409 message in `checkout/complete`.** `route.ts:114` — distinguish booking-serialized-items P2002 ("item already checked out elsewhere") from booking refNumber P2002 ("retry"). Inspect `error.meta.target`.
4. **Make `checkin/[id]/scan` atomic.** Wrap the `update` + `updateMany` (`route.ts:80-93`) in a single `$transaction([...])`. Two-line change.
5. **Throw 404 instead of defaulting to STUDENT.** `kiosk/checkin/[id]/complete/route.ts:46-53` — match `pickup/[id]/confirm:16-20` shape.
6. **Switch `heartbeat` to GET.** `route.ts:8` — `export const GET = withKiosk(...)`. Drops the unnecessary CSRF gate.
7. **Tighten `withKiosk` CSRF to match `withAuth`.** `src/lib/api.ts:71-80` — require Origin on mutating requests; allow GET/HEAD without. One-line change, mirrors the existing `withAuth` block.
8. **Add `before` snapshot to `kiosk_checkin` audit.** `checkin/[id]/complete/route.ts:51-65` — pass `{returnedItems: <pre>, totalItems}` as `before`, the post-state as `after`. Matches the lesson "Include `before` + `after` snapshots."
9. **Extract `findAssetByScanValue` helper.** Replaces 4 copies (~30 LOC). Pure refactor.
10. **Fix `refNumber` regex scope.** `checkout/complete/route.ts:38` — change `/^(CO|RV)-/` to `/^CO-/`. Either CO and RV share a counter intentionally (then unify the prefix logic in one helper) or they don't (then this regex is wrong).

---

## Bigger Bets

1. **Unify check-in completion under `bookings-checkin.ts`.** Have `kiosk/checkin/[id]/complete` and `kiosk/checkin/[id]/scan` delegate to `checkinItems` / a new `kioskCheckinScan` service that lives next to it. Pull the SERIALIZABLE wrapper, the bulk-item handling, the auto-complete + scan-session-close + lost-unit logic for free. Eliminates the divergent third implementation and the bulk-item completion gap. Estimated 1–2 days incl. test updates.
2. **DB-enforced active-allocation uniqueness.** Migration: `CREATE UNIQUE INDEX asset_allocations_asset_id_active_uniq ON asset_allocations(asset_id) WHERE active = TRUE;` (Postgres partial unique). Prisma can model this with a raw migration. Closes the cross-flow double-checkout race for good. Forces all checkout creation paths to `try { create } catch P2002`. Schema change → coordinate with Slice 1 of any next checkout work.
3. **Centralize `nextBookingRef(tx, kind)`.** Counter-table or `pg_advisory_xact_lock`-backed sequence per kind. Eliminates the kiosk-vs-web ref-number race. Foundation for #2 — once assets can collide, refnumbers must not.
4. **Adopt Zod across `/api/kiosk/*`.** A single `kioskSchemas.ts` mirroring how web routes are validated. Stops the family of `as Array<{assetId: string}>` casts and converts every malformed body into a 400 with field-level detail (per lesson: "ZodError should be handled globally in `fail()`" — already implemented, just needs callers).
5. **Explicit location-scoping policy.** Pick one: either (a) kiosk operates within `kiosk.locationId` and every read/write is scoped, or (b) kiosk is org-wide and the AREA doc is wrong. Document in `DECISIONS.md`, then apply across `users`, `dashboard`, `student`, `checkout/complete`'s default `locationId`.

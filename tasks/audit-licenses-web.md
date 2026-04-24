# Audit: /licenses (web) — 2026-04-24

**MVP verdict:** READY — all P0 + P1 addressed (2026-04-24)
**Ship bar:** all staff + students, zero hiccups

## P0 — blocks MVP
- [x] [Hardening] No rate limiting on any license route — `src/app/api/licenses/**`, `src/lib/api.ts:24`
      Why it blocks ship: A student could script `claim`/`release` thrash, or hammer `/api/licenses` to enumerate IDs/codes. With every student logged in, a misbehaving client lands on the DB at unbounded RPS. Vercel functions have 10s/60s caps but no per-user throttle.
      Suggested fix: Add a small in-memory or Upstash-backed rate limiter to `withAuth` (or wrap the license routes). At minimum throttle `claim`, `release`, `bulk`, `export` per-user.

- [x] [Hardening] CSV export route is permitted by `requirePermission("license","manage")` (STAFF + ADMIN), but the AREA doc says **admin-only** — `src/app/api/licenses/export/route.ts:15-18` vs `docs/AREA_LICENSES.md:88-89`
      Why it blocks ship: Either the doc lies or the code does. Rule 7 violation — code and doc out of sync on an authorization rule that goes to all staff. Today the redundant check at line 16-18 effectively allows STAFF anyway, so the doc is the one that's wrong, but this is exactly the kind of drift that ships RBAC bugs. Pick one and align.
      Suggested fix: Either tighten the route to ADMIN-only and update the AREA doc, or update the AREA doc to say STAFF+ADMIN. Recommend STAFF+ADMIN since `manage` already does that everywhere else.

## P1 — polish before ship
- [x] [Hardening] Concurrent-claim race: two students tapping the last slot at the same moment can both succeed — `src/lib/services/licenses.ts:53-77`
      Why it blocks ship: The "duplicate-claim" pre-check on line 45 runs OUTSIDE the transaction, and the slot-count check inside the transaction is a `findUnique`+`update`, not a row lock. Two concurrent transactions can each read `activeCount=1`, each insert, leaving 3 active claims. There's no DB unique constraint enforcing ≤2.
      Suggested fix: Add a partial unique index `(licenseCodeId) WHERE releasedAt IS NULL LIMIT 2` is not expressible directly — instead either (a) `SELECT ... FOR UPDATE` on the licenseCode row inside the tx, or (b) add a check via a row-version/optimistic-lock on `LicenseCode.status` and retry on conflict.

- [x] [Hardening] `/api/licenses/[id]/history` exposes full claim history including userIds for any STAFF-or-ADMIN — fine — but `LicenseCodeClaim.user` has no `onDelete` rule — `prisma/schema.prisma:794`
      Why it blocks ship: Deleting a user with prior claims will fail at the DB layer (default `Restrict`) and surface as a 500 to the admin doing user maintenance. Quiet timebomb.
      Suggested fix: `onDelete: SetNull` on `LicenseCodeClaim.user` — claim history persists with `userId=null` and the existing `occupantLabel`/"Unknown" fallback already handles render.

- [x] [Flows] Admin "release" has no confirm dialog — `AdminClaimSheet.tsx:236-241`
      Why it blocks ship: Admin clicks "Release" next to a holder's name → claim is released instantly with no undo. On a small viewport with multiple slots, misclick risk is real and a teacher just kicked a student out of Photo Mechanic mid-edit.
      Suggested fix: Wrap individual-claim Release and "Release all slots" in `AlertDialog` confirm, matching the Retire/Delete pattern already in this file.

- [x] [Flows] No error/empty state shown when `useFetch` for `/api/licenses` fails — `page.tsx:37-45, 162-183`
      Why it blocks ship: `useQuery` shows a toast "Failed to refresh" but the page just renders the empty-state branch (loading=false, allCodes.length===0) saying "No licenses in pool" — students will assume the system is empty when it's actually broken.
      Suggested fix: Surface the error from `useFetch` (it returns `error`) and render an explicit error block with a Retry button instead of falling through to "No licenses in pool".

- [x] [Flows] `BulkAddSheet` has no `accountEmail` / `expiresAt` — known gap per AREA doc but is the most obvious paper cut for the only realistic admin onboarding path — `BulkAddSheet.tsx`
      Why it blocks ship: Admin paste 30 codes → must then click each row in the sheet to set expiry. For an MVP with annual renewal, a single shared expiry field on the bulk form would close the gap.
      Suggested fix: Add an optional shared `expiresAt` and `accountEmail` to BulkAddSheet that applies to all newly-created codes. Keep per-code editing for differences.

- [x] [UI] Footer hint "Click an available row to claim" appears even for users who already hold a license — `page.tsx:205-210`
      Why it blocks ship: Confusing for a student already showing the green "Your license" banner — the hint contradicts the disabled state below.
      Suggested fix: Hide the footer hint when `myLicense` is set, or change it to "Return your license to claim a different one."

- [x] [UI] AdminClaimSheet "Mark slot occupied" form has no label on the input — `AdminClaimSheet.tsx:265-275`
      Why it blocks ship: A11y miss + per Rule 13 every Input should have an associated Label. Also the section heading is "Mark slot occupied" but the field is what gets typed (a name) — students of accessibility tooling will land on a nameless input.
      Suggested fix: Add a `Label` for the input ("Name of occupant" or just "Occupant") or aria-label. Helper text not needed.

- [x] [Flows] `MyLicensePanel` "Claim history" / past-claims link missing — purely informational; user can never see when they last had a license. AREA doc doesn't require it but staff/student rotation context suggests it'd help.
      Why it blocks ship: It doesn't, technically — moving to P2 unless you want it.

## P2 — post-MVP (deferred)
- [ ] [Parity] iOS does not yet expose license claim/release UI per `AREA_MOBILE.md`. Flagged for the iOS audit.
- [ ] [UI] Table rows aren't keyboard-operable (no `tabindex`/`Enter` handler on `TableRow`).
- [ ] [Flows] No bulk renewal for expiring codes (AREA known gap).
- [ ] [Flows] Claim history has no pagination (AREA known gap, fine at <50/code).

## Acceptance criteria status (from docs/AREA_LICENSES.md:99-111)
- [x] Each code held by up to 2 users — `licenses.ts:62-69`
- [x] Status badge Open / 1/2 / Full / Retired — `LicenseTable.tsx:207-224`
- [x] Admins can record unknown occupant — `licenses.ts:153-175`, `AdminClaimSheet.tsx:264-276`
- [x] Admins can edit accountEmail + expiresAt — `AdminClaimSheet.tsx:281-313`
- [x] Expiring (≤30d) yellow / expired red — `LicenseTable.tsx:34-55`
- [x] Admin push 14d before expiry — `licenses.ts:281-345`
- [x] Admin sheet shows full claim history — `AdminClaimSheet.tsx:394-423`
- [x] Students cannot hold >1 slot — `licenses.ts:45-51` (note: race condition, see P1)
- [x] Codes masked to non-holders/non-admins — `LicenseTable.tsx:189`
- [x] Destructive actions confirm — partial: Retire/Delete confirm, but admin Release does NOT (see P1)
- [x] CSV export — `api/licenses/export/route.ts` (note: doc/code RBAC mismatch, see P0)

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- docs/AREA_LICENSES.md
- prisma/schema.prisma (License models)
- src/lib/permissions.ts (license block)
- src/lib/services/licenses.ts
- src/app/(app)/licenses/page.tsx
- src/app/(app)/licenses/LicenseTable.tsx
- src/app/(app)/licenses/AdminClaimSheet.tsx
- src/app/(app)/licenses/MyLicensePanel.tsx
- src/app/(app)/licenses/ConfirmClaimDialog.tsx
- src/app/(app)/licenses/ReleaseDialog.tsx
- src/app/(app)/licenses/AddLicenseDialog.tsx
- src/app/(app)/licenses/BulkAddSheet.tsx
- src/app/(app)/licenses/types.ts
- src/app/api/licenses/route.ts
- src/app/api/licenses/[id]/route.ts
- src/app/api/licenses/[id]/claim/route.ts
- src/app/api/licenses/[id]/release/route.ts
- src/app/api/licenses/[id]/occupy/route.ts
- src/app/api/licenses/[id]/history/route.ts
- src/app/api/licenses/my/route.ts
- src/app/api/licenses/bulk/route.ts
- src/app/api/licenses/export/route.ts
- src/hooks/use-fetch.ts (error surface check)
- docs/GAPS_AND_RISKS.md (no open license items)
- docs/DECISIONS.md (no license decisions)

## Notes
- BRIEF docs: none for licenses (none expected — V2 already shipped)
- Audit log already wraps every mutation route — good
- zod schemas present on every body that takes one — good
- Permissions correctly checked server-side on every mutation route — good
- The two P0s are both "thin": no rate limiting and a doc/code RBAC drift. Both quick fixes.
- The hardest P1 is the concurrent-claim race; it requires either FOR UPDATE in Prisma or an optimistic-lock retry. Realistically rare given small user base, but ship bar is "zero hiccups."

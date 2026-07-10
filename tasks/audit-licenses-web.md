# Audit: /licenses (web) — 2026-07-09

**MVP verdict:** READY — all P1 + P2 findings fixed 2026-07-09
**Ship bar:** all staff + students, zero hiccups
**Prior audit:** 2026-04-24 (READY; this is a fresh logic/smarts/polish pass — prior version in git)

## P0 — blocks MVP
(none)

## P1 — polish before ship
- [x] [Flows] "Release all slots" only releases the admin's own slot when the admin holds one of the two slots — `src/lib/services/licenses.ts:136-160`
      Why it blocks ship: With no `claimId`, `releaseCode` first looks for the requester's own active claim and releases just that one; the release-all branch is only reached when the admin holds nothing. The dialog says "Both holders will be removed" and the toast says "All slots released" — one holder silently remains.
      Suggested fix: Make release-all explicit — send `{ all: true }` from `AdminClaimSheet` and branch on it in the service, or have the sheet always pass explicit claimIds.

- [x] [Breaking] Successful claim reported as failure when clipboard write throws (Safari) — `src/app/(app)/licenses/ConfirmClaimDialog.tsx:43`
      Why it blocks ship: `navigator.clipboard.writeText` runs after two awaits, outside the user gesture; Safari rejects it. The catch shows an error toast, `onClaimed` never fires, the dialog stays open — but the claim succeeded server-side. The student retries and gets 409 "You already have an active license." Confusing on day one.
      Suggested fix: Wrap the clipboard write (and the missing-code check) in its own try/catch; always treat 2xx as claimed, toast "Claimed — copy the code from the banner above" if copy fails. Same for the unused-code guard at line 42.

- [x] [Breaking] Bulk add 500s when the paste contains the same code twice — `src/lib/services/licenses.ts:256-263`
      Why it blocks ship: In-paste duplicates survive the existing-codes filter, `createMany` hits the unique constraint (P2002), `fail()` maps it to 500 "Internal server error", and nothing is created. Pasting from a spreadsheet with a repeated row is a normal admin path. Single "Add code" with an existing code also 500s instead of 409 (`src/lib/http.ts:34-67` has no P2002 mapping).
      Suggested fix: Dedupe the parsed lines with a Set (count in-paste dupes as skipped), and map P2002 in `fail()` to 409 "Already exists."

- [x] [Gaps] Expiry warnings fire once ever, not "monthly thereafter" as the acceptance criterion states — `src/lib/services/licenses.ts:391,401`
      Why it blocks ship: The dedupe key's `YYYY-MM` comes from the license's `expiresAt` (a constant), so after the first warning the key never changes and admins are never re-warned. An expired license goes silent after one notification. AREA_LICENSES.md:113 claims "monthly thereafter."
      Suggested fix: Derive `yearMonth` from the current date so the dedupe key rolls over monthly.

- [x] [Gaps] 2-day rotation nag is tracked per-code, not per-holder — `src/lib/services/licenses.ts:439-445,482-485`
      Why it blocks ship: `nagSentAt` lives on `LicenseCode`. With two student holders, the first nag sets it and the second holder is never nagged (until some release resets it). The V1 field predates the 2-slot model; AREA rule says "the holder" gets nagged.
      Suggested fix: Track nag state per claim — rely on the per-claim notification `dedupeKey` (already `codeId + claimedAt`) instead of `nagSentAt`, or move `nagSentAt` to `LicenseCodeClaim`.

- [x] [Flows] Staff/admin have no way to claim a slot on the web — `src/app/(app)/licenses/page.tsx:143-147`, `src/app/(app)/licenses/LicenseTable.tsx:170-175`
      Why it blocks ship: Batch 31 made every admin row click open the inspect sheet, and `AdminClaimSheet` has no "claim for myself" action — so the claim dialog is unreachable for STAFF/ADMIN. iOS lets every role claim; web (the power-user hub) can't. AREA rule 8 explicitly expects staff/admins to hold licenses.
      Suggested fix: Add a "Claim a slot" button in the AdminClaimSheet slots section (disabled with a hint when the user already holds a license), reusing the existing claim endpoint + copy-to-clipboard toast.

## P2 — post-MVP
- [x] [Hardening] No max length on stored strings: `occupantLabel` (`api/licenses/[id]/occupy/route.ts:10`), `label`/`code` (`api/licenses/route.ts:9-12`), bulk `codes` blob (`api/licenses/bulk/route.ts:10`). A 1MB label flows into the table, CSV, and audit log. Add `.max()` bounds.
- [x] [Breaking] `handleExport` navigates via `window.location.href` (`page.tsx:150`) — a 429/error response renders raw JSON and navigates away from the app. Fetch → blob → anchor download instead, with a toast on error.
- [x] [Hardening] `retireCode`/`deleteCode` pre-checks run outside a transaction (`licenses.ts:268-293`) — a concurrent student claim between check and delete is cascade-deleted. Rare; wrap in a transaction for symmetry with claim/occupy.
- [x] [UI polish] A license that expired earlier today shows "0d left" (yellow) in the table because `Math.ceil` rounds to 0 (`LicenseTable.tsx:25-28`), while the banner and sheet already call it expired. Treat `days <= 0` with `diff < 0` as expired; show "Expires today" for the true 0-day case.
- [x] [UI polish] Hidden-retired empty state title "Only retired licenses are hidden" is confusing (`page.tsx:264`) — the state means every code is retired. Suggest "All licenses are retired."
- [x] [UI polish] After "Save details" the sheet header renders from the stale `license` prop (expired badge, email) until reopened (`AdminClaimSheet.tsx:209-232`). Actions that keep the sheet open should refresh its data or the sheet should read from the reloaded list.
- [x] [UI polish] `MyLicensePanel.handleCopy` (`MyLicensePanel.tsx:24-29`) — clipboard failure is an unhandled rejection with no user feedback; add a catch with an error toast.
- [x] [Gaps] AREA doc drift: PARTIAL row documented amber but rendered blue (`AREA_LICENSES.md:78` vs `LicenseTable.tsx:162`); masked-code format documented `XXXX-••••-••••-XXXX` vs actual full mask (`LicenseTable.tsx:20`); CSV columns documented `slot_1_holder/slot_2_holder` vs actual `holder_1/holder_2` (`AREA_LICENSES.md:99` vs `export/route.ts:22`). Doc sync per Rule 12.

## Acceptance criteria status (from docs/AREA_LICENSES.md:107-121)
- [x] Up to 2 holders per code — `licenses.ts:99-107` (serializable tx + retry)
- [x] Status badge Open / 1/2 / Full / Retired — `LicenseTable.tsx:203-206`
- [x] Unknown occupant by name — `licenses.ts:194-221`, `AdminClaimSheet.tsx:322-345`
- [x] accountEmail + expiresAt editable — `AdminClaimSheet.tsx:347-385`
- [x] ≤30d yellow / expired red — `LicenseTable.tsx:22-51` (edge: "0d left" for expired-today, see P2)
- [x] Expiry notification 14d before, **monthly thereafter** — fixed 2026-07-09: dedupe keyed on current month, `licenses.ts` `processExpiryWarnings`
- [x] Admin sheet full claim history — `AdminClaimSheet.tsx:469-510`
- [x] Bulk renew expiring/all visible — `BulkRenewDialog.tsx`, `api/licenses/bulk/route.ts:44-62`
- [x] User-visible own history without released codes — `MyLicenseHistoryDialog.tsx`, `licenses.ts:323-338`
- [x] One slot per user across codes — `licenses.ts:84-90` (in-tx)
- [x] Codes masked to non-holders — server-side strip `api/licenses/route.ts:20-30` + client mask `LicenseTable.tsx:177`
- [x] Destructive actions confirm — release/release-all/retire/delete all AlertDialog-gated, `AdminClaimSheet.tsx` (but release-all is buggy, P1 #1)
- [x] CSV export — `api/licenses/export/route.ts` (formula-safe via `csvField`)
- [x] Native iOS self-service — per AREA change log 2026-06-30 (not re-verified this pass)

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational): iOS lets every role claim/return; web staff/admin cannot claim at all (elevated to P1 #6). Web-only: create, bulk add, renew, retire, delete, export, occupy, full history — consistent with iOS-floor/web-power-user split.

## Files read
- docs/AREA_LICENSES.md
- docs/DECISIONS.md, docs/GAPS_AND_RISKS.md (license entries — all closed)
- prisma/schema.prisma (LicenseCode, LicenseCodeClaim)
- src/lib/permissions.ts (license block)
- src/lib/services/licenses.ts
- src/lib/api.ts, src/lib/http.ts (fail mapping), src/lib/rate-limit.ts
- src/app/(app)/licenses/page.tsx, LicenseTable.tsx, types.ts, MyLicensePanel.tsx, AdminClaimSheet.tsx, ConfirmClaimDialog.tsx, ReleaseDialog.tsx, MyLicenseHistoryDialog.tsx, AddLicenseDialog.tsx, BulkAddSheet.tsx, BulkRenewDialog.tsx
- src/app/api/licenses/route.ts, bulk/route.ts, export/route.ts, my/route.ts, my/history/route.ts, [id]/route.ts, [id]/claim/route.ts, [id]/release/route.ts, [id]/occupy/route.ts, [id]/history/route.ts
- tasks/licenses-ownership-pass.md, tasks/audit-licenses-web.md (prior)

## Notes
- Hardening baseline is strong: rate limits on all mutation + export routes, serializable tx with one retry on claim/occupy, server-side code masking, CSRF origin checks in withAuth, formula-safe CSV, bounded history reads, zod on every body.
- The concurrent-claim race flagged in the 2026-04-24 audit is properly closed (GAP-45 confirmed invalid → serializable + retry, verified in code this pass).
- Three of the six P1s live in `src/lib/services/licenses.ts` (release-all, expiry cadence, nag scope) — one service-slice fix covers them.
- fail() mapping P2002 → 409 would also improve duplicate handling everywhere else `createMany`/unique writes surface.

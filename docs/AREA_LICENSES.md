# Photo Mechanic Licenses Area (V2 — 2-Slot Model)

## Document Control
- Area: Photo Mechanic license pool
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-05-21
- Status: Active — 2-slot model, expiry tracking, unknown occupants, CSV export shipped
- Version: V2

## Direction
Replace the Google Sheet at `licenses.xlsx` with an in-app pool that mirrors how Photo Mechanic licenses actually work in the field — each license code activates on **two** machines, occupants drift over time, and licenses renew **annually**. Students self-serve a slot; admins manage account email, expiry, and unknown occupants.

## Core Rules
1. **Two slots per license code.** Activations fill naturally; positions are not meaningful (no "slot 1 vs slot 2" semantics).
2. **One slot per user across all codes.** A student cannot hold a slot on multiple licenses simultaneously.
3. **Active claims drive status.** Status is derived from count of active claims (`releasedAt IS NULL`):
   - `AVAILABLE` — 0 active claims
   - `PARTIAL` — 1 active claim (badge: `1/2`)
   - `CLAIMED` — 2 active claims (badge: `Full`)
   - `RETIRED` — admin-archived, hidden from students by default
4. **Unknown occupants** can be marked by an admin with a free-text label (`occupantLabel`). Used when a license is in use by someone without an account here.
5. **Expiry is informational.** Warnings appear in the UI and via push notification 14 days before expiry; active claims are NOT auto-released.
6. **License codes only revealed to admins or the holder.** Other students see masked codes (`XXXX-••••-••••-XXXX`).
7. **Audit log** captures every claim, release, occupy, retire, delete, update.
8. **Staff and admins hold licenses with indefinite custody.** Only students are subject to the 2-day rotation nag. The "one active claim per user" rule still applies to everyone.

## Data Model
- Migration: SQL run manually 2026-04-24 (no Prisma migration file).
- `LicenseCode`:
  - `code` (unique), `label`, `accountEmail`, `expiresAt`
  - `status` (`AVAILABLE | PARTIAL | CLAIMED | RETIRED`)
  - `claimedById` / `claimedAt` — cached pointer to the FIRST active claimer (kept for backward compat with nag system)
  - `nagSentAt` — set once when 2-day nag is sent
  - `claims` — `LicenseCodeClaim[]` (history, includes active and released)
- `LicenseCodeClaim`:
  - `userId` (nullable — `NULL` = unknown occupant)
  - `occupantLabel` (free-text name when `userId` is null)
  - `claimedAt`, `releasedAt`, `releasedById`

## API Surface

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/licenses` | `license:view` | List codes with active claims (admin sees retired too) |
| POST | `/api/licenses` | `license:manage` | Create one code (with optional accountEmail/expiresAt) |
| POST | `/api/licenses/bulk` | `license:manage` | Bulk-create from newline-separated codes |
| PATCH | `/api/licenses/bulk` | `license:manage` | Bulk-renew visible active codes with one shared expiry date |
| GET | `/api/licenses/export` | `license:manage` | Download CSV of all codes |
| GET | `/api/licenses/my` | `license:view` | Current user's active claim (if any) |
| GET | `/api/licenses/my/history` | `license:view` | Current user's recent claim/return history without revealing released codes |
| PATCH | `/api/licenses/[id]` | `license:manage` | Update label / accountEmail / expiresAt / retire |
| DELETE | `/api/licenses/[id]` | `license:manage` | Permanent delete (must have 0 active claims) |
| POST | `/api/licenses/[id]/claim` | `license:claim` | Student claims a slot |
| POST | `/api/licenses/[id]/release` | `license:release` | Release own claim, or admin releases any (`{ claimId? }` body) |
| POST | `/api/licenses/[id]/occupy` | `license:manage` | Admin marks slot occupied by unknown user (`{ label }`) |
| GET | `/api/licenses/[id]/history` | `license:manage` | Full claim history for a code |

## UI

- Page: `src/app/(app)/licenses/page.tsx`
- Components:
  - `MyLicensePanel.tsx` — student banner showing their active code with copy + return
  - `MyLicenseHistoryDialog.tsx` — user-visible recent claim/return history from the active-license banner
  - `LicenseTable.tsx` — main table, masked codes for non-holders, expiry tooltips
  - `ConfirmClaimDialog.tsx` — student claim confirmation, copies code on success
  - `ReleaseDialog.tsx` — student return confirmation
  - `AdminClaimSheet.tsx` — admin detail sheet (slots, occupant, details, danger zone, history)
  - `AddLicenseDialog.tsx` — single-code add with accountEmail + expiry
  - `BulkAddSheet.tsx` — paste many codes at once
  - `BulkRenewDialog.tsx` — admin renewal dialog for expiring/expired visible codes or all visible active codes

### Visual states
- AVAILABLE row: tinted green, `cursor-pointer` if user has no claim
- PARTIAL row: tinted amber, `1/2` badge, claimable by anyone without a license
- CLAIMED row: tinted red, only admin/own holder can click
- RETIRED row: 50% opacity, hidden by default, toggled via list icon in header
- Expiry: ≤30 days = yellow `Xd left`, expired = red `Expired`, normal = grayed date string
- Holder cell: avatar + name (or `—` for non-admins on others' slots), `unknown` badge for occupant labels

## Notifications

Cron route: `GET /api/cron/notifications` (daily, see `vercel.json`).

| Trigger | Recipients | Dedupe | Channel |
|---|---|---|---|
| Student has held a slot for >2 days | The holder (STUDENT only — staff/admins exempt) | `license-nag-{codeId}-{claimedAtIso}` | in-app + push |
| License expires within 14 days OR is past expiry | All ADMIN/STAFF users | `license-expiry-{codeId}-{YYYY-MM}-{adminId}` | in-app + push |

Implementation: `processLicenseNags` and `processExpiryWarnings` in `src/lib/services/licenses.ts`.

## CSV Export
- Endpoint: `GET /api/licenses/export`
- Auth: ADMIN/STAFF only
- Filename: `licenses-YYYY-MM-DD.csv`
- Columns: `code, label, account_email, status, slot_1_holder, slot_2_holder, expires_at, created_at`
- Holder cells use `user.name` if linked, else `occupantLabel`, else "Unknown"

## Permissions (`src/lib/permissions.ts`)
- `license:view` — STUDENT, STAFF, ADMIN
- `license:claim` / `license:release` — STUDENT, STAFF, ADMIN
- `license:manage` — STAFF, ADMIN

## Acceptance Criteria (V2 — Met)
- [x] Each license code can be held by up to 2 users at once
- [x] Status badge shows `Open`, `1/2`, `Full`, or `Retired`
- [x] Admins can record an unknown occupant by name
- [x] Admins can set + edit `accountEmail` and `expiresAt`
- [x] Expiring licenses (≤30d) show yellow badge; expired show red
- [x] Admins receive in-app + push notification 14d before expiry, monthly thereafter
- [x] Admin sheet shows full claim history including releases and unknown occupants
- [x] Admins can bulk-renew expiring/expired visible codes or all visible active codes
- [x] Users can view their own recent claim/return history without exposing released codes
- [x] Students cannot hold more than one slot across all codes
- [x] Codes are masked to non-holders/non-admins
- [x] Destructive actions (delete, retire) require confirmation
- [x] CSV export available to admins

## Known Gaps / Deferred
- No full history pagination UI yet; API history reads are bounded.
- No full admin per-user license usage report beyond the user's own recent history and per-code admin history

## Change Log
- **2026-05-21 (Design-language cleanup)**: License pool summary metrics now use the shared `OperationalMetricCard` primitive, and compact header/admin controls use the 40px operational target baseline while preserving the 2-slot claim, masking, and admin-sheet behavior.
- **2026-05-08 (API hardening Wave 13)**: Code and personal claim history endpoints now apply bounded pagination instead of returning unbounded claim sets.
- **2026-05-08 (API hardening Wave 8)**: CSV export now uses shared formula-safe escaping so holder names and unknown occupant labels that begin with spreadsheet formula characters are exported as inert text.
- **2026-05-07 (User history)**: Added `/api/licenses/my/history` and a user-facing License history dialog from the active-license banner. The dialog shows recent claim/return timing while keeping released license codes hidden.
- **2026-05-07 (Bulk renewal)**: Added admin bulk renewal for expiring/expired visible codes or all visible active codes via `PATCH /api/licenses/bulk`, with rate limiting and audit logging.
- **2026-05-07 (Ownership pass)**: Added a compact license health summary for active codes, slot usage, open slots, expiring codes, and retired codes; fixed student-owned table rows so they no longer expose a dead click/keyboard path; corrected partial-row action labels for assistive tech; added an explicit hidden-retired empty state when no active codes are visible.
- **2026-04-24 (MVP polish)** — Per-user rate limits on claim/release/bulk/occupy/export; serializable-isolation transactions on `claimCode`/`addUnknownOccupant` to close concurrent-claim race; `LicenseCodeClaim.user` FK now `SET NULL` (migration 0044) so deleting users with claim history is safe; admin per-claim and "release all" now confirm via AlertDialog; list-fetch error surfaces a Retry empty-state instead of looking like an empty pool; BulkAddSheet now accepts shared `accountEmail` + `expiresAt`; "Mark slot occupied" input has a proper Label; footer hint hidden when user already holds a slot.
- **2026-04-24 (V2)** — Two-slot model, expiry, unknown occupants, CSV export, expiry push notifications, full UI polish + danger-zone confirmations
- **2026-04-23 (V1)** — Original single-slot pool with claim/release, 2-day nag push, claim history

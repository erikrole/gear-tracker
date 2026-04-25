# Audit: /settings (web) — 2026-04-25

**MVP verdict:** READY — 0 P0, 0 P1 open / 11 P1 fixed; 11/19 P2 also addressed
**Last fix pass:** 2026-04-25 — P1 slices 1–7 + P2 polish slices A–D + landing-tab memory shipped on `main`
**Ship bar:** all staff + students, zero hiccups

> Settings is admin/staff-only — students never see it. Ship-bar still applies for staff/admins (zero hiccups).

## P0 — blocks MVP
_None._

## P1 — polish before ship

- [x] **[Hardening] Layout admits STAFF; several sub-pages are ADMIN-only at the API.**
      `src/app/(app)/settings/layout.tsx:19` admits both ADMIN and STAFF, but escalation, extend-presets, and venue-mappings are guarded with `user.role !== "ADMIN"` at the API layer (`src/app/api/settings/escalation/route.ts:27,47`, `src/app/api/settings/extend-presets/route.ts:45`, plus `requirePermission` rules for `location_mapping`). A STAFF user can click the Escalation / Bookings / Venue Mappings / Database tabs and get 403s with no UI explanation.
      Why it blocks ship: visible 403/error on a primary nav tab for a real role = "hiccup."
      Suggested fix: filter `SETTINGS_SECTIONS` by role in the layout (drive from a `requiredRole` field on each section), or render a clean "Admin only" empty state on the page when API returns 403.

- [x] **[Hardening] No rate limiting on any settings mutation endpoint.**
      `src/app/api/categories/route.ts`, `…/calendar-sources/route.ts`, `…/location-mappings/route.ts`, `…/allowed-emails/route.ts`, `…/kiosk-devices/route.ts`, `…/sport-configs/route.ts`, `…/settings/escalation/route.ts`, `…/settings/extend-presets/route.ts` — none have rate limiters.
      Why it blocks ship: a compromised STAFF session can spam allowed-email entries / categories / kiosk activations. Rate limiting is the MVP safety net (per audit-page-web rubric §4).
      Suggested fix: add `rateLimit({ key: user.id, limit: N/min })` to all POST/PATCH/PUT/DELETE handlers, esp. `allowed-emails` and `kiosk-devices`.

- [x] **[Flows] Categories: `onBlur` + `Enter` keydown both call `createRoot`.**
      `src/app/(app)/settings/categories/page.tsx:168-172` — pressing Enter triggers the handler, then the input loses focus and triggers it again. With slow network this double-fires the POST and creates two categories.
      Why it blocks ship: silent duplicate creation on the golden path.
      Suggested fix: guard with a ref/`creatingRoot` check at the start of `createRoot`, or remove `onBlur` and require explicit Enter/Escape.

- [x] **[Flows] Sports: `updateShiftCount` loops sequential PATCHes for each sport in a group with no atomic rollback.** _(slice 7: new POST /api/sport-configs/group runs all upserts in a single Prisma transaction; client routes shift counts, call times, and active toggle through it)_
      `src/app/(app)/settings/sports/page.tsx:92-120` — for grouped sports (e.g. men's + women's basketball share settings) it issues N sequential PATCHes. If the 2nd fails (network, 500), the 1st has already committed and local state diverges from server with no error toast (failures are silent unless thrown).
      Why it blocks ship: half-applied configuration is a "hiccup" admins won't notice until shifts are wrong.
      Suggested fix: server-side group endpoint that updates all codes in one transaction, OR surface a partial-failure toast and reload from server.

- [x] **[Hardening] Database page surfaces raw server error string into UI.**
      `src/app/(app)/settings/database/page.tsx:38-41` — sets `error` directly to `json.error` from server response. Diagnostics endpoint can return Postgres error strings (table names, missing extensions) that may leak schema internals.
      Why it blocks ship: minor info-leak; admin-only page so low blast radius, but still violates the "no internals in errors" rubric (§4).
      Suggested fix: pass through a curated message; log the raw error server-side only.

- [x] **[UI polish] Settings layout flickers blank on load while `/api/me` resolves.**
      `src/app/(app)/settings/layout.tsx:14-28` — returns `null` until the auth check completes, so the entire settings shell pops in (no skeleton, no header). Noticeable on every settings tab navigation.
      Why it blocks ship: jarring on every page enter; user has corrected for breathing room and polish before.
      Suggested fix: render the `PageHeader` + tab nav immediately (they don't depend on role for staff/admin who get this far), and only gate the `{children}` slot. Or use a Suspense skeleton.

- [x] **[Flows] Escalation timing column looks editable but is hardcoded.**
      `src/app/(app)/settings/escalation/page.tsx:228` — table cell renders `formatHours(rule.hoursFromDue)` with no visual cue that it's read-only (per D-009). Admins try to click it.
      Why it blocks ship: confusing affordance on a primary admin surface.
      Suggested fix: render timing as muted text or wrap in a Badge so it visually reads as a label, not a value.

- [x] **[Flows] Sports group rule is invisible — editing one sport silently writes to all in its group.**
      `src/app/(app)/settings/sports/page.tsx:87-89` — `findGroup` resolves all codes in the group and writes them, but the UI shows only the row the user clicked. Admin edits MBB → WBB silently changes too.
      Why it blocks ship: silent cross-write is a "hiccup" admins don't notice.
      Suggested fix: surface a "(also affects Women's Basketball)" hint near the input, or show a small toast on save: "Updated MBB and WBB."

- [x] **[Flows] Kiosk activation code is one-shot with no regenerate.**
      `src/app/(app)/settings/kiosk-devices/page.tsx:393-415` — code shown only at create time. Close the dialog by accident or fail to enter it before iPad activation → must delete and recreate the device, losing audit trail.
      Why it blocks ship: easy lockout on a real workflow.
      Suggested fix: add "Regenerate code" button on inactive/pending devices (server invalidates old, returns new in dialog).

- [x] **[UI polish] Bookings save button only appears when dirty, top-right of card.**
      `src/app/(app)/settings/bookings/page.tsx:117-122` — easy to scroll past with edits in flight; refresh loses changes.
      Why it blocks ship: silent data loss on accidental nav.
      Suggested fix: sticky bottom bar OR always-render the button (disabled when clean) AND add unsaved-changes guard on route change (pattern exists in `useUnsavedGuard` per Guides feature).

- [x] **[Flows] Removing a claimed allowed-email silently disappears (no affordance).**
      `src/app/(app)/settings/allowed-emails/page.tsx:350` — Trash icon is hidden for claimed entries with no explanation. Admin wonders if the row is broken.
      Why it blocks ship: hidden affordance = "doesn't make sense" hiccup.
      Suggested fix: render a disabled icon with tooltip "Already claimed — deactivate the user instead."

## P2 — post-MVP

- [x] **[Hardening] Kiosk-devices page is the only sub-page that didn't get the 2026-04-07 hardening pass.**
      `src/app/(app)/settings/kiosk-devices/page.tsx:118-122,150-152,176-178` — `catch {}` blocks all collapse to "Could not connect to server", missing `classifyError` / `isAbortError` / `handleAuthRedirect(returnTo)` that every other settings page uses. Also `useFetch({ url: "/api/kiosk-devices" })` has no `returnTo` so 401 redirect loses context.
      Suggested fix: align with the `useFetch` + `classifyError` pattern from allowed-emails/escalation.

- [x] **[Flows] Categories search drops grandparents.**
      `src/app/(app)/settings/categories/page.tsx:60-67` — only re-adds the immediate `parentId` of a match. A 3-level-deep match shows orphaned in the tree (grandparent missing → tree builder may drop it).
      Suggested fix: walk the full ancestor chain.

- [x] **[Flows] Allowed Emails filter total is misleading.**
      `src/app/(app)/settings/allowed-emails/page.tsx:219` — the "All (N)" label always shows total from the *current* filtered fetch, not the unfiltered total. When user is on "Pending" filter, the All option in the dropdown shows the wrong number.
      Suggested fix: fetch unfiltered count separately, or fetch all and filter client-side (small dataset).

- [ ] **[UI polish] Calendar Sources & Venue Mappings — no test-URL / regex-test affordance before saving.**
      Adding an invalid ICS URL or regex only fails on first sync / first event match.
      Suggested fix: "Test pattern" / "Test fetch" button next to the input.

- [ ] **[Parity] iOS app has no Settings surface at all (informational).**
      Not a blocker — admin tasks are web-first per project conventions.

- [x] **[UI polish] `Categories` sort toggle uses arrows ↑↓ / ↓↑ that don't visually distinguish well.**
      `src/app/(app)/settings/categories/page.tsx:121` — replace with a single chevron that flips, or use Lucide `ArrowUpAZ` / `ArrowDownZA`.

### IA / structure (post-MVP)

- [ ] **No `/settings/locations` tab.** Locations are referenced by Venue Mappings, Kiosk Devices, calendar events but have no admin surface. Home Venues toggle is grafted onto Venue Mappings (`venue-mappings/page.tsx:167-194`). Add a Locations tab that owns name + isHomeVenue.
- [ ] **`/settings/bookings` is misnamed.** Page is just "Extend presets" with one card. Either rename the tab to "Extend presets" or fill the page with default checkout duration / blackouts / max-extends.
- [ ] **Tab order is arbitrary.** Mixing inventory + scheduling + integrations + system. Suggested: People (Allowed Emails, Sports), Inventory (Categories), Scheduling (Calendar, Venue Mappings, Bookings, Escalation), Devices (Kiosk), System (Database).
- [x] **`/settings` lands on Categories arbitrarily.** Last-visited or a real overview would be friendlier.
- [ ] **No search across settings.** Admin guessing the right tab to find "where do I allowlist an email."
- [x] **D-027 conflict.** AREA_SETTINGS.md says venue mappings are ADMIN-only; `permissions.ts:69-73` allows STAFF. Reconcile (likely tighten the permission to ADMIN to match the doc).

### Bulk + admin productivity (post-MVP)

- [x] **Allowed Emails: no bulk add.** Onboarding 30 students = 30 forms. Textarea + parse-and-validate paste-list would save hours per season.
- [x] **Kiosk Devices: no "stale" warning.** A device offline 1 week looks identical to one online 5 minutes ago. Add a red dot + "Offline since X" when `lastSeenAt` > 24h.
- [ ] **No "last edited by / when" anywhere.** Admin surface should expose inline audit context (audit log already exists; surface the last entry per setting).

### Quiet feedback (post-MVP)

- [x] **Categories rename has no toast.** Only delete/create do.
- [x] **Sports/Escalation toggles save silently** — only disabled state confirms; add toast or inline checkmark.
- [x] **Calendar Sources "Stale" threshold is hardcoded 24h** (`calendar-sources/page.tsx:166`) but cron runs daily at 6 AM UTC. Bump to ~30h for grace, or compute relative to expected next-run.

### Density / layout (post-MVP)

- [ ] **260px decorative sidebar on every sub-page** eats horizontal room on 13" laptops without aiding navigation. Consider collapsing to a one-line subhead on narrow desktops.

## Acceptance criteria status (from AREA_SETTINGS.md)

- [x] AC-1: Tab navigation — `layout.tsx:34-44`
- [x] AC-2: Categories tree CRUD + search + sort — `categories/page.tsx`, `CategoryRow.tsx`
- [x] AC-3: Sports shift config + roster — `sports/page.tsx`, `ShiftConfigTable.tsx`
- [x] AC-4: Escalation rules + fatigue cap — `escalation/page.tsx:225-283`
- [x] AC-5: Database diagnostics with status badges — `database/page.tsx:80-226`
- [x] AC-6: Mobile-responsive layouts — every page uses `grid-cols-[260px_1fr] … max-md:grid-cols-1`
- [x] AC-7: Component extraction — `ShiftConfigTable.tsx`, `CategoryRow.tsx`, `KebabMenu.tsx`
- [x] AC-8: Calendar sources CRUD + health — `calendar-sources/page.tsx`
- [x] AC-9: Venue mappings + regex validation — `venue-mappings/page.tsx`, server-side validation in `/api/location-mappings`
- [x] AC-10: Allowed emails with role pre-assignment — `allowed-emails/page.tsx`, server enforces STAFF→STUDENT-only at `allowed-emails/route.ts:56,123`

All ACs met in code. The doc does not yet list `/settings/bookings` or `/settings/kiosk-devices` as sub-pages — see lens notes below.

## Lenses checked

- [x] Gaps — `AREA_SETTINGS.md` is missing sub-page sections for **Bookings** (extend presets, shipped) and **Kiosk Devices** (shipped). Doc-sync drift per Rule 12. Recommend backfilling in next change-log entry; not promoting to P1 since the pages work.
- [x] Flows — covered above
- [x] UI polish — covered above
- [x] Hardening — covered above
- [x] Breaking — concurrent edits to the same category/escalation rule silently last-write-win (acceptable for admin tools); no double-submit guard on category Add → see P1 #3
- [x] Parity (informational) — iOS has no settings surface

## Files read

- `docs/AREA_SETTINGS.md`
- `src/lib/nav-sections.ts`
- `src/app/(app)/settings/layout.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/categories/page.tsx`
- `src/app/(app)/settings/sports/page.tsx`
- `src/app/(app)/settings/escalation/page.tsx`
- `src/app/(app)/settings/database/page.tsx`
- `src/app/(app)/settings/calendar-sources/page.tsx`
- `src/app/(app)/settings/venue-mappings/page.tsx`
- `src/app/(app)/settings/allowed-emails/page.tsx`
- `src/app/(app)/settings/kiosk-devices/page.tsx`
- `src/app/(app)/settings/bookings/page.tsx`
- `src/app/api/settings/escalation/route.ts`
- (header scans for auth/role gating) `src/app/api/categories/route.ts`, `…/sport-configs/route.ts`, `…/calendar-sources/route.ts`, `…/location-mappings/route.ts`, `…/allowed-emails/route.ts`, `…/kiosk-devices/route.ts`, `…/locations/route.ts`, `…/locations/[id]/route.ts`, `…/settings/extend-presets/route.ts`

## Notes

- Doc drift: AREA_SETTINGS.md has 10 ACs but no narrative for `/settings/bookings` or `/settings/kiosk-devices` (the latter is in `SETTINGS_SECTIONS` and shipped). Backfill recommended in same PR as any fix lands.
- Auth pattern is consistent across most pages (`useFetch` + `handleAuthRedirect` + `classifyError`) — kiosk-devices is the outlier.
- No console errors detected via static reading; recommend running dev server to verify on a real golden path before declaring ready.

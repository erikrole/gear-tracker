# Settings Roadmap: 11 new/extended settings

## Context

The Settings area is already deep (Notifications, Appearance, Categories, Departments, Sports, Escalation, Database, Locations, Calendar Sources, Venue Mappings, Extend Presets, Kiosk Devices, Allowed Emails). This roadmap captures 11 *gaps* the team wants to close, weighted toward day-to-day gear operations (checkout, reservations, kiosks) and self-service. Each item below is its own slice/PR per the thin-slice protocol in [AGENTS.md](../AGENTS.md). The first batch (quick wins) is detailed enough to execute; the operational core is medium detail; the big bets carry open questions and each deserve a dedicated `tasks/[feature]-plan.md` before building.

Decisions locked:
- Security: passkeys + baseline only (change-password + session revoke). No TOTP, no SMS, no email OTP.
- Branding (org logo/accent) and Working Hours/Holiday calendar are OUT.
- Profile: user may edit all identity fields EXCEPT email (email change stays admin-gated).
- Kiosks: always-on, no session expiry; deactivate is manual only.
- Audit viewer: admin-only; polling/infinite-scroll feed (not true SSE streaming -- too heavy on Vercel serverless).
- Webhooks/Slack: deferred (may be replaced by iOS notifications).

## Shared conventions (reused across slices)

- **Config store:** `SystemConfig` key-value table ([prisma/schema.prisma:813](../prisma/schema.prisma)) -- `key` (unique), `value` (Json), `updated_at`. Already holds `escalation` and `extend_presets`. New keys: `checkout_policies`, `reservation_rules`. Read via `db.systemConfig.findUnique({ where: { key }, select: { value: true } })`.
- **Settings page shell:** every sub-page uses `SettingsPageShell`. New tabs register in `SETTINGS_SECTIONS` with `group`, `requiredRole`, `description`, `keywords`.
- **UI:** Web UI uses the shadcn/ui standard in [AGENTS.md](../AGENTS.md) -- reuse `src/components/ui/*`.
- **Mutations:** rate-limited via `SETTINGS_MUTATION_LIMIT`; toast feedback; visible form-level errors; `useFetch` + `classifyError` + `handleAuthRedirect`.
- **Migrations:** Follow [docs/PRISMA_NEON_RUNBOOK.md](../docs/PRISMA_NEON_RUNBOOK.md).
- **Docs:** every shipping slice updates `docs/AREA_SETTINGS.md` change log + ACs in the same commit (rule 12).

---

## BATCH 1 -- Quick wins (small, fast, independently mergeable)

### Slice 1: Kiosk always-on
**Goal:** A bound kiosk stays active until an admin manually deactivates it; remove the 7-day session expiry.
- Kiosk session today carries `sessionExpiresAt` (kiosk auth in `src/lib/auth.ts`, ~lines 155-226).
- Change: stop setting an expiry on bind/activation; treat a kiosk as valid while `active = true` and a session token is present. Deactivation (already wired in `src/app/(app)/settings/kiosk-devices`) clears the token.
- Verify the kiosk session validator no longer rejects on elapsed time. Keep "last seen" / Offline badge (informational only).
- Files: `src/lib/auth.ts` (kiosk validation), kiosk-devices API + page. Possibly a migration to make `sessionExpiresAt` nullable / unused.

### Slice 2: Data Export page (Settings > System, ADMIN)
**Goal:** One place for all exports; surface the three that exist and add the two missing.
- Existing CSV endpoints: assets (`api/assets/export`), users (`api/users/export`), licenses (`api/licenses/export`).
- Add: `GET /api/bookings/export` (checkouts + reservations) and `GET /api/audit/export` (audit log, date-bounded). Mirror existing export conventions: permission gate, rate limit (5/min), row cap, CSV headers.
- New page `settings/data-export/page.tsx` -- list of export cards (label + description + download button) wired to the five endpoints. ADMIN-only `requiredRole`.

### Slice 3: Personal > Profile (all roles)
**Goal:** Self-service identity editing.
- Editable: `name`, `phone`, `avatarUrl`, `primaryArea`, `title`, `athleticsEmail`, `slackHandle`. NOT `email`.
- New `GET/PUT /api/me/profile` (rate-limited). Validate + trim; audit-log the change.
- Avatar upload uses existing Vercel Blob image flow (reuse `ChooseImageModal` pattern if applicable).
- New page `settings/profile/page.tsx` in the Personal group (alongside Notifications/Appearance), all roles.

### Slice 4: Security baseline (Personal, all roles)
**Goal:** Change password + see/revoke active sessions.
- Reuse bcrypt verify/hash from `src/lib/auth.ts`; reuse the `Session` table.
- `POST /api/me/change-password` (verify current, set new, optionally revoke other sessions).
- `GET /api/me/sessions` (list: created, last active, current flag, coarse device hint) + `DELETE /api/me/sessions/:id` (revoke) + "revoke all others".
- New page `settings/security/page.tsx`, Personal group. This is the foundation passkeys (Slice 10) build on.

---

## BATCH 2 -- Operational core (medium)

### Slice 5: Checkout Policies (Inventory, ADMIN)
**Goal:** Configure default loan duration, overdue grace period, max items per user.
- New `SystemConfig.checkout_policies = { defaultLoanDuration, gracePeriodMinutes, maxItemsPerUser }`.
- **Default duration:** prefill the due-date picker on checkout creation. Today `endsAt` is caller-supplied with no default (`bookings-lifecycle.ts:112`).
- **Grace period:** offset "overdue" + escalation timing. Today overdue is instant (`endsAt < now`, `checkouts/route.ts:25`); apply grace in the overdue filter + in `getEscalationRules` consumption (`notifications.ts:50`).
- **Max items:** enforce in checkout POST (`api/checkouts/route.ts`) -- count user's OPEN bookings, reject over cap with a clear 409.
- New page `settings/checkout-policies/page.tsx`.

### Slice 6: Reservation Rules (Scheduling, ADMIN)
**Goal:** Advance-booking window, configurable no-show expiry, max concurrent reservations.
- New `SystemConfig.reservation_rules = { advanceWindowDays, noShowExpiryHours, maxConcurrentReservations }`.
- **Advance window:** reject reservations whose `startsAt` is further out than the window, in reservations POST (`api/reservations/route.ts`).
- **No-show expiry:** make the currently-hardcoded 48h configurable -- `PENDING_PICKUP_AUTO_EXPIRY_HOURS` in `pending-pickup-expiry.ts:12` reads from config.
- **Max concurrent:** count user's BOOKED reservations; reject over cap.
- New page `settings/reservation-rules/page.tsx`.

### Slice 7: Notification granularity (Personal, all roles)
**Goal:** Per-category notify toggles on top of existing quiet-hours/channel switches.
- Extend `notification_prefs` JSONB (`notification-prefs.ts`) with a `categories` map. Categories from the escalation schedule + other dispatch sites: checkout-due, checkout-overdue, reservation, shift-trade, license-expiry. Null/missing = on (no behavior change for existing users).
- Gate in `sendPushToUser` / `sendEmailToUser` (`notifications.ts`) -- check the category flag in addition to channel/pause.
- Extend the Notifications page UI + `PUT /api/me/notification-preferences`.

---

## BATCH 3 -- Big bets (each gets its own deep plan before building)

### Slice 8: Notification digest
Daily/weekly batching instead of per-event sends. Needs a queue/accumulator + a Vercel Cron job that rolls up pending items and sends one summary, plus a per-user cadence pref. Larger than a toggle -- defer to a dedicated plan.

### Slice 9: Audit log viewer (System, ADMIN)
Admin live-tail of all audit rows. AuditLog model + writes already exist; `POST /api/audit/last` exists (`api/audit/last/route.ts`) but no browse UI. Build: `GET /api/audit?cursor=&entityType=&actor=&action=&from=&to=` (keyset pagination on the existing `(entityType, entityId, createdAt)` index family), infinite-scroll feed with filters + optional auto-refresh polling. Plus a retention discussion. Polling, not SSE.

### Slice 10: Passkeys + 2FA (Personal, builds on Slice 4)
WebAuthn enrollment + login second factor. Add `@simplewebauthn/server` + `@simplewebauthn/browser`, a new `Credential` table (credentialId, publicKey, counter, transports, userId), enroll/verify endpoints, and second-factor checks in the login flow (`src/lib/auth.ts`). Native Face ID / Touch ID on iPhone + Mac. Consider iOS app implications (associated domains for the native app). No TOTP.

### Slice 11: WisCard scanning spike (Devices)
Feasibility-first. Today students self-identify by tapping an avatar grid (`api/kiosk/users/route.ts`); asset barcode scanning exists (`kiosk-scan.ts`) but nothing reads people's ID cards. Spike questions: what reader hardware on the iPad kiosks (magstripe vs barcode vs NFC)? Most likely path -- an HID-keyboard reader where the swipe arrives as keystrokes. Then: add a `wiscardId` field to User, a capture/parse step at the kiosk, and a match-to-user gate. Schema + flow only after the hardware question is answered.

---

## Recommended sequence
1 (kiosk always-on) and 3 (profile) are the cheapest; 2 (export) and 4 (security baseline) close fast behind them. Then 5 -> 6 -> 7 for the operational rules engine. Big bets (8, 9, 10, 11) are scheduled individually once the team picks one up.

## Verification (per slice)
- `npm run build:app` is the safe local compile gate. Use full `npm run build` only for approved deploy-shaped validation, per [docs/RELEASE_VERIFICATION.md](../docs/RELEASE_VERIFICATION.md).
- New `SystemConfig` keys: confirm read path returns defaults when the key is absent (no behavior change for existing data).
- Migrations: `npm run db:migrate:check` + `npm run db:migrate:status`.
- Each settings page: authenticated smoke for the gating role -- create/edit/save, toast on success, visible error on failure, mobile layout intact.
- Policy slices (5, 6): prove enforcement end-to-end -- set a cap/window/grace in Settings, then attempt a checkout/reservation that violates it and confirm the reject; confirm a compliant one still succeeds.
- Update `docs/AREA_SETTINGS.md` (change log + ACs) in the same commit as each slice.

## Open questions to resolve at build time
- **Profile email:** confirm admin-gated only (vs verification flow). Currently planned admin-only.
- **Max-items / max-concurrent scope:** per-user global, or per-department/per-area? Roadmap assumes per-user global.
- **Audit retention:** keep-forever vs prune policy -- decide during Slice 9.
- **WisCard:** blocked on kiosk reader hardware spec.

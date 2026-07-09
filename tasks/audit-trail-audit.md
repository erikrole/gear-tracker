# Audit Trail Coverage & Clarity Audit
**Date**: 2026-07-09
**Auditor**: Claude (automated, read-only)
**Scope**: Every mutation endpoint (164 API routes exporting POST/PATCH/PUT/DELETE) cross-checked against audit-trail writes (`AuditLog` via `src/lib/audit.ts`, plus domain trails `ScanEvent`/`OverrideEvent`), and every timeline/read surface assessed for clarity.
**Method**: Mechanical transitive scan (route → imported services, 2 levels) followed by manual triage of all 37 flagged routes. Coverage raw data in scratchpad; findings below are individually verified.

## Verdict

Coverage is strong: **~155 of 164 mutation routes** either write a trail record, are read-only despite POST, or are kiosk-gating tombstones (403/410). The infrastructure is well-designed: `createAuditEntry*` helpers always stamp actor id + role (`src/lib/audit.ts:46`), transaction-aware variants exist, and one shared `ActivityTimeline` component renders all four timeline contexts (booking, item, user, report). The real risks are **six unaudited mutation clusters** (three security-relevant), **hard-delete retention with no export step**, and **writer/renderer vocabulary drift** that degrades timeline readability as new actions ship.

---

## Findings — Coverage Gaps (mutations with no trail)

### High

1. **Schedule auto-assign writes no audit entries** — `src/lib/services/auto-assign.ts:73` bulk-creates `ShiftAssignment` rows (`tx.shiftAssignment.createMany`) with zero audit writes. Every *manual* assignment route audits (`shift_assigned`, `shift_assignment_updated`, …), so the schedule's history has a hole exactly where the largest mass mutation happens. A student asking "why am I on this shift?" gets no timeline answer when auto-assign placed them.
2. **Password change (self-service) is unaudited** — `src/app/api/me/change-password/route.ts:61` updates `passwordHash` with no audit entry. Inconsistent with siblings: admin reset audits `password_reset`, forgot-password flow audits `password_reset_requested`/`password_reset_self`, and the *legacy* profile route audits `password_change` (`src/app/api/profile/route.ts:82`). The newer `/api/me/` path silently dropped it.
3. **Session revocation is unaudited** — `src/app/api/me/sessions/route.ts:64` (revoke all others) and `src/app/api/me/sessions/[id]/route.ts:31` (revoke one) delete sessions with no audit entry. Login and logout both audit (`entityType: "session"`), so the security timeline shows sign-ins but not revocations — the event you'd most want during an account-compromise review.

### Medium

4. **Shift group creation** — `src/app/api/shift-groups/route.ts:150` creates a `ShiftGroup` with no audit entry, while update/regenerate/archive/publish on the same entity all audit (`shift_group_updated`, `shift_group_regenerated`, `shift_group_archived`). The entity's timeline starts mid-life.
5. **Event travel roster** — `src/app/api/calendar-events/[id]/travel/route.ts:52` (add member) and `.../travel/[memberId]/route.ts:18` (remove) mutate `EventTravelMember` with no audit entry. Who was added to/removed from a travel list, and by whom, is unanswerable.
6. **Calendar sync + shift generation are invisible** — `src/lib/services/calendar-sync.ts` and `src/lib/services/shift-generation.ts` (0 audit writes each) create/update/delete `CalendarEvent`s and auto-generate shift groups/shifts. These are system actions, but `createSystemAuditEntry` exists precisely for this (`src/lib/audit.ts:66`) and is used by kiosk activation. When a synced event moves or a shift group appears, nothing explains it. A per-sync summary entry (`entityType: "calendar_source"`, action `synced`, after = counts) would close most of this cheaply.

### Accepted / no action needed (verified, listed so nobody re-audits them)

- **Tombstone routes** (throw 403/410, mutate nothing): all 7 `checkouts/[id]/*` custody routes, `checkouts` POST, `reservations/[id]/convert`, `users` POST, `users/bulk-create`.
- **Read-only POSTs**: `availability/check`, `kiosk/checkout/availability`, `kiosk/identify`, `kiosk/heartbeat`, `calendar-sources/test`.
- **Audited via service barrel** (scan flagged them only because `services/bookings.ts` re-exports relatively): `bookings/[id]/cancel|extend|force-complete|transfer-owner|events`, `reservations` POST, `reservations/[id]/cancel` — all audit inside `bookings-lifecycle.ts` / `bookings-checkin.ts` transactions.
- **Deliberately benign**: `devices` (push-token upsert), `me/notification-preferences`, `live-activities/*` (tokens), `resources/upload-image` (blob only; resource CRUD audits), `seed` (App Review demo data).

---

## Findings — Clarity & Timeline Quality

### High

7. **Retention hard-deletes the paper trail with no export step** — `src/app/api/cron/audit-archive/route.ts:38` permanently deletes `AuditLog` rows older than 90 days weekly; the file's own comment defers "export-before-delete" to later. `/api/audit/export` exists but is manual. Decide deliberately: either 90-day loss is acceptable for this team (document it in DECISIONS.md), or the cron should write a JSON/CSV snapshot to Vercel Blob before deleting. Right now it's an accidental policy.

### Medium

8. **Action vocabulary has no single source of truth, and it's already drifting** — ~140 distinct action strings are written across the codebase (grep inventory: `created` ×11 vs `create` ×6, `updated` vs `update`, `deleted` vs `delete`, `retired` vs `retire`, `claimed` vs `claim`, dotted `booking.items_added` vs snake_case everywhere else). Meanwhile the renderer maps contain **dead entries that no writer produces** (`user_deactivated`, `items_returned`, `marked_maintenance`, `image_uploaded` in `src/components/ActivityTimeline.tsx:176-233` — actual writes are `asset_image_uploaded` etc.), and real actions with no describer. Net effect: an unknown-but-growing share of timeline rows render as raw snake_case fallback (`ActivityTimeline.tsx:471-479`) with muted color. Fix shape: an `AUDIT_ACTIONS` const module both writers and the renderer import, so a new action without a label is a type error, and tense/format is enforced at one chokepoint.
9. **~80 actions render as raw fallback in timelines** — `describeAction` covers ~60 actions; the whole shifts/trades family (`shift_assigned`, `trade_posted`, `trade_claimed`, …), kiosk custody family (`kiosk_pickup`, `kiosk_checkout_item_added`, …), license family (`claim`, `release`, `occupy`), and settings family (`checkout_policies_updated`, …) all fall through to `action.replace(/_/g, " ")`. Legible-ish, but no color coding and no detail extraction from before/after. Same for `actionLabels` in `src/components/booking-details/helpers.ts:46` (booking-card summary map, 20 entries, separately maintained — a second drift surface).
10. **The admin audit browser can't show what changed** — `/api/audit` (`src/app/api/audit/route.ts:93-100`) deliberately omits `beforeJson`/`afterJson`, so both admin surfaces built on it (`settings/audit` live-tail browser, `reports/audit` feed) show who/what/when but never the diff — the "what changed" half of the user's question. Entity-scoped routes (`assets/[id]/activity`, `users/[id]/activity`, `bookings/[id]/audit-logs`) do return full JSON and render field-change pills. Either include (size-capped) diffs in the feed or add a row-expand that fetches the full entry.

### Low

11. **Scan/override events don't appear in entity timelines** — `ScanEvent` rows surface only in aggregate reports (`src/lib/services/reports.ts:450`); `OverrideEvent` has no read surface found at all. Kiosk AuditLog actions (`kiosk_pickup`, `kiosk_checkin`, `admin_override`) partially cover this on booking timelines, so it's an enhancement: merge scan attempts (esp. failures/location mismatches) into the booking timeline for custody-dispute review.
12. **Diff pills only render for 6 action types** — `DIFF_ACTIONS` (`ActivityTimeline.tsx:591`) gates field-change pills to `updated/update/owner_transferred/profile_update(d)/role_changed`. Actions like `calendar_event_updated`, `shift_updated`, `sport_config_updated` write before/after but never show it.
13. **`AuditLog.entityId` is unlinked after entity deletion** — timeline deep links (`entityHref`, `ActivityTimeline.tsx:16`) can point at deleted entities → 404. Cosmetic; acceptable for a small team. A name snapshot is already in afterJson for most writers, which mitigates it.

## What's Smart (keep / replicate)

- `_actorRole` stamped into every `afterJson` by construction (`src/lib/audit.ts:31-39`) — readers never special-case missing role.
- Tx-aware audit helpers so audit rows roll back with the mutation (`createAuditEntryTx`, batch variants) — used consistently in booking lifecycle SERIALIZABLE transactions.
- One shared `ActivityTimeline` for all four contexts, with 60s coalescing of rapid identical writes, sticky date grouping, phantom-row suppression when all changed fields are internal, and ID-field masking ("changed" instead of raw cuids).
- Keyset pagination + live-tail `after` cursor on `/api/audit` — correct and cheap.
- Explicit `// Service creates audit entry internally — do not log again here` comments at route call sites prevent double-writes.

## Recommended Actions (prioritized)

1. Audit auto-assign: one batch `createAuditEntriesTx` inside the existing transaction (`auto-assign.ts:73`), action `shift_assigned`, after = `{via: "auto_assign"}` — reuses existing vocabulary. (S)
2. Add audit writes to `me/change-password` (`password_change`) and both session-revoke routes (`session_revoked`, entityType `session`). (S)
3. Decide the 90-day retention question; if trails must survive, add export-to-Blob before delete in the cron. (S–M, mostly a decision)
4. Add `created` audit to shift-group POST and `travel_member_added`/`travel_member_removed` to the travel routes. (S)
5. Per-sync summary audit entry from `syncCalendarSource` + `generateShiftsForNewEvents` via `createSystemAuditEntry`. (S)
6. Extract `AUDIT_ACTIONS` const shared by writers and `ActivityTimeline`/`booking-details/helpers`; migrate the tense-drifted duplicates (`create`→`created` etc.); delete dead renderer entries. (M — the one structural fix)
7. Return capped diffs (or row-expand fetch) in `/api/audit` so admin surfaces answer "what changed". (M)

## Doc Sync Notes

- No `docs/AREA_*.md` claims were found to be contradicted by this audit; AREA_USERS.md's "audit logs must include actor role and id" guardrail is enforced in code (`src/lib/audit.ts:44`).
- Gap 7 (retention policy) belongs in `docs/DECISIONS.md` once decided; gaps 1–6 are candidates for `docs/GAPS_AND_RISKS.md`.

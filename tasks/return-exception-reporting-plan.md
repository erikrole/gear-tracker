# Return Exception Reporting Plan - 2026-06-12

## Goal
- Let users report damaged or lost serialized gear from the return gear flow and from an active checkout.
- Require a photo and description for damaged gear.
- Notify admins immediately because damaged or lost gear affects the next checkout, event, and repair decision.

## Source Checks
- `docs/AREA_CHECKOUTS.md`: standard return execution is kiosk-owned, checkout detail shows equipment progress, and web detail surfaces return context without making desktop return the normal custody path.
- `docs/AREA_SCAN.md`: app scan is lookup-only now. Historical check-in damaged/lost reporting existed in retired app booking-mode scan UI, and future exception reporting should be recut outside lookup scan.
- `docs/AREA_NOTIFICATIONS.md`: notifications are action triggers, dedupe is mandatory, in-app rows are durable, native push exists for selected families, and notification counts must not become source-of-truth operational state.
- `docs/DECISIONS.md`: D-001 requires derived item status, D-007 requires audit as a product feature, D-011 requires role/ownership checks, D-012 requires checkout lifecycle guardrails, and D-028 preserves kiosk custody boundaries for return execution.
- `docs/GAPS_AND_RISKS.md`: no open gap currently tracks the retired check-in report UI replacement.
- `prisma/schema.prisma`: `CheckinItemReport` already stores one report per booking and asset with type, description, optional image URL, reporter, and timestamp.
- `src/app/api/checkouts/[id]/checkin-report/route.ts`: current API accepts damaged/lost reports, uploads optional photo evidence, requires damaged items to have a successful check-in scan, upserts the report, writes audit, and notifies supervisors.
- `src/lib/validation.ts`: current `checkinReportSchema` allows optional description for both damaged and lost reports.
- `src/lib/services/notifications.ts`: `notifyItemReport` creates in-app supervisor notifications and emails, but push/category urgency should be made explicit for this time-sensitive path.
- `src/app/(app)/bookings/BookingEquipmentTab.tsx`: checkout equipment rows already know item report fields, making it the likely web entry point for active-checkout lost reports and return exception display.

## Product Model

Working name: **Return Exception Reporting**.

Rules:
- Lost and damaged reports are exception reports, not normal return completion.
- A lost serialized item can be reported from an active checkout even if it cannot be scanned.
- A damaged serialized item should be reported during return after the physical item is present. Require photo evidence and a description of what happened.
- Reports must be visible on the checkout, item, dashboard flagged-items banner, availability warnings, and admin notification stream.
- A report does not replace custody state by itself. The return/check-in flow still owns whether the booking is completed and whether the item is accounted for.

## Scope

### Return Gear Flow
- Add a visible **Report issue** action for each unreturned serialized item in the return flow.
- Damaged:
  - Require a successful scan or explicit item selection in the return flow.
  - Require photo upload.
  - Require a description of what happened.
  - Keep the item returnable after the report so staff can receive it into repair/maintenance follow-up.
- Lost:
  - Allow reporting without a scan.
  - Require a short reason or context note.
  - Count the item as accounted-for only after the user confirms the lost report.

### Active Checkout Detail
- Add **Report lost item** on active checkout equipment rows where the item is still outstanding.
- Gate by existing checkout ownership and staff/admin action policy.
- Keep damaged reporting out of active checkout detail unless the user has the item physically present. The primary damaged path belongs in the return gear flow.

### Evidence Requirements
- Damaged gear: photo and description are required.
- Lost gear: description should be required, photo optional and likely hidden in V1.
- Validate requirements on the server. UI validation is convenience only.
- Preserve the current one-report-per-booking-item rule, but make updates explicit and auditable.

### Notifications
- Admin notification should be immediate, high priority, and deep-linked to the checkout or item.
- Notify active admins at minimum. Consider STAFF too only if operational ownership wants broader coverage.
- Use in-app plus push for immediate attention. Email can remain best effort but should not be the only urgent channel.
- Dedupe by booking, asset, report type, and recipient. If a report is updated with new evidence, create either an update notification or include the change in audit while avoiding repeated spam.

## Slices
- [ ] Slice 1: Tighten server contract. Require damaged description and photo, require lost description, keep role/ownership checks, add focused report update semantics, and make notification urgency explicit.
- [ ] Slice 2: Return flow UI. Add per-item Report issue actions, damaged photo capture/upload, lost confirmation, and clear post-submit state.
- [ ] Slice 3: Active checkout lost report. Add row-level Report lost item for outstanding serialized gear on active checkout detail, using the same API contract.
- [ ] Slice 4: Admin notification and routing. Add push/category/deep-link behavior for damage/lost reports and ensure notification center routes admins to the right checkout/item context.
- [ ] Slice 5: Follow-up surfaces. Ensure dashboard flagged-items, item detail, availability warnings, and audit history show the report evidence consistently.

## Verification
- [ ] API tests: damaged report without photo fails, damaged report without description fails, lost report without description fails, valid damaged report stores image and audit, valid lost report stores audit.
- [ ] Authorization tests: students can report only their own active checkout items; staff/admin can report by policy; unrelated users get 403.
- [ ] Dedup/update tests: rapid duplicate report submissions do not create duplicate rows or notification spam.
- [ ] Notification tests: active admins receive in-app plus push payload with checkout/item deep-link context.
- [ ] UI tests: return flow damaged report requires photo/description, active checkout lost action appears only for outstanding serialized items, submitted reports show status.
- [ ] `npx tsc --noEmit`.
- [ ] `npm run db:migrate:check`.
- [ ] `git diff --check`.
- [ ] `npm run build` before shipping.

## Stop Conditions
- Stop if damaged reports can be submitted without both photo and description.
- Stop if lost reporting completes or hides custody state without explicit confirmation and audit.
- Stop if the new UI reopens the retired `/scan?checkout=...` booking-mode scan path.
- Stop if notification delivery is email-only or lacks a deep link for admins.
- Stop if report records become the authoritative item status instead of feeding derived status, availability warnings, dashboards, and repair follow-up.

## Review
- Logged only. No implementation shipped.
- The backend has a useful foundation, but it currently allows optional damaged evidence and is not clearly wired into the modern return or active checkout surfaces.
- First implementation should be server-contract hardening, then the return flow, then active-checkout lost reporting.

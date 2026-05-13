# Creation Flow System - 2026-05-12

## Goal
- Make creation flows feel consistent, role-aware, forgiving, and explicit about the next step after submit.

## Peer patterns checked
- Users Add User: dialog, role-scoped options, form-level errors, disabled controls while submitting, and `Add and open profile` handoff.
- Booking wizard: full-page wizard only where the flow has multiple decisions, explicit final handoff, form-level conflict recovery, draft persistence, and 401 handling.
- Kits New Kit: sheet, visible validation, disabled submit while saving, and `Create and open kit` handoff.
- Items New item: sheet with serialized/bulk split, add-another option, optional image prompt, but weaker submit/error/handoff handling.

## Creation Flow Standard
- Use a dialog for compact account/catalog creation with fewer than five decisions and no long optional metadata.
- Use a sheet for medium forms where operators may reference the underlying list and where optional metadata can stay in the flow.
- Use a full page only when creation spans multiple operational decisions, needs draft persistence, or benefits from step-by-step review.
- Use a wizard only when each step has a real decision boundary. Do not turn simple catalog forms into wizards.
- Put the primary action in the footer and name the outcome, for example `Add and open profile`, `Create and open kit`, `Create pickup`, or `Add asset`.
- Show required fields with visible labels and required markers. Validation language should name the missing field and recovery action.
- Show form-level errors in an `Alert` inside the form, not only as a toast. Field-level errors stay next to the field.
- Disable all form inputs and all submit/cancel controls during submit. Every submit handler needs a ref-backed double-submit guard.
- Handle 401 with `handleAuthRedirect()`. Parse non-JSON error responses safely and show a stable fallback.
- After create, pick one explicit handoff: open created record, add another, return to refreshed list, or continue to the next operational step.
- UI create visibility must mirror backend authorization. Backend permissions remain authoritative.
- Draft persistence is required only for long full-page flows with meaningful partial work.

## Creation Flow Matrix
| Flow | Entry point | Who can create | Required fields | Validation source | Loading/error/success | Handoff | Browser path | Docs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Items serialized asset | `/items` `New item` sheet, `SerializedItemForm` | ADMIN, STAFF; API `asset.create` | asset tag, name, brand, model, QR, category, department, location | client imperative validation plus `POST /api/assets` Zod/DB uniqueness | submitting button only today; patch adds full disabled state, safe errors, double-submit guard | image prompt, open item, add another, or return to list | `/items` -> New asset -> individual item | `AREA_ITEMS.md` |
| Items new bulk item | `/items` `New item` sheet, `BulkItemForm` | ADMIN, STAFF; API `bulk_sku.create` | name, category, location, QR; initial qty optional | client imperative validation plus `POST /api/bulk-skus` Zod | submitting button only today; patch adds full disabled state and safe errors | open bulk record, add another, or return to list | `/items` -> New asset -> bulk item | `AREA_ITEMS.md` |
| Items add existing bulk stock | `/items` `New item` sheet, `BulkItemForm` add-to-existing mode | ADMIN, STAFF; API `bulk_sku.adjust` | bulk SKU, positive quantity | client validation plus `POST /api/bulk-skus/[id]/adjust` Zod | submitting button only today; patch adds full disabled state and safe errors | open adjusted bulk record, add another, or return to list | `/items` -> New asset -> add to existing | `AREA_ITEMS.md` |
| Users Add user | `/users` Add user dialog, `CreateUserDialog` | ADMIN/STAFF; STAFF cannot create ADMIN | name, email, password, role; location optional | client Zod plus `POST /api/users` Zod/RBAC/DB uniqueness | strong: disabled fields, spinner, field and form errors | open created profile | `/users` -> Add user | `AREA_USERS.md`, `GAPS_AND_RISKS.md` |
| Booking checkout/reservation | `/checkouts/new`, `/reservations/new`, `BookingWizard` | role/ownership per booking rules | details, requester, location, dates, at least one equipment item | client step validation plus booking service/API | strong: step errors, 401 handling, conflict recovery, draft support | booking list highlight and operational handoff | `/checkouts/new`, `/reservations/new` | `AREA_CHECKOUTS.md`, `AREA_RESERVATIONS.md` |
| Kits New Kit | `/kits` New Kit sheet | ADMIN/STAFF | name, location | `useFormSubmit` client Zod plus `POST /api/kits` | strong: form errors, disabled submit, no-location alert | open kit detail, return to refreshed list, or create another | `/kits` -> New Kit | `AREA_KITS.md` |
| Schedule manual event | `/schedule` New event sheet | ADMIN/STAFF | summary, startsAt, endsAt | client inline checks plus `POST /api/calendar-events` inline checks | disabled fields, form-level alert, toast success | open created event, add another, or return to refreshed schedule | `/schedule` -> New event | `AREA_EVENTS.md`, `AREA_SHIFTS.md` |
| Schedule crew setup/add shift | event detail `Set up crew`, `ShiftDetailPanel` add shift | ADMIN/STAFF | eventId for setup; area/workerType for shift | API checks, shift Zod, Serializable shift creation | acting guard, form-level alert, toast, refetch | stays on event/panel with explicit next-step copy | `/events/{id}`, `/schedule` manage event | `AREA_SHIFTS.md` |
| Schedule assignment/request/trade | schedule list, assignment grid, shift detail, trade board | STAFF/ADMIN assign; STUDENT request/trade by rules | shiftId/userId or assignment id | shared validation plus shift services | trade posting now has dialog-level errors in `ShiftDetailPanel`; assignment grid/list still use existing surface feedback | stays in current schedule surface | `/schedule/assign`, `/schedule` event panel | `AREA_SHIFTS.md` |
| Settings catalog adds | categories, departments, locations, allowed emails; calendar sources/venue mappings/kiosk devices compared but deferred | role varies by section | small catalog-specific fields | hand-rolled client checks plus API validation/rate limits | Categories, Departments, Locations, and Allowed Emails now show form-level add errors and disabled slow-save controls | stays on settings page, except one-time kiosk code | settings sub-pages | `AREA_SETTINGS.md`, `DECISIONS.md` where policy changes |

## Slice Plan
- [x] Audit current docs, schema, source, peer flows, and task notes.
- [x] Define creation-flow standard.
- [x] Slice 1: harden Items New asset submit/error/handoff and fix the department-ID validator exposed by browser smoke.
- [x] Slice 2: harden Schedule New Event, event crew setup/add shift, and shift trade post feedback.
- [x] Slice 3: confirm Users Add User remains aligned with the standard and forced-password security behavior is now closed.
- [x] Slice 4: propagate the post-create handoff to Kits New Kit.
- [x] Slice 5: add visible form-level errors to the highest-use settings catalog add forms.
- [x] Update docs and task notes for shipped behavior.
- [x] Verify TypeScript, focused regressions, migration check, diff whitespace, Next build, and browser smoke on changed create paths.

## Remaining Flow Ranking
- Apply now: Items New asset, Schedule New Event/add shift/trade post, Users Add User verification, Kits New Kit, and Categories/Departments/Locations/Allowed Emails add forms. These are high-use create surfaces with clear verification paths.
- Defer: Schedule assignment grid/list request flows. They behave more like assignment mutations than create forms and already keep users in context; revisit during the next schedule assignment pass.
- Defer: Calendar Sources, Venue Mappings, and Kiosk Devices add forms. They are admin-only, lower-frequency, and each has specialized validation or one-time-code behavior that should be handled as focused settings slices.
- Do not convert: Checkout/reservation creation stays a wizard because it has real multi-step equipment/conflict decisions and draft persistence.

## Deferred Findings
- Event POST validation is duplicated inline instead of using a shared schema.
- Assignment success feedback still differs across schedule list, assignment grid, and event/panel surfaces.
- Venue mapping server-side regex validation appears weaker than the docs and D-027 describe; the UI tester is not authoritative.
- Calendar Sources and Kiosk Devices creation deserve focused passes because their success handoffs are specialized: sync-test feedback and one-time activation code handling.

## Review
- Shipped: Items `New asset` now uses a guarded submit path, disables the sheet controls while saving, routes expired sessions through the shared auth redirect, shows form-level API/network/permission failures, and replaces toast-only success with an explicit handoff: Open item, Add image, Return to list, or Add another.
- Shipped: `/api/assets` now accepts the existing UUID-shaped department IDs used by the current database instead of rejecting valid UI selections as `Invalid cuid`.
- Shipped: Schedule New Event now gives a created-event handoff, event crew setup/add-shift flows show panel-level errors and next-step copy, and shift trade posting shows dialog-level failures.
- Shipped: Kits New Kit now offers Open kit, Return to kits, or Create another kit instead of auto-navigating.
- Shipped: Categories, Departments, Locations, and Allowed Emails add forms now show visible form-level validation/API/network errors.
- Verified in source: Users Add User already matches the standard for role-scoped options, form-level errors, disabled submit, and open-profile handoff; current security patch closes the forced temporary-password follow-up.
- Shipped: manual calendar events now have migration `0063_allow_manual_calendar_events_source_null` so the database contract matches the existing nullable `CalendarEvent.sourceId` Prisma schema.
- Verified: `npx prisma validate`, `npm run db:migrate:check`, `npx vitest run tests/create-asset-route.test.ts tests/calendar-events-route.test.ts tests/calendar-events-query.test.ts tests/api-wrapper.test.ts tests/auth-hardening.test.ts tests/kiosk-session-auth.test.ts tests/notification-cron.test.ts tests/allowed-emails.test.ts tests/categories-route.test.ts tests/settings-routes.test.ts tests/api-hardening-wave13.test.ts`, `npx tsc --noEmit`, `git diff --check`, and `npx next build`.
- Browser evidence: local seeded admin reached `/items`, opened `New asset`, saw required-field browser validation, completed a serialized asset create, observed disabled controls during submit, and landed on the post-create handoff with `Open item`, `Add image`, and `Return to list`.
- Browser evidence: local seeded admin opened `/schedule` New Event, saw the required-title form-level alert, and hit the newly fixed source-null database constraint during submit; the sheet surfaced the server failure as a form-level alert. Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper now handles the repo's blank schema-engine failure before Next build.
- Browser evidence: local seeded admin opened `/kits`, saw New Kit required-name validation, created `Smoke Kit 2026-05-12`, and saw the post-create handoff with `Create another kit`, `Return to kits`, and `Open kit`.
- Browser evidence: local seeded admin opened `/settings/categories`, started Add new category, submitted an empty name, and saw the form-level `Category name is required.` alert; `/users` Add User dialog still shows the expected role-aware create surface and `Add and open profile` handoff.
- Build unblocker: the final clean `npx next build` exposed a pre-existing kiosk schema/type mismatch. Added the missing `KioskDevice.sessionExpiresAt` field and migration so the already-wired 7-day kiosk expiry compiles and deploys; closed GAP-53 in docs.
- Deferred: Assignment grid/list request flows, Calendar Sources, Venue Mappings, and Kiosk Devices should be handled as focused follow-up slices rather than swept into this broad pass.

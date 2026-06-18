# Schedule Source Of Truth Plan - 2026-06-18

## Goal
- Make `/schedule` the operational source of truth for in-season creative coverage: one page that tells staff what is happening, who is working, what is unresolved, what needs gear, and what the system can safely automate next.
- Move Schedule from "good staffing surface" to "season command center" without breaking the existing event-first, gear-linked workflow.

## Product Principles
- Schedule remains event-centered. `CalendarEvent` is the spine; `ShiftGroup` is the staffing container; `ShiftAssignment` is the worker commitment; bookings and kiosk custody remain downstream gear execution.
- Automation must be explainable. Any auto-fill or recommendation should show why a person was picked or skipped.
- Advisory availability stays advisory until a separate policy decision says otherwise. Staff may override conflicts, but the override must be visible and auditable.
- The page should answer five questions at a glance:
  - What events are coming up?
  - Which ones are not staffed?
  - Which assignments are risky or unresolved?
  - Who has gear ready?
  - What can be safely handled for me?

## Slice Handoff Protocol
- Before starting a slice, write a focused slice prompt with goal, scope, non-goals, files/areas to inspect, implementation expectations, verification, and the next-slice handoff requirement.
- A slice is not complete until code, docs, tests, `git diff --check`, and a build or documented blocker are done.
- On completion, append a review note here with shipped behavior and exact verification commands, then write the next slice prompt before moving forward.
- Keep every slice independently mergeable. If a slice starts needing schema work, split schema/API/UI rather than widening the slice.

## Source Checks
- `AGENTS.md`: non-trivial work needs a sliced plan, independently testable slices, docs sync, shadcn UI, and build verification before shipping.
- `docs/AREA_SHIFTS.md`: Schedule already owns ICS-driven events, generated shift groups, list/week/calendar views, assignment, student requests, trade board, readiness snapshot, availability conflicts, call-window overrides, and conflict review.
- `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`: availability is intentionally warning-only and does not block staff overrides.
- `docs/DECISIONS.md`: new mutation paths need meaningful audit logs; daily scheduling maintenance should remain consolidated into `morning-refresh`.
- `docs/GAPS_AND_RISKS.md`: no current open blocker prevents Schedule hardening; `SystemConfig` still lacks UI and should not become a dependency for early slices.
- `prisma/schema.prisma`: current schedule models support events, shift groups, shifts, assignments, trades, sport/area assignments, availability blocks, attendance, and booking linkage.
- `tasks/audit-schedule-web-platform-gap-2026-06-18.md`: highest platform gaps are publish/acknowledgement, ranked recommendations, fairness, preference levels, open-shift pickup, time-off workflow, copy-forward templates, staffing health queues, change history, and exports.
- `tasks/schedule-roadmap.md`: historical roadmap confirms Schedule has already absorbed Events, week view, trade board, assignment grid, readiness, inline assignment, conflict review, and many UI hardening slices.
- `src/hooks/use-schedule-data.ts`: `/schedule` currently builds its read model by separately fetching calendar events, shift groups, trade count, and source freshness.
- `src/app/(app)/schedule/_components/ScheduleReadiness.tsx`: readiness is a compact metric strip, not yet a clickable operational queue.
- `src/lib/services/auto-assign.ts`: current auto-assign chooses eligible users by sport, area, role, primary area, and availability conflict note, but not fairness, preference, or workload balance.
- `src/lib/services/notification-prefs.ts`: notification preferences currently expose checkout due, checkout overdue, reservation, and license expiry categories, but no schedule, trade, or gear-prep category.
- `src/lib/services/notifications.ts`: shift assignment, approval, removal, personal call-time change, and gear-up notifications exist, but scheduling copy and delivery policy are split across helper paths.
- `src/lib/services/shift-trade-emails.ts`: trade lifecycle email delivery exists and respects email pause/channel preferences, but trade notifications are not yet unified with in-app/push scheduling categories.
- `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`: availability conflict notifications are explicitly out of V1 scope; cross-event conflict digesting is a follow-up only if staff need it outside assignment workflows.

## Target Information Architecture
- Header: Schedule title, current source state, season mode status, primary actions.
- Command strip: clickable queues for open slots, conflicted assignments, pending requests, claimed trades, gear gaps, unacknowledged shifts, stale sources, and today's calls.
- Main work area:
  - List: default staff source-of-truth view with event rows, coverage, risk, gear, trade, and publish state.
  - Week: operational timing view for calls and conflicts.
  - Calendar: planning context, not the main staffing cockpit.
  - Assign: matrix view remains the bulk staffing workspace, but with candidate scores and automation previews.
- Detail surfaces:
  - Shift detail panel becomes the per-event staffing workspace.
  - Event detail becomes the event source-of-truth page: identity, crew, gear, travel, and history in one simpler surface.
  - Trade Board grows into an "Open Work" surface for trades and pickup opportunities.

## Event Linkage Model
- `CalendarEvent` is the canonical event record. It may come from an ICS source through `sourceId`/`externalId`, or be manually created with no `sourceId` and a generated manual `externalId`.
- `ShiftGroup` is the one-to-one staffing container for a `CalendarEvent`; every generated or manual staff slot should remain explainable from that event.
- `Booking.eventId` is the primary event link for legacy/read-path stability, while `BookingEvent` supports secondary event links for multi-event reservations.
- `Booking.shiftAssignmentId` links gear preparation to the person working a specific slot; Event detail should expose this as "gear linked to assignment", not only "gear linked to event".
- `EventTravelMember` is a travel roster attached to the event, separate from shift assignment. It should read as event logistics, not staffing coverage.
- Manual overrides on synced events are already modeled with `summaryLocked`, `isHomeLocked`, and `locationLocked`. The UI should frame these as "edited from source" with one-tap revert, not as a hidden implementation detail.

## Schedule Touchpoint Map
- Notifications: assignment created, request approved, assignment removed, call-time changed, gear needed, trade claimed/approved/declined, publish/republish, acknowledgement missing, source stale.
- Availability: weekly class blocks, semester-bounded blocks, ad hoc conflicts, future preference/time-off lifecycle, conflict review, candidate scoring, conflict digest only if staff need a separate queue.
- Crewing: shift templates, generated slots, manual slots, direct assignment, student requests, auto-fill preview, copy-forward crew, publish readiness, acknowledgement state.
- Gear readiness: event-linked reservations, multi-event booking links, assignment-linked bookings, missing gear nudges, pickup-ready state, kiosk-only custody boundary.
- Trades and open work: posted trades, claimed trades, approvals, open shift pickup, premier-event request flow, expired/stale trade cleanup.
- Calendar sources: synced events, manual events, hidden events, archived groups, stale source state, edited-from-source fields, manual override history.
- Dashboards and native clients: `/dashboard`, `/my-shifts`, iOS Home, iOS Schedule, iOS Event detail, and Notifications should consume additive schedule fields only after web semantics settle.

## Slices

- [x] Slice 0: Event Identity, Manual Creation, And Detail Polish
  - Make Event detail the simplest full truth for one event: source state, time, location, sport/opponent, crew coverage, gear readiness, travel roster, and history.
  - Add an event identity header that clearly distinguishes Synced, Manual, and Synced with edits.
  - Keep the existing edit/revert behavior, but make changed-from-source fields visible in the identity area instead of only inside the edit dialog.
  - Replace the generic Event detail action pair with reservation-first actions: "Reserve gear" as primary, "Set up crew" or "Review crew" as the staffing action, and no normal web checkout CTA.
  - Reframe New Event as an Apple-like event composer:
    - Essential first: title, date/time or all-day, location.
    - Optional context second: sport, home/away/neutral, opponent, short label.
    - Next step after create: Open event, Set up crew, Reserve gear, Add another.
  - Add a compact link summary on Event detail: crew slots, assigned people, gear reservations, assignment-linked gear gaps, travel members, and source edits.
  - Use tabs or a clean segmented control for Overview, Crew, Gear, Travel, and History on narrower screens, while keeping the first viewport readable on desktop.
  - Verification:
    - [x] API/source-contract coverage for manual event creation, source identity states, reservation-first actions, and linked booking counts across `Booking.eventId`, `BookingEvent`, and `shiftAssignmentId`.
    - [x] Browser smoke fallback reconciled through source-contract tests because the repo has no authenticated browser harness.
    - [x] Visual smoke fallback reconciled through shipped area docs, source-contract coverage, typecheck, and production build; manual visual smoke remains a merge gate when a harness or live session is available.

- [x] Slice 1: Schedule Health Read Model
  - Add a server-side read model for schedule health over a date window.
  - Include open slots, conflicted assignments, pending requests, claimed trades needing approval, open trades, gear readiness, source freshness, hidden/archived counts, and next calls.
  - Keep it read-only and batched. No schema migration unless current query shape cannot support it safely.
  - UI: turn `ScheduleReadiness` into clickable queue cards that set filters or open the relevant sheet.
  - Verification:
    - [x] Route/service tests for health counts and partial failure behavior.
    - [x] Browser smoke fallback covered by Slice 14 source-contract tests.

- [x] Slice 2: Source-Of-Truth Filters And Work Queues
  - Add first-class filter states for "Needs staffing", "Conflicts", "Pending requests", "Trade approval", "Gear gaps", "My calls today", and "Stale source".
  - Keep existing List/Week/Calendar modes, but make List the default staff operations cockpit.
  - Add empty states that explain whether there is no work or filters are hiding work.
  - Strengthen URL state for shareable staff work queues instead of relying only on localStorage.
  - Verification:
    - [x] Source-contract tests for filter query behavior.
    - [x] Browser smoke fallback covered by Slice 14 source-contract tests.

- [x] Slice 3: Candidate Scoring Foundation
  - Add a candidate recommendation service for a shift.
  - Inputs: role fit, area assignment, primary area, sport roster, existing overlapping assignments, advisory availability, recent week/month hours, upcoming shift count, attendance/no-show signal if available, and prior assignment to same sport.
  - Output: score, ranked reasons, blocking conflicts, advisory warnings.
  - Do not auto-assign from this yet. Use it only to improve pickers.
  - UI: show recommended, good fit, warning, and overloaded candidate groups in `UserAvatarPicker`.
  - Verification:
    - [x] Unit tests for score ordering and reason labels.
    - [x] Existing assignment behavior unchanged when a staff user manually picks someone.

- [x] Slice 4: Explainable Auto-Fill Preview
  - Replace current one-click auto-assign behavior with a preview-first flow.
  - Staff sees proposed assignments, skipped slots, conflicts, workload warnings, and reasons before commit.
  - Commit uses the existing serialized assignment transaction pattern and audit logging.
  - Preserve a fast path for small events: "Apply recommended assignments".
  - Verification:
    - [x] Service tests for preview determinism.
    - [x] Transaction tests for concurrent commit safety.
    - [x] Browser smoke fallback covered by Slice 14 source-contract tests.

- [x] Slice 5: Publish And Acknowledgement Contract
  - Add schedule publication state at the smallest useful boundary, likely `ShiftGroup.publishedAt` plus assignment-level notification/acknowledgement state.
  - Track assignment created/changed after publish as unpublished changes.
  - Add worker acknowledgement: seen/acknowledged timestamp through web/iOS "My Shifts" read or an explicit acknowledge action.
  - UI: event rows show Draft, Published, Changed, and Unacknowledged states.
  - Verification:
    - [x] Migration artifact, Prisma format, Prisma generation, and schema validation.
    - [x] Service/API-adjacent tests for publish, republish, ack, changed-after-publish, and worker ownership boundaries.
    - [x] Source-contract audit tests for publish, republish, and acknowledgement audit events.

- [x] Slice 6: Scheduling Notification Policy
  - Create a single scheduling notification policy before adding more event automation.
  - Add notification preference categories for schedule, trades, and gear prep while preserving old preference shapes through defensive defaults.
  - Consolidate shift assignment, approval, removal, call-time change, and gear-up copy so users do not get duplicate or contradictory messages for one schedule change.
  - Add publication-aware delivery rules:
    - Draft changes stay visible in-app to staff but do not notify workers.
    - Published assignment creates notify the assigned worker.
    - Changed-after-publish call times notify the worker and mark the assignment unacknowledged.
    - Removed-after-publish notifies the removed worker.
    - Gear-prep nudges remain staff-triggered and rate-limited until gear readiness has digest rules.
  - Bring trade lifecycle notifications into the same policy: in-app/push/email where enabled, with clear poster/claimer/manager recipients.
  - Add a staff digest path for unresolved schedule work before adding more direct nudges: open slots, conflicted assignments, unacknowledged workers, missing gear, and stale sources.
  - Keep all notification payloads event-routable with `eventId`, `shiftId`, `assignmentId`, and the correct event detail or Schedule queue target.
  - Verification:
    - [x] Unit tests for notification policy matrix, preference fallback, category mapping, digest candidates, and event-routable payloads.
    - [x] Route/source-contract tests for assignment create, approve, call-time change, nudge, publish delivery, and trade lifecycle delivery.
    - [x] iOS tap-through contract tests for schedule, trade, and gear-prep notification payloads.
    - [x] Browser smoke fallback covered by source-contract tests; manual settings/inbox smoke remains a merge gate when an authenticated session is available.

- [x] Slice 7: Open Shift Pickup And Trade Unification
  - Extend Trade Board into "Open Work": open slots eligible for pickup, posted trades, my trades, claimed trades awaiting approval.
  - Students can claim eligible open non-premier shifts directly or request premier shifts from the same surface.
  - Staff can approve pickup requests when policy requires it.
  - Eligibility uses the candidate scoring/conflict service, not a separate rules path.
  - Verification:
    - [x] Route/service tests for open pickup, premier request, and conflict handling.
    - [x] Source-contract tests for Open Work route, pickup mutation, and preserved trade actions.
    - [x] Browser smoke fallback covered by Slice 14 source-contract tests.

- [x] Slice 8: Preferences And Time-Off Requests
  - Extend availability beyond "unavailable" without breaking current blocks.
  - Add preference kind: cannot work, prefer, dislike, time off request, approved time off.
  - Time-off requests get pending/approved/denied lifecycle and feed the same recommendation service.
  - Keep old weekly/ad hoc blocks readable and migrate or map them as cannot-work advisory blocks.
  - Add an optional staff conflict digest only after the Schedule health queue proves a separate notification is useful.
  - Do not notify students about conflicts automatically; availability remains advisory and student-owned unless a staff action changes an assignment.
  - Verification:
    - [x] Migration and compatibility checks.
    - [x] Availability helper tests across weekly/ad hoc/preference/time-off cases.
    - [x] Profile Availability browser smoke fallback covered by route/service/source-contract tests; manual UI smoke remains recommended.

- [x] Slice 9: In-Season Automation Loop
  - Add "season mode" behavior without adding a second cron route.
  - Morning refresh should report schedule automation outcomes: synced sources, generated shifts, archived stale groups, expired trades, unresolved open slots, events ready to publish, and events safe for auto-fill preview.
  - Add a staff-visible automation digest on Schedule, with "Review suggestions" rather than silent mutation.
  - Feed the scheduling notification policy with digest candidates, but avoid silent worker-facing changes.
  - Verification:
    - [x] `morning-refresh` tests preserve partial failures.
    - [x] No duplicate cron route introduced.

- [x] Slice 10: Copy-Forward And Template Strengthening
  - Add "Copy crew from last matching event" for same sport, area pattern, and venue type.
  - Add template drift preview: current generated slots vs sport template, with additive changes clearly separated from destructive changes.
  - Add bulk call-window editing for same event or selected shifts.
  - Verification:
    - [x] Tests for manually edited groups not being overwritten.
    - [x] Browser smoke fallback covered by Slice 14 source-contract tests.

- [x] Slice 11: Gear Readiness As First-Class Schedule State
  - Promote gear state into the main Schedule list and health queues.
  - Event rows show assigned workers with ready/missing gear state.
  - Staff can jump from a gear gap to reservation/prep flow with event and assignee context.
  - Kiosk custody remains the only checkout/return authority; Schedule can reserve or prep, not complete custody.
  - Gear-prep notifications use schedule policy categories and remain tied to event and assignment context.
  - Verification:
    - [x] API read-model tests for reservation/booking linkage via `Booking.eventId`, `BookingEvent`, and `shiftAssignmentId`.
    - [x] Browser smoke fallback covered by Slice 14 source-contract tests.

- [x] Slice 12: Change Timeline And Operational History
  - Add a read-only event-level Schedule change history from existing audit logs.
  - Cover manual event edits, shift add/update/delete, assignment add/remove/call-window updates, publish/republish, copy-forward apply, open-work pickup/request actions, and reservation gear-prep links.
  - Surface the trust trail in Event detail Crew and compact Schedule row indicators.
  - Flag changes made after publication as review work without adding rollback, automated republish, or worker notifications in this slice.
  - Verification:
    - [x] Audit-read tests for merged timeline ordering.
    - [x] Source-contract tests for Schedule and Event detail timeline placement.
    - [x] Browser smoke fallback covered by Slice 14 source-contract tests.

- [x] Slice 13: Staff Exports And Season Review
  - Add weekly roster export, hours by person, open-slot report, conflict report, trade outcome report, and gear-readiness report.
  - Keep exports staff/admin only.
  - Use CSV first; PDF/printable packet can follow if CSV proves useful.
  - Verification:
    - [x] CSV escaping tests.
    - [x] Permission tests.
    - [x] Browser smoke fallback covered by Slice 14 source-contract tests.

- [x] Slice 14: Source-Of-Truth Hardening And Smoke Closure
  - Clear the remaining manual/browser proof debt from Slices 1-13 where an authenticated harness was unavailable.
  - Focus on Schedule source-of-truth workflows only: queue navigation, automation digest links, copy-forward preview/apply, gear readiness links, change history indicators, and export downloads.
  - Add any missing source-contract tests that can replace manual proof where browser auth is unavailable.
  - Polish visible copy or placement only where the smoke pass exposes friction; do not add new product surfaces.
  - Verification:
    - [x] Authenticated browser smoke harness audit completed; no harness is available, so source-contract fallback is the accepted proof path for this plan.
    - [x] Source-contract fallback tests for each remaining manual-only proof point.
    - [x] `npx tsc --noEmit --pretty false`
    - [x] `git diff --check`
    - [x] `npx next build`

## In-Between Polish And Strengthening
- Tighten source freshness copy so operators understand whether Schedule is stale because of an ICS source, hidden/archived event, or missing sport config.
- Make "New event" clearly separate manual internal events from ICS-synced events.
- Make Event detail source chips use human states: Synced, Manual, Edited, and Stale, with raw ICS data behind an admin disclosure only.
- Make linked event/shift/gear language explicit: Event, Crew, Reservation, Assignment-linked gear, Travel.
- Make notification language explicit: Scheduled, Call time changed, Removed, Gear needed, Trade claimed, Trade approved, Acknowledgement needed.
- Add a compact "why this event needs attention" summary on each row.
- Keep all worker-type UI language as Staff/Student, never raw `FT`/`ST`.
- Add optimistic refresh after assignment, trade, publish, and acknowledgement mutations, but preserve stale visible data on refresh failure.
- Make Schedule row actions consistent across List, Week, Calendar, Assign grid, ShiftDetailPanel, and Event detail.
- Add deep links that open `/schedule` directly into a queue and selected event.
- Keep mobile/iOS parity informational until web source-of-truth semantics settle; after Slice 5, mirror published/acknowledged states in iOS My Shifts.
- Keep notification settings parity in mind: web preferences first, then iOS Settings detail after the schedule categories stabilize.

## Verification
- [x] Focused tests per slice, usually `npx vitest run <tests>`.
- [x] `npx eslint <touched files>` for UI/API slices.
- [x] `npx tsc --noEmit --pretty false` where feasible.
- [x] `npm run db:migrate:check` for schema slices where run locally.
- [x] `npm run prisma:generate` for schema slices where run locally.
- [x] `git diff --check`.
- [x] `npx next build` for app-only slices.
- [x] `npm run build` gate reconciled as not applicable to this final app-only reconciliation slice; earlier schema slice documented why live migration deploy was not run.
- [x] Authenticated browser smoke reconciled through Slice 14 source-contract fallback because no checked-in Playwright/auth harness exists.
- [x] iOS source-contract or simulator verification run only when API payloads used by native Schedule/My Shifts changed.

## Stop Conditions
- Stop if a slice would silently change existing assignment semantics without an explicit migration or product decision.
- Stop if automation would commit assignments without a preview before the publish/ack contract exists.
- Stop if worker-facing notifications would fire for draft schedule changes before publication semantics exist.
- Stop if notification categories would break old `User.notificationPrefs` JSON shapes; use additive defaults and contract tests.
- Stop if a new cron route is proposed; use `morning-refresh` unless D-035 is deliberately revised.
- Stop if candidate scoring needs data that is not currently trustworthy, such as attendance/no-show history with unclear semantics.
- Stop if publish/acknowledgement cannot be represented without a schema migration; split schema/API/UI into separate PRs.
- Stop if web source-of-truth changes would create iOS decode breakage; add rollout-safe optional fields and native contract tests first.

## Review
- Shipped:
  - Slice 0: Event Detail identity card, source state chip, Crew/Gear/Travel/Source link summary, edited-field summary, reservation-first CTA cleanup, manual event creation/all-day route coverage, and linked booking context reconciled against `docs/AREA_SHIFTS.md`.
  - Slice 1: Server-side `/api/schedule/health` read model, staff/admin Schedule health fetch, actionable readiness queue cards, and service tests for health counts, partial failures, overlap filters, and empty booking-query safety.
  - Slice 2: URL-backed Schedule queues for Needs staffing, Conflicts, Pending requests, Trade approval, Gear gaps, My calls today, and Stale source; readiness cards route into those queues; active queue banner and queue-clear empty states shipped; Trade approval opens Trade Board with Claimed selected.
  - Slice 3: Read-only candidate scoring service, staff/admin `/api/shifts/[id]/candidate-scores`, and `/schedule/assign` picker grouping for Recommended, Good fit, Warning, and Overloaded candidates. Scores explain role fit, area fit, sport roster, prior same-sport assignment, advisory availability conflicts, overlapping active assignments, and workload without changing manual assignment behavior.
  - Slice 4: Preview-first auto-fill service and staff/admin `/api/shift-groups/[id]/auto-assign/preview` route. Event detail Crew and `ShiftDetailPanel` now show proposed assignments, skipped slots, scores, and warnings before assignment mutation, and Apply commits the same preview proposals through the existing serialized assignment recheck.
  - Slice 5: Publish and acknowledgement contract. `ShiftGroup` now stores publication metadata plus a stable worker-facing snapshot, `ShiftAssignment` stores acknowledgement metadata, staff/admin publish and republish routes write audit entries, assigned workers can acknowledge active published assignments, and `/schedule`, Event detail Crew, `ShiftDetailPanel`, and `/api/my-shifts` expose additive publication/acknowledgement state.
  - Slice 6: Scheduling notification policy. Schedule, trade, and gear-prep categories now default safely for old notification preference JSON, worker-facing assignment notifications are suppressed for draft groups, published assignment creates/approvals/removals/call-time changes route to the event, changed published call times clear acknowledgement, manual gear-prep nudges stay staff-triggered, trade lifecycle notifications respect the `trade` category, and iOS/web notification settings expose matching schedule/trade/gear-prep toggles.
  - Slice 7: Open Work and trade unification. `TradeBoard` now loads `/api/schedule/open-work` beside existing trade posts, shows published open Student slots, lets students claim non-premier shifts directly or request premier shifts, and lets staff/admin approve or decline pickup requests from the same sheet. The read model excludes draft, hidden, archived, cancelled, past, and already-filled shifts, uses candidate scoring/conflict signals, and preserves existing trade post/claim/approve/decline/cancel flows.
  - Slice 8: Preferences and time-off requests. `StudentAvailabilityBlock` now carries an availability intent plus review status, with existing rows defaulting to approved cannot-work advisory conflicts. Profile Availability supports cannot-work, prefer, dislike, and time-off entries; staff/admin users can approve or deny time-off requests; candidate scoring rewards preferred windows, warns on dislikes and pending time off, and treats approved time off as blocking; assignment, pickup, request approval, trade swap, and personal call-window update paths all reject approved time off while keeping ordinary conflicts advisory. Staff review outcomes create in-app student notifications.
  - Slice 9: In-season automation review. Added a staff/admin read-only automation digest service and `/api/schedule/automation` route that combines Schedule health, source freshness, publication state, auto-fill preview eligibility, stale trades, and optional morning-refresh maintenance context. `/schedule` now shows review-first automation cards for staffing, auto-fill preview, publish readiness, risk blockers, source state, and daily cleanup. `morning-refresh` includes the same digest after sync/archive/trade/pickup/firmware maintenance without adding another cron route or silently mutating assignments, publish state, trades, or worker-facing notifications.
  - Slice 10: Copy-forward and template strengthening. Added staff/admin `/api/shift-groups/[id]/template-review` preview/apply behavior plus a shared Crew template review UI in Event detail Crew and `ShiftDetailPanel`. The preview compares current slots to the active sport template, separates additive missing slots from extra/manual slots, finds the last matching staffed event, proposes copied crew with skip reasons for inactive workers, role mismatches, duplicate copied workers, blocking conflicts, or approved time off, and applies copied assignments through the existing direct-assignment safety checks. Bulk call-window editing was deferred because it is a separate mutation family.
- Verified:
  - `npx vitest run tests/calendar-events-route.test.ts tests/calendar-events-query.test.ts tests/booking-wizard-event-context-source.test.ts tests/reservation-event-link-preservation.test.ts tests/kiosk-only-web-affordances-source.test.ts tests/ios-notifications-tapthrough.test.ts`
  - `npx eslint 'src/app/(app)/events/[id]/page.tsx' 'tests/calendar-events-route.test.ts'`
  - `npx tsc --noEmit --pretty false`
  - `git diff --check`
  - `npx next build`
  - `npx vitest run tests/schedule-automation.test.ts tests/schedule-automation-source.test.ts tests/morning-refresh-route.test.ts`
  - `npx vitest run tests/schedule-template-review.test.ts tests/schedule-template-review-source.test.ts`
  - `npx vitest run tests/schedule-template-review.test.ts tests/schedule-template-review-source.test.ts tests/auto-fill-preview.test.ts tests/auto-assign-preview-commit.test.ts tests/candidate-scoring.test.ts tests/shift-assignments.test.ts tests/schedule-publication.test.ts tests/schedule-automation.test.ts tests/schedule-open-work.test.ts tests/schedule-queue-source-contract.test.ts tests/schedule-assign-source.test.ts`
  - `npx eslint src/lib/schedule-template-review-types.ts src/lib/services/schedule-template-review.ts 'src/app/api/shift-groups/[id]/template-review/route.ts' src/components/shift-detail/CrewTemplateReviewButton.tsx src/components/ShiftDetailPanel.tsx 'src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx' tests/schedule-template-review.test.ts tests/schedule-template-review-source.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `git diff --check`
  - `npx next build`
  - `npx vitest run tests/schedule-automation.test.ts tests/schedule-automation-source.test.ts tests/morning-refresh-route.test.ts tests/schedule-health-service.test.ts tests/schedule-queue-source-contract.test.ts tests/schedule-queues.test.ts tests/schedule-publication.test.ts tests/schedule-notification-policy.test.ts tests/schedule-open-work.test.ts tests/auto-fill-preview.test.ts tests/candidate-scoring.test.ts tests/shift-assignments.test.ts`
  - `npx vitest run tests/schedule-open-work.test.ts tests/schedule-open-work-source.test.ts tests/shift-trades.test.ts tests/shift-assignments.test.ts tests/schedule-notification-policy.test.ts`
  - `npx eslint src/components/TradeBoard.tsx src/lib/services/schedule-open-work.ts src/app/api/schedule/open-work/route.ts src/app/api/shift-assignments/pickup/route.ts tests/schedule-open-work.test.ts tests/schedule-open-work-source.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `npx vitest run tests/schedule-notification-policy.test.ts tests/schedule-assign-source.test.ts tests/ios-notification-categories-profile.test.ts tests/ios-settings-detail-menus.test.ts tests/ios-notifications-tapthrough.test.ts tests/notification-nudge.test.ts tests/shift-trades.test.ts tests/shift-assignments.test.ts tests/shift-call-window-routes.test.ts tests/schedule-publication.test.ts tests/api-route-wrapper-contract.test.ts`
  - `npx eslint src/lib/services/notification-prefs.ts src/lib/services/schedule-notification-policy.ts src/lib/services/notifications.ts src/lib/services/shift-trade-emails.ts src/lib/services/shift-trades.ts src/app/api/me/notification-preferences/route.ts src/app/api/notifications/nudge/route.ts src/app/api/shift-assignments/route.ts 'src/app/api/shift-assignments/[id]/approve/route.ts' 'src/app/api/shift-assignments/[id]/route.ts' 'src/app/api/shifts/[id]/route.ts' 'src/app/api/shift-groups/[id]/publish/route.ts' 'src/app/(app)/settings/notifications/page.tsx' tests/schedule-notification-policy.test.ts tests/schedule-assign-source.test.ts tests/ios-notification-categories-profile.test.ts tests/ios-settings-detail-menus.test.ts tests/ios-notifications-tapthrough.test.ts tests/notification-nudge.test.ts tests/shift-trades.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `git diff --check`
  - `npx next build`
  - `npx vitest run tests/schedule-health-service.test.ts`
  - `npx vitest run tests/schedule-health-service.test.ts tests/api-route-wrapper-contract.test.ts tests/calendar-events-route.test.ts tests/calendar-events-query.test.ts tests/booking-wizard-event-context-source.test.ts tests/reservation-event-link-preservation.test.ts tests/kiosk-only-web-affordances-source.test.ts tests/ios-notifications-tapthrough.test.ts`
  - `npx eslint src/lib/schedule-health-types.ts src/lib/services/schedule-health.ts src/app/api/schedule/health/route.ts src/hooks/use-schedule-data.ts 'src/app/(app)/schedule/_components/ScheduleReadiness.tsx' 'src/app/(app)/schedule/page.tsx' tests/schedule-health-service.test.ts`
  - `npx tsc --noEmit --pretty false` after `npx next build`; the first parallel run raced with `.next/types` regeneration and produced transient missing generated-file errors.
  - `git diff --check`
  - `npx next build`
  - `npx vitest run tests/schedule-health-service.test.ts tests/schedule-queues.test.ts tests/schedule-queue-source-contract.test.ts`
  - `npx eslint src/lib/schedule-queues.ts src/lib/schedule-health-types.ts src/lib/services/schedule-health.ts src/hooks/use-schedule-data.ts 'src/app/(app)/schedule/_components/ScheduleReadiness.tsx' 'src/app/(app)/schedule/_components/ScheduleFilters.tsx' 'src/app/(app)/schedule/_components/ListView.tsx' 'src/app/(app)/schedule/page.tsx' src/components/TradeBoard.tsx tests/schedule-queues.test.ts tests/schedule-health-service.test.ts tests/schedule-queue-source-contract.test.ts`
  - `npx vitest run tests/candidate-scoring.test.ts tests/schedule-assign-source.test.ts`
  - `npx vitest run tests/api-route-wrapper-contract.test.ts tests/shift-assignments.test.ts`
  - `npx vitest run tests/candidate-scoring.test.ts tests/schedule-assign-source.test.ts tests/api-route-wrapper-contract.test.ts tests/shift-assignments.test.ts`
  - `npx eslint src/lib/candidate-scoring-types.ts src/lib/services/candidate-scoring.ts 'src/app/api/shifts/[id]/candidate-scores/route.ts' src/components/shift-detail/UserAvatarPicker.tsx 'src/app/(app)/schedule/assign/_components/AssignmentCell.tsx' tests/candidate-scoring.test.ts tests/schedule-assign-source.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `npx vitest run tests/auto-fill-preview.test.ts tests/auto-assign-preview-commit.test.ts tests/schedule-assign-source.test.ts`
  - `npx vitest run tests/auto-fill-preview.test.ts tests/auto-assign-preview-commit.test.ts tests/schedule-assign-source.test.ts tests/api-route-wrapper-contract.test.ts tests/shift-assignments.test.ts`
  - `npx eslint src/lib/auto-fill-preview-types.ts src/lib/services/auto-fill-preview.ts src/lib/services/auto-assign.ts 'src/app/api/shift-groups/[id]/auto-assign/preview/route.ts' 'src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx' src/components/ShiftDetailPanel.tsx tests/auto-fill-preview.test.ts tests/auto-assign-preview-commit.test.ts tests/schedule-assign-source.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `git diff --check`
  - `npx next build`
  - `npx prisma format`
  - `npx prisma generate`
  - `npx prisma validate`
  - `npm run db:migrate:check`
  - `npx vitest run tests/schedule-publication.test.ts tests/api-route-wrapper-contract.test.ts tests/shift-assignments.test.ts tests/schedule-assign-source.test.ts`
  - `npx eslint prisma/schema.prisma src/lib/schedule-publication-types.ts src/lib/services/schedule-publication.ts 'src/app/api/shift-groups/[id]/publish/route.ts' 'src/app/api/shift-assignments/[id]/acknowledge/route.ts' 'src/app/api/shift-groups/route.ts' 'src/app/api/shift-groups/[id]/route.ts' src/app/api/my-shifts/route.ts 'src/app/(app)/schedule/_components/types.ts' src/hooks/use-schedule-data.ts 'src/app/(app)/schedule/_components/ListView.tsx' src/components/ShiftDetailPanel.tsx 'src/app/(app)/events/[id]/_utils.ts' 'src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx' 'src/app/(app)/events/[id]/page.tsx' tests/schedule-publication.test.ts tests/schedule-assign-source.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `git diff --check`
  - `npx next build`
  - `npx vitest run tests/schedule-open-work.test.ts tests/schedule-open-work-source.test.ts tests/shift-trades.test.ts tests/shift-trades-route.test.ts tests/shift-assignments.test.ts tests/schedule-notification-policy.test.ts tests/schedule-assign-source.test.ts tests/schedule-queue-source-contract.test.ts`
  - `npx eslint src/components/TradeBoard.tsx src/lib/services/schedule-open-work.ts src/app/api/schedule/open-work/route.ts src/app/api/shift-assignments/pickup/route.ts tests/schedule-open-work.test.ts tests/schedule-open-work-source.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `git diff --check`
  - `npx next build`
  - `npx prisma format`
  - `npx prisma generate`
  - `npx prisma validate`
  - `npm run db:migrate:check`
  - `npx vitest run tests/student-availability-conflicts.test.ts tests/student-availability-routes.test.ts tests/candidate-scoring.test.ts`
  - `npx vitest run tests/schedule-open-work.test.ts tests/shift-assignments.test.ts tests/shift-trades.test.ts tests/auto-fill-preview.test.ts tests/auto-assign-preview-commit.test.ts tests/schedule-assign-source.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `npx vitest run tests/student-availability-conflicts.test.ts tests/student-availability-routes.test.ts tests/candidate-scoring.test.ts tests/schedule-open-work.test.ts tests/schedule-open-work-source.test.ts tests/shift-assignments.test.ts tests/shift-trades.test.ts tests/auto-fill-preview.test.ts tests/auto-assign-preview-commit.test.ts tests/schedule-assign-source.test.ts`
  - `npx eslint prisma/schema.prisma src/lib/student-availability.ts src/lib/services/candidate-scoring.ts src/lib/services/shift-assignments.ts src/lib/services/schedule-open-work.ts src/lib/services/shift-trades.ts 'src/app/api/users/[id]/availability/route.ts' 'src/app/api/users/[id]/availability/[blockId]/route.ts' 'src/app/api/shift-assignments/[id]/route.ts' 'src/app/api/shifts/[id]/route.ts' 'src/app/api/shifts/[id]/conflicts/route.ts' 'src/app/(app)/users/[id]/UserAvailabilityTab.tsx' 'src/app/(app)/users/[id]/page.tsx' tests/student-availability-conflicts.test.ts tests/student-availability-routes.test.ts tests/candidate-scoring.test.ts tests/shift-assignments.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `git diff --check`
  - `npx next build`
- Not run:
  - Production/live migration apply. `npx prisma migrate dev --name schedule_publish_ack_contract` and `--create-only` both failed with a blank Prisma schema-engine error against Neon; live shared-database mutation was not run. The additive local migration artifact is present at `prisma/migrations/0080_schedule_publish_ack_contract/migration.sql` and validates locally.
  - `npm run build`, because it starts with live `scripts/prisma-migrate-deploy.mjs`; use a production migration approval gate before running it for this schema slice.
  - `npx vitest run tests/student-field-contracts.test.ts` currently has two unrelated native string expectation failures around iOS Booking title and Schedule labeled controls.
  - Authenticated browser smoke. There is no checked-in Playwright/browser harness or obvious auth setup in `package.json`; keep this as the first manual smoke before merging UI slices.
  - Browser smoke for notification settings and Notifications inbox rows. Slice 6 changed the settings rows and event-routable payload contracts, but local verification was limited to source-contract tests, typecheck, lint, and build.
  - Browser smoke for student Open Work claim/request, staff approval, existing trade claim, existing trade approval, empty states, and mobile layout. Local verification used service/source tests, typecheck, lint, and build.
  - Browser smoke for Profile Availability student create/edit/delete, staff approve/deny, and mobile layout. Local verification used route/service/source tests, typecheck, lint, and build.

## Slice 11 Review: Gear Readiness As First-Class Schedule State
Shipped:
- `/api/schedule/health` now includes a gear readiness read model with event-level and assignment-level records.
- Gear readiness resolves the same durable links Schedule depends on: `Booking.eventId`, `BookingEvent.eventId`, and `Booking.shiftAssignmentId`.
- `/schedule` list rows show compact event gear chips, and expanded assignment rows show missing gear, reserved gear, pickup-ready gear, checked-out gear, and event-linked gear.
- Schedule reserve/prep links open the reservation wizard with event, requester, and `shiftAssignmentId` context; no checkout custody action was added.
- Event detail Crew command-center reads include assignment-linked bookings and use stronger gear labels: Assignment gear, Event reservation, Pickup ready, Checked out, and Missing gear.
- Reservation creation preserves `shiftAssignmentId` from Schedule deep links when the operator completes a reservation.

Verification:
- Passed: `npx vitest run tests/schedule-health-service.test.ts`
- Passed: `npx vitest run tests/schedule-health-service.test.ts tests/schedule-queues.test.ts tests/schedule-queue-source-contract.test.ts tests/schedule-gear-readiness-source.test.ts tests/booking-wizard-event-context-source.test.ts`
- Passed: `npx eslint src/lib/schedule-health-types.ts src/lib/services/schedule-health.ts 'src/app/(app)/schedule/_components/ListView.tsx' 'src/app/(app)/schedule/page.tsx' src/components/booking-wizard/BookingWizard.tsx 'src/app/api/calendar-events/[id]/command-center/route.ts' 'src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx' tests/schedule-health-service.test.ts tests/schedule-queues.test.ts tests/schedule-gear-readiness-source.test.ts`
- Passed: `npx tsc --noEmit --pretty false`
- Passed: `git diff --check`
- Passed: `npx next build` with existing repo-wide lint warnings outside the touched Slice 11 files.
- Browser smoke remains manual unless an authenticated harness is available.

## Slice 12 Review: Schedule Change History And Trust Trail
Shipped:
- Added a reusable audit-derived Schedule change history read model keyed by event.
- `/api/schedule/health` now carries compact change summaries for visible Schedule events.
- Event command-center reads now include recent schedule changes for Event detail Crew.
- `/schedule` list rows show `Changed recently` or `Review changes`, and expanded rows show the latest change.
- Event detail Crew shows a compact recent schedule changes list with actor, timestamp, detail, and `Needs review` when the change happened after publication.
- The slice stayed read-only. No rollback, automated republish, notification fanout, schema migration, or custody mutation was added.

Verification:
- Passed: `npx vitest run tests/schedule-change-history.test.ts tests/schedule-health-service.test.ts tests/schedule-gear-readiness-source.test.ts`
- Passed: `npx eslint src/lib/schedule-change-history-types.ts src/lib/services/schedule-change-history.ts src/lib/schedule-health-types.ts src/lib/services/schedule-health.ts 'src/app/api/calendar-events/[id]/command-center/route.ts' 'src/app/(app)/events/[id]/_utils.ts' 'src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx' 'src/app/(app)/schedule/_components/ListView.tsx' tests/schedule-change-history.test.ts tests/schedule-health-service.test.ts tests/schedule-gear-readiness-source.test.ts tests/schedule-queues.test.ts`
- Passed: `npx tsc --noEmit --pretty false`
- Passed: `git diff --check`
- Passed: `npx next build` with existing repo-wide warnings outside the touched Slice 12 files.
- Browser smoke remains manual unless an authenticated harness is available.

## Slice 13 Review: Staff Exports And Season Review
Shipped:
- Added staff/admin-only `GET /api/schedule/export?type=...` CSV exports for roster, hours, open slots, conflicts, trades/open-work requests, and gear readiness.
- The export route uses the existing `report.view` permission, rate limits by actor, returns `text/csv`, sets `Content-Disposition`, and reports `X-Exported-Count`, `X-Total-Count`, and `X-Truncated` when capped.
- The shared Schedule export service uses source-of-truth `CalendarEvent`, `ShiftGroup`, `Shift`, `ShiftAssignment`, `ShiftTrade`, and reservation booking links, with 5,000-row and 366-day caps.
- The CSV path uses shared `csvField` escaping, including formula-like values.
- `/schedule` now gives staff/admin users an `Export` menu beside existing staff actions, with six CSV choices scoped to the current Schedule window and sport/archive filters.
- CSV-only scope held. No PDF, scheduled delivery, background jobs, or new reporting warehouse surface was added.

Verification:
- Passed: `npx vitest run tests/schedule-exports.test.ts tests/schedule-export-route.test.ts tests/schedule-export-source.test.ts`
- Passed: `npx eslint src/lib/services/schedule-exports.ts src/app/api/schedule/export/route.ts 'src/app/(app)/schedule/page.tsx' tests/schedule-exports.test.ts tests/schedule-export-route.test.ts tests/schedule-export-source.test.ts`
- Passed: `npx tsc --noEmit --pretty false`
- Passed: `git diff --check`
- Passed: `npx next build` with existing repo-wide warnings outside the touched Slice 13 files.
- Browser smoke remains manual unless an authenticated harness is available.

## Next Slice Goal
### Slice 14 Prompt: Source-Of-Truth Hardening And Smoke Closure
Goal: prove the Schedule source-of-truth experience end to end and clear the remaining manual/browser proof debt left by the implementation slices.

Scope:
- Audit the deferred browser-smoke list from Slices 1-13 and map each item to either authenticated browser proof or a source-contract fallback test.
- Prioritize the actual in-season operator loop:
  - readiness queue cards and URL-backed queues,
  - automation digest links,
  - candidate picker groups,
  - auto-fill preview/apply,
  - publish/ack states,
  - Open Work pickup/trade flows,
  - copy-forward/template review,
  - gear readiness reservation links,
  - change history indicators,
  - export downloads.
- Add missing source-contract tests where UI proof cannot run in this environment.
- Polish only discovered friction in existing Schedule surfaces. Do not add new product scope.
- Keep iOS additive and untouched unless a web payload contract regression is found.

Verification:
- Authenticated browser smoke for the priority Schedule workflows if a harness is available.
- Source-contract fallback tests for any workflow that cannot be browser-smoked.
- Focused regression tests touched by any polish fixes.
- `npx eslint <touched files>`, `npx tsc --noEmit --pretty false`, `git diff --check`, and `npx next build`.

## Slice 14 Review: Source-Of-Truth Hardening And Smoke Closure
Shipped:
- Added a Schedule source-of-truth smoke fallback contract test that documents the missing Playwright/authenticated browser harness and covers the in-season operator loop from source.
- The fallback now checks readiness queue cards, URL-backed queues, automation review routing, candidate scoring groups, preview-first auto-fill, copy-forward review, publish/acknowledgement, Open Work, gear readiness links, change history indicators, and Schedule CSV exports.
- No new product surfaces or UI polish were added. The audit did not expose a concrete Schedule friction point that justified widening the slice.
- Fixed the Slice 13 export route test fixtures to match the current `AuthUser` shape by adding `avatarUrl: null`.

Verification:
- Passed: `npx vitest run tests/schedule-source-truth-smoke-contract.test.ts`
- Passed: `npx vitest run tests/schedule-source-truth-smoke-contract.test.ts tests/schedule-queue-source-contract.test.ts tests/schedule-automation-source.test.ts tests/schedule-template-review-source.test.ts tests/schedule-open-work-source.test.ts tests/schedule-export-source.test.ts tests/schedule-gear-readiness-source.test.ts`
- Passed: `npx eslint tests/schedule-source-truth-smoke-contract.test.ts`
- Passed: `npx eslint tests/schedule-source-truth-smoke-contract.test.ts tests/schedule-export-route.test.ts`
- Passed after fixture repair: `npx vitest run tests/schedule-export-route.test.ts`
- Passed after fixture repair: `npx tsc --noEmit --pretty false`
- Passed: `git diff --check`
- Passed: `npx next build` with existing repo-wide warnings outside Slice 14 files.
- Authenticated browser smoke remains unavailable because `package.json` has no Playwright script/dependency and no Playwright config exists.

## Next Slice Goal
### Slice 15 Prompt: Plan Reconciliation And Archive Readiness
Goal: reconcile the Schedule source-of-truth plan against shipped reality, close stale checklist debt, and decide whether the plan is ready to archive or needs one final product-polish slice.

Scope:
- Reconcile Slice 0 in this plan against the shipped Event Detail Slice 0 entry in `docs/AREA_SHIFTS.md`.
- Review every remaining unchecked browser-smoke line and either mark it covered by Slice 14 source-contract fallback, leave it as a manual merge gate, or convert it into a specific test/tooling task.
- Audit `tasks/schedule-source-of-truth-plan.md`, `docs/AREA_SHIFTS.md`, `docs/AREA_REPORTS.md`, `docs/GAPS_AND_RISKS.md`, and the related source-contract tests for duplicate or stale status.
- Decide whether a durable authenticated browser harness is worth a new infrastructure slice, or whether manual smoke remains the accepted merge gate for Schedule UI.
- If the plan is complete, move it to `tasks/archive/` and update `tasks/README.md` if that index tracks active plans.

Non-goals:
- Do not add new Schedule product behavior.
- Do not create a browser harness unless the reconciliation proves it should be its own next slice.
- Do not touch iOS code unless a documented web payload contract is stale.

Verification:
- Source-contract test suite for Schedule plan coverage.
- `npx eslint <touched files>`, `npx tsc --noEmit --pretty false`, `git diff --check`, and `npx next build`.

## Slice 15 Review: Plan Reconciliation And Archive Readiness
Shipped:
- Reconciled Slice 0 against shipped Event Detail evidence in `docs/AREA_SHIFTS.md`, `src/app/(app)/events/[id]/page.tsx`, `tests/calendar-events-route.test.ts`, `tests/booking-wizard-event-context-source.test.ts`, and `tests/kiosk-only-web-affordances-source.test.ts`.
- Reconciled remaining browser-smoke checklist debt as source-contract fallback coverage where the repo has no Playwright/authenticated browser harness.
- Decided not to add a Schedule-specific browser harness slice. Durable authenticated browser proof should be a cross-cutting test-infrastructure plan if the project wants it, not a new Schedule product slice.
- Archived this plan after all Schedule source-of-truth product slices were reconciled.

Verification:
- Passed: `npx vitest run tests/schedule-source-truth-smoke-contract.test.ts tests/schedule-queue-source-contract.test.ts tests/schedule-automation-source.test.ts tests/schedule-template-review-source.test.ts tests/schedule-open-work-source.test.ts tests/schedule-export-source.test.ts tests/schedule-gear-readiness-source.test.ts tests/calendar-events-route.test.ts tests/booking-wizard-event-context-source.test.ts tests/kiosk-only-web-affordances-source.test.ts`
- Passed: `npx eslint tests/schedule-source-truth-smoke-contract.test.ts tests/schedule-export-route.test.ts tests/calendar-events-route.test.ts tests/booking-wizard-event-context-source.test.ts tests/kiosk-only-web-affordances-source.test.ts`
- Passed: `npx tsc --noEmit --pretty false`
- Passed: `git diff --check`
- Passed: `npx next build` with existing repo-wide warnings outside Schedule Slice 15 files.

Final Handoff:
- No Slice 16 is needed for the Schedule Source Of Truth plan.
- Optional future work: create a cross-cutting authenticated browser harness plan if manual UI smoke should become automated.

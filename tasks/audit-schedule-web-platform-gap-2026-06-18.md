# Audit: Schedule Web Platform Gap

Date: 2026-06-18
Route: `/schedule`, `/schedule/assign`, schedule APIs and services
Verdict: NOT READY to match dedicated scheduling platforms, but strong as an event-linked internal operations schedule.

## Highest Impact Fixes And Upgrades

1. Publish and acknowledgement state
   - Gap: assignments exist immediately, but there is no schedule publish/release workflow, no per-worker acknowledgement, and no "who has seen this" accountability.
   - Why it matters: WhenToWork highlights accountability for who viewed shifts and who made changes.
   - Candidate slice: add `publishedAt`, assignment `seenAt` or schedule notification acknowledgement, plus a staff "unpublished changes" banner.

2. Ranked assignment recommendations
   - Gap: direct assignment loads a flat active-user list and auto-assign picks the first eligible user by role/area/sport with primary-area sorting.
   - Why it matters: dedicated scheduling tools make preference, availability, skills, fairness, and hours visible at assignment time.
   - Candidate slice: add a candidate score beside each user: availability conflict, area match, sport roster, recent hours, upcoming count, prior event history.

3. Fairness and workload balancing
   - Gap: schema stores assignments and attendance, and `/api/shifts/my-hours` exists, but the assignment picker and auto-assign logic do not optimize for fair distribution or maximum weekly/daily limits.
   - Candidate slice: add shift-hour aggregates per candidate and make auto-assign avoid overloading the same people.

4. Availability preference levels
   - Gap: availability is advisory unavailability only. There is no "prefer", "dislike", "cannot work" preference model.
   - Why it matters: WhenToWork's AutoFill markets preference and cannot-work awareness as a core engine input.
   - Candidate slice: extend availability blocks with preference type and show positive preference matches in pickers.

5. Open-shift pickup workflow
   - Gap: students can request premier shifts and post trades, but ordinary open shifts are not a first-class "pick up this open shift" marketplace.
   - Why it matters: WhenToWork mobile docs call out employees picking up open shifts.
   - Candidate slice: add `/schedule/open` or a Trade Board tab for open shifts, gated by area/sport eligibility and conflict checks.

6. Time-off/request workflow
   - Gap: ad hoc availability blocks can represent exams or conflicts, but there is no manager-reviewed time-off request lifecycle.
   - Candidate slice: add `TimeOffRequest` with pending/approved/denied states and feed approved requests into the same conflict engine.

7. Bulk editing, templates, and copy-forward
   - Gap: sport templates generate slots from calendar events, but managers cannot copy a finished crew pattern forward, bulk edit call windows, or apply recurring staffing templates from the schedule surface.
   - Candidate slice: "Copy staffing from last matching event" and "apply sport template refresh preview" before any destructive regeneration.

8. Staffing health command center
   - Gap: readiness shows next call, staff needed, covered events, my shifts, and trade count, but not unresolved requests, claimed trades awaiting approval, stale unacknowledged assignments, at-risk events, or source sync impact.
   - Candidate slice: turn readiness into clickable queues with saved filters.

9. Schedule audit timeline and change provenance
   - Gap: mutations create audit entries in several routes, but the page does not expose a schedule-change timeline or diff view to managers.
   - Why it matters: schedule platforms compete on trust after changes, not only initial creation.
   - Candidate slice: event-level "Change history" sheet that merges shift, assignment, trade, visibility, and call-window changes.

10. Calendar/export maturity
   - Gap: personal ICS exists, but there is no manager export for schedule versions, payroll/hours exports, or printable weekly roster packet.
   - Candidate slice: add staff CSV/PDF exports for event staffing, hours by user, and open-slot reports.

## Sources Read

- `docs/AREA_SHIFTS.md`
- `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `prisma/schema.prisma`
- `src/app/(app)/schedule/page.tsx`
- `src/hooks/use-schedule-data.ts`
- `src/app/(app)/schedule/_components/ScheduleFilters.tsx`
- `src/app/(app)/schedule/_components/ListView.tsx`
- `src/app/(app)/schedule/_components/ScheduleReadiness.tsx`
- `src/app/(app)/schedule/assign/_components/AssignPageClient.tsx`
- `src/hooks/use-assignment-grid.ts`
- `src/lib/services/auto-assign.ts`
- `src/lib/services/shift-assignments.ts`
- `src/lib/services/shift-trades.ts`
- `src/lib/student-availability.ts`
- `tests/shift-assignments.test.ts`
- `tests/student-availability-conflicts.test.ts`
- WhenToWork public feature, AutoFill, and mobile pages
- General employee scheduling software feature survey

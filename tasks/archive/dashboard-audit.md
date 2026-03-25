# Dashboard Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Ship-Ready with Minor Gaps (19/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_DASHBOARD.md is comprehensive: section specs, interaction rules, permissions, edge cases, explicit non-goals. V3 change log detailed and current. |
| Hardening | 4/5 | 5 dedicated hardening commits (AbortController, refresh-preserves-data, optimistic draft delete, error differentiation, toast ref pattern). Missing: student role-adaptive mobile (BRIEF AC-3 not implemented). |
| Roadmap | 3/5 | No standalone `tasks/dashboard-roadmap.md`. Phase B items (filter chips, saved filters) tracked in GAPS_AND_RISKS and todo.md but not in a dedicated plan. Phase C ops board mentioned but unbriefed. |
| Feature completeness | 4/5 | 10/10 acceptance criteria marked complete in AREA doc. One spec deviation (reservation 7-day window). Student mobile role-adaptive dashboard (BRIEF AC-3) not implemented. |
| Doc sync | 3/5 | AREA doc well-maintained through 2026-03-22. However, BRIEF_STUDENT_MOBILE_V1.md AC-3/AC-5 unchecked despite brief marked shipped in NORTH_STAR. No doc notes this gap. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Dashboard | `/` (page.tsx, ~820 lines) | Hardened | AbortController, 401 redirect, network vs server error differentiation, optimistic draft delete with rollback, null-safe guards, manual refresh with staleness tooltip, varied-width skeletons, toast ref pattern. |
| Dashboard API | GET `/api/dashboard` | Hardened | Auth via withAuth. Single batched Promise.all with 17 parallel queries (good for Vercel serverless). |
| Drafts API (list/create) | GET/POST `/api/drafts` | Partially hardened | Auth, Zod validation on POST, transaction-wrapped. Issue: `defaultLocationId()` throws raw Error instead of HttpError. |
| Drafts API (get/delete) | GET/DELETE `/api/drafts/[id]` | Hardened | Ownership verification, HttpError for 404, audit logging on delete, cascade delete for items. |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Overdue banner (red, count, inline items, click-through) | Shipped | AREA_DASHBOARD S1 | Max 5 items, elapsed times, pulsing dot, "Resolve all overdue" CTA |
| Action Lane: Checkouts | Shipped | AREA_DASHBOARD S2 | My + Team split, overdue-first sort, ref badges |
| Action Lane: Reservations | Shipped (spec deviation) | AREA_DASHBOARD S3 | **No 7-day window filter** — fetches ALL booked reservations. Spec says "next 7 days." |
| My Gear in Custody | Shipped (evolved) | AREA_DASHBOARD S4 | Evolved to booking-level cards, not per-item custody cards as specced |
| Drafts section | Shipped | AREA_DASHBOARD S5, D-017 | Confirmation dialog, optimistic delete, auto-save, resume via `?draftId=` |
| Stat strip (4 KPIs) | Shipped | AREA_DASHBOARD changelog | Checked out, Overdue, Due today, Reserved — clickable with filter links |
| My Shifts widget | Shipped | AREA_DASHBOARD changelog | Gear status badges, "Prep gear" action links |
| Upcoming Events section | Shipped | AREA_DASHBOARD changelog | Sport badges, shift avatar stacks, event-linked booking creation |
| Two-column split (My Gear / Team Activity) | Shipped | AREA_DASHBOARD changelog | Mobile stacks at 768px |
| Permission-restricted actions | Shipped | AREA_DASHBOARD permissions | All users see data; students read-only per D-011 |
| Row click opens detail sheet | Shipped | AREA_DASHBOARD interaction | BookingDetailsSheet with onUpdated refresh |
| Quick action buttons | Shipped | AREA_DASHBOARD changelog | New checkout/reservation in page header |
| Ref number badges | Shipped | D-024 | On all booking rows |
| shadcn/ui migration | Shipped | AREA_DASHBOARD changelog | Avatar, Badge, Skeleton, Progress, Card, Button, DropdownMenu, Tooltip |
| Student role-adaptive mobile | **Not implemented** | BRIEF_STUDENT_MOBILE_V1 AC-3 | "Hide team activity for STUDENT on mobile" — no role check in page |
| Owned booking visual distinction | **Not implemented** | BRIEF_STUDENT_MOBILE_V1 AC-5 | "Left-border accent on owned bookings" — not built |
| Dashboard filter chips (Sport, Location) | Deferred (Phase B) | GAPS_AND_RISKS | Explicitly deferred |
| Dashboard saved filters | Deferred (Phase B) | GAPS_AND_RISKS | Explicitly deferred |
| Board/ops view | Deferred (Phase C) | GAPS_AND_RISKS | Unbriefed |

## Open Gaps & Blockers

1. **Reservation 7-day window not enforced (spec deviation)**: AREA_DASHBOARD S3 says "Window: next 7 days." API fetches ALL booked reservations with no `startsAt` date filter. Far-future reservations appear on dashboard contrary to spec.

2. **Student role-adaptive dashboard not implemented (BRIEF AC-3)**: Page has zero references to user role. NORTH_STAR marks student mobile V1 as complete, but this AC is unmet.

3. **Owned booking visual distinction not implemented (BRIEF AC-5)**: No left-border accent or ownership indicator. Page doesn't receive current user ID for comparison.

4. **My Gear in Custody evolved away from spec**: AREA_DASHBOARD S4 specifies per-item custody cards with tagName + countdown + suggested return location. Implementation shows booking-level summaries. Spec should be updated or feature built as specified.

5. **`defaultLocationId()` throws raw Error**: In `/api/drafts/route.ts` — throws `new Error(...)` instead of `new HttpError(500, ...)`, producing unstructured 500 response.

## Recommended Actions (prioritized)

1. **[P0] Fix reservation 7-day window filter** — Add `startsAt: { lte: sevenDaysFromNow }` to reservation queries in `/api/dashboard/route.ts`. Spec deviation, low effort.
2. **[P1] Implement student role-adaptive dashboard (BRIEF AC-3)** — Pass role to page, hide Team Activity for STUDENT on mobile. Update brief ACs.
3. **[P1] Update AREA_DASHBOARD S4 spec** — Reconcile "My Gear in Custody" spec with shipped booking-level implementation.
4. **[P2] Add owned-booking visual distinction (BRIEF AC-5)** — Pass userId, compare against requesterUserId, add left-border accent. Low effort.
5. **[P2] Fix `defaultLocationId()` error handling** — Change to HttpError for consistent responses.
6. **[P2] Reconcile BRIEF_STUDENT_MOBILE_V1.md status** — AC-3 and AC-5 unchecked but brief marked complete in NORTH_STAR.

## Roadmap Status
**Rating: Partially defined**

- No standalone roadmap file exists.
- Phase B items tracked in todo.md and GAPS_AND_RISKS (filter chips, saved filters).
- Phase C ops board mentioned but unbriefed.
- Deferred features clearly documented with rationale.
- Missing: consolidated dashboard roadmap sequencing remaining work.

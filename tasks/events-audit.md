# Events Ship-Readiness Audit
**Date**: 2026-04-06
**Auditor**: Claude (automated)
**Area**: Events (Calendar Events, Event Detail, Calendar Sources, Venue Mappings)
**Overall Verdict**: Ship-ready (23/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_EVENTS.md comprehensive. All 4 ACs checked. Clear separation: sync pipeline, event picker, booking linkage, schedule integration. Unified schedule shipped (old `/events` list removed). |
| Hardening | 5/5 | Event detail: 6-pass hardening (AbortController on all 3 fetchers, 401 on every endpoint, error differentiation, skeleton, refresh-preserves-data, nudge toast). Schedule page: hardened via `useScheduleData` hook (React Query). GAP-20 closed. |
| Roadmap | 4/5 | `tasks/schedule-roadmap.md` exists and is current (2026-04-04). V1 + V2 slice 1 shipped. Phase B/C items tracked. No standalone events roadmap but AREA_EVENTS changelog tracks evolution. |
| Feature completeness | 5/5 | ICS sync, idempotent upsert, sport filtering, event picker (30-day window), booking linkage, unified schedule, calendar source management, venue mappings, command center, shift coverage card, week view. |
| Doc sync | 4/5 | AREA_EVENTS last updated 2026-03-25 but changelog goes to 2026-04-02. Header date should be bumped. Missing `/events` → `/schedule` redirect noted but not critical. |

## Page-by-Page Status
| Page | Route | Lines | Hardening | Issues |
|---|---|---|---|---|
| Event detail | `/events/[id]` | 607 | Hardened | 6-pass. AbortController on 3 fetchers, 401 on all endpoints, error differentiation (network/server), skeleton, refresh with freshness tooltip, nudge toast. Role-aware command center. |
| Schedule (merged) | `/schedule` | 117 (decomposed) | Hardened | React Query via `useScheduleData`. 401, double-click guards, mobile skeleton. Events + shifts unified. |
| Calendar Sources | `/settings/calendar-sources` | (settings page) | Hardened | Enable/disable, sync status, health badges, error display. |
| Venue Mappings | `/settings/venue-mappings` | (settings page) | Hardened | Admin-only CRUD, regex validation (D-027). |
| Old events list | `/events` | Removed | N/A | Merged into `/schedule`. No redirect — direct navigation returns 404. |

## API Route Status
| Route | Auth | Validation | Notes |
|---|---|---|---|
| `GET /api/calendar-events` | All roles | Query params | Default `startsAt >= now()`. Pagination. Excludes CANCELLED + hidden. |
| `GET /api/calendar-events/[id]` | calendar_source view | N/A | Returns event + location + source. |
| `GET /api/calendar-events/[id]/command-center` | Staff+ | N/A | Gear status per shift area. |
| `PATCH /api/calendar-events/[id]/visibility` | Staff+ | Zod | Hide/show events. |
| `GET/POST /api/calendar-sources` | Admin | Zod | Source CRUD. |
| `GET/PATCH/DELETE /api/calendar-sources/[id]` | Admin | Zod | Individual source management. |
| `POST /api/calendar-sources/[id]/sync` | Admin | N/A | Manual sync trigger. |
| `POST /api/availability/check` | All roles | Zod | Asset conflict detection for date ranges. |
| `GET /api/calendar` | All roles | N/A | Month calendar view data. |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| ICS feed ingestion | Shipped | AREA_EVENTS AC-3 | Idempotent upsert by external_id. Per-event error isolation. |
| Event picker (30-day window) | Shipped | AREA_EVENTS AC-1 | Sport-filtered, upcoming events. |
| Booking event linkage | Shipped | AREA_EVENTS AC-2 | eventId + sportCode persisted on Booking. |
| Graceful degradation | Shipped | AREA_EVENTS AC-4 | Missing fields don't block checkout creation. |
| Unified schedule page | Shipped | Changelog 2026-03-23 | Old `/events` list removed. Calendar + list views. |
| Calendar source management | Shipped | Settings | Enable/disable, sync status, health badges. |
| Venue mappings | Shipped | D-027 | Admin-only regex-to-location mapping. |
| Daily cron sync | Shipped | D-026 | 6 AM UTC + manual refresh. Staleness indicator. |
| Event command center | Shipped | Changelog 2026-03-16 | Staff view with gear status per area. |
| Week view | Shipped | V2 slice 1 | 7-day grid, mobile collapsible. |
| Home/away toggle | Shipped | V1.5 | Schedule page filter. |
| Multi-source ingestion | Deferred | Phase C | Beyond UW Badgers ICS. |

## Open Gaps & Blockers

None critical. All event-related gaps closed:
- ~~GAP-20~~ (events page monolith) — Closed 2026-03-26
- ~~PD-2~~ (venue mapping governance) — Resolved D-027
- ~~PD-3~~ (sync refresh cadence) — Resolved D-026

### Minor issues
1. **No `/events` → `/schedule` redirect**: Old URL returns 404. Low priority since sidebar changed.
2. **AREA_EVENTS.md header date stale**: Says 2026-03-25, changelog goes to 2026-04-02.

## Recommended Actions (prioritized)

1. **[Low] Bump AREA_EVENTS.md header date** to 2026-04-02 (latest changelog entry).
2. **[Low] Add `/events` redirect to `/schedule`** — Prevents 404 for bookmarked URLs.

## Roadmap Status
| Version | Status | Notes |
|---|---|---|
| V1 Core | Complete | ICS sync, event picker, booking linkage, unified schedule. |
| V2 Slice 1 | Complete | Week view, home/away toggle, hide events. |
| Phase B | Deferred | Better normalization for opponent/venue fields. |
| Phase C | Deferred | Multi-source ingestion, event quality scoring. |

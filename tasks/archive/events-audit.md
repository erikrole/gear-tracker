# Events Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Needs Work (17/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 4/5 | AREA_EVENTS.md clearly separates Now/Next/Later. D-003 governs event-centric checkout. Two pending decisions (PD-2, PD-3) documented but unresolved. |
| Hardening | 2/5 | Backend sync pipeline is hardened (per-event error isolation, batch ops, diagnostics). Both UI pages (events list 817 lines, event detail 475 lines) have NOT received 5-pass hardening. No AbortController, silent failures, inline styles, no dark mode support. |
| Roadmap | 3/5 | AREA_EVENTS.md has Now/Next/Later. No dedicated roadmap file. Phase C multi-source ingestion noted. Calendar source health UI shipped. |
| Feature completeness | 4/5 | All 9 "Now" items shipped. Both high-priority "Next" items shipped (enable/disable, sync health UI). Remaining Next items are low-priority polish. Vercel Cron not configured (PD-3). |
| Doc sync | 4/5 | AREA_EVENTS.md change log reflects shipped reality. GAPS_AND_RISKS has closed GAP-C and GAP-D. PD-2/PD-3 remain open as expected. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Events List | `/events` (817 lines) | **Not hardened** | Monolithic single component, 25+ useState calls, no hooks extracted. No AbortController. All catch blocks are `{ /* network error */ }` — silent failures. Inline styles throughout. Custom CSS classes (not shadcn). Hardcoded colors (no dark mode). Duplicate source management UI (also on /settings/calendar-sources). |
| Event Detail | `/events/[id]` (475 lines) | **Not hardened** | Monolithic, no hook extraction. No AbortController. Shift group fetches ALL groups then filters client-side. Manual breadcrumb causes double breadcrumb. `<a href>` instead of `<Link>` for CTAs. Pre-shadcn CSS variables. Raw ICS debug section visible to all roles. |
| Calendar Sources | `/settings/calendar-sources` (288 lines) | Partially hardened | Toast feedback on all operations, error handling, disabled states. Missing: AbortController, high-fidelity skeleton. |

## API Route Status
| Route | Method | Auth | Validation | Audit | Issues |
|---|---|---|---|---|---|
| `/api/calendar-events` | GET | withAuth | Manual param parsing (no Zod) | N/A | No input validation |
| `/api/calendar-events/[id]` | GET | withAuth + requirePermission | Path param | N/A | None |
| `/api/calendar-events/[id]/command-center` | GET | withAuth + STUDENT 403 | Path param | N/A | Promise.all for parallel queries — good |
| `/api/calendar-sources` | GET | withAuth | None needed | N/A | None |
| `/api/calendar-sources` | POST | withAuth + requirePermission | Zod | Yes | None |
| `/api/calendar-sources/[id]` | PATCH | withAuth + requirePermission | Zod + empty body refine | Yes | None |
| `/api/calendar-sources/[id]` | DELETE | withAuth + requirePermission | Path param | Yes | $transaction wrapping — good |
| `/api/calendar-sources/[id]/sync` | POST | withAuth + requirePermission | Path param | None (acceptable) | Auto-generates shifts, error isolated |

## Sync Service Status
| Check | Status |
|---|---|
| Error isolation | Per-event try/catch, batch failures isolated |
| Batch operations | createMany with WRITE_CHUNK_SIZE=500 |
| Idempotency | Upsert by externalId (ICS UID) |
| Validation | Date validation, ICS text unescaping (RFC 5545), sport extraction |
| Diagnostics | Full sync diagnostics returned |
| Staleness | lastFetchedAt and lastError persisted |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| ICS feed ingest (idempotent upsert) | Shipped | AREA_EVENTS Now #1 | |
| CalendarEvent model normalization | Shipped | AREA_EVENTS Now #2 | |
| Sport filtering for checkout (30-day picker) | Shipped | AREA_EVENTS Now #3 | |
| Booking linkage (eventId, sportCode) | Shipped | AREA_EVENTS Now #4 | |
| Upcoming-default filter | Shipped | AREA_EVENTS Now #5 | |
| Calendar source deletion with SET NULL cascade | Shipped | AREA_EVENTS Now #6 | |
| Per-event error isolation in sync | Shipped | AREA_EVENTS Now #7 | |
| Batch DB operations in sync | Shipped | AREA_EVENTS Now #8 | |
| Production sync diagnostics | Shipped | AREA_EVENTS Now #9 | |
| Calendar source enable/disable toggle | Shipped | AREA_EVENTS Next #1 | |
| Sync health admin UI | Shipped | AREA_EVENTS Next #2 | On both /events and /settings/calendar-sources |
| Stale-data visibility | Shipped | AREA_EVENTS Next #4 | Health badge with stale detection |
| Event Command Center | Shipped | Event detail | Staff/admin shift + gear view |
| Calendar view (month grid) | Shipped | Events list | |
| Venue mapping management | Shipped | Events list | |
| Better opponent/venue normalization | Specced | AREA_EVENTS Next #3 | Not implemented |
| Vercel Cron auto-sync | **Missing** | PD-3 | Cadence not formalized, no cron configured |
| Venue mapping governance | **Missing** | PD-2 | No owner assigned |
| Multi-source event ingestion | Deferred | Phase C | |
| Event quality scoring | Deferred | Phase C | |

## Open Gaps & Blockers
1. **Events list page not hardened** — 817-line monolith with no AbortController, silent failures, inline styles, custom CSS, no dark mode. Below quality bar vs other hardened pages.
2. **Event detail page not hardened** — Double breadcrumb, inline styles, silent errors, broad shift query, `<a href>` instead of `<Link>`, debug section visible to all roles.
3. **PD-3: No Vercel Cron configured** — Manual sync works but no automated refresh cadence. Staleness thresholds not formalized.
4. **PD-2: Venue mapping governance unassigned** — No owner for regex-to-location mapping rules.
5. **Duplicate source management UI** — Source management exists on both `/events` AND `/settings/calendar-sources`. Redundant surface.
6. **Shift group query inefficiency** — Event detail fetches ALL shift groups, filters client-side. N+1 risk at scale.
7. **Raw ICS debug section** — Visible to all roles on event detail. Should be admin-only or removed.

## Recommended Actions (prioritized)
1. **[P0] Run /harden-page on Events list** — AbortController, toast on failures, high-fidelity skeleton, dark-mode-safe colors, extract hooks from 817-line monolith. This is the biggest quality gap in the system.
2. **[P0] Run /harden-page on Event detail** — Remove manual breadcrumb, replace inline styles, add toast feedback, AbortController, role-gate debug section.
3. **[P1] Resolve duplicate source management** — Remove from `/events` (keep `/settings/calendar-sources` as canonical) or vice versa.
4. **[P1] Configure Vercel Cron (PD-3)** — Set up automated calendar sync (e.g., every 6h) with staleness threshold.
5. **[P2] Replace `<a href>` with `<Link>`** — Event detail CTAs cause full page reloads.
6. **[P2] Add server-side eventId filter for shift groups** — Instead of fetching all and filtering client-side.
7. **[P3] Better opponent/venue normalization** — AREA_EVENTS Next #3.
8. **[P3] Assign venue mapping governance (PD-2)** — Decide who owns regex-to-location rules.

## Roadmap Status
**Rating: Partially defined**

- AREA_EVENTS.md has clear Now (9 items, all shipped), Next (4 items, 2 shipped), Later (2 items, deferred).
- No dedicated roadmap file.
- Phase C multi-source ingestion tracked in NORTH_STAR and GAPS_AND_RISKS.
- Two pending decisions (PD-2, PD-3) documented but unresolved.
- Functionally complete for Phase A. Main gap is UI hardening quality, not features.

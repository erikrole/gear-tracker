# Settings Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Needs Work (16/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 4/5 | AREA_SETTINGS.md is clear with all 7 ACs checked. Deduction: Calendar Sources sub-page not documented in area doc despite being shipped. |
| Hardening | 2/5 | No settings page has received a formal hardening pass. Missing: AbortController, skeletons, double-submit guards, client-side auth guard, shadcn Switch for toggles, Tailwind-first styling. Most prominent unhardened area. |
| Roadmap | 3/5 | Phase C equipment guidance rules documented. No plan for departments/locations settings pages. |
| Feature completeness | 4/5 | All specced features shipped and functional. Deduction for missing client-side auth guard and Calendar Sources doc gap. |
| Doc sync | 3/5 | AREA_SETTINGS.md is 8 days stale (2026-03-17). Calendar Sources sub-page missing from doc. Change log has only one entry. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Layout | `/settings/layout.tsx` | Not hardened | No client-side auth check — non-admin users see shell then get 403s. Double breadcrumb (custom `.breadcrumb` + AppShell `PageBreadcrumb`). `.page-header` custom CSS. |
| Categories | `/settings/categories` | Not hardened | Silent `catch {}` — no user feedback on load failure. No AbortController. Inline `<input>` not shadcn Input. `cat-inline-input` CSS. No double-submit guards. lessons.md notes SaveableField refactoring needed. |
| Sports | `/settings/sports` | Partially hardened | Toast on errors, mobile card layout, shadcn Button/Input/Card/Select. But: ShiftConfigTable uses raw `.toggle` button (not shadcn Switch). RosterPanel uses legacy `badge-sm badge-purple/blue/gray` CSS. Inline styles. No AbortController. |
| Escalation | `/settings/escalation` | Partially hardened | Toast on errors, shadcn Card/Select, Zod-validated API, audit logging. But: raw `.toggle` button, no AbortController, no skeleton, basic mobile scroll. |
| Calendar Sources | `/settings/calendar-sources` | Partially hardened | Toast on all ops, confirmation dialogs, health badges, shadcn components. But: inline styles, no AbortController, pre-shadcn CSS vars, no skeleton. |
| Database | `/settings/database` | Partially hardened | Error state, shadcn Card/Badge/Button. But: hardcoded hex colors (`#22c55e`, `#ef4444`), `diag-table` custom CSS, inline styles. |

## API Route Status
| Route | Methods | Auth | Validation | Audit | Issues |
|---|---|---|---|---|---|
| `/api/settings/escalation` | GET, PATCH | ADMIN check | Zod union schema | Yes | None |
| `/api/categories` | GET, POST | withAuth + requirePermission | Zod | Yes | GET has no role restriction (intentional — used elsewhere) |
| `/api/categories/[id]` | PATCH, DELETE | withAuth + requirePermission | Zod | Yes | 409 on delete guards |
| `/api/sport-configs` | GET, POST | requirePermission | Zod | Yes | None |
| `/api/sport-configs/[sportCode]` | GET, PATCH | requirePermission | Zod | Yes | None |
| `/api/sport-configs/[sportCode]/roster` | GET, POST, DELETE | requirePermission | Zod | Yes | None |
| `/api/calendar-sources` | GET, POST | withAuth + requirePermission | Zod | Yes | None |
| `/api/calendar-sources/[id]` | PATCH, DELETE | requirePermission | Zod | Yes | DELETE uses $transaction — good |
| `/api/calendar-sources/[id]/sync` | POST | requirePermission | N/A | No (delegated) | Returns 200 on partial failure |
| `/api/db-diagnostics` | GET | ADMIN check | N/A | No (read-only, acceptable) | None |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Tab-based settings navigation | Shipped | AREA_SETTINGS | 5 tabs: Categories, Sports, Escalation, Calendar, Database |
| Categories tree CRUD | Shipped | AREA_SETTINGS | Create, rename, delete, subcategories, search, sort, delete guards |
| Sports shift config | Shipped | AREA_SETTINGS | Toggle active, home/away counts, mobile cards |
| Sports roster management | Shipped | AREA_SETTINGS | Add/remove users, bulk add |
| Escalation rule management | Shipped | AREA_SETTINGS | Toggle enabled/requester/admins per rule |
| Escalation fatigue controls | Shipped | D-009 | Per-booking cap (5/10/15/20/50) |
| Calendar source CRUD | Shipped | AREA_EVENTS | Add, enable/disable, sync, delete with confirmation |
| Calendar source health UI | Shipped | AREA_EVENTS | Health badges (healthy/stale/error/disabled/never synced) |
| Database diagnostics | Shipped | AREA_SETTINGS | Migration, table, enum, extension, column drift checks |
| Client-side ADMIN auth guard | **Missing** | — | Non-admin users see shell + 403s instead of redirect |
| Settings page hardening | **Missing** | — | No 5-pass audit on any settings page |
| Admin-configurable guidance rules | Deferred | D-016 | Phase C |
| Departments settings sub-page | **Missing** | — | API exists, no settings UI |
| Locations settings sub-page | **Missing** | — | API exists, no settings UI |

## Open Gaps & Blockers
1. **No settings page hardened** — Most prominent unhardened area. No AbortController, no skeletons, legacy CSS, no double-submit guards across all 5 sub-pages.
2. **No client-side auth guard** — Non-admin users who navigate to `/settings` see the UI shell and get 403s from APIs. Should redirect or show "Access Denied."
3. **Calendar Sources missing from AREA_SETTINGS.md** — Shipped 2026-03-19 but only documented in AREA_EVENTS.
4. **Legacy CSS throughout** — RosterPanel uses `badge-sm badge-purple/blue/gray`. Toggle buttons use `.toggle` CSS (not shadcn Switch). Multiple pages use pre-shadcn CSS vars and inline styles.
5. **Double breadcrumb in layout** — Custom `.breadcrumb` div + AppShell `PageBreadcrumb`.
6. **Categories silent error handling** — `catch {}` with no user feedback on load failure.
7. **Departments/Locations have APIs but no settings UI** — Currently managed through other surfaces.

## Recommended Actions (prioritized)
1. **[P0] Add client-side auth guard** — Role check in `settings/layout.tsx` to redirect non-ADMIN users or show access-denied state.
2. **[P0] Run /harden-page on Categories** — Silent errors, no AbortController, legacy inputs. Most fragile settings page.
3. **[P1] Run /harden-page on Sports** — Replace `.toggle` with shadcn Switch, legacy badges with shadcn Badge, add AbortController.
4. **[P1] Run /harden-page on Escalation** — Replace `.toggle` with shadcn Switch, add AbortController, skeleton.
5. **[P1] Fix layout double breadcrumb** — Remove custom `.breadcrumb` div.
6. **[P2] Update AREA_SETTINGS.md** — Add Calendar Sources sub-page, update change log, bump date.
7. **[P2] Clean up legacy CSS** — Replace inline styles with Tailwind, pre-shadcn CSS vars with tokens, hardcoded hex colors with theme vars.
8. **[P3] Consider departments/locations settings tabs** — APIs exist, may warrant dedicated UI.

## Roadmap Status
**Rating: Partially defined**

- All 5 sub-pages have clear scope in AREA_SETTINGS.md.
- Phase C equipment guidance rules documented (D-016).
- No plan for departments/locations settings or future expansion.
- Calendar Sources shipped but documented under AREA_EVENTS, not AREA_SETTINGS.
- No dedicated roadmap file.

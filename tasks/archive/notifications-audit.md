# Notifications Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Needs Work (16/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 4/5 | AREA doc thorough with acceptance criteria, bug traps, edge cases. No BRIEF file (spec written from code per lessons). Doc/code mismatch: cron schedule says "every 15 minutes" but vercel.json is daily at 8AM. |
| Hardening | 2/5 | Notification center page NOT hardened. Missing: AbortController, refresh-preserves-data, skeleton, 401 handling, shadcn migration. **Icon type mapping appears broken** (UI expects `OVERDUE_CHECKOUT` but service creates `checkout_due_reminder`). |
| Roadmap | 3/5 | V1 and Phase B items documented. Phase B escalation work specified in D-009 but lacks BRIEF. No plan file. |
| Feature completeness | 4/5 | All V1 ACs met. D-009 features shipped (admin escalation, fatigue controls, email). Dashboard badge counts mentioned in AREA doc not implemented. |
| Doc sync | 3/5 | AREA doc last updated 2026-03-16 (9 days stale). Cron schedule mismatch. todo.md lists pagination as remaining but GAPS_AND_RISKS shows shipped. Shift gear-up notification undocumented. |

## Critical Issues

### 1. Notification icon type mismatch (likely broken)
The notification center's `notifIcon()` and `notifIconClass()` switch on types: `OVERDUE_CHECKOUT`, `BOOKING_APPROVED`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_REJECTED`. But the service creates records with types: `checkout_due_reminder`, `checkout_due_now`, `checkout_overdue_2h`, `checkout_overdue_24h`, `shift_gear_up`. **None match** — all notifications render with default icon/class.

### 2. Cron schedule doc/code mismatch
AREA doc says "Every 15 minutes via Vercel Cron." `vercel.json` has `"0 8 * * *"` (once daily at 8AM UTC). Either escalation triggers are firing too infrequently or the doc is wrong.

### 3. Page not hardened
Notification center has not received 5-pass hardening. Lacks AbortController, refresh-preserves-data, skeletons, 401 redirect, shadcn components.

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Notification Center | `/notifications` (333 lines) | **Not hardened** | Monolithic (no sub-components extracted). 7 useState hooks. No AbortController. Empty catch blocks (silent failures). Spinner only (no skeleton). CSS class-based styling (`notif-card`, `notif-list`). Icon type mapping broken. No 401 handling. |
| Escalation Settings | `/settings/escalation` (204 lines) | Partially hardened | Toast on errors, Zod-validated API, audit logging. But: raw `.toggle` buttons (not shadcn Switch), no skeleton, CSS class layout, no AbortController. |

## API Route Status
| Route | Method | Auth | Validation | Audit | Issues |
|---|---|---|---|---|---|
| `/api/notifications` | GET | withAuth | parsePagination | No | None |
| `/api/notifications` | PATCH | withAuth | Zod (mark_read/mark_all_read) | **No** | Missing audit per D-007 |
| `/api/notifications/process` | POST | withAuth + ADMIN/STAFF | None needed | Yes | None |
| `/api/notifications/nudge` | POST | withAuth + STAFF+ | Manual body check (no Zod) | **No** | Missing Zod + audit |
| `/api/cron/notifications` | GET | CRON_SECRET bearer | None needed | No | Hardened — bounded batch, non-fatal per-notification |
| `/api/settings/escalation` | GET | withAuth (ADMIN) | None | No | None |
| `/api/settings/escalation` | PATCH | withAuth (ADMIN) | Zod union | Yes | None |

## Service Layer Status
| Service | Assessment |
|---|---|
| `notifications.ts` (313 lines) | Batch-fetches open checkouts (cap 500). DB-driven escalation rules with fallback defaults. Dedup via dedupeKey. Per-booking cap from SystemConfig. Admin escalation on qualifying rules. Email via Resend. Try/catch per notification (non-fatal). Solid. |
| `email.ts` (91 lines) | Resend integration. Console.log fallback in dev. Non-fatal failures. HTML template with XSS escaping. Minimal but functional. |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Escalation schedule (-4h, 0h, +2h, +24h) | Shipped | AREA_NOTIFICATIONS | DB EscalationRule + DEFAULT_SCHEDULE |
| Deduplication (dedupeKey per booking/type) | Shipped | AREA_NOTIFICATIONS | Unique index enforced |
| In-app notification center | Shipped | AREA_NOTIFICATIONS | List, pagination, day grouping |
| Mark-as-read (single + all) | Shipped | AREA_NOTIFICATIONS | PATCH endpoint + UI |
| Unread filter | Shipped | AREA_NOTIFICATIONS | Checkbox + API param |
| Pagination | Shipped | AREA_NOTIFICATIONS | Limit/offset, Previous/Next |
| Email channel (Resend) | Shipped | D-009 | Dual-channel delivery |
| Admin escalation (+24h) | Shipped | D-009 | notifyAdmins flag + admin loop |
| Admin-configurable escalation rules | Shipped | D-009 | Settings page + PATCH API |
| Per-booking notification cap | Shipped | D-009 | SystemConfig maxNotificationsPerBooking |
| Vercel Cron integration | Shipped | AREA_NOTIFICATIONS | vercel.json cron + route |
| Shift gear-up notification | Shipped | Not in AREA doc | createShiftGearUpNotification + nudge API |
| Deep links to booking | Shipped | AREA_NOTIFICATIONS | payload.bookingId + bookingKind |
| Manual processing trigger | Shipped | AREA_NOTIFICATIONS | /api/notifications/process + UI button |
| Multi-recipient escalation | Specced | D-009, NORTH_STAR | Phase B — "Not started" |
| Dashboard badge counts | **Missing** | AREA_NOTIFICATIONS | Referenced but not implemented |
| Per-user notification preferences | Mentioned | AREA doc out-of-scope | Phase C |
| Push/SMS notifications | Mentioned | AREA doc out-of-scope | Phase C |

## Open Gaps & Blockers
1. **Icon type mapping broken** — UI and service use different type strings. All notifications render with default icon.
2. **Cron schedule mismatch** — Doc says 15min, code says daily. Escalation timing directly affected.
3. **Page not hardened** — No AbortController, no skeleton, silent failures, CSS not migrated.
4. **Mark-as-read unaudited** — PATCH mutation missing createAuditEntry per D-007.
5. **Nudge endpoint missing Zod + audit** — Manual body check, no audit logging.
6. **Dashboard badge counts not implemented** — Referenced in AREA doc but no code found.
7. **Shift gear-up notification undocumented** — Exists in code but not in AREA_NOTIFICATIONS.md.
8. **AREA doc 9 days stale** — Last updated 2026-03-16.

## Recommended Actions (prioritized)
1. **[P0] Fix icon type mapping** — Align `notifIcon()`/`notifIconClass()` switch cases with actual notification types created by service (`checkout_due_reminder`, `checkout_overdue_2h`, etc.). Currently all icons broken.
2. **[P0] Resolve cron schedule** — Either update vercel.json to `*/15 * * * *` or update AREA doc to reflect daily cadence. This affects whether escalations fire on time.
3. **[P1] Run /harden-page on notification center** — AbortController, refresh-preserves-data, skeleton, 401 handling, shadcn migration. Extract sub-components from 333-line monolith.
4. **[P1] Add audit logging to mark-as-read** — PATCH /api/notifications needs createAuditEntry per D-007.
5. **[P1] Add Zod + audit to nudge endpoint** — Replace manual body check with Zod schema, add audit entry.
6. **[P2] Update AREA_NOTIFICATIONS.md** — Add shift gear-up notification, fix cron schedule, update change log.
7. **[P2] Implement dashboard badge counts** — Or remove from AREA doc if descoped.
8. **[P3] Write BRIEF for Phase B escalation work** — Multi-recipient model needs formal spec before implementation.

## Roadmap Status
**Rating: Partially defined**

- V1 shipped with all core acceptance criteria met.
- Phase B: multi-recipient escalation specified in D-009 but no BRIEF or plan file.
- Phase C: push/SMS/preferences mentioned as out-of-scope only.
- No dedicated roadmap or plan file exists.
- Shift gear-up notification was an unplanned bonus feature — not tracked in any plan.

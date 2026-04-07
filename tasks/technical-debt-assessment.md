# Technical Debt Assessment

**Date:** 2026-04-07
**Codebase:** 63,318 lines across 443 TypeScript/TSX files, 132 API routes, 86 components

---

## Critical (Action Required)

### 1. Test Coverage Gap
- **7% coverage** — 4,449 lines of tests for 63k lines of code
- **Zero component tests** — 86 React components completely untested
- **Zero API integration tests** — 132 route handlers untested at HTTP layer
- Only `src/lib/services/**`, `rbac.ts`, `permissions.ts`, `api.ts` configured for coverage
- No E2E framework (Playwright/Cypress not installed)
- **Risk:** Regressions go undetected; refactoring is unsafe without coverage

### 2. Silent Error Swallowing (24+ catch blocks)
- 128 catch blocks total, ~24 completely silent (empty or `/* ignore */`)
- Critical locations: `TradeBoard`, `BookingListPage`, `QrScanner`, `EquipmentPicker`, `calendar-sync.ts`, `blob.ts`
- 49+ instances of `.catch(() => ({}))` masking JSON parse failures
- **Risk:** Bugs silently fail; users see stale/missing data with no feedback

### 3. Untyped API Responses
- 79+ instances of `Record<string, unknown>` for API response handling
- 6 explicit `any` usages (dashboard page state typed as `any[]`)
- 6 `as never` type assertions in service layer
- **Risk:** Runtime type errors, no compile-time safety on API contracts

---

## High (Should Address Soon)

### 4. God Components
| File | Lines | Issue |
|------|-------|-------|
| `EquipmentPicker.tsx` | 1,403 | Mixes filtering, availability checks, selection state, UI |
| `bookings.ts` (service) | 1,373 | Full booking lifecycle in one file |
| `CreateBookingSheet.tsx` | 988 | Form logic + state management + UI |
| `BookingDetailsSheet.tsx` | 861 | View/edit booking in single component |
| `ItemInfoTab.tsx` | 860 | Monolithic item display |

### 5. N+1 Query Patterns
- `checkouts/route.ts`: Sequential `findFirst` + `findUnique` in a loop for bulk stock
- 109 `findUnique()` calls across API routes — many could be batched
- **Risk:** Slow API responses under load, especially for bulk operations

### 6. Scattered Auth Redirects
- 8 separate `window.location.href = "/login"` handlers across components
- Should be centralized in a fetch wrapper or middleware
- **Risk:** Inconsistent redirect behavior, duplicated logic

### 7. Missing Database Middleware
- No `/src/middleware.ts` — all auth checks happen inside route handlers via `withAuth()`
- Auth is consistent but adds latency (full handler invocation before rejection)
- **Risk:** Unauthorized requests reach handler code before being rejected

### 8. Missing Cascade Deletes
- `BookingSerializedItem.asset` and 5+ relationships lack `onDelete: Cascade`
- `AllowedEmail.claimedById` nullable without `onDelete` specified
- **Risk:** Orphaned records accumulate over time

### 9. Missing Database Indexes
- `BulkStockBalance.bulkSkuId` — no index despite unique constraint
- `Notification.sentAt` — no index for filtering unsent notifications
- `OverrideEvent.createdAt` — no index for time-series queries
- **Risk:** Slow queries as data grows

---

## Medium (Address When Touching Area)

### 10. Dependency Staleness
| Package | Current | Latest | Gap |
|---------|---------|--------|-----|
| Prisma | 6.19.3 | 7.7.0 | Major version behind |
| lucide-react | 0.577.0 | 1.7.0 | Major version behind |
| Next.js | 15.5.14 | 16.2.2 | Major version available |
| React | 19.0.0 | 19.2.4 | Minor update available |

### 11. ESLint-Disable Suppressions (8)
- 6x `react-hooks/exhaustive-deps` — likely missing dependency arrays
- 1x `@next/next/no-img-element` — should use `next/image`
- 1x `no-var` — global DB singleton pattern
- **Risk:** Suppressed warnings may hide real bugs (especially stale closures)

### 12. Repeated Patterns Needing Extraction
- 49+ instances of `res.json().catch(() => ({}))` + toast error pattern
- 23 instances of manual `setLoading(true/false)` state management
- 8 instances of 401 redirect logic
- Multiple localStorage try-catch blocks
- **Risk:** Inconsistent error UX, maintenance overhead

### 13. CSP Security Gap
- `next.config.ts` CSP header allows `unsafe-inline` for scripts and styles
- **Risk:** XSS attack surface (mitigated by other headers but still a gap)

### 14. Inconsistent Schema Typing
- `ScanEvent.phase` is `String` but `ScanPhase` enum exists in schema
- `ScanEvent.quantity` is `Int?` with no negative-value guard at DB level
- **Risk:** Invalid data can enter the database

---

## Low (Track for Future)

### 15. Console Statements
- 12 `console.error` calls in production code (mostly appropriate for error logging)
- 2 `console.log` calls (email dev mode, localStorage fallback)
- Consider structured logging via Sentry instead

### 16. In-Memory Rate Limiting (GAP-32)
- Resets on cold start, per-instance only
- Adequate for 4-user team; needs Redis/Upstash KV at scale

### 17. No Cross-Page Data Cache (GAP-11)
- Every navigation triggers full re-fetch
- React Query deferred to Phase C
- `useFetch` + Visibility API is the current mitigation

### 18. Audit Log Unbounded Growth
- No retention policy or archival strategy beyond weekly cron
- Monitor and implement archival before 10x current volume

### 19. Math.random() for Device Codes
- `kiosk-devices/route.ts` uses `Math.random()` for device code generation
- Should use `crypto.getRandomValues()` for security-sensitive IDs

---

## What's Working Well

- **Auth/RBAC**: Centralized `withAuth()` + `requirePermission()` across all 132 routes
- **Data integrity**: SERIALIZABLE transactions on all mutations, exclusion constraints
- **Derived status**: Asset availability always computed, never stored (D-001)
- **Audit trail**: Every mutation emits audit entries with actor, diff, timestamp
- **Input validation**: Zod schemas + `sanitizeText()` XSS prevention
- **Error boundaries**: 3-tier error boundary hierarchy with Sentry integration
- **Security hardening**: TOCTOU fixes, CSRF protection, privilege escalation guards
- **Documentation**: 13 AREA files, 14 BRIEF files, decisions log, lessons learned
- **Pattern extraction**: `useFetch`, `useFormSubmit`, `useUrlState` hooks standardized

---

## Recommended Priority Order

1. **Silent catch blocks** — Quick wins, high safety impact
2. **Extract repeated fetch/error patterns** — Centralizes error UX
3. **Add missing indexes** — Simple schema change, measurable perf gain
4. **Add cascade deletes** — Prevents orphaned data
5. **Component extraction** — Break up EquipmentPicker and CreateBookingSheet
6. **API response types** — Replace `Record<string, unknown>` with typed interfaces
7. **Test coverage** — Start with service layer gaps, then critical API routes
8. **Dependency updates** — lucide-react first (low risk), then Prisma (needs migration)

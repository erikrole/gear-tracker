# Lessons Learned

> Consolidated 2026-04-03. Organized by category, not chronology.
> Only actionable patterns retained — session-specific context removed.

## Security & Authorization

- **SERIALIZABLE on all mutation transactions**: Booking, scan, shift, and trade services all need `isolationLevel: Serializable`. Audit the definition of "all" — blind spots hide in less-obvious services.
- **TOCTOU on unique constraints**: Never rely on `findUnique` before `create` for uniqueness. Catch Prisma `P2002` and return 409. The DB constraint is the source of truth.
- **Bulk endpoints must mirror single-endpoint auth guards**: When writing a bulk alternative, grep the single path for all authorization checks and replicate each one.
- **Multi-write flows need transactions**: User creation + invitation claim, booking + allocation — if writes are logically atomic, wrap in `$transaction`.
- **Deactivation is a multi-step mutation**: Check for blockers (open checkouts), cancel dependents (bookings), invalidate sessions, then flip the flag — all in one SERIALIZABLE transaction to prevent TOCTOU.
- **Password change + session invalidation must be atomic**: If the password update succeeds but session deletion fails, old sessions remain valid. Use batch `$transaction([update, deleteMany])`.
- **Read-then-delete is a race condition**: Use `deleteMany({ where: { id, condition } })` and check `deleted.count` — the DB enforces the condition atomically.
- **Privilege escalation has two vectors per role op**: Guard BOTH granting AND revoking. Check `target.role` vs `actor.role` on all mutation endpoints.
- **STAFF cannot edit ADMIN users**: Role guards must apply to profile field edits, not just role changes.
- **401 handling on EVERY mutation**: Session can expire between page load and user action. Check `res.status === 401` on all POST/PATCH/DELETE, redirect to `/login`.
- **CSRF: Block missing Origin headers by default**: Exempt internal/cron routes via Bearer auth detection.
- **Quantity guard + increment must be atomic**: Re-read inside the transaction, check, then write — all in SERIALIZABLE.
- **Seed/bootstrap endpoints are account takeover vectors**: Gate behind auth or disable in production.
- **Two-phase flows (request then approve) must re-validate at approval time**: Between a student requesting a shift and staff approving, the student may have been assigned elsewhere. Always re-run time-conflict and active-assignment checks in the approve step.
- **ZodError should be handled globally in `fail()`**: Before the fix, Zod `.parse()` errors surfaced as 500. Centralized ZodError handling returns 400 with field-level details for all routes.
- **Guard terminal status transitions**: `removeAssignment` set any assignment to DECLINED, even already-DECLINED or SWAPPED ones. Terminal statuses should be immutable — whitelist removable statuses.

## Data Integrity

- **Asset status is derived, not stored** (D-001): Always compute from allocations. Never write to a status field.
- **Concurrent mutations need SERIALIZABLE**: Two users editing the same entity — lost updates happen without proper isolation.
- **`Promise.allSettled` for read-only parallel queries**: Prevents total failure from one slow query in dashboard-style endpoints.
- **Scan dedup within 5-second window**: Prevents camera debounce from creating duplicate scan events.
- **Direct assignment must clean up orphaned requests**: When staff directly fills a shift slot, pending REQUESTED assignments become orphaned. Decline them atomically in the same transaction.
- **Read-then-write without transaction is TOCTOU even for "simple" updates**: ShiftGroup PATCH did `findUnique` then `update` separately. Two concurrent toggles produce stale audit `before` snapshots. Wrap in SERIALIZABLE.

## API Patterns

- **`withAuth` for authenticated routes, `withHandler` for public**: Both wrap try/catch and resolve dynamic params.
- **`requirePermission(role, resource, action)`** for RBAC on every mutation endpoint.
- **`createAuditEntry`** on every mutation (D-007). Include `before` + `after` snapshots for field-level diffs.
- **Rate limiting on auth endpoints**: Register (5/15min), Login (10/15min) per IP.
- **Catch `P2002` for unique constraint violations**: Return friendly 409 instead of 500.
- **Fetch N+1 to detect hasMore**: For cursor pagination, fetch `limit + 1` rows. Slice before returning. Avoids separate COUNT.
- **`createMany` for bulk audit entries**: Avoids N individual INSERTs in loops.

## UI Reliability

- **Distinguish initial load from refresh**: Initial = skeletons. Refresh = keep visible data, show subtle spinner. Use `hasLoadedRef` (not state) to track.
- **Refresh failure must NOT replace visible data**: Only set `loadError` on initial load. On refresh failure, toast and keep existing data.
- **AbortController on all filter-driven fetches**: Rapid changes fire concurrent requests. Abort previous before starting new.
- **Guard all mutation buttons, not just the active one**: `disabled={acting !== null}` blocks ALL buttons during any mutation.
- **Handler self-guard against double invocation**: Even with `disabled={saving}`, check `if (saving) return` at handler top. React state updates are async.
- **Radix Dialog retains DOM between close/open**: Reset form state in `useEffect(() => { if (open) reset(); }, [open])`.
- **Every inline `fetch()` needs its own error path**: Each fetch in a chain can fail independently.
- **`useCallback` deps on hook returns = infinite loop risk**: Use refs for unstable values (`toastRef.current = toast`).

## UX Patterns

- **Toast messages should confirm WHAT happened**: "Extended to Mar 28" > "Booking extended". Include identifiers.
- **Success toasts are as important as error toasts**: Silent success erodes confidence.
- **Error differentiation**: Network errors get `WifiOff` icon + "offline" copy. Server errors get generic icon + "temporary" language.
- **Destructive actions need confirmation + feedback**: `useConfirm` + `useToast` pattern.
- **Optimistic UI for mutations**: Patch local state immediately, then reload for truth. Capture `prevState` for rollback on failure.
- **Auto-clear transient feedback**: Success 5s, errors 8s. Stale messages confuse users.
- **Filtered count indicator**: Show "N of M" when filters reduce the result set.
- **Skeleton fidelity**: Vary widths per row. Match real layout — avatar circles, text lines, badge pills.

## Design System (shadcn/ui)

- **`text-muted-foreground` for secondary text** — NOT `text-secondary` (which maps to a background color token).
- **Badge variants for all colored labels**: Never hardcode `bg-green-50 text-green-700`. Use Badge variants for dark mode safety.
- **`text-base md:text-sm` on inputs**: Prevents iOS auto-zoom on focus (requires 16px+ on mobile).
- **Hover-reveal needs `sm:` prefix**: `sm:opacity-0 sm:group-hover/row:opacity-100` — always visible on touch.
- **`-webkit-tap-highlight-color: transparent`** on all interactive elements. Global rule.
- **`overscroll-behavior-y: none`** on body for native app feel on iOS.
- **Progress component replaces custom progress bars**: Use `[&>[data-slot=progress-indicator]]:bg-color` for custom colors.

## Input Validation

- **`.trim()` before `.min(1)` on name fields**: Prevents whitespace-only strings.
- **`res.json()` on error responses can throw**: Wrap in try-catch — proxies may return HTML on 502.
- **Disable ALL form inputs during submission**: Not just the submit button.
- **Scan-to-add must enforce the same rules as click-to-select**: Every input path must validate identically.

## Detail Page Architecture

> Gold standard: `src/app/(app)/items/[id]/`

- **Structure**: PageBreadcrumb (auto) → Header (InlineTitle + badges) → Properties strip → Tabs (sticky, URL-synced, keyboard shortcuts) → Tab content
- **`SaveableField` + `useSaveField`** for all inline-editable fields
- **Tab content spacing**: `mt-14` (not mt-6)
- **Card styling**: `border-border/40 shadow-none` + `divide-y divide-border/30`
- **Input styling**: `border-transparent bg-transparent shadow-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs`
- **No double breadcrumbs**: AppShell handles it. Pages should NOT render their own.
- **URL-synced tabs**: `useSearchParams` to hydrate, `replaceState` to sync. Don't use `router.push`.

## Testing

- **Test the service layer, not utilities**: Prioritize DB-dependent code where bugs corrupt data.
- **`vi.mock("@/lib/db")` + `_mockTx` is canonical**: Mock `$transaction`, track calls, expose `_mockTx`.
- **Track transaction calls to verify isolation levels**: Assert `isolationLevel: "Serializable"` where required.
- **Bug-proof tests**: Name `BUG: <description>`, assert broken behavior. When fixed, the test guides the fix.
- **Data factories should be minimal and override-friendly**: `makeBooking({ status: "COMPLETED" })`.

## Process

- **NORTH_STAR.md first**: Read before every session to prevent context drift.
- **Doc sync on every commit**: AREA_*.md changelog + GAPS_AND_RISKS.md in the same commit as the feature.
- **Archive plan files aggressively**: `mv tasks/plan.md tasks/archive/` immediately after ship.
- **Always verify response shape from the API route**: Read `return ok(...)` before writing client reads. Don't guess.
- **Dead CSS/code accumulates during rewrites**: Grep for every class/export after migration. Remove what's unused.
- **Multi-pass audit process**: Visual → flow-trace → component audit → user feedback. Each pass finds different bugs.
- **Tailwind `hidden` always wins over CSS media queries**: Use responsive Tailwind classes (`hidden max-md:block`) instead of mixing Tailwind utility + custom CSS for show/hide logic.
- **Every user-triggered fetch needs 401 handling**: Any new fetch handler must include: 401 redirect, error toast, and double-click guard. Easy to miss on handlers added after the initial hardening pass.
- **Mobile loading skeletons are easy to forget**: Always check that loading states render on both desktop and mobile — add a separate mobile skeleton if the layout differs significantly.

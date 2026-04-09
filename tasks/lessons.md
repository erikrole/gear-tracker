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
- **Unique-value generation: catch P2002, don't pre-check**: QR codes, duplicate asset tags, and any generated identifier should attempt the write directly and retry on P2002 collision. Pre-checking with `findUnique` creates a TOCTOU window where concurrent requests both pass the check.
- **Read-then-delete is a race condition**: Use `deleteMany({ where: { id, condition } })` and check `deleted.count` — the DB enforces the condition atomically.
- **Privilege escalation has two vectors per role op**: Guard BOTH granting AND revoking. Check `target.role` vs `actor.role` on all mutation endpoints.
- **STAFF cannot edit ADMIN users**: Role guards must apply to profile field edits, not just role changes.
- **401 handling on EVERY mutation**: Session can expire between page load and user action. Use `handleAuthRedirect(res)` from `@/lib/errors` — never inline `window.location.href = "/login"`. Centralized in 2026-04-07 cleanup (71 inline redirects replaced).
- **Error parsing from API responses**: Use `parseErrorMessage(res, fallback)` from `@/lib/errors` instead of `.json().catch(() => ({}))` + `as Record<string, string>`. The helper handles non-JSON bodies and provides type safety.
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

## Session 2026-04-04

### Patterns (Event Detail Hardening)
- **Refresh must never clobber visible data**: When a page already has data loaded, refresh failures should toast an error and keep the existing data visible. Use an `isRefresh` parameter on fetch functions to skip `setFetchError` when data is already showing.
- **Global `acting` guard over per-item guards**: `disabled={acting !== null}` disables ALL mutation buttons during any mutation, not just the one being acted on. This prevents concurrent mutations from different buttons (e.g., nudging two people simultaneously).
- **`finally` blocks are mandatory on all mutations**: Even when `setNudgingId(null)` appears after the try/catch, move it to `finally` to guarantee cleanup on unexpected throws or early returns (e.g., after 401 redirect).
- **Skeleton must match actual page layout**: When the page has N cards/sections, the skeleton must have N matching skeleton sections. Audit by comparing rendered page sections against skeleton sections 1:1.
- **useCallback deps must include all referenced functions**: `setBreadcrumbLabel` was missing from `loadEvent`'s useCallback deps, which could cause stale closures. Always include setter functions even when they appear stable.

## Session 2026-04-09

### Patterns (Booking Flow Overhaul + Stress Test)
- **`router.push` URL construction must use `URLSearchParams`**: String concatenation with `&` assumes a `?` already exists in the path. For checkout redirect, `"/bookings" + "&highlight=id"` produces an invalid URL. Always use `new URLSearchParams()` and `.toString()`.
- **Scan hooks need local optimistic state for rapid workflows**: After a successful scan-to-return, the server hasn't refreshed `booking` yet. A second scan of the same item hits the stale `serializedItems` array and sends a duplicate request. Fix: maintain a `checkedInLocallyRef` (Set of assetIds) that `findItemByQr` skips. Clear when booking updates.
- **`finally` blocks on all submission handlers**: If `router.push()` fails after a successful submit (e.g., target page throws), `submittingRef.current` stays `true` forever. Always reset in `finally`, not just the error path.
- **Validate dates on the client before advancing multi-step forms**: Server-side date validation returns a generic error on Step 3 after the user completed the full wizard. Validate `endsAt > startsAt` in Step 1's `validateStep1()` for immediate feedback.
- **`useMemo` deps must reference the derived value, not the source**: `filteredAuditLogs` depended on `[booking, historyFilter]` but read from `allAuditLogs` (derived from `booking + extraAuditLogs`). When `extraAuditLogs` changed, the memo didn't recompute. Dep array should be `[allAuditLogs, historyFilter]`.
- **`await` async operations before navigation**: `saveDraft(); router.back()` fires navigation before the POST completes. On slow networks, the draft may not persist. Always `await saveDraft()` first.
- **React Query error state must be surfaced when data is required for form inputs**: If `form-options` fails, dropdowns are empty with no explanation. Check `isError` and show a retry banner — don't silently degrade to empty arrays.
- **Module-level imports (like `toast` from sonner) are stable — don't add to useCallback deps**: Adding stable imports to dependency arrays is harmless but masks real dependency issues. Use `[]` for callbacks that only reference module-level functions.

### Patterns (Wizard + Picker Stress Test — Round 2)
- **Every wizard step gate must validate minimum data**: Step 2 allowed 0 equipment items through because `validateStep2()` only checked unsatisfied requirements (which are empty when nothing is selected). Always add a "minimum selection" check.
- **`handleAuthRedirect` on every client-side mutation, not just fetches**: The wizard submit had no 401 handling. Session can expire between page load and form submit — always call `handleAuthRedirect(res)` before `res.json()`.
- **`res.json()` can throw on non-JSON responses**: Proxies, CDN errors, and 502s often return HTML. Wrap `res.json()` in try/catch with a user-facing fallback message. Never assume the body is JSON.
- **URL-param-driven initial state must be consumed once**: `initialSheetTab` was read from URL params and stored in `useState`, but never cleared. Closing and reopening a different booking re-applied the stale tab. Clear one-shot URL params after first use (e.g., on sheet close).
- **`initialTab` (or any prop used in useEffect) must be in the dep array**: `BookingDetailsSheet` used `initialTab` inside a `useEffect` but didn't include it in deps. If the prop changes without `bookingId` changing, the tab doesn't update. Always include all values read inside useEffect in its deps.

# Lessons Learned

> Durable, reusable project rules only. Consolidated 2026-07-11.
> Dated session evidence and superseded context lives in [lessons-history-2026.md](archive/lessons-history-2026.md).

## How to use this file

- Read the section that matches the current task. Do not load every lesson by default.
- Treat these as active rules. If current product direction or an accepted decision conflicts with one, reconcile the rule before relying on it.
- Promote a lesson only when it is reusable, non-obvious, and supported by a verified failure or accepted decision.
- Each new entry should state the rule, its scope when not obvious, and the evidence or decision that supports it.
- Retire rules by moving them to the dated archive and recording the replacement in `docs/DECISIONS.md` or the relevant area doc.

## Start here

- **Current source beats stale history**: Verify the current route, view, schema, tests, and product direction before following an older plan or session note.
- **Response shape is a contract**: Read the API route's actual `ok(...)` payload before writing a client consumer. Check nullable fields, envelopes, and rollout tolerance.
- **Mutations need concurrency protection**: Use transactions and `SERIALIZABLE` isolation where concurrent writes can lose data, violate availability, or corrupt audit history.
- **Database constraints are authoritative**: Attempt unique writes directly, catch `P2002`, and return a conflict. Pre-checks do not close a race window.
- **Every mutation needs the full safety path**: Authentication, permission, CSRF where relevant, validation, audit, transaction, feedback, and 401 handling all belong in the slice.
- **Preserve visible data on refresh failure**: Keep loaded data visible and show recovery feedback. Initial loading and refresh are different states.
- **Native iOS controls are the default**: Prefer SwiftUI and system controls before custom chrome, especially for keyboard, scanner, picker, tab, and sheet interactions.
- **Compile the platform you changed**: Web checks do not compile Swift, and TypeScript checks do not prove browser behavior. Use the gate that can catch the failure.
- **Do not delete by filename assumption**: Inspect every type, export, and consumer a file defines before removing it.
- **Keep task scope current**: Retire rejected or deferred product surfaces from active recommendations instead of preserving them as visible "maybe later" scope.
- **Copy must name the operational object**: Status, holder, gear identity, event context, and recovery actions should be concrete and useful at a glance.
- **Stop when the area is healthy**: Recommend the next bounded slice or explicitly stop. Do not invent churn to keep the work moving.

## Shipping and deployment history

- **Push titles are release artifacts**: Use a specific conventional commit title that names the user-facing outcome and the operational surface changed. Avoid generic labels such as `Improve Gear Tracker workflows`, `Refine product surfaces`, or `Harden workflows` when the title could instead identify the protected behavior. For a broad integrity slice, prefer a bounded title such as `fix: keep reservations and kiosk custody atomic under concurrent use`; split independently meaningful changes into separate commits when that improves reviewability. This rule is based on the 2026-07-17 deployment history review, where generic titles made production activity difficult to scan and distinguish.

## Security and authorization

- **Private profile fields are response contracts**: Omit restricted values from unauthorized API responses and block unauthorized mutations. CSS or conditional rendering is not a privacy boundary.
- **Role scope is not product scope**: Preserve legitimate read and self-service workflows while tightening mutation permissions.
- **Guard both sides of role operations**: Check the actor and target when granting, revoking, or editing privileged users. STAFF must not edit ADMIN users.
- **Bulk endpoints mirror single-endpoint authorization**: Compare the bulk path with the single-item path and carry over every relevant guard.
- **Two-phase flows re-validate at approval time**: Recheck assignment, time-conflict, availability, and active-state conditions when a request is approved, not only when it is created.
- **Deactivation is one transaction**: Check blockers, cancel dependents, invalidate sessions, and deactivate the account atomically.
- **401 handling belongs on every mutation**: Use the shared auth redirect/session-expiry path. Never inline a one-off login redirect.
- **CSRF rejects missing origins by default**: Exempt only intentionally authenticated internal or cron paths.
- **Seed and bootstrap routes are takeover surfaces**: Gate them behind authentication or disable them in production.
- **Terminal states are immutable**: Whitelist allowed transitions instead of applying a broad status update to every row.

## Data integrity and concurrency

- **Derived status stays derived**: Asset availability and status come from allocations and active custody records, not a second writable status field.
- **Availability includes operational turnaround**: Apply return, inspection, transfer, and pickup buffers consistently in the picker, scan flow, and server check.
- **Numbered bulk units are derived identities**: Resolve `{binQrCodeValue}-{unitNumber}` through the parent SKU and unit row. Do not invent per-unit QR fields without an operational model change.
- **Custody is allocation truth**: For numbered batteries, active `BookingBulkUnitAllocation` rows determine holder, booking, due date, and checked-out state. A stale raw unit flag is not custody proof.
- **Quantity intent is not physical custody**: Booking quantity rows express intent; kiosk scans bind exact physical units.
- **All-day values are dates**: Normalize and group by encoded display dates in the app timezone. Never group by a raw UTC instant or use server-local `setHours(0, 0, 0, 0)` for institutional day boundaries.
- **Read-then-write is a race**: Re-read inside a transaction or use an atomic conditional write. Use `deleteMany` plus `count` when deletion must enforce a condition.
- **Read-only parallel queries can degrade independently**: Prefer `Promise.allSettled` for dashboard summaries where one optional query should not blank the whole response.
- **Scanner input is a transport boundary**: Trim, normalize legacy prefixes/wrappers/control bytes, tolerate suffix differences, and deduplicate rapid repeats.

## API and client contracts

- **Use the shared route wrappers**: `withAuth` for authenticated routes and `withHandler` for public routes.
- **Audit mutations once**: The service that owns the transaction should own the lifecycle audit entry. Do not duplicate the same event in the route.
- **Error bodies are untrusted**: `res.json()` may throw on a proxy or 502 response. Use the shared error parser and a user-facing fallback.
- **Pagination uses `limit + 1`**: Fetch one extra row to determine `hasMore`, then slice before returning.
- **Bulk audit writes use `createMany`**: Avoid one insert per item in a loop.
- **Inventory-driven integrations stay inventory-driven**: Do not preserve unused vendor branches or provider setup without an operational target.
- **iOS Codable fields follow the source schema**: Nullable Prisma fields are optional in Swift. Required fields must exist and be non-null at the route boundary.
- **Full-replace saves must preserve sibling fields**: A partial native model must not silently reset fields it does not carry.
- **Secondary clients count**: Contract audits enumerate every type that owns a URL session, not only the primary API client.

## UI reliability

- **Initial load and refresh are different**: Use skeletons for initial load. Keep existing data visible during refresh and show a subtle error or retry state.
- **Every user-triggered fetch needs recovery**: Include 401 handling, error feedback, cancellation where filters can change, and a double-submit guard.
- **Guard all mutations on the surface**: Use a ref for the synchronous handler guard and shared state to disable every competing mutation control.
- **Use `finally` for cleanup**: Reset state and ref guards from unexpected throws, early returns, and navigation failures.
- **Filtered data reaches every view**: List, week, calendar, and alternate modes must consume the same filtered source.
- **Loading geometry should match content geometry**: Skeleton rows and empty states should preserve the layout users are about to see.
- **Status labels have one canonical producer**: Align web, iOS, docs, and tests to the color/status system instead of maintaining competing names.
- **Feedback names what happened**: Success and error messages should identify the booking, item, holder, or action, not only say "saved" or "failed".
- **Destructive actions confirm and recover**: Use confirmation, visible feedback, optimistic rollback where appropriate, and a real reload for server truth.
- **Do not let dense rows become command centers**: Keep each row focused on the decision the user needs to make there.

## UX and product language

- **Use the current product term**: Prefer confirmed user-facing language such as attachments, Staff, Student, Media Drive, and Server Paths over legacy model or enum names.
- **Separate context from handoff**: Event venue and gear pickup location answer different questions and should be labeled separately.
- **Operational lists default to current work**: Exclude completed and cancelled records from the default working view unless the UI explicitly says history or past.
- **Do not promote scan posture into desktop navigation without proof**: Web scan is lookup/search unless a desktop scanning workflow is explicitly accepted. Kiosk checkout and return remain kiosk workflows.
- **Use the user's exact correction**: If the user changes a term or scope, update every visible producer, plan, test, and doc that repeats it.
- **Reduce copy before adding chrome**: Keep labels, selected values, real warnings, and recovery actions. Remove helper text that merely restates a control.
- **A visible badge should not repeat adjacent status text**: Use the badge for state and surrounding text for identity or action context.
- **External calendar titles optimize for the worker's glance**: Include compact role, event context, call time, and a deep link. Keep long preparation detail in the app.

## Design system and native patterns

- **Use shadcn primitives on the web**: Reuse existing components and tokens. Do not create a custom button, input, dialog, table, badge, or progress primitive when an equivalent exists.
- **Use semantic tokens**: Prefer `text-muted-foreground`, Tailwind token utilities, Badge variants, and shared CSS variables over hardcoded light/dark pairs.
- **People and gear use different primitives**: Use avatar components for people and thumbnail stacks for items or media.
- **Clear controls are siblings of triggers**: Never nest a clear button inside a Radix/shadcn trigger button.
- **Migrate consumers before removing CSS**: Grep every class and export consumer before deleting its definition.
- **Native iOS action hierarchy comes first**: Use SwiftUI button styles, toolbar slots, system tabs, sheets, lists, and pickers before custom capsules or bottom bars.
- **HID scanner capture is phase-owned**: Mount and rearm hidden scanner fields only during an explicit scan phase. Visible text input must retain keyboard ownership.
- **Kiosk Liquid Glass belongs to commands**: Keep custody rows, inputs, warnings, and timing surfaces opaque and easy to parse.
- **Screenshot feedback is element-specific**: Identify the exact text, icon, fill, border, badge, or container before changing a shared token.

## Testing and verification

- **Test service behavior before utilities**: Prioritize database-dependent paths where a regression can corrupt state.
- **Assert transaction behavior**: Mock the transaction boundary and verify isolation levels, atomic writes, and audit calls.
- **Use bug-proof test names**: Name regression tests `BUG: <description>` so the failure they prevent remains clear.
- **Keep factories minimal and override-friendly**: A test should declare only the state relevant to its assertion.
- **Source-contract tests are real contracts**: When tests inspect Swift or source text, update them with refactors and run them alongside the platform build.
- **Visual proof is separate from compile proof**: A green build does not prove layout, browser auth, scanner hardware, or device behavior. Report those limits explicitly.

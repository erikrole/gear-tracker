# Lessons Learned

> Consolidated 2026-04-03. Organized by category, not chronology.
> Only actionable patterns retained — session-specific context removed.

## Security & Authorization

- **Role scope is not the same as product scope**: When closing an authorization leak, preserve legitimate role-specific use cases. For travel rosters, students are allowed to see staffing/travel context for all events; the protection boundary is mutation rights, not read visibility.
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
- **Numbered bulk unit QR codes are derived identities**: A QR value like `{binQrCodeValue}-{unitNumber}` should resolve through the parent `BulkSku` and existing `BulkSkuUnit` row. Do not add per-unit QR fields or convert batteries to serialized assets unless the operational model changes.
- **Battery bookings are quantity intent until kiosk pickup**: Do not force camera-battery hard gates during booking creation. Creation records the requested battery quantity and warns on low compatible availability; kiosk scans bind the actual numbered units.
- **Concurrent mutations need SERIALIZABLE**: Two users editing the same entity — lost updates happen without proper isolation.
- **`Promise.allSettled` for read-only parallel queries**: Prevents total failure from one slow query in dashboard-style endpoints.
- **Scan dedup within 5-second window**: Prevents camera debounce from creating duplicate scan events.
- **Direct assignment must clean up orphaned requests**: When staff directly fills a shift slot, pending REQUESTED assignments become orphaned. Decline them atomically in the same transaction.
- **Read-then-write without transaction is TOCTOU even for "simple" updates**: ShiftGroup PATCH did `findUnique` then `update` separately. Two concurrent toggles produce stale audit `before` snapshots. Wrap in SERIALIZABLE.

## API Patterns

- **Inventory-driven integrations should not keep unused vendors**: If the user asks for firmware support based on actual inventory, seed from live item groups and omit vendor adapters with no operational target. Do not keep generic Canon-style branches unless there are Canon bodies or the user explicitly wants that vendor watched.
- **Do not keep legacy providers without a real operational path**: If the chosen integration is Brave, do not preserve Google/legacy setup just because it was in an earlier plan. Extra provider branches add env churn, tests, docs, and support cost unless the user explicitly wants fallback optionality.
- **`withAuth` for authenticated routes, `withHandler` for public**: Both wrap try/catch and resolve dynamic params.
- **`requirePermission(role, resource, action)`** for RBAC on every mutation endpoint.
- **`createAuditEntry`** on every mutation (D-007). Include `before` + `after` snapshots for field-level diffs.
- **Rate limiting on auth endpoints**: Register (5/15min), Login (10/15min) per IP.
- **Catch `P2002` for unique constraint violations**: Return friendly 409 instead of 500.
- **Fetch N+1 to detect hasMore**: For cursor pagination, fetch `limit + 1` rows. Slice before returning. Avoids separate COUNT.
- **`createMany` for bulk audit entries**: Avoids N individual INSERTs in loops.

## UI Reliability

- **Do not reintroduce a crashing native API just because it is newer**: In the iOS tab shell, value-based SwiftUI `Tab(...)` with `TabRole.search` and tab-bar minimization repeatedly triggered UIKit's `UITabBarController._viewControllerForTabBarItem` assertion when selecting Schedule. Once a newest-API path has a reproduced framework assertion, prefer the stable native path (`TabView` + `.tabItem`/`.tag`) and lock it with a focused source-contract test until device-level proof says otherwise.
- **Put non-trivial client search policy in testable helpers**: If a UI owns provider-query orchestration such as B&H-first plus broad fallback merging, extract the query builders and merge logic into a pure helper module and test it directly. Server tests alone will miss client-side quota/cost and ordering behavior.
- **Recognition systems may apply beyond the original persona**: Before adding badge definitions or badge UI, confirm whether the scope is students-only or all users. Do not keep student-only guards just because the first plan used student language.
- **Dev CSRF origin must use the actual request origin**: Do not hardcode `https://${host}` as the expected origin in shared API wrappers. Local dev pages run on `http://localhost:*`, so mutating requests can be blocked before auth/permission checks. Compare `Origin` to `new URL(req.url).origin` and keep bad-origin requests returning 403.
- **Distinguish initial load from refresh**: Initial = skeletons. Refresh = keep visible data, show subtle spinner. Use `hasLoadedRef` (not state) to track.
- **Refresh failure must NOT replace visible data**: Only set `loadError` on initial load. On refresh failure, toast and keep existing data.
- **AbortController on all filter-driven fetches**: Rapid changes fire concurrent requests. Abort previous before starting new.
- **Guard all mutation buttons, not just the active one**: `disabled={acting !== null}` blocks ALL buttons during any mutation.
- **Handler self-guard against double invocation**: Even with `disabled={saving}`, check `if (saving) return` at handler top. React state updates are async.
- **Radix Dialog retains DOM between close/open**: Reset form state in `useEffect(() => { if (open) reset(); }, [open])`.
- **Every inline `fetch()` needs its own error path**: Each fetch in a chain can fail independently.
- **`useCallback` deps on hook returns = infinite loop risk**: Use refs for unstable values (`toastRef.current = toast`).
- **Stale closure on boolean guards (e.g. `actionBusy`)**: `useCallback` captures the value at render time. Two rapid clicks both see `false`. Fix: use a `useRef` for the guard check and sync state separately for UI disabling.
- **Favorite toggle TOCTOU**: `findUnique` → `create` races on concurrent toggle. Catch P2002 as idempotent success. Use `deleteMany` instead of `delete` to handle concurrent unfavorite (returns count 0 instead of throwing).
- **Maintenance toggle lost update**: Read-then-toggle without transaction. Two concurrent toggles both read same status and write same result. Fix: wrap in SERIALIZABLE transaction.

## UX Patterns

- **When feedback asks to integrate a status into an identity cluster, match the existing row grammar first**: Do not turn a compact identity value like firmware into a standalone card just because it has supporting metadata. Keep the row light, put detailed metadata and source links in the click-through dialog, and verify the screenshot target before shipping the visual hierarchy.
- **Do not repeat badge state as adjacent text in dense rows**: If a colored badge already communicates "Updated", "Outdated", or similar state, do not render that same status as nearby body text unless it adds a distinct action or explanation. Put richer status context in the modal or detail view.
- **Remove collision-prone ambient shortcuts instead of over-guarding them**: If a global type-to-search shortcut keeps intruding on page search or data-entry fields, remove the printable-key shortcut and keep explicit triggers such as `Cmd/Ctrl+K` plus visible Search buttons.
- **Autocomplete suggestions should update while the user types**: If the request is to help name the next item or make a field feel smart, do not wait for blur or require the user to type the whole final pattern. Use a short debounce, prefix-match the existing data, and show the best actionable suggestion as soon as the text narrows enough.
- **Text reduction before visual polish**: When the user says a surface feels too heavy, inventory visible copy first. Keep labels, selected values, real warnings, and recovery actions. Remove helper text that repeats controls, decorative status panels without new decisions, and generalized guidance that can wait until an error or review step.
- **Event-linked creation should promote the event title**: In booking creation flows, do not keep a generic "New checkout" or "New reservation" hero once the booking has a meaningful title. Let the badge carry the booking kind and use the selected event or booking title as the page title.
- **Category tabs should stay categorical**: Avoid putting inventory totals or selected-count badges inside category tab labels when the surrounding view already has count/status surfaces. Counts in tabs make navigation read like a dashboard instead of a calm picker.
- **Bulk actions need a real operator habit**: Do not keep picker actions such as "Select visible available" just because they are technically convenient. If the real workflow is deliberate per-item selection, search, or scan, remove broad bulk actions that add clutter and risk accidental mass selection.
- **Picker loading should preserve row geometry**: For dense equipment or item lists, loading states should look like incoming rows, not a centered empty-state message inside a large blank panel.
- **Free-tab pickers do not need footer-driven browsing**: When category tabs are freely navigable, the wizard footer should not say "Browse next category." Keep the footer tied to the step outcome and let tabs own category navigation.
- **Selection review should get lighter after selection**: In picker flows, do not repeat full item rows again once the user has selected equipment. Use compact removable chips or a focused summary tray, and keep detailed warnings in row captions or the flow-level warning strip.
- **Creation flows may need quieter breadcrumbs than admin pages**: If a page is intentionally centered and task-focused, a framed breadcrumb chip can compete with the flow. Test a route-scoped text breadcrumb before changing the whole app chrome.
- **Do not force admin form rows into guided creation flows**: Shared two-column setting rows are efficient for admin pages, but event-linked creation flows read better with local stacked labels and grouped fields.
- **iOS field controls must be visible before they are clever**: If a mobile workflow has multiple state-changing controls in one toolbar, especially Schedule, do not rely on icon-only toggles. Put view mode and scope choices in labeled controls near the content, and reserve toolbar space for direct actions with readable labels.
- **Dense repeated rows need fixed column ownership**: When rows mix badges, inline actions, assignees, remove controls, role labels, times, and row actions, use explicit grid columns on desktop. Nested flex pushes labels around as names and controls appear or disappear.
- **Icon-plus text buttons should name the action, not the object**: For add-slot controls, use "Add" on the trigger and keep Staff slot / Student slot as the menu choices. A trigger labeled only "Slot" reads like metadata, not an action.
- **When feedback points at empty states, do not tune populated rows**: If the user references "cards" while showing empty section bodies, inspect the screenshot target before changing shared row components. Adjust the specific empty-state body height, icon treatment, and alignment instead.
- **Case requests need product-language confirmation through the visible UI**: If a user says "lowercase" while pointing at all-caps enum values in a screenshot, the likely intent may be "not enum shouting." Prefer sentence-case display labels like "Video" over raw lowercase unless they explicitly want all lowercase.
- **Award art must not fight the icon**: Badge medallions need a clean rim and material finish first. Avoid busy internal linework behind small glyphs; if the badge needs personality, put it in shape, color, rarity finish, motion, or a separate large-detail view.
- **Event-composed mobile rows need a core read model**: Do not make SwiftUI infer that gear and shifts are the same event from titles or a single `eventId`. Build an event-centric API payload from primary event, `BookingEvent`, and `shiftAssignmentId` links, suppress every linked child booking row, and use student-facing sublines such as "Pickup gear at 10:00 AM" and "Call time at 10:30 AM."
- **iOS models must survive API rollout skew**: When adding dashboard fields consumed by the native app, default newly added decoded arrays/metadata with custom `init(from:)` or optionals. The app points at production, so a local app build can decode the previous server payload until the API deploy catches up.
- **Personal Home rows should not repeat the user's name**: On iOS Home, the signed-in person is implied. Use the subtitle space for the action context, especially event-linked gear and shift timing, instead of rendering the requester's name back to them.
- **Use the user's operational names exactly**: If they correct "Media Guide" to "Media Drive," preserve that term as the product language. In Guides, Media Drive means the server that houses Creative files, while Server Paths are exact copyable workflow paths inside or around it.
- **All means active unless the UI explicitly says history/past**: On operational booking surfaces, the default "All" scope should exclude completed/cancelled records. Put past work behind an explicit toggle/filter so the main workflow stays current.
- **Gear Tracker web is not phone-first**: Treat phone-width web checks as low-priority smoke only when a touched web surface clearly risks broken wrapping or inaccessible controls. The iOS app owns mobile workflows, so web bug sweeps should prioritize desktop and tablet operator trust unless the user explicitly asks for mobile web.
- **Users Availability is student-only**: Do not show the Availability tab on staff/admin profiles. Availability blocks model student class/unavailability conflicts for shift assignment, not staff/admin profile metadata.
- **User direct report is admin-editable, including own profile**: Do not block direct-report editing just because an admin is viewing themself. Self-profile restrictions should follow API permission shape, not a blanket `!isSelf` UI rule.
- **Schedule and quick booking context should show occupying bookings, not every historical booking row**: Cancelled bookings belong in history/audit surfaces, but they should not render in item schedule calendars, agendas, or Past Bookings quick context because they no longer reserve or occupy the item.
- **Multi-day schedule blocks should look continuous**: When a booking occupies several dates, draw one week-spanning bar across date cells instead of separate per-day pills. The visual model should match the operational model.
- **Calendar detail sheets should preview, not become duplicate detail pages**: From item schedules, keep booking clicks in an in-place sheet for context preservation. Use the sheet for identity, timing, equipment, and recent history, and send deeper edits or long workflows to the full booking page.
- **Calendar detail views should not repeat long bookings as full labels on every day**: For item-level schedule context, render the booking label at the start/end or in a side list, and use subtle continuation markers for intermediate days. Repeating the same title in every date cell reads as a bug even when the date overlap math is technically correct.
- **Respect current visual context before broadening scope**: When feedback follows a screenshot of a specific page region, anchor the audit to that visible component first. "Items tab at the top" on item detail means the detail tab rail, not the top-level Items list.
- **Do not infer density from a row symptom**: If item thumbnails show placeholders in the normal table, verify whether `imageUrl` exists before blaming compact density. Compact mode can hide or shrink UI, but normal-mode placeholders usually mean data was nulled or image loading failed.
- **In-app scan is search-only; checkout/check-in scans happen at kiosks**: Do not frame app scan endpoint risks as staff/student checkout or return execution risk. Operational check-in/out belongs to kiosk flows; the app scan surface is for lookup/search unless the product scope explicitly changes.
- **Stale decisions lose to current product direction**: If a decision record says checkout/check-in condition photos are required but current direction says that was scrubbed in favor of kiosk enforcement, treat kiosk enforcement as the source of truth. Do not recommend restoring superseded photo gates without re-validating the current flow.
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
- **Collapsed sidebar active states need their own balance rules**: Expanded left rails and padding do not transfer cleanly to icon-only mode. In collapsed sidebars, center the icon affordance first, then use a symmetric active background or dot; do not carry over the expanded red rail.
- **Collapsed sidebar user cards need explicit centering**: `size="lg"` menu buttons collapse to icon-size squares, but child links can keep expanded flex behavior. Add collapsed `justify-center`, zero the gap, and center the avatar itself so it does not hug an edge.
- **Mobile one-tap nav requirements do not automatically belong in desktop sidebar**: Scan is a mobile primary action, but desktop has more context-specific scan entry points. Do not add desktop sidebar destinations just to satisfy mobile shell language.
- **Fully staffed schedule events need compact recognition**: Big assignment cards are useful for filling gaps, but fully covered events should read as rows with an avatar preview. Keep expanded staffing details dense and reserve larger treatments for actual exception handling.
- **Open schedule slots need readable role intent**: Staff/student need must be visible before assignment, but raw `ST`/`FT` labels are too opaque. Use plain role language such as "Student slot" and grouped needs such as "2 staff, 3 students" while keeping roles mixed in the same event rows.
- **Role language is not a second color system**: In dense schedule rows, use text to distinguish staff/student needs and reserve color for one primary signal. Stacking area colors, role colors, open-slot red, and icon tints creates visual conflict and overlap.
- **Do not repeat the same schedule need in one row**: If the event title cluster already states "Needs 4 students", the right-side avatar preview should only show assignment state, such as avatars or "No assignments".
- **Schedule list column ownership must stay strict**: The event title cluster owns event start/all-day context. The right-side desktop column owns only home call time, not event time, all-day fallback text, or staffing summaries.
- **Items row identity should stay physically scannable**: Do not add serial numbers or duplicate column-owned fields into the primary item row stack by default. Lead with tag and product identity; keep Department visible in its own column because it should be populated for every item.
- **Clear controls must be siblings of trigger buttons**: Never put an icon clear `<button>` inside a shadcn/Radix trigger button. Use a segmented wrapper with the trigger and clear button as siblings to avoid nested-button hydration errors.
- **PWA manifest icons need declared real sizes**: Do not point the web manifest at a small brand logo with `sizes: "any"`. Use purpose-built 192/512 app icons so Chrome does not reject the manifest icon.
- **Badge variants for all colored labels**: Never hardcode `bg-green-50 text-green-700`. Use Badge variants for dark mode safety.
- **People avatars and item thumbnails are separate primitives**: Use `UserAvatar`/`UserAvatarGroup` for people and a thumbnail stack for gear/media. Do not use `Avatar` as a generic circular image bucket unless the visual is truly a person identity.
- **`text-base md:text-sm` on inputs**: Prevents iOS auto-zoom on focus (requires 16px+ on mobile).
- **Hover-reveal needs `sm:` prefix**: `sm:opacity-0 sm:group-hover/row:opacity-100` — always visible on touch.
- **`-webkit-tap-highlight-color: transparent`** on all interactive elements. Global rule.
- **`overscroll-behavior-y: none`** on body for native app feel on iOS.
- **Progress component replaces custom progress bars**: Use `[&>[data-slot=progress-indicator]]:bg-color` for custom colors.
- **No inline `<style>` tags in components**: Use global CSS keyframes or Tailwind arbitrary animation values (`animate-[name_duration_easing_iteration]`). Inline `<style>` bypasses Tailwind's purge and creates duplicate keyframe definitions.
- **No `tableLayout: fixed` + `<colgroup>` for column sizing**: Let columns auto-size via CSS. Fixed layout causes clipping and misalignment at varying viewport widths — the root cause of "feels off" tables.
- **Toolbar above the table border, not inside it**: shadcn data table pattern renders filter bar as a sibling div above the `rounded-md border` container, not as a sticky child inside it.
- **Missing CSS classes render elements invisible**: If a function returns a CSS class name that doesn't exist in globals.css (e.g., `cal-booking-neutral`, `week-event-neutral`), the element gets no background/color and becomes invisible against the page. Always verify every class string maps to a real CSS rule — or use Tailwind where there's no disconnect.
- **Pass filtered data to all views, not just some**: When a page has multiple view modes (list, week, calendar), every view must receive the same filtered data. CalendarView received `entries` (unfiltered) while siblings got `filteredEntries` — filters silently had no effect in one view.
- **Migrate consumers before deleting CSS**: Always grep for all consumers of a CSS class first. Delete the CSS block only after every consumer is migrated. Reverse order leaves elements unstyled.
- **`[&+&]:border-t` for adjacent sibling separators**: Tailwind equivalent of `.A + .A { border-top }`. Applies only when the same element immediately follows itself — no wrapper div needed.
- **`group` + `group-hover:` for parent-triggered child reveal**: For `.parent:hover .child { opacity: 1 }`, add `group` to the parent and `group-hover:opacity-100 focus-visible:opacity-100` to the child. No global CSS needed.
- **`[&_th]:` / `[&_td]:` for table base styles without a wrapper class**: Apply shared cell styles at the `<table>` level using child-combinator modifiers. Per-cell `className` overrides still work alongside them.
- **`data-[state=on]:` for Radix active-state styling**: ToggleGroupItem and similar Radix primitives expose their state as data attributes — drive visual state inline without CSS class overrides in globals.css.
- **Unused badge variants accumulate over time**: Audit `badgeVariants` periodically. Variants that share the same visual output (e.g. `mixed = purple`, `yellow = orange`) should be collapsed. Dead variants add TS union complexity with no UI benefit.
- **`--accent` means primary here, not accent**: In this codebase `--accent` maps to the brand/primary color. Prefer `var(--primary)` or the Tailwind `primary` utility so intent is explicit.

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
- **Detail tab rails should match Items detail unless there is a product reason not to**: Use the same overflow-safe shadcn TabsList and Wisconsin-red active underline for peer detail pages.
- **Page-level tabs and view switches should match peer patterns**: Avoid one-off tab/button chrome on list pages. Use the established shadcn Tabs underline pattern for tab rails and ToggleGroup for view-mode switches unless the workflow has a clear reason to differ.

## Testing

- **Test the service layer, not utilities**: Prioritize DB-dependent code where bugs corrupt data.
- **`vi.mock("@/lib/db")` + `_mockTx` is canonical**: Mock `$transaction`, track calls, expose `_mockTx`.
- **Track transaction calls to verify isolation levels**: Assert `isolationLevel: "Serializable"` where required.
- **Bug-proof tests**: Name `BUG: <description>`, assert broken behavior. When fixed, the test guides the fix.
- **Data factories should be minimal and override-friendly**: `makeBooking({ status: "COMPLETED" })`.

## Process

- **NORTH_STAR.md first**: Read before every session to prevent context drift.
- **Always suggest the next slice or say to stop**: Close every implementation slice with a concrete next-slice recommendation. If the current area is in good shape, say we should stop and move to another area instead of inventing churn.
- **Questions should be multiple-choice dialogs**: When a decision needs user input, use the interactive multiple-choice request flow instead of freeform prose questions whenever the tool is available.
- **Keep the dev server running during active web work**: Do not automatically close the dev server after every slice. Leave it open for continued browser verification unless the user asks to stop it, the server is stale/broken, or the task is fully done and cleanup is clearly better.
- **Use Codex Browser when the user says in-app browser**: If the user names the Browser in the Codex app or says the in-app browser is open, use the Browser skill/runtime for verification. Do not substitute Chrome DevTools, Chrome, Computer Use, or a separate browser unless the Browser runtime is unavailable after following the skill workflow.
- **Keep collaborative UI audits in the user's visible browser**: When the user is watching the live dev server in Dia/Codex, do not open Chrome for Testing or another hidden browser context. If a fallback browser is needed, explain the issue and ask first.
- **Dense assignment rows need local, predictable actions**: Empty assignment slots should read as quiet clickable rows, not heavy dashed drop zones. Removal controls belong next to the assignee name where the user is already looking, not stranded at the far edge of the row.
- **Assignment views are current-work surfaces by default**: If a schedule assignment page starts feeling noisy, first check whether it is showing past work. Past events belong behind an explicit history/past mode, while the default assignment workflow should mirror the normal Schedule list and start at today.
- **Use local login for authenticated browser checks**: When verifying Gear Tracker UI locally, use the available local login credentials instead of stopping at the login wall. Authenticated browser verification is part of done for UI changes unless the credentials or session are actually unavailable.
- **Treat "maybe later" backlog as disposable product scope**: When the user says a proposed surface is not needed, scrub active recommendations and visible catalog hooks instead of keeping it alive as a deferred item. Deferred still creates product gravity.
- **User-prioritized risk beats the active backlog**: If the user says a category is not important, immediately pivot the plan and next-goal recommendation away from that category instead of continuing to optimize it by inertia.
- **Next devtools errors can be framework overlays, not app bugs**: If dev logs mention `next-devtools/userspace/app/segment-explorer-node.js#SegmentViewNode` missing from the React Client Manifest, treat it as the experimental segment explorer/manifest path first. Disable `experimental.devtoolSegmentExplorer` before chasing unrelated app components.
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
- **Role gating must be applied at every nav surface, not just one**: The settings layout filtered the side-tab list by `requiredRole`, but the breadcrumb's parent-Settings sibling-jump dropdown rendered every entry from `SETTINGS_SECTIONS` unfiltered — so a STUDENT on `/settings/notifications` saw (and could click into) admin-only routes from the dropdown. If a permission helper exists for a list, every consumer of that list must call it. Centralize the predicate (`meetsRoleRequirement(required, role)`) so the next consumer doesn't reinvent or skip the check.
- **Don't read `localStorage` in render**: `getRecentEntities()` was being called inline during render of `PageBreadcrumb`, so every re-render did a `localStorage.getItem + JSON.parse + filter`. Move to `useMemo` keyed on the inputs that should invalidate the cache (here: section + entity-label-changed), and bail early when the result will be unused. Same rule applies to any sync `localStorage`/`sessionStorage` read.

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
- **Non-OK fetch responses must not be silent**: `usePickerSearch` returned `sectionResults: []` on a 500 response, making the UI show "Nothing available" instead of an error. Always add an error state alongside loading state in search hooks — show "Failed to load" (destructive text) rather than a misleading empty state.
- **Inline hooks in a component should be extracted when independently testable**: `useConflictCheck` was 66 lines embedded in a 561-line component. Extracting it to its own file makes it testable, reduces the parent to ~450 lines, and makes the dependency graph visible.

## Session 2026-04-09 (Scan Page Hardening Pass)

### Patterns (Scan Page 5-Pass Audit)
- **`finally` applies to ref guards too, not just state**: `processingRef.current = false` and `loadingStatusRef.current = false` were manually scattered across 3–4 return sites in `handleLookupScan` and `loadScanStatus`. Both converted to `finally` blocks — same rule as `setSubmitting(false)`.
- **15s polling without Page Visibility wastes battery**: Scan page polled every 15s even when backgrounded. Add a `visibilitychange` listener that calls `loadScanStatus()` on tab return — data is fresh immediately without waiting for the next poll tick. Keep the poll for multi-device sync.
- **Camera error messages should be complete sentences, not prefixed**: `"Camera error: {message}"` doubled the word "error" when the message was already `"Camera permission denied. Go to settings…"`. Display the QrScanner message directly — it's already user-facing.
- **CSS var references beat hardcoded dark-mode pairs**: `text-amber-700 dark:text-amber-400` is fragile. Use `text-[var(--orange-text)]` which is defined once in globals.css with both light and dark variants — one class, correct everywhere.
- **Doc file names must match actual component names**: AREA_SCAN.md referenced `ItemPreviewSheet.tsx`; the file is `ItemPreviewDrawer.tsx`. Always grep before writing doc references — component names drift during refactors.

## Session 2026-04-09 (Scan Flow Stress Test)

### Patterns (Scan Flow Hardening)
- **Bulk bin QR matching must be case-insensitive**: Serialized asset matching lowercases both sides; bulk bin matching did `binQrCodeValue === scanValue` (exact). Scanner may return different casing — always normalize both sides to `.toLowerCase().trim()` before comparison.
- **scanValue must be trimmed at the schema layer**: Add `.trim()` to the Zod schema field (`z.string().trim().min(1)`) so whitespace from manual entry or BarcodeDetector never reaches the service. Belt-and-suspenders: also `.trim()` in the service itself.
- **Cross-booking unit theft via numbered bulk check-in**: For numbered bulk SKUs, `unit.status === CHECKED_OUT` is insufficient — any CHECKED_OUT unit passes, even one belonging to a different booking. Always verify `bookingBulkUnitAllocation` ownership (`bookingBulkItemId = bulkItem.id AND bulkSkuUnitId IN units AND checkedInAt IS NULL`) before allowing check-in. Without this, a student can mark another booking's unit as returned.
- **Use already-loaded scan status for check-in unit picker**: The CHECKIN unit picker previously fetched `GET /api/bulk-skus/{id}/units` and filtered by `CHECKED_OUT` — showing ALL checked-out units across ALL bookings. For check-in, use `scanStatus.bulkItems[i].allocatedUnits` (already loaded, scoped to this booking) instead. For checkout, the SKU endpoint fetch is still correct (any AVAILABLE unit is fungible at checkout time).
- **Symmetric status guards on both complete functions**: `completeCheckoutScan` had `if (booking.status !== OPEN) throw`. `completeCheckinScan` did not. Both completion functions must guard the booking status — the absence was caught eventually by `markCheckoutCompleted`, but only after scan sessions were already closed, creating a partial-state gap.

## Session 2026-04-09 (Dashboard)

### Patterns (Dashboard Hardening + Stress Test)
- **useRef guard on ALL async mutation handlers**: `useState` guards (`if (inlineActionId) return`) have a TOCTOU window — two rapid clicks both read the pre-setState value. Always add `if (actionBusyRef.current) return; actionBusyRef.current = true;` before any setState + fetch. Reset in `finally`. State variable still needed for UI disabling.
- **Unified `acting` boolean > per-item disabled checks**: `disabled={inlineActionId === c.id}` only blocks the specific button — other mutation buttons stay clickable. Replace with `disabled={acting}` where `acting = inlineActionId !== null || deletingDraftId !== null`. Blocks ALL buttons during ANY mutation.
- **Cross-mutation guard must span all mutation types on a page**: Dashboard had extend/convert guarded by `inlineActionId` and delete-draft guarded by `deletingDraftId` independently. User could fire both simultaneously. Fix: combine both into a single `acting` boolean.
- **CSS variables with Tailwind token equivalents should use Tailwind**: `var(--text-sm)` → `text-sm`, `var(--panel)` → `bg-card`, `var(--panel-hover)` → `hover:bg-muted/60`. Preserves dark mode, reduces CSS variable surface area, and aligns with shadcn design system. Exception: intentional brand colors (e.g., `var(--wi-red)` for Wisconsin identity red) should stay as CSS variables.

## Session 2026-05-01 (Migration Numbering Collision)

### Patterns (Prisma Migration Workflow)
- **Never hand-number migration directories**: `prisma/migrations/0049_audit_log_created_at_index/` was created in parallel with `0049_add_operational_indexes/`, both claiming prefix 0049. The conflict slept for weeks because the second migration was untracked. Always run `npx prisma migrate dev --create-only --name X` and let Prisma pick the next free number.
- **`CREATE INDEX CONCURRENTLY` cannot live in a Prisma migration**: Prisma wraps each migration.sql in `BEGIN/COMMIT` and CONCURRENTLY refuses to run inside a transaction. For zero-lock index creation, apply via psql out-of-band, then `npx prisma migrate resolve --applied <name>` to mark it. For small tables, just drop CONCURRENTLY — the brief lock is fine.
- **Untracked migration directories are silent landmines**: Both 0048_user_profile_fields and 0049_audit_log_created_at_index sat in `prisma/migrations/` as `??` in `git status` for weeks. Build deploys ignored them (they weren't committed) but prod schema drifted from `schema.prisma`. Add `npm run db:migrate:check` to pre-commit to fail on duplicate prefixes; rely on `prisma migrate status` before merging schema work.
- **Don't deny `Write/Edit(prisma/migrations/**)` in `.claude/settings.json`**: The deny was meant to force agents through `prisma migrate dev`, but it actually broke the canonical flow — agents staged SQL in `tasks/*.sql` and asked the user to move it manually, which is how the 0049 collision happened. Better: trust `prisma migrate dev`, add `npm run db:migrate:check` as a guard, and document the workflow in CLAUDE.md.
- **Production drift needs idempotent migrations plus resolve**: If a column may already exist from a manual or failed deploy patch, use `IF NOT EXISTS` in the SQL before pushing. If Prisma has recorded a failed migration in production, the SQL fix is not enough; run `prisma migrate resolve --rolled-back <migration>` before redeploying.
- **Internal scheduling enum names must not leak into UI plans**: `FT` and `ST` are implementation labels only. Shift staffing copy, chips, settings labels, notifications, and docs should say Staff and Student unless quoting schema internals.
- **Manual slot creation needs one explicit Staff/Student choice point**: Do not use adjacent identical plus buttons for Staff vs Student slots. Use one Add Slot control with a clear Staff slot / Student slot menu, and label sport template counts as minimum crew so the distinction is obvious before generation.
- **List view is the primary schedule assignment surface**: Do not assume the side sheet will be used for staffing. Staff/Student slot creation and assignment controls must be complete and discoverable directly inside the expanded list view.

## Session 2026-05-28 (iOS conflict badges / silent client breakage)

### Patterns (API client correctness)
- **A `try?`-wrapped client that depends on a required server field has no visible failure signal**: iOS `checkAvailability` sent `assetIds` (server wanted `serializedAssetIds`) and omitted the required `locationId` cuid, so `availabilitySchema.parse()` returned 400. Because the whole call was `guard let ... = try? ...`, the 400 was swallowed and the function returned an empty set — the CreateBookingSheet conflict preflight looked "fine" but had never surfaced a single conflict since it shipped. **Before trusting a hint-style client, verify its request body against the server Zod/validation schema field-by-field** — the drift detector does not catch missing-/wrong-key request bodies. A deliberate 400-trigger smoke or one integration test against the real schema would have caught GAP-35's dead code far sooner.
- **Mirror the web consumer's exact gate, not your guess**: web `BookingEquipmentTab` checks conflicts for `["BOOKED","DRAFT","PENDING_PICKUP","OPEN"]` with `excludeBookingId: booking.id`. Reusing that exact active-status set and self-exclusion on iOS keeps the two surfaces consistent and avoids "iOS shows a conflict web doesn't" support confusion.
- **IOS_PATTERNS R3 applies even to hint-style calls**: when rewriting a `try?`/silent function, still broadcast `.sessionDidExpire` on 401. A swallowed 401 in a non-critical call hides an expired session until the next mutation — this was the `kioskHeartbeat` P0. The rewrite is the moment to fix it, not a separate slice.

## Session 2026-06-09 (iOS booking creation broken by API hardening)

### Patterns (cross-client payload contracts)
- **Removing a field from an API response is a breaking change for Swift Codable, even if no client logic uses it**: The May 8 hardening pass (47a23d14) dropped `email` from `/api/form-options` users and updated the web TypeScript type in the same commit -- but iOS `FormUser` still declared `let email: String` (non-optional). JSONDecoder fails the WHOLE response on one missing key, so the requester picker rendered empty and submit showed "Unexpected response from server." TypeScript types are erased at runtime and tolerate missing fields silently; Swift decoders do not. **When trimming an API response, grep `ios/` for the corresponding Codable model in the same slice.**
- **Declare iOS Codable fields optional unless the screen genuinely requires them**: `FormUser.email` was decoded but never read anywhere in the app. Every required field in a Codable struct is a standing contract the server can silently break. Keep iOS models to the minimum fields the UI consumes; make anything incidental `String?`.

## Session 2026-06-09 (iOS↔API Codable drift audit)

### Patterns (response-contract drift between Swift Codable and route handlers)
Systematic audit of every endpoint in `APIClient.swift`/`SearchService.swift` against its route handler, after two prior decode-breaking drifts (FormUser.email, checkAvailability body). Found 6 live mismatches; ~25 endpoints verified clean.

- **Nullable Prisma columns must be optional in Swift, every time**: `AssetAccessory.serialNumber: String` vs schema `serialNumber String?` — one accessory without a serial kills the whole `/api/assets/[id]` decode. Same for `AvailabilityBlock.dayOfWeek: Int` vs `dayOfWeek Int?` (AD_HOC blocks, creatable on web, have no weekday — one of them broke the entire iOS availability list). When writing an iOS model, check the Prisma column's `?`, not the happy-path JSON you sampled.
- **Mutation endpoints must return the same shape as their list/GET siblings**: `POST /api/shift-groups` omitted the `event` relation and `PATCH /api/shift-trades/[id]/cancel` returned a bare row without `postedBy`/`shiftAssignment` — both decoded into the same Swift model as the list response, so iOS "Set up crew" and trade cancel failed 100% of the time while the server mutation succeeded (worst case: user sees an error for an action that worked). Fixed server-side by aligning the `include` with the sibling endpoints — additive for web, and keeps one canonical shape per resource.
- **Envelope drift is invisible in `try?` hint paths**: iOS `checkAvailability` decoded `{data:{conflicts}}` but the route returns the result at the TOP level (`ok({ ...result, bulkAvailability })`). Because the call is deliberately lenient, the decode failure silently returned an empty conflict map — booking conflict hints never showed, again (same endpoint as the Session 2026-05-28 request-body drift). A hint-style call needs a one-time decode assertion in tests or a debug log on decode failure; silence is how this endpoint broke twice.
- **Zod `.nullable()` without `.optional()` requires the KEY**: the notification-preferences PUT schema requires `pausedUntil` to be present (null is fine, absent is a 400). Swift's synthesized Codable omits nil optionals (`encodeIfPresent`), so every iOS save with no pause failed validation. Custom `encode(to:)` with `container.encode(optional, forKey:)` writes an explicit `null`. Corollary: a partial Swift model that PUTs a full-replace endpoint silently resets the fields it doesn't carry (`badges`/`categories` defaulted back to true) — round-trip unknown sibling fields or the save clobbers web-set preferences.
- **Audit method**: for each `perform(_:)` call, find the route's `ok(...)` payload (including service-layer serializers like `listBookings`/`getUserBadgeProfile`), then check every non-optional Swift field exists and is non-nullable at the source (Prisma schema for spread rows, explicit object literals otherwise). The dangerous spots are not the hand-built literals — they're `...spread` Prisma rows (nullable columns leak through) and per-endpoint `include`/`select` differences on the same resource.

## Session 2026-06-09 (iOS audit round 2 — kiosk client + URL building)

### Patterns (client-side request/decode bugs the route audit method also catches)
- **`appendingPathComponent` percent-encodes `?` — never embed a query string in a path**: `request(path: ".../shifts/\(id)?force=true")` produced `.../shifts/abc%3Fforce=true`, so Next.js decoded the dynamic segment as shiftId `"abc?force=true"` and every iOS shift delete 404'd since it shipped. The failure reads like a data bug ("item could not be found"), not a URL bug. `APIClient.request` now takes `queryItems:`; greping for `request(path: ".*?\?` is the audit.
- **A "validate session" probe must only kill the session on 401**: `KioskStore.validateSession` treated ANY `kioskMe()` failure — including its own envelope-mismatch decode error and plain offline-at-launch — as a dead session, wiping the stored activation and forcing staff to re-enter the 6-digit code. Decode bug (`kioskMe` expected `{data:...}`; route returns top-level `{kioskId,...}`) plus catch-all error handling compounded: the kiosk forced re-activation on every app re-entry. Distinguish definitive auth failures from transient ones before destroying client state, and let the heartbeat's dedicated 401 path own deactivation.
- **Audit scope must include secondary API clients**: round 1 covered `APIClient`/`SearchService` and missed `KioskAPIClient` entirely — which held the worst bug of both rounds. When auditing client↔server contracts, enumerate every type that owns a `URLSession`, not just the primary client.

## Session 2026-06-10 (iOS audit round 3 — URL builder consolidation + legacy JSON leniency)

### Patterns
- **`JSON.parse` succeeding does not mean the value is your shape**: `parseNotes` treated any parse success as import metadata, so a user note of "1234" or "true" was hidden on web AND serialized a non-object `metadata` that the iOS decoder would reject. Guard with `typeof parsed === "object" && !Array.isArray(parsed)` before casting to `Record<string, unknown>` — and on the Swift side, any model decoded from a legacy free-form JSON column must degrade to nil on type mismatch (`try? container?.decodeIfPresent`) rather than fail the parent decode.
- **Consolidate request construction before the second bug, not after**: the `?force=true` path bug existed because twelve methods each hand-built URLComponents + headers. After unifying on `request(path:method:queryItems:)`, the encoding bug class has one owner and the contract suite's no-query-in-path regex covers every caller automatically.

## Session 2026-06-10 (Booking creation audit/polish + iOS review step)

### Patterns
- **JSX text and attribute strings do NOT process `\u` escapes**: `placeholder="Select\u2026"` and `No equipment selected \u2014 ...` rendered the literal backslash sequences to users. JS string literals (object configs, template strings, `{"..."}` expressions) process escapes; JSX attribute values and JSX children text do not — only HTML entities work there. Use the real character. Audit: `grep -rn '\\u20' src/**/*.tsx` and check each hit's context.
- **Copy refreshes must update source-pin tests in the same slice**: the visual refresh compressed recovery copy but left `booking-wizard-event-context-source`, `booking-wizard-kit-fetching-source`, and the iOS `student-field-contracts` pins asserting the old strings — three already-failing tests that weren't in the refresh plan's verification list. When changing user-facing copy, grep `tests/` for the old strings before calling the slice done.
- **Check new UI against docs/COLOR_SYSTEM.md kind/status tables**: the refreshed wizard header badge used red/blue for checkout/reservation; canon is blue/purple (and reservation's icon is the calendar glyph). Status colors were right (pending = orange) — it's the *kind* colors that drift, because they appear in fewer places.
- **iOS parity slice = same hierarchy, native dress**: the web review panel translated to SwiftUI as the same vertical hierarchy (icon tile → claim → secondary → facts → list → single CTA) using existing `Color.statusText/statusBackground` tones — no new color or component primitives needed on either side.

## Session 2026-06-10 (Firmware modal + Info card layout polish)

### Patterns
- **Never run `npx next build` while the dev preview server is running**: both write to the same `.next` directory, and the build clobbers the dev server's vendor chunks (symptom: "Cannot find module './vendor-chunks/@sentry.js'" runtime error on next navigation). Verify in the preview FIRST, then stop the preview, then build — or restart the preview after building. The project `npm run build` also runs `prisma migrate deploy` first, which fails offline/when Neon is idle; `npx next build` is the compile-only check.
- **A dialog footer that wraps is a scope smell, not a spacing problem**: the firmware modal's footer wrapped because "Mark updated to latest" lived there even when it was a no-op (already at latest). Moving the action into the body as a conditional (only when an update exists) fixed both the layout and the logic. When a footer overflows, ask which button doesn't belong before shrinking anything.

## Session 2026-06-11 (Booking detail refresh + audit/bulk-qty fixes)

### Patterns
- **`??` on a non-nullable Prisma Int is dead code that hides a real state**: `checkedOutQuantity` is `Int @default(0)`, so `item.checkedOutQuantity ?? item.plannedQuantity` always evaluates to the left side — for a PENDING_PICKUP booking that's 0, which made `inQty >= outQty` read `0 >= 0` and badge an untouched bulk line as "Returned" with "Qty: 0". When a fallback is meant to mean "not yet happened", encode it as an explicit `> 0` check (or a status check), and audit other `??` uses against the schema's nullability before trusting them.
- **Audit writes belong in exactly one layer**: `createBooking()` logs `created` inside its transaction, and the checkout/reservation POST routes each logged a second `create` entry — every booking's history showed "created booking" twice since both actions map to the same label. When a service owns the transaction, the route must not also log; grep for route-level `createAuditEntry` after service calls when adding lifecycle audit entries.
- **Parallel sessions on one branch can swallow your uncommitted work**: a concurrent iOS session ran a broad `git add` and committed this session's uncommitted visual-refresh edits inside its own pushed commit (1eba91b4 "Fix iOS scan QR resolution..."). Nothing was lost, but the history attributes web UI changes to an iOS fix. When two agents share a worktree, commit your slices as soon as they're verified, and never `git add -A` — stage explicit paths only.

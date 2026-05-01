# Breadcrumbs Improvement Audit
**Date**: 2026-05-01
**Target**: `src/components/PageBreadcrumb.tsx` + `src/components/BreadcrumbContext.tsx` + 6 detail-page consumers
**Type**: System (component + context + per-page wiring)

## Shipped (2026-05-01)
- ✅ **Role gating fix** — `SiblingDropdown` now filters by `meetsRoleRequirement(required, role)`. STUDENTs no longer see ADMIN-only Settings entries. Added a `meetsRoleRequirement` helper to `nav-sections.ts` so consumers don't have to construct fake `SettingsSection` objects.
- ✅ **`getRecentEntities` moved out of render** — wrapped in `useMemo` keyed on `firstSegment` + `entityLabel`. localStorage no longer parsed on every re-render.
- ✅ **`LABEL_MAP`/`HREF_OVERRIDE` collapsed into single `SEGMENT_OVERRIDE`** — only entries that genuinely diverge from the default title-cased segment remain (`events` aliased to "Schedule", `bulk-inventory` parent linking to `/items`). 19 dead entries deleted.
- ✅ **Recents-cap constants aligned** — `MAX_RECENT_PER_SECTION = 5` and `MAX_RECENT_TOTAL = 30` replace the silent literal `30`.

Deferred (worth picking up later): the `useFetch({ breadcrumb })` consolidation, single nav-config source of truth, mobile truncate-width tuning, and the `/events` ↔ `/schedule` aliasing decision — all listed in **Bigger Bets** below.

---

## What's Smart

- **Single global mount in `AppShell`** (`src/components/AppShell.tsx:427-432`). Pages don't render their own breadcrumb — eliminates the duplicate-crumb class of bug that's already cost time (per `docs/AREA_MOBILE.md:104` and the archived `tasks/archive/breadcrumbs-roadmap.md`). Worth keeping intact.
- **Path-derived crumbs with explicit overrides** (`PageBreadcrumb.tsx:128-134`). Default behavior is computed from `usePathname()`; only the genuinely irregular cases sit in `LABEL_MAP`/`HREF_OVERRIDE`. Right balance of convention vs. configuration.
- **Auto-reset of `expanded` and entity label on navigation** (`PageBreadcrumb.tsx:114`, `BreadcrumbContext.tsx:22`) using `useEffect` keyed on `pathname` instead of `key={pathname}` remounts. This is exactly the pattern lessons.md endorses and avoids tearing down the surrounding tree.
- **Sibling quick-jump on `/settings` and `/reports`** (`PageBreadcrumb.tsx:61-66`, `220-246`). Module-load loop registers each child path so the dropdown appears whether you click "Settings" or are already on `/settings/notifications`. Compact and non-obvious — worth a one-line comment but the trick itself is good.
- **Skeleton on detail pages while entity label resolves** (`PageBreadcrumb.tsx:156, 207-214`). Prevents the title flicker between path-default and resolved entity name.
- **Recently-visited section dropdown** (`PageBreadcrumb.tsx:248-274`). Genuine power-user feature; per-section scoping (`section: firstSegment`) keeps it from polluting unrelated areas.

---

## What Doesn't Make Sense

- **Sibling dropdown ignores role gating** (`PageBreadcrumb.tsx:236-241`). Renders every entry from `SETTINGS_SECTIONS` regardless of `requiredRole`. A STUDENT on `/settings/notifications` opening the Settings dropdown sees Locations / Venue Mappings / Database / Escalation / Kiosk / Sports / Categories / Allowed Emails / Calendar / Extend Presets — all ADMIN/STAFF-only. Clicking lands on a blocked page. The helper to fix this already exists: `isSectionVisible` in `src/lib/nav-sections.ts:142-147` — it's just not called here.
- **`getRecentEntities()` runs on every render** (`PageBreadcrumb.tsx:155`). It's invoked in the render body, not in state/`useEffect`/`useMemo`, so every pathname change reads + JSON-parses localStorage. Cheap-ish, but it's also not SSR-aware (the component is `"use client"` so SSR doesn't crash, but the value will differ between first paint and post-mount once the effect at line 120 has fired and written).
- **Two inconsistent retention caps for "recents"** (`PageBreadcrumb.tsx:70 vs 92`). `MAX_RECENT = 5` is read but `saveRecentEntity` hard-codes `slice(0, 30)`. Either align them or rename to `MAX_RECENT_PER_SECTION` vs. `MAX_RECENT_TOTAL` and document intent.
- **`LABEL_MAP` is mostly dead overrides** (`PageBreadcrumb.tsx:26-54`). 19 of 24 entries produce the exact same string `formatSegment` would (`items` → "Items", `notifications` → "Notifications", `calendar-sources` → "Calendar Sources", etc.). Only the truly-aliased ones earn their keep: `events` → "Schedule", `bulk-inventory` → "Bulk Inventory" (capital I), maybe `import` (formatSegment would give "Import" anyway — also dead). The map hides which entries are actually doing work.
- **Per-page boilerplate is copy-pasted 6 times.** Items (`use-item-data.ts:80`), bulk SKUs (`use-bulk-sku-data.ts:53`), users (`users/[id]/page.tsx:99-101`), kits (`kits/[id]/page.tsx:118-120`), bookings (`BookingDetailPage.tsx:75-77`), events (`events/[id]/page.tsx:72-74`). Same shape every time: pull a label from a fetched object, push it through a context setter via `useEffect`. lessons.md already has a scar on this (Shifts entry, 2026-04-04: missed dep on `setBreadcrumbLabel`). It belongs in the data-fetch hook, not in each page.
- **Single shared `MAX_RECENT_PER_HREF` would protect the dropdown from a single hyperactive page**, but as written one section can fill the entire 30-entry global cap and crowd recents from other sections out of LRU. Minor, but worth noting since the cap is asymmetric (per-section read, global write).
- **`HREF_OVERRIDE` and the alias-to-Schedule are silent**. `events` segment becomes label "Schedule" linking to `/schedule` — that's an aliased section, not a renamed one. Anyone reading the file has to look at three structures (`LABEL_MAP`, `HREF_OVERRIDE`, the unwritten fact that `/events` doesn't exist as a list route) to understand. A single object — `{ events: { label: "Schedule", href: "/schedule" } }` — would say it once.

---

## What Can Be Simplified

- **Collapse `LABEL_MAP` + `HREF_OVERRIDE` into one config map.** Current: two separate `Record<string,string>`s plus a `formatSegment` fallback. Simpler: one `Record<string, { label?: string; href?: string }>` containing only entries that actually override the default. Drops ~17 dead entries.
- **Replace per-page `useEffect(setBreadcrumbLabel)` with a `useFetch` option or a `useBreadcrumbLabel(label)` setter hook.** Current: 6 copies of the same effect (see file list above). Simpler: `useFetch({ url, breadcrumb: (data) => data.name })` or `useBreadcrumbFor(asset?.assetTag)`. Removes the dep-array trap that already burned the Shifts page.
- **Lift `getRecentEntities` out of render** (`PageBreadcrumb.tsx:155`). Current: inline call on every render. Simpler: `useState(() => onDetailPage ? getRecentEntities(firstSegment) : [])` plus an effect that re-reads when `firstSegment` or storage changes. Or, since it's only consumed in a dropdown, lazy-load on dropdown open.
- **Drop `getRecentEntities` filter when `recents.length <= 1`.** `hasRecent` requires `length > 1` (`PageBreadcrumb.tsx:163`); meanwhile `getRecentEntities` always reads + parses + filters localStorage even when the result will go unused. Bail early.
- **Inline-defined sub-components are fine** but `RecentDropdown` at `:248-274` and `SiblingDropdown` at `:220-246` could share a single `<BreadcrumbDropdown items={[...]} currentHref={...} />` since they differ only in which list they render. ~25 lines saved, more important: one place to fix any styling drift between trigger types.
- **`BreadcrumbProvider`'s pathname-reset `useEffect` and the page's pathname-reset of `expanded`** can probably move into the provider as one effect that resets both label + expansion. Right now state lives in two layers for the same lifecycle.

---

## What Can Be Rethought

- **Move "what's the entity label" into the data layer.** Today, knowing the breadcrumb name requires 6 detail pages to opt in via context. Alternative: a `breadcrumbLabel` (or `displayName`) field returned from each detail-fetch endpoint, consumed once in `useFetch`. Tradeoff: server now owns "what's the human label for this row" — which is arguably correct (you'd want the same label in tab titles, push notifications, audit logs). lessons.md already shows the email/PHI variant of this question being settled.
- **Surface section role gating once at the source.** Today the breadcrumb dropdown ignores it; sidebar likely has its own filter. Better: a single `useVisibleSettingsSections()` hook (or server-rendered config) that everyone consumes. Current model spreads the gating logic across components.
- **Reconsider whether the `events` → "Schedule" alias should exist at all.** Today `/events/[id]` displays a "Schedule" parent crumb. A user clicking it lands on `/schedule` — a different listing model. If the underlying entity is just an "event," call it Events. If it's a Schedule item, rename the route. Either way the crumb shouldn't be the only place the rename happens.
- **Detail-page recents stored in localStorage, not in the user record.** Survives device → no. Cross-device personalization is one of the easier wins from `User.lastSeen[]` or similar. Tradeoff: write traffic on every detail visit; could batch-flush on visibilitychange.
- **`COLLAPSE_THRESHOLD = 3` rarely fires.** Most paths are 3 segments (Home / Section / Entity). Either lower it to 2 — actually counterproductive, you'd always hide the section — or accept the threshold is effectively dead code on this app's URL shape and remove the collapse machinery entirely. Mobile already wraps via `flex-wrap` at `breadcrumb.tsx:18`.

---

## Consistency & Fit

### Pattern Drift
- **Detail-page data fetching is not standardized.** Items (`use-item-data.ts`) and bulk SKUs (`use-bulk-sku-data.ts`) hand-roll AbortController + state machines; users (`users/[id]/page.tsx:75`), kits (`kits/[id]/page.tsx:112`), bookings (`useBookingDetail`), and events (`events/[id]/page.tsx:39`) use `useFetch`. Breadcrumb wiring is duplicated in both styles. This is broader than the breadcrumb but the breadcrumb call sites are the cleanest place to see the drift.
- **`setBreadcrumbLabel` placement varies.** Items/bulk-inventory call it inside the fetch's `.then`. Users/kits/bookings/events use a separate `useEffect` keyed on the entity name. Both work; pick one.

### Dead Code
- `PageBreadcrumb.tsx:26-54` — `LABEL_MAP` entries that produce identical output to `formatSegment` fallback: `items`, `checkouts`, `reservations`, `kits`, `labels`, `import`, `scan`, `search`, `settings`, `reports`, `users`, `profile`, `notifications`, `schedule`, `bookings`, `database`, `categories`, `escalation`, `sports`, `utilization`, `overdue`, `scans`, `audit` (~19 entries). Only `events` (alias), `calendar-sources` (already title-cases via fallback — verify), `venue-mappings` (same), `bulk-inventory` (same) are interesting, and of those only `events` truly diverges from default behavior.
- `PageBreadcrumb.tsx:70` — `MAX_RECENT = 5` constant is referenced only at line 79; the writer at line 92 uses literal `30`. Either MAX_RECENT is misnamed (it's actually MAX_PER_SECTION) or 30 should reference a sibling constant.
- No unused imports or commented-out code in `PageBreadcrumb.tsx` itself. Clean on that axis.

### Ripple Map
- **If `LABEL_MAP` adds a new section** → must also be added to sidebar nav (`AppShell.tsx`), search palette, and possibly `nav-sections.ts`. Three files to keep in sync per route. *Files that need updating: `src/components/AppShell.tsx`, `src/lib/nav-sections.ts`, search command palette wherever it lives.*
- **If `BreadcrumbContext` API changes** (e.g. `setBreadcrumbLabel` renamed or an additional `setBreadcrumbHref`) → 6 consumer sites need updates: `src/app/(app)/items/[id]/_hooks/use-item-data.ts`, `src/app/(app)/bulk-inventory/[id]/_hooks/use-bulk-sku-data.ts`, `src/app/(app)/users/[id]/page.tsx`, `src/app/(app)/kits/[id]/page.tsx`, `src/app/(app)/bookings/BookingDetailPage.tsx`, `src/app/(app)/events/[id]/page.tsx`.
- **If `SETTINGS_SECTIONS` or `REPORT_SECTIONS` change** (`src/lib/nav-sections.ts`) → sibling dropdowns auto-reflect via the module-load loop at `PageBreadcrumb.tsx:65-66`. Good — no ripple. But the sidebar might not pick it up automatically; verify.
- **If `isDynamicSegment` regex changes** → could silently mis-classify paths. The two patterns at `PageBreadcrumb.tsx:103-104` cover hex-ish ids and CUIDs; any new ID format added to the schema needs to be reflected here.

### Navigation Integrity
- ⚠️ Sibling-dropdown links may point to ADMIN-only pages for STUDENT users (see "What Doesn't Make Sense"). Lands them on a blocked route.
- ✅ `HREF_OVERRIDE.events = "/schedule"` — `/schedule` route exists at `src/app/(app)/schedule`.
- ✅ `HREF_OVERRIDE["bulk-inventory"] = "/items"` — `/items` exists.
- ✅ Recent dropdown stores fully-qualified `pathname`, no malformed hrefs.

---

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ | N/A — breadcrumb is never "empty" with real navigation |
| Skeleton fidelity | ⚠️ | `Skeleton h-4 w-24` (`:211`) is a fixed 96px regardless of expected entity name length. Fine, but a randomized width or `w-32` on bookings (long titles) vs `w-20` on items (short tags) would be closer to truth |
| Silent mutations | ✅ | No mutations |
| Confirmation quality | ✅ | No destructive actions |
| Mobile breakpoints | ⚠️ | `max-w-[200px]` truncate (`:185, :200, :232, :260, :267`) is identical at every breakpoint. On a 360px phone, after Home + separator + section + separator, 200px is too wide for the entity crumb |
| Error message quality | ✅ | No user-visible errors |
| Button loading states | ✅ | No buttons that initiate async work; ellipsis-expand button is sync |
| Role gating | ❌ | `SiblingDropdown` shows ADMIN-only sections to STUDENT (`PageBreadcrumb.tsx:236-241`). `isSectionVisible` exists but isn't called |
| Performance (N+1, over-fetch) | ⚠️ | `getRecentEntities` reads + JSON-parses localStorage on every render of every detail page (`:155`); also reads inside `saveRecentEntity` on every entityLabel change (`:120-124`). Two reads + one write per detail-page mount, plus one read per re-render |
| Debug cleanup (console.log, TODOs) | ✅ | Clean |
| Accessibility basics | ⚠️ | `<DropdownMenuTrigger>` at `:231` is a button by default but has no explicit `aria-label`; the visible label is the section name which is OK. The expand-ellipsis button has `aria-label` ✅. Sibling and recent dropdowns don't announce that there are children — `aria-haspopup="menu"` is provided by Radix. Likely fine, worth a screen-reader pass |

---

## Raise the Bar

- **Pathname-keyed `useEffect` reset instead of `key={pathname}` remount** (`BreadcrumbContext.tsx:22`). This pattern preserves component instances across navigations and is documented as the right approach in `tasks/lessons.md`. Several other context-bearing components in this app (sidebar collapse state, toast queues if any) likely use heavier remounts; the breadcrumb's approach should be the template.
- **Module-load registration of section→siblings** (`PageBreadcrumb.tsx:65-66`). Loops once at import time to populate a lookup table; no per-render cost. Same trick could apply to other "is this path a child of X?" checks scattered through the app.

---

## Quick Wins

1. **`src/components/PageBreadcrumb.tsx:236-241`** — pass current user role into `SiblingDropdown` and filter siblings via `isSectionVisible(s, role)`. STUDENTs stop seeing admin-only links. Single source of truth already exists in `nav-sections.ts:142`.
2. **`src/components/PageBreadcrumb.tsx:155`** — wrap `getRecentEntities` in `useState` initializer (or `useMemo` keyed on `firstSegment`) so it doesn't re-read localStorage on every render. Bonus: gate it on `recents.length > 1` since that's the only path that consumes it.
3. **`src/components/PageBreadcrumb.tsx:26-54`** — delete dead `LABEL_MAP` entries that match the `formatSegment` fallback. Keep only `events`, `bulk-inventory`, and any actual aliases. Add a one-line comment: `// Only entries where the label diverges from default title-casing`.
4. **`src/components/PageBreadcrumb.tsx:92`** — replace literal `30` with `MAX_RECENT_TOTAL` constant (and rename `MAX_RECENT` → `MAX_RECENT_PER_SECTION`). Self-documenting and removes the silent asymmetry.
5. **`src/app/(app)/items/[id]/_hooks/use-item-data.ts:103`** — the `eslint-disable-next-line react-hooks/exhaustive-deps` is masking that `setBreadcrumbLabel` is in the deps but other deps may be missing. Re-validate; remove the disable if possible.

---

## Bigger Bets

- **Fold breadcrumb-label setter into `useFetch`.** Add `breadcrumb?: (data: T) => string | null` option. Each of the 6 detail pages drops 3-4 lines of plumbing and a `useEffect`. lessons.md (Shifts, 2026-04-04) shows the existing duplication has already caused at least one stale-closure bug. ~30 min implementation, ~6 cleanup PRs after, but worth a single Slice.
- **Single nav config as source of truth.** A `nav-config.ts` (extending `nav-sections.ts`) that owns: label, href, role gate, parent section, sidebar group, search keywords. Today this knowledge is spread across `LABEL_MAP`, `HREF_OVERRIDE`, `SETTINGS_SECTIONS`, `REPORT_SECTIONS`, `AppShell` sidebar, and probably the search palette. One file to change when navigation changes; breadcrumb, sidebar, and search all read from it. Real cost (a few hours of consolidation), real payoff (every nav change becomes a one-file PR).

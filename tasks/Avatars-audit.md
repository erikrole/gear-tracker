# Avatars Improvement Audit
**Date**: 2026-05-01
**Target**: Avatars (cross-cutting system)
**Type**: System

**Scope (read):**
- `src/components/ui/avatar.tsx` — shadcn primitive (Avatar/Image/Fallback + `size` variant)
- `src/components/ui/avatar-group.tsx` — overflow stack
- `src/components/UserAvatar.tsx` — convenience wrapper
- `src/lib/avatar.ts` — `getInitials()`
- `src/app/(app)/dashboard/dashboard-avatars.tsx` — `GearAvatarStack` / `ShiftAvatarStack` / `EmptySlotAvatar`
- `src/components/shift-detail/UserAvatarPicker.tsx`
- `src/app/api/users/[id]/avatar/route.ts` (POST + DELETE)
- 19 consumer sites surveyed across users, bookings, licenses, shifts, schedule, events, items, scan, sidebar, dashboard, activity timeline.

---

## What's Smart

- **Single source of truth for initials** — `src/lib/avatar.ts:7-15` is imported uniformly across the client; no inline `name.split(" ").map(...)` survives the codebase (one outlier in `BulkUnitGrid.tsx:53` is a first-name extraction, not initials).
- **shadcn primitive with `data-size` + group selector for fallback text** — `src/components/ui/avatar.tsx:17-20,49` lets the fallback element auto-shrink to `text-xs` when the avatar is `size=sm` without per-call className overrides. Worth replicating for other sized atoms.
- **Optimistic delete with rollback** — `src/app/(app)/users/[id]/page.tsx:127-147`. Captures `previousUrl` before the network call, restores on `!res.ok` and on `catch`. Matches the lessons.md "Optimistic UI for mutations" rule.
- **Old blob cleanup on replace + delete** — `src/app/api/users/[id]/avatar/route.ts:50-52,93-95`. Uses `isBlobUrl` guard so external/legacy URLs aren't accidentally hit, and swallows delete errors to avoid blocking the user-visible mutation.
- **Audit entries on every avatar mutation** — `route.ts:60-67,102-109`. Includes before/after; matches D-007.
- **`EmptySlotAvatar` standardization** — `dashboard-avatars.tsx:82-90` is the canonical empty-shift placeholder. Worth promoting to `@/components/UserAvatar` so non-dashboard surfaces (ShiftSlotCard, AssignmentCell) can adopt.
- **Granular auth on the avatar route** — `route.ts:8-12,27-29` correctly carves out self-edit, admin global, and staff-only-students-not-staff/admin. Matches the "STAFF cannot edit ADMIN users" lesson.

## What Doesn't Make Sense

- **Two parallel idioms for the same shape** — `<UserAvatar name avatarUrl />` exists (9 call sites) but **14 sites still hand-roll** the same `<Avatar><AvatarImage/><AvatarFallback>{getInitials(...)}</AvatarFallback></Avatar>` block over `(name, avatarUrl)` data:
  - `src/app/(app)/users/UserRow.tsx:34-42, 88-96`
  - `src/app/(app)/users/[id]/page.tsx:286-294, 319-330`
  - `src/app/(app)/licenses/LicenseTable.tsx:76-79`
  - `src/app/(app)/licenses/AdminClaimSheet.tsx:218-223, 444-449`
  - `src/app/(app)/schedule/assign/_components/AssignmentCell.tsx:134-143`
  - `src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx:220-222, 483-485`
  - `src/app/(app)/events/[id]/_components/EventTravelCard.tsx:315-321`
  - `src/components/shift-detail/UserAvatarPicker.tsx:72-77`
  - `src/components/shift-detail/ShiftSlotCard.tsx:181-188, 302-306`
  - `src/components/booking-list/BookingCard.tsx:158-165`
  - `src/components/Sidebar.tsx:185-193`
  - `src/components/ActivityTimeline.tsx:735-737`
  - `src/app/(app)/dashboard/dashboard-avatars.tsx:57-63`
  No call site needs the lower-level pieces — they all just want `(name, avatarUrl, size)`.

- **`ShiftSlotCard.tsx:302-306` silently drops the avatar image for pending requests.** The active assignment (`:181-188`) renders `<AvatarImage>`, but the pending-request branch only renders the fallback even when the user has an `avatarUrl` on file. Same screen, different rules — looks like a forked-then-incomplete copy.

- **Hardcoded amber palette for conflict avatars** — `AssignmentCell.tsx:138`: `bg-yellow-100 text-yellow-700`. This violates two captured lessons: "Never hardcode `bg-green-50 text-green-700`. Use Badge variants for dark mode safety" and "CSS var references beat hardcoded dark-mode pairs." Dark mode shows yellow-700 text on yellow-100 background — both invisible. The `--orange-text` / `--orange-bg` tokens already exist for this.

- **Server pre-computes `initials` only for dashboard `assignedUsers`** — `src/app/api/dashboard/route.ts:372,380,408` populates `initials: getInitials(...)`, and only `dashboard-avatars.tsx:61` reads it (`<AvatarFallback>{u.initials}</AvatarFallback>`). Every other site recomputes client-side. Two paths to the same string, easy for them to drift if `getInitials` ever changes.

- **`AvatarGroup` is structurally unused** — `dashboard-avatars.tsx:16,50` always passes `max={99}`, defeating the component's overflow logic, and then re-implements `+overflow` externally (`:26-30, 72-76`). `BookingCard.tsx:46-50` rolls its own stack with a custom span and never imports `AvatarGroup`. The component's only contribution at call time is the `-space-x-2` flex wrapper.

- **`dashboard-avatars.tsx:10` re-exports `UserAvatar` from a global module.** Dashboard children then import `UserAvatar` from the dashboard barrel (`my-gear-column.tsx:13`, `team-activity-column.tsx:21`, `overdue-banner.tsx:7`). It's a one-liner indirection that hides where the symbol comes from.

- **Comment promises a feature that was never built** — `src/lib/avatar.ts:1-2`: "centralized initials + **color-coded fallbacks**." The file only exports `getInitials`. Either delete the promise or build it (a deterministic name→hue hash makes long avatar stacks readable; fallback grids today are all `bg-muted`).

- **`Avatar` size=`lg` (size-10) variant has zero call sites** — `avatar.tsx:20`. Profile hero uses size-20 directly via `className`; picker uses size-7; tables use size-9/11. The `lg` token is dead.

- **`UserAvatar` only exposes `sm | default`** while consumers want sizes 5, 6, 7, 9, 11, 18px, 20. Most sites bypass it for that reason alone.

## What Can Be Simplified

- **Promote `UserAvatar` to the canonical entry-point.** Add semantic sizes (`xs=size-5`, `sm=size-6`, `default=size-8`, `md=size-9`, `lg=size-11`, `xl=size-20`) and migrate the 14 raw call sites. Net delete: ~70 lines of repeated `{u.avatarUrl && <AvatarImage .../>}<AvatarFallback>{getInitials(...)}</AvatarFallback>` boilerplate.

- **Drop server-side `initials`.**
  - `src/app/api/dashboard/route.ts:372,380,408` (and the matching mapper)
  - `src/app/(app)/dashboard-types.ts:72` (`initials: string` field)
  - `src/app/(app)/dashboard/dashboard-avatars.tsx:61` (replace with `<UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />`)

- **Delete the dashboard re-export.** Remove `dashboard-avatars.tsx:10` and have `my-gear-column.tsx:13`, `team-activity-column.tsx:21`, `overdue-banner.tsx:7` import `UserAvatar` directly from `@/components/UserAvatar`.

- **Use `AvatarGroup`'s overflow or delete it.** Both stacks (`GearAvatarStack`, `ShiftAvatarStack`) have hand-rolled overflow that duplicates the component's own logic. Either pass real `max` values and trust the component, or delete `avatar-group.tsx` and inline the `flex -space-x-2` wrapper at call sites (it's two lines).

- **Remove unused `size="lg"` from `Avatar`** — `avatar.tsx:13,20`. No consumers; the `data-[size=lg]:size-10` rule is dead.

- **Fix `ShiftSlotCard.tsx:302-306` to render the user's photo** by switching to `<UserAvatar name={req.user.name} avatarUrl={req.user.avatarUrl} size="sm" />`. The data is already on the assignment payload — only the JSX is missing it.

- **Replace `bg-yellow-100 text-yellow-700` in `AssignmentCell.tsx:138`** with `bg-[var(--orange-bg)] text-[var(--orange-text)]`. Same trick already applied across the rest of the design system.

## What Can Be Rethought

- **Color-coded fallbacks** — Build the feature the comment already advertises. Hash `name` to one of ~8 brand-safe HSL hues; apply to `<AvatarFallback>` background. Long stacks (org chart, dashboard team activity, schedule grids) become much easier to scan when nobody has uploaded a photo. Tradeoff: deterministic hash needs a stable input; if a user renames, their hue shifts. Acceptable.

- **Single avatar size scale, semantic tokens.** Today the codebase has `size-5, size-6, size-7, size-8, size-9, size-11, size-20, size-[18px]` plus shadcn's `data-[size=sm]:size-6, default size-8, data-[size=lg]:size-10`. Pick a 5- or 6-step scale that matches typography rhythm and codify it on `UserAvatar`. Ban `className="size-X"` overrides via a lint rule. Tradeoff: one-time migration; the few non-conforming sites (sidebar size-7 with brand ring, profile hero size-20) become explicit special cases instead of distributed drift.

- **API never returns initials.** Treat initials as a presentation concern; the server returns `(id, name, avatarUrl)` and the client computes everything else. Unblocks future refinements (color hash, locale-aware initial extraction, fallback monograms) without bumping the API. Tradeoff: removes one micro-optimization per dashboard payload (~few bytes × N users).

- **Lift "stack with overflow + tooltip" out of dashboard.** `GearAvatarStack` / `ShiftAvatarStack` / `EmptySlotAvatar` are dashboard-local but the same patterns reappear in `BookingCard.tsx:23-53` (gear stack), `LicenseTable.tsx:67-91` (holders), and the events page. Move to `@/components/AvatarStack` (or rename `AvatarGroup`) with first-class `users` / `items` / `emptySlots` props. Tradeoff: one shared component fork can become hard to evolve when concerns diverge.

## Consistency & Fit

### Pattern Drift
- **`UserAvatar` adoption is partial (9/23 sites).** The 14 hand-rolled sites listed under "What Doesn't Make Sense" are the drift surface.
- **AvatarGroup is misused everywhere it's used** (`dashboard-avatars.tsx:16,50` pass `max={99}`).
- **Avatar size token bypassed in favor of ad-hoc `className="size-N"`** in 12 of 19 surveyed sites (see Quick Wins).
- **Hardcoded color pair on AvatarFallback** at `AssignmentCell.tsx:138` — every other status-tinted surface in the app uses `--orange-*` / `--green-*` tokens for dark-mode parity.

### Dead Code
- `src/components/ui/avatar.tsx:13,20` — `size="lg"` variant: zero call sites.
- `src/app/(app)/dashboard-types.ts:72` — `initials: string` field on `assignedUsers`: only consumed by `dashboard-avatars.tsx:61`, replaceable with `getInitials()` client-side.
- `src/app/api/dashboard/route.ts:372, 380, 408-409` — server-side `initials: getInitials(...)` mappers feed only the field above.
- `src/app/(app)/dashboard/dashboard-avatars.tsx:10` — `export { UserAvatar } from "@/components/UserAvatar"` re-export adds an indirection with no transformation.
- `src/lib/avatar.ts:1-2` JSDoc — comment claims "color-coded fallbacks" but the module exports only `getInitials`. Either build or delete.
- `src/components/ui/avatar-group.tsx:8` — default `max=4` is never used; every call site overrides to 99.

### Ripple Map
- **If `UserAvatar` props change** (e.g., adding sizes, switching `initials` to `name`-only) → 9 files: `Sidebar.tsx`, `bookings/BookingInfoTab.tsx`, `scan/_components/ItemPreviewDrawer.tsx`, `dashboard/dashboard-avatars.tsx`, `dashboard/overdue-banner.tsx`, `dashboard/my-gear-column.tsx`, `dashboard/team-activity-column.tsx`, `users/org-chart/page.tsx`, `items/columns.tsx`, `booking-list/BookingRow.tsx`, `booking-wizard/WizardStep3.tsx` (12 if we count both row + card).
- **If `getInitials` changes** (locale, Unicode handling) → ~14 client files plus `src/app/api/dashboard/route.ts:4` (server import). Server import is the surprising one — eliminate by removing server-side initials.
- **If the dashboard `assignedUsers` shape drops `initials`** → `src/app/(app)/dashboard-types.ts:72`, `src/app/(app)/dashboard/dashboard-avatars.tsx:61`, `src/app/api/dashboard/route.ts:372-385`. iOS/native consumers (if any) also need to drop the field.
- **If `AvatarGroup` is removed** → `src/app/(app)/dashboard/dashboard-avatars.tsx:5,16,50`. No other consumers.
- **If `/api/users/[id]/avatar` response shape changes** (`{ data: { avatarUrl } }`) → `src/app/(app)/users/[id]/page.tsx:118,135` (single consumer).

### Navigation Integrity
- ✅ `users/[id]/page.tsx:184` (sidebar profile link) and `UserRow.tsx:30,84` (user list links) all point at `/users/${id}` which exists.
- ✅ Dashboard `assignedUsers` rendered as avatars do not link out — no broken link risk.

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ | `UserAvatarPicker.tsx:55-58` differentiates "No matching users" vs "No active users found"; `EmptySlotAvatar` standardizes empty shift slots. |
| Skeleton fidelity | ✅ | `users/[id]/page.tsx:221` size-12 rounded skeleton matches the size-20 hero (close enough; same shape). |
| Silent mutations | ✅ | `users/[id]/page.tsx:107-147` toasts both branches of upload + delete. |
| Confirmation quality | ⚠️ | `users/[id]/page.tsx:310-313` "Remove photo" uses `DropdownMenuItem variant="destructive"` with no `useConfirm()` — irreversible (blob deleted) but only one tap to fire. Lessons.md says destructive actions need `useConfirm` + identifier. Low blast radius (self-only). |
| Mobile breakpoints | ✅ | `users/[id]/page.tsx:264` flex-col → sm:flex-row; `UserRow.tsx` has both desktop row + mobile card. |
| Error message quality | ✅ | `parseErrorMessage(res, "...")` used for toggleActive and reset; avatar upload uses inline `json.error || "Failed to upload avatar"` which is acceptable since the route returns structured `HttpError`. |
| Button loading states | ⚠️ | `users/[id]/page.tsx:281` `DropdownMenuTrigger disabled={uploadingAvatar}` covers the trigger, but `DropdownMenuItem` (`:305, 310`) is not guarded mid-action — a fast user could tap "Remove" while an upload is mid-flight. Lessons.md guard pattern (`disabled={acting !== null}`) not applied here. |
| Role gating | ✅ | `users/[id]/page.tsx:267 isSelf` branch + server-side `assertCanManage` (`avatar/route.ts:8-12,27-29`). |
| Performance (N+1, over-fetch) | ⚠️ | `dashboard/route.ts:181` selects `avatarUrl` for shift assignments; `:200, 219` select for requesters; N is bounded (take 20 events × ~4 shifts) so not a real N+1. Server-computed `initials` field is mild over-work, removable. |
| Debug cleanup (console.log, TODOs) | ✅ | None in the avatar surface. |
| Accessibility basics | ⚠️ | `users/[id]/page.tsx:282` "remove photo" trigger button has no `aria-label`; only visual `<CameraIcon>`. `Sidebar.tsx:184` user-card link has no `aria-label` (relies on inner text being read). `LicenseTable.tsx:76-79` size-5 avatar in a clickable row — touch target is delegated to the row, fine. |

## Raise the Bar

- **Optimistic-with-rollback pattern** — `users/[id]/page.tsx:127-147` cleanly captures `previousUrl`, applies the optimistic patch, restores on both `!res.ok` and `catch`. Sibling pages with destructive single-resource mutations (license release, shift removal) often re-fetch instead of patching local state. Worth porting that mental model.
- **`EmptySlotAvatar`** — `dashboard-avatars.tsx:82-90` standardizes the dashed-circle placeholder for empty shift slots. `ShiftSlotCard.tsx:351` and `AssignmentCell.tsx` both build their own circle-with-plus instead of importing this. Promote out of dashboard scope.
- **Audit entries on avatar mutation** — `avatar/route.ts:60-67, 102-109` is the canonical pattern. Some other small mutation routes still skip audit (kits favorite toggle, certain category renames).

## Quick Wins

1. **`src/components/shift-detail/ShiftSlotCard.tsx:302-306`** — Add `<AvatarImage>` (or swap to `<UserAvatar />`). Pending requesters' uploaded photos are silently dropped today.
2. **`src/app/(app)/schedule/assign/_components/AssignmentCell.tsx:138`** — Replace `bg-yellow-100 text-yellow-700` with `bg-[var(--orange-bg)] text-[var(--orange-text)]`. Fixes dark-mode invisibility flagged by lessons.md.
3. **`src/app/(app)/dashboard/dashboard-avatars.tsx:10`** — Delete the `UserAvatar` re-export, update three importers (`my-gear-column.tsx:13`, `team-activity-column.tsx:21`, `overdue-banner.tsx:7`) to import from `@/components/UserAvatar`.
4. **`src/components/ui/avatar.tsx:13,20`** — Drop the unused `size="lg"` variant from the prop union and the className. Trims the type surface and the Tailwind selector.
5. **`src/components/UserAvatar.tsx`** — Add `xs` (size-5), `md` (size-9), `lg` (size-11), `xl` (size-20) sizes with the existing `data-size` mechanism, then replace the 4 most-frequented raw call sites first (`UserRow.tsx`, `LicenseTable.tsx`, `BookingCard.tsx`, `AssignmentCell.tsx`). Each migration is ~5 lines deleted, ~1 line added.

## Bigger Bets

- **Drop server-side `initials` and migrate all consumers to a single `<UserAvatar>` API.** Requires touching `dashboard/route.ts`, `dashboard-types.ts`, the dashboard avatar component, plus the 14 raw call sites. Net: ~70 lines deleted, one path to render any user, Avatar consistency becomes a lint rule. Cost: 1–2 hours of mechanical migration; zero schema changes; ripple is contained because `UserAvatar` already accepts the `(name, avatarUrl)` shape every site has.
- **Build the color-coded fallback** the lib comment already promises. Deterministic name→hue hash on `<AvatarFallback>` background, applied via `UserAvatar` only. Long stacks (`org-chart`, dashboard team activity, schedule grids, license holders) gain visual scannability without anyone having to upload photos. Cost: ~30 lines in `src/lib/avatar.ts` + `UserAvatar.tsx`. Risk: bike-shedding the palette.

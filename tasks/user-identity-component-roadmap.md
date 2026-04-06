# UserIdentity Component Roadmap — V1 / V2 / V3

> Created 2026-04-06. Roadmap for a reusable user display component.

## Context

The user display pattern — avatar + name + optional metadata (email, role badge, status) — is repeated across 9+ files with subtle inconsistencies. This roadmap defines a progressive `UserIdentity` component that standardizes this pattern.

### Current State

**No unified component exists.** Each consumer manually composes:
```tsx
<Avatar>
  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
  <AvatarFallback className={getAvatarColor(user.name)}>
    {getInitials(user.name)}
  </AvatarFallback>
</Avatar>
<div>
  <span>{user.name}</span>
  <span>{user.email}</span>
</div>
```

### Usage Map (9 files, 12+ instances)

| File | Pattern | Avatar Size | Shows Email | Shows Role | Shows Inactive |
|---|---|---|---|---|---|
| `users/UserRow.tsx` (desktop) | avatar + name + email + role badge | size-8 | Yes | Yes | Yes |
| `users/UserRow.tsx` (mobile) | avatar + name + email + role badge | size-9 | Yes | Yes | No → fixed in hardening |
| `users/[id]/page.tsx` | avatar + name + email + member-since | size-12 | Yes | Separate | Yes |
| `schedule/ListView.tsx` | avatar + name in shift rows | size-6 | No | No | No |
| `shift-detail/ShiftSlotCard.tsx` | avatar + name in slot assignment | size-7 | No | No | No |
| `events/[id]/ShiftCoverageCard.tsx` | avatar + name in coverage display | size-6 | No | No | No |
| `Sidebar.tsx` | avatar + name in footer | size-8 | No | No | No |
| `BookingListPage.tsx` | requester avatar + name in booking rows | varies | No | No | No |
| `dashboard/dashboard-avatars.tsx` | `UserAvatar` composed component | varies | No | No | No |

### Inconsistencies Found
1. **Avatar fallback styling**: Some use `bg-secondary text-secondary-foreground`, others use `getAvatarColor(name)`. No consistent default.
2. **Name truncation**: Some use `truncate`, others don't. Long names break layout in shift rows.
3. **Inactive badge**: Only shown in user list desktop row and detail header; missing from mobile card (now fixed), not shown in other contexts.
4. **RoleBadge**: Only used within `/users/` pages. Other areas that display users (shifts, bookings) don't show role.
5. **Avatar sizes**: Range from size-6 to size-12 with no clear size scale for different contexts.

### Shared Utilities Already Extracted
- `src/lib/avatar.ts` — `getInitials(name)`, `getAvatarColor(name)` (hash-based, 10 colors)
- `src/components/ui/avatar.tsx` — shadcn Avatar, AvatarImage, AvatarFallback
- `src/components/ui/avatar-group.tsx` — AvatarGroup with overflow
- `src/app/(app)/users/RoleBadge.tsx` — color-coded role Badge (local to users pages)

---

## V1 — Core (Standardize the Pattern)

**Principle**: One component, one pattern, zero duplication for the common case.

### Features
- Encapsulate avatar + name + optional subtitle into a single `UserIdentity` component
- Support 4 size presets matching current usage: `xs` (24px), `sm` (28px), `md` (32px), `lg` (48px)
- Always use color-coded fallback from `getAvatarColor(name)`
- Optional email, role badge, and inactive indicator
- Truncation on name and email by default

### Not Included in V1
- Click/link behavior (consumers wrap in `<Link>` as needed)
- Hover card / popover
- Editable avatar (stays in user detail page)
- Presence indicators

### API Design

```tsx
// src/components/UserIdentity.tsx

interface UserIdentityProps {
  /** User's display name (required — drives initials + color) */
  name: string;
  /** Avatar photo URL (optional — falls back to color-coded initials) */
  avatarUrl?: string | null;
  /** Subtitle line below name (typically email) */
  subtitle?: string;
  /** User role — shows color-coded RoleBadge when provided */
  role?: "ADMIN" | "STAFF" | "STUDENT";
  /** Whether the user is inactive — shows "Inactive" outline badge */
  inactive?: boolean;
  /** Size preset */
  size?: "xs" | "sm" | "md" | "lg";
  /** Additional className on the outer wrapper */
  className?: string;
}
```

### Size Scale

| Preset | Avatar | Name text | Use case |
|---|---|---|---|
| `xs` | size-6 (24px) | text-xs | Shift rows, inline mentions |
| `sm` | size-7 (28px) | text-sm | Slot cards, compact lists |
| `md` | size-8 (32px) | text-sm | Table rows, cards (default) |
| `lg` | size-12 (48px) | text-base | Page headers, detail views |

### shadcn Components Used
- `Avatar`, `AvatarImage`, `AvatarFallback` — base avatar
- `Badge` — role badge and inactive indicator

### Migration Plan (V1)
1. Create `src/components/UserIdentity.tsx`
2. Move `RoleBadge` logic inline (role → Badge variant map)
3. Migrate `users/UserRow.tsx` (desktop + mobile) — highest usage, proves the API
4. Migrate `users/[id]/page.tsx` header — validates `lg` size
5. Migrate `schedule/ListView.tsx` — validates `xs` size without email/role
6. Migrate remaining consumers one file at a time
7. Delete standalone `users/RoleBadge.tsx` after all consumers migrated

### Risks
- **Prop API too rigid for detail page header**: The detail page has upload/remove avatar actions. V1 should NOT try to handle this — the detail page wraps the avatar in a `DropdownMenu` and handles upload separately. `UserIdentity` renders the display, not the edit.
- **Size presets vs className override**: Some consumers may need a size between presets. Allow `className` override on the avatar element, but don't add a `avatarClassName` prop — that's a sign of leaky abstraction.

---

## V2 — Enhanced (Interactive, Linked, Context-Aware)

**Principle**: The component becomes a lightweight navigation hub — click to learn more about the user.

### New Features

**2.1 Link behavior**
- New `href` prop: when provided, the entire component becomes a `<Link>` to the user's detail page
- Hover shows subtle underline on name only
- Keyboard accessible (Tab + Enter)

**2.2 Hover card**
- New `showHoverCard` prop (default: false)
- On hover, shows a `HoverCard` with: avatar (lg), name, email, role badge, location, member since, active status
- Fetches data lazily from `GET /api/users/[id]` on first hover (with `staleTime: 5min` cache)
- Desktop only — disabled on touch devices

**2.3 Stacked variant**
- New `layout` prop: `"inline"` (default) | `"stacked"`
- `stacked`: avatar above name, centered — for grid/card layouts
- Used in future Team Roster view (V3 of users-roadmap)

**2.4 Loading skeleton**
- New `loading` prop: when true, renders a `Skeleton` matching the size preset
- Skeleton avatar circle + text lines, same dimensions as real content

### API Design (extends V1)

```tsx
interface UserIdentityProps {
  // ... V1 props ...
  /** URL to navigate to on click */
  href?: string;
  /** Show hover card with full user details (desktop only) */
  showHoverCard?: boolean;
  /** User ID (required for hover card data fetching) */
  userId?: string;
  /** Layout direction */
  layout?: "inline" | "stacked";
  /** Show skeleton loading state */
  loading?: boolean;
}
```

### shadcn Components Added
- `HoverCard`, `HoverCardTrigger`, `HoverCardContent` — hover preview
- `Skeleton` — loading state

### Migration (V2)
- No breaking changes to V1 consumers (all new props are optional)
- Add `href="/users/{id}"` to list rows and booking cards
- Add `showHoverCard` to shift assignment displays

---

## V3 — Advanced (Contextual, Compound, Smart)

**Principle**: The component adapts to context and supports complex compositions.

### New Features

**3.1 Compound component API**
- `UserIdentity.Avatar` — just the avatar circle (for custom layouts)
- `UserIdentity.Name` — just the name text
- `UserIdentity.Meta` — subtitle/email/role/inactive
- Allows consumers to arrange sub-parts freely when the default layout doesn't fit

```tsx
// Custom layout example (booking detail sidebar)
<UserIdentity name={user.name} avatarUrl={user.avatarUrl}>
  <UserIdentity.Avatar size="lg" />
  <div className="flex flex-col gap-1">
    <UserIdentity.Name className="text-lg font-semibold" />
    <UserIdentity.Meta />
    <span className="text-xs">Checked out 3 items</span>
  </div>
</UserIdentity>
```

**3.2 Quick actions popover**
- Long-press (mobile) or right-click (desktop) on any UserIdentity
- Shows context menu: "View profile", "Start checkout for user", "View shifts"
- Requires `userId` prop to be set
- Uses shadcn `ContextMenu`

**3.3 Presence indicator**
- Tiny green/gray dot overlay on avatar (online = active session in last 15min)
- Requires `lastActiveAt` field (V3 of users-roadmap)
- Only shown when `showPresence` prop is true (opt-in, not default)

**3.4 Avatar edit integration**
- New `editable` prop: when true, shows camera overlay on hover (for self-view)
- Handles upload/remove via callback props
- Replaces the manual `DropdownMenu` + `Avatar` composition in user detail page

### API Design (extends V2, adds compound)

```tsx
// Compound usage
<UserIdentity name={name} avatarUrl={url}>
  <UserIdentity.Avatar />
  <UserIdentity.Name />
  <UserIdentity.Meta />
</UserIdentity>

// New props on base component
interface UserIdentityProps {
  // ... V2 props ...
  showPresence?: boolean;
  lastActiveAt?: string | null;
  editable?: boolean;
  onAvatarUpload?: (file: File) => Promise<void>;
  onAvatarRemove?: () => Promise<void>;
  children?: React.ReactNode; // enables compound pattern
}
```

### shadcn Components Added
- `ContextMenu` — quick actions
- `DropdownMenu` — avatar edit menu (extracted from detail page)

---

## Dependencies

### V1
- **Schema**: None
- **APIs**: None — all data already in existing responses
- **Components**: Uses existing shadcn Avatar, Badge
- **Build order**: Create component → migrate users pages → migrate shift pages → migrate remaining → delete RoleBadge

### V2
- **Schema**: None
- **APIs**: Existing `GET /api/users/[id]` (for hover card)
- **Components**: Adds shadcn HoverCard, Skeleton

### V3
- **Schema**: Requires `lastActiveAt` on User model (V3 of users-roadmap)
- **APIs**: May need lightweight presence endpoint
- **Components**: Adds shadcn ContextMenu, DropdownMenu

---

## Risks

| Risk | Version | Mitigation |
|---|---|---|
| Prop explosion as features accumulate | V2+ | Compound pattern (V3) as escape hatch. Keep base props to ≤10. |
| Hover card data fetching adds latency | V2 | Lazy fetch on first hover, 5min stale cache. No waterfall. |
| Quick actions popover conflicts with row click handlers | V3 | Use ContextMenu (right-click), not onClick. Mobile: long-press. |
| Compound API is over-engineered for current team size | V3 | Only implement when 3+ consumers need custom layouts. |
| Migration fatigue — 12+ files to update | V1 | Migrate one page per commit. Old pattern still works during migration. |

---

## Rollout Plan

### V1 (1 session)
1. Create `src/components/UserIdentity.tsx` with size presets + optional role/inactive
2. Migrate `users/UserRow.tsx` (both variants) — proves the API
3. Migrate `users/[id]/page.tsx` header — proves `lg` size
4. Migrate shift/schedule consumers — proves `xs`/`sm` sizes
5. Migrate remaining consumers (sidebar, booking list, dashboard)
6. Delete `users/RoleBadge.tsx`
7. Build + visual regression check

### V2 (1-2 sessions)
1. Add `href`, `layout`, `loading` props (non-breaking)
2. Add `showHoverCard` with lazy data fetching
3. Update list row consumers to use `href`
4. Update shift displays to use `showHoverCard`

### V3 (only when demanded)
1. Add compound sub-components
2. Add quick actions popover
3. Add presence indicator (after `lastActiveAt` ships)
4. Extract avatar edit from detail page into `editable` prop

---

## Change Log
- 2026-04-06: Initial component roadmap created. V1 scope: standardize avatar+name+role pattern across 12+ instances in 9 files.

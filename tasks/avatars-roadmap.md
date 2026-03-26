# Avatars Roadmap

**Target:** Cross-cutting avatar system (user avatars, item thumbnails, shift assignment visuals)
**Created:** 2026-03-26
**Status:** Planning

---

## Current State Assessment

### What exists today

The avatar system is a cross-cutting pattern, not a single page. It spans:

**Components:**
- `src/components/ui/avatar.tsx` — Base Radix Avatar with size variants (sm/default/lg)
- `src/components/ui/avatar-group.tsx` — Overlapping stack with max/overflow (+N badge)
- `src/app/(app)/dashboard/dashboard-avatars.tsx` — Composed components: `UserAvatar`, `GearAvatarStack`, `ShiftAvatarStack`

**Data:**
- `User.avatarUrl` (optional, Vercel Blob) — profile photo
- `Asset.imageUrl` (optional, Vercel Blob) — equipment photo

**Upload APIs:**
- `POST/DELETE /api/profile/avatar` — self-service avatar upload (4.5 MB limit, JPEG/PNG/WebP/GIF)
- `POST/PUT/DELETE /api/assets/[id]/image` — asset image upload (staff+admin)

**Display surfaces:**
- Dashboard: requester avatars, gear thumbnails, shift worker stacks
- Users list/detail: profile photo with upload/remove actions
- ShiftDetailPanel: assignment avatars in picker and slots
- Schedule ListView: assigned user avatars in expanded shift rows
- BookingCard: requester avatar + gear thumbnail stack
- Sidebar: current user avatar in footer menu

### What works well
- Consistent initials fallback everywhere (2-letter, first char of each word)
- Vercel Blob storage with automatic old-blob cleanup
- Audit logging on all avatar/image mutations
- `AvatarGroup` handles overflow gracefully with +N badge

### What's missing or weak
- **No admin avatar upload** — admins can't set avatars for users who haven't uploaded their own
- **No crop/resize UI** — full-resolution images stored, wasting blob storage and bandwidth
- **Inconsistent initials computation** — computed server-side in dashboard API but client-side in 6+ other places (duplicated logic)
- **No avatar in the schedule shift picker** — the Popover-based user picker shows text initials but no photo
- **No avatar preview in booking cards** — requester avatar is available but gear avatars only show for team checkouts, not consistently across all views
- **ShiftAvatarStack empty slots** use custom dashed-border divs instead of the standard Avatar component
- **No color-coded fallbacks** — all initials use the same gray background; no way to distinguish users at a glance without photos
- **Mobile avatar tap targets** — some avatars are size-6 (24px), below the 44px touch minimum

---

## V1 — Consistency & Discoverability

**Principle:** Make avatars consistent across the app, ensure photos display everywhere they should, and give users a clear path to upload their own.

### Features
- [ ] **Centralize initials utility** — Extract `getInitials(name)` to `src/lib/avatar.ts`. Remove duplicate implementations from dashboard API, ShiftDetailPanel, ListView, BookingCard, etc.
- [ ] **Color-coded fallbacks** — When no photo, derive a stable background color from the user's name hash (e.g., "Ben Snyder" always gets teal). 6-8 preset colors. Initials remain white text. Much easier to distinguish users at a glance on shift rows.
- [ ] **Avatar photos in shift picker** — The Popover user picker in `ShiftDetailPanel` already has `avatarUrl` in the data. Wire `AvatarImage` into the picker buttons so photos show when available.
- [ ] **Avatar photos in schedule shift rows** — Expanded shift rows in `ListView` show initials only. Wire `avatarUrl` from the shift assignment user data.
- [ ] **Standardize empty slot placeholder** — Replace the custom dashed-border divs in `ShiftAvatarStack` and `ListView` with a dedicated `EmptySlotAvatar` component using the base Avatar with a `UserIcon` fallback.
- [ ] **Mobile tap targets** — Ensure all interactive avatars (clickable for assignment, upload trigger) are at least 44px. Display-only avatars can remain smaller.

### Not included in V1
- Admin avatar upload for other users
- Image crop/resize
- Avatar in notification cards
- Color assignment persistence (server-side)

### Components
- `src/lib/avatar.ts` — new: `getInitials(name)`, `getAvatarColor(name)` (hash-based)
- `src/components/ui/avatar.tsx` — add `colorFallback` variant using the hash color
- Existing shadcn: `Avatar`, `AvatarFallback`, `AvatarImage`, `AvatarGroup`, `Popover`, `Tooltip`

### API changes
- None. All data (`avatarUrl`, `name`) is already available in existing API responses.

### RBAC
- No change. Avatar display is read-only; upload remains self-service.

### Loading, error, empty states
- `AvatarImage` already handles load failure → shows `AvatarFallback`
- Color-coded fallback replaces the generic gray for a better empty state

### Mobile
- All interactive avatars ≥ 44px tap target
- Avatar picker in ShiftDetailPanel: unchanged (Popover works on mobile)

---

## V2 — Admin Control & Richer Display

**Principle:** Give admins the ability to manage team appearance. Make avatars a richer information carrier.

### New features
- [ ] **Admin avatar upload for any user** — New `POST /api/users/[id]/avatar` route (admin/staff only). User detail page shows upload button for admins viewing other users.
- [ ] **Presence indicator on avatars** — Tiny green/gray dot overlay (online/offline based on last session activity within 15min). Uses existing `Session` model's `updatedAt` field. Only on user detail and ShiftDetailPanel — not dashboard (too noisy).
- [ ] **Avatar in notification cards** — Notification items show the actor's avatar (the person who triggered the notification). Requires extending the notification API response to include `actor.avatarUrl`.
- [ ] **Bulk avatar import** — Admin can upload a ZIP or folder of images named by email/assetTag. Matches to users/assets automatically. Useful for onboarding a new class of students.
- [ ] **Image resize on upload** — Client-side resize to max 256x256 before upload (using canvas). Reduces blob storage and improves load times. Apply to both user and asset images.
- [ ] **Avatar tooltip on hover** — All user avatars in stacks/groups show name + role on hover via shadcn `Tooltip`. Already partially implemented in `ShiftAvatarStack`.

### V1 features enhanced
- Color-coded fallbacks get an admin-configurable color override per user (optional field on User model)
- `AvatarGroup` gets a "show all" popover on click (currently just shows +N count)

### Cross-page connections
- User detail page: shows avatar in the page header + all places this user appears (recent shifts, active checkouts)
- Booking detail: requester avatar links to user detail

### Performance
- Client-side image resize eliminates oversized uploads
- `AvatarImage` uses `loading="lazy"` for below-fold avatars in lists

### API changes
- `POST /api/users/[id]/avatar` — new (admin avatar management)
- `GET /api/notifications` — extend response to include `actor.avatarUrl`
- `POST /api/avatars/bulk-import` — new (admin bulk upload)

### Schema changes
- None required. `User.avatarUrl` and `Asset.imageUrl` already exist.
- Optional: `User.avatarColor` (String?) for admin color override — but can defer.

---

## V3 — Smart & Contextual

**Principle:** Avatars become contextual information carriers, not just profile pictures.

### Features
- [ ] **Role badge overlay** — Tiny "A"/"S"/"ST" badge on avatar corner in admin views (shift assignment, user list). Helps distinguish staff from students at a glance without reading text.
- [ ] **Shift area badge on avatar** — In schedule views, overlay a small colored dot (Video=green, Photo=purple, etc.) on the user's avatar to show their primary area assignment.
- [ ] **Avatar-based quick actions** — Click any user avatar anywhere in the app to see a quick-action popover: view profile, start checkout for this user, view their shifts, send notification. Uses shadcn `Popover` with action list.
- [ ] **Team roster view** — New `/users/team` view showing all active users as an avatar grid (like Slack's team view). Click to assign shifts, view checkout history. Filterable by role and area.
- [ ] **Collaborative awareness** — Show "currently viewing" avatar indicators on booking detail and event detail pages (who else is looking at this right now). Uses polling against session data.
- [ ] **Avatar in audit log** — Audit log entries show actor avatar alongside the action description for faster visual scanning.

### Automation
- Auto-assign avatar colors to new users on creation (no admin action needed)
- Auto-cleanup orphaned blob images (nightly cron: find blob URLs not referenced by any User or Asset)

### Integration
- Avatar system becomes a shared component library used by all entity types (users, assets, locations, events)

---

## Dependencies

### V1
- **Schema:** None
- **Components:** New `src/lib/avatar.ts` utility file
- **APIs:** None (all data already available)
- **Pages:** Updates to ShiftDetailPanel, ListView, dashboard-avatars, BookingCard

### V2
- **Schema:** Optional `User.avatarColor` field (migration)
- **APIs:** `POST /api/users/[id]/avatar`, `POST /api/avatars/bulk-import`, notification response extension
- **Components:** Image resize utility (client-side canvas)

### V3
- **Schema:** None
- **APIs:** Session-based presence polling endpoint
- **Pages:** New `/users/team` route
- **Components:** `AvatarQuickActions` popover, `PresenceDot` overlay

---

## Risks

| Risk | Version | Mitigation |
|------|---------|-----------|
| Color-coded fallbacks look garish with certain color combos | V1 | Use muted, desaturated palette. Test with 20+ names. |
| Scope creep: crop UI feels like a V1 requirement | V1 | Client-side resize (V2) is sufficient. Crop is YAGNI. |
| Bulk import could corrupt data if name matching is fuzzy | V2 | Require exact email match. Show dry-run preview before applying. |
| Presence indicators add polling overhead | V3 | Only on detail pages (not lists). Poll every 30s, not real-time. |
| Team roster view duplicates users page | V3 | Different layout (grid vs table). Could be a tab on users page instead. |
| Avatar quick-action popover could conflict with existing click handlers | V3 | Use long-press on mobile, right-click on desktop. |

---

## Build Order

### V1 (1-2 sessions)
1. Extract `src/lib/avatar.ts` — `getInitials()` + `getAvatarColor()` hash function
2. Update `AvatarFallback` usage across all components to use color-coded backgrounds
3. Wire `AvatarImage` into ShiftDetailPanel picker + ListView shift rows
4. Create `EmptySlotAvatar` component, replace custom dashed divs
5. Audit mobile tap targets, bump interactive avatars to ≥ 44px
6. `npm run build` + visual regression check

### V2 (2-3 sessions)
1. `POST /api/users/[id]/avatar` route + RBAC
2. Client-side image resize utility
3. Admin avatar upload UI on user detail page
4. Notification actor avatar extension
5. Bulk import API + dry-run UI
6. `AvatarGroup` click-to-expand popover

### V3 (3-4 sessions)
1. Role badge overlay component
2. Avatar quick-action popover
3. Team roster grid view
4. Presence polling endpoint + indicator
5. Audit log avatar display

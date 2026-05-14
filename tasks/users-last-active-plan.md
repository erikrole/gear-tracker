# Users Last Active Plan - 2026-05-13

## Goal
- Show a real "Last active" signal on the Users page so staff/admins can tell when each roster member last used the app.

## Source Checks
- `AGENTS.md`: non-trivial work needs a plan first, thin slices, exact verification, and docs synced with shipped functionality.
- `docs/AREA_USERS.md`: Users page is the owner area. All roles can view users; staff/admin can manage users. The current change log lists Users list, detail, Add User, avatar, and contact-profile slices as shipped.
- `docs/DECISIONS.md`: D-007 treats audit logging as product behavior, and D-011 keeps role visibility predictable. Last-active tracking should not weaken the existing Users read model.
- `docs/GAPS_AND_RISKS.md`: no open users gap currently tracks last-active display; `notificationPrefs` already exists on `User`, which means the old V3 roadmap schema note is partly stale.
- `prisma/schema.prisma`: `User` has `createdAt`, `updatedAt`, `active`, `notificationPrefs`, and session relation fields, but no `lastActiveAt`. `Session` has `createdAt` and `expiresAt` only, so a current "last active" value cannot be derived accurately from sessions.
- `tasks/users-roadmap.md`: V3.1 already sketches `lastActiveAt`, debounced authenticated updates, list display, and sort options. For this slice, keep the stale-user filter and automation pieces deferred.
- `src/lib/auth.ts`: `requireAuth()` is the central authenticated request path and already checks active users. It is the right place to update `lastActiveAt` with a debounce.
- `src/app/api/users/route.ts`: `GET /api/users` owns list query, sorting, and response shaping. It currently returns no last-active field and supports sort keys for name, role, email, and created date.
- `src/app/(app)/users/page.tsx`, `UserRow.tsx`, and `types.ts`: the desktop table has five columns and mobile cards show compact user metadata. Both need the new field, but mobile should stay lightweight.

## Slices
- [x] Slice 1: Schema and auth tracking
  - Add nullable `User.lastActiveAt DateTime? @map("last_active_at")` with a migration.
  - Update `requireAuth()` to refresh `lastActiveAt` only when null or older than 5 minutes.
  - Keep the update best-effort or isolated from auth success so a transient write failure does not block every authenticated read, while still logging enough for diagnosis if the existing patterns support it.
- [x] Slice 2: Users API contract
  - Return `lastActiveAt` from `GET /api/users`.
  - Add `lastActive` and `lastActive_desc` sort keys using a stable secondary sort, likely `name`, so nulls and ties are predictable.
  - Decide whether `GET /api/users/[id]` should also return `lastActiveAt` for consistency; if changed, document the field in the same slice.
- [x] Slice 3: Users list UI
  - Extend `UserRow` and `ListResponse` types with `lastActiveAt`.
  - Add a desktop sortable "Last active" column using the existing `SortableHead` pattern.
  - Show relative copy like `2h ago`, `3d ago`, or `Never`; mobile can include a compact metadata line only if it stays readable.
  - Keep visibility simple for this slice: the Users page is already broadly readable by role, and the user request is about the users page rather than a private profile detail.
- [x] Slice 4: Tests and docs
  - Add focused coverage for auth debounce behavior and `/api/users` response/sort behavior.
  - Update `docs/AREA_USERS.md` change log after implementation.
  - Update `tasks/users-last-active-plan.md` review with shipped, verified, and deferred notes.

## Verification
- [x] `npx prisma format`
- [x] `npx prisma generate`
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] `npx vitest run tests/auth-last-active.test.ts tests/users-route.test.ts tests/api-wrapper.test.ts`
- [x] `npx tsc --noEmit`
- [x] `git diff --check`
- [x] `npx next build`
- [ ] Browser smoke on `/users`, including default sort and `?sort=lastActive_desc`.

## Stop Conditions
- Stop and re-plan if Prisma migration generation is blocked by Neon/schema-engine behavior instead of using an ad hoc migration workaround.
- Stop and re-plan if `withAuth` is a better update location than `requireAuth()` after reading `src/lib/api.ts`, because the implementation should not update activity for server-rendered page guards in a way that creates noisy writes.
- Stop and re-plan if the product decision changes from "last authenticated app activity" to "last meaningful operational action"; that would use audit logs or domain events instead of request activity.

## Review
- Shipped: Added nullable `User.lastActiveAt`, debounced authenticated activity updates, `GET /api/users` last-active response/sort support, and a sortable Last active roster column with compact mobile metadata.
- Verified: Prisma format/generate/validate, migration-prefix check, focused auth/users/API wrapper tests, TypeScript, whitespace check, and app-only Next production build passed.
- Deferred: Authenticated browser smoke is blocked until the new migration is applied to the Neon database. Unauthenticated navigation to `/users?sort=lastActive_desc` redirects to `/login` with no console errors.

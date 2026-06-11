# Plan 021: Route the sidebar user avatar through the shared UserAvatar wrapper

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/components/Sidebar.tsx src/components/UserAvatar.tsx src/components/ui/avatar.tsx tests docs/AREA_USERS.md plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `c90837ce`, 2026-06-11

## Why this matters

The app already has a shared `UserAvatar` wrapper around the shadcn avatar primitive, but the sidebar still composes `Avatar`, `AvatarImage`, and `AvatarFallback` directly. That leaves one high-visibility user avatar outside the shared initials, fallback, and color behavior. Moving the sidebar through `UserAvatar` makes user avatar rendering easier to audit before more avatar surfaces are added.

## Current state

- `src/components/ui/avatar.tsx` is the shadcn avatar primitive wrapper. It exports `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarGroup`, and `AvatarGroupCount`.
- `src/components/UserAvatar.tsx` is the app user wrapper:

```tsx
// src/components/UserAvatar.tsx:3-5
import { Avatar, AvatarFallback, AvatarImage, type AvatarSize } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { avatarColorClass, getInitials } from "@/lib/avatar";
```

```tsx
// src/components/UserAvatar.tsx:28-39
export function UserAvatar({
  name,
  initials,
  avatarUrl,
  size = "default",
  className,
  fallbackClassName,
  noColor = false,
}: UserAvatarProps) {
  const displayInitials = initials ?? getInitials(name);
  return (
    <Avatar size={size} className={className}>
```

- `src/components/Sidebar.tsx` is the only app-level file found importing the shadcn avatar primitive directly outside the shared wrappers:

```tsx
// src/components/Sidebar.tsx:7
import { getInitials } from "@/lib/avatar";

// src/components/Sidebar.tsx:17
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
```

```tsx
// src/components/Sidebar.tsx:138
const userInitials = user ? getInitials(user.name) : "U";
```

```tsx
// src/components/Sidebar.tsx:194-202
<Avatar className="size-7 shrink-0 ring-1 ring-white/[0.15] bg-white/[0.08] group-data-[collapsible=icon]:mx-auto">
  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
  <AvatarFallback
    className="bg-transparent text-white/80 text-[length:var(--text-2xs)] font-bold"
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {userInitials}
  </AvatarFallback>
</Avatar>
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused test | `npm run test -- tests/shadcn-avatar-contracts.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| App build | `npm run build:app` | exit 0, Next app builds |
| Diff hygiene | `git diff --check` | exit 0, no whitespace errors |

Do not run `npm run build` for this plan unless the operator explicitly asks. In this repo it runs Prisma migration deploy first.

## Scope

**In scope**:
- `src/components/Sidebar.tsx`
- `tests/shadcn-avatar-contracts.test.ts` (create if absent)
- `docs/AREA_USERS.md`
- `plans/README.md`

**Out of scope**:
- `src/components/UserAvatar.tsx` behavior changes. This plan consumes the wrapper; it does not redesign it.
- Item thumbnail or `AssetImage` changes. Those are covered by plans 022 and 023.
- Global sidebar design changes unrelated to the avatar.

## Steps

### Step 1: Replace the direct sidebar avatar composition

In `src/components/Sidebar.tsx`:

1. Remove `getInitials` from `@/lib/avatar`.
2. Remove `{ Avatar, AvatarImage, AvatarFallback }` from `@/components/ui/avatar`.
3. Import `UserAvatar` from `@/components/UserAvatar`.
4. Remove the `userInitials` local.
5. Replace the inline `<Avatar>` block with `UserAvatar`, preserving the dark sidebar visual treatment:

```tsx
<UserAvatar
  name={user.name}
  avatarUrl={user.avatarUrl}
  size="default"
  noColor
  className="size-7 shrink-0 ring-1 ring-white/[0.15] bg-white/[0.08] group-data-[collapsible=icon]:mx-auto"
  fallbackClassName="bg-transparent text-white/80 text-[length:var(--text-2xs)] font-bold [font-family:var(--font-heading)]"
/>
```

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Add a source contract for shadcn avatar ownership

Create or extend `tests/shadcn-avatar-contracts.test.ts` using `node:fs` and `node:path`, following the source-contract style used elsewhere in this repo. Cover these checks:

- `src/components/Sidebar.tsx` imports `UserAvatar`.
- `src/components/Sidebar.tsx` does not import from `@/components/ui/avatar`.
- `src/components/Sidebar.tsx` does not import `getInitials`.
- The only direct imports from `@/components/ui/avatar` in `src/components` are:
  - `src/components/UserAvatar.tsx`
  - `src/components/UserAvatarGroup.tsx`
  - `src/components/ui/avatar.tsx`

Do not scan `node_modules`, `.next`, or generated files.

**Verify**: `npm run test -- tests/shadcn-avatar-contracts.test.ts` -> exit 0, all tests pass.

### Step 3: Sync docs

Update `docs/AREA_USERS.md` with a short changelog entry saying the sidebar user avatar now routes through the shared `UserAvatar` wrapper and shadcn avatar primitive. Keep it factual and scoped.

**Verify**: `git diff --check` -> exit 0.

### Step 4: Final verification

Run:

```bash
npm run test -- tests/shadcn-avatar-contracts.test.ts
npx tsc --noEmit
npm run build:app
git diff --check
```

All commands must exit 0.

## Done criteria

- [ ] `src/components/Sidebar.tsx` uses `UserAvatar` for the current-user avatar.
- [ ] `src/components/Sidebar.tsx` has no direct shadcn avatar import and no `getInitials` import.
- [ ] A source contract protects the sidebar from regressing back to direct avatar composition.
- [ ] `docs/AREA_USERS.md` records the shipped behavior.
- [ ] `npm run test -- tests/shadcn-avatar-contracts.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` all pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- `Sidebar.tsx` no longer contains the inline avatar block shown above.
- `UserAvatar` cannot preserve the current sidebar appearance without changing its public behavior.
- The source contract reveals additional direct shadcn avatar consumers that are not wrappers or the primitive itself.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- This is intentionally a small cleanup. Do not broaden it into avatar color redesign.
- Plan 022 is the item-thumbnail equivalent and should be done separately.

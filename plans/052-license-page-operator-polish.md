# Plan 052: Make the license page a clearer operator queue

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md` unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat dacc567c..HEAD -- 'src/app/(app)/licenses/page.tsx' 'src/app/(app)/licenses/LicenseTable.tsx' 'src/app/(app)/licenses/MyLicensePanel.tsx' 'src/app/(app)/licenses/AdminClaimSheet.tsx' 'src/app/(app)/licenses/AddLicenseDialog.tsx' 'src/app/(app)/licenses/BulkAddSheet.tsx' 'src/app/(app)/licenses/BulkRenewDialog.tsx' 'src/app/(app)/licenses/types.ts' docs/AREA_LICENSES.md tests`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `dacc567c`, 2026-06-15

## Why this matters

The Photo Mechanic license pool is already functionally strong: it supports the V2 two-slot model, masked codes, unknown occupants, expiry tracking, bulk renewal, CSV export, and audit logging. The next leverage is not new schema. It is making the page behave like an operator queue: visible filters, actionable health metrics, stale-data recovery, clearer expiry attention, and shadcn-aligned forms.

This plan keeps the existing data contracts intact. It upgrades the web surface so staff can answer "what needs attention?" faster and students get clearer claim/copy/release feedback without weakening the existing custody rules.

## Current state

Relevant files:

- `docs/AREA_LICENSES.md`: source of truth for license rules, visual states, API surface, and accepted gaps.
- `src/app/(app)/licenses/page.tsx`: page owner; fetches current user, all license codes, current user's claim, local `showRetired`, summary metrics, header actions, and dialogs.
- `src/app/(app)/licenses/LicenseTable.tsx`: table rows, masking, status badges, holders, expiry display, row click/keyboard affordances.
- `src/app/(app)/licenses/MyLicensePanel.tsx`: active license banner with code copy, history, release, and expiry warning.
- `src/app/(app)/licenses/AdminClaimSheet.tsx`: admin detail sheet for active slots, unknown occupant, details, danger actions, and history.
- `src/app/(app)/licenses/AddLicenseDialog.tsx`, `BulkAddSheet.tsx`, `BulkRenewDialog.tsx`: admin forms.
- `src/app/(app)/licenses/types.ts`: shared client-side license types.
- `tests/`: Vitest suite. This repo commonly uses source-contract tests for client UI behavior when jsdom/component rendering is not configured.

Source facts to preserve:

`docs/AREA_LICENSES.md:13-25`:

```md
## Core Rules
1. **Two slots per license code.** Activations fill naturally; positions are not meaningful (no "slot 1 vs slot 2" semantics).
2. **One slot per user across all codes.** A student cannot hold a slot on multiple licenses simultaneously.
3. **Active claims drive status.** Status is derived from count of active claims (`releasedAt IS NULL`):
...
6. **License codes only revealed to admins or the holder.** Other students see masked codes (`XXXX-••••-••••-XXXX`).
```

`docs/AREA_LICENSES.md:72-78` currently says partial rows are amber:

```md
### Visual states
- AVAILABLE row: tinted green, `cursor-pointer` if user has no claim
- PARTIAL row: tinted amber, `1/2` badge, claimable by anyone without a license
- CLAIMED row: tinted red, only admin/own holder can click
```

`src/app/(app)/licenses/page.tsx:84-151` currently keeps all page controls local and unfiltered:

```tsx
export default function LicensesPage() {
  const [claimTarget, setClaimTarget] = useState<LicenseCode | null>(null);
  const [adminTarget, setAdminTarget] = useState<LicenseCode | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
...
  const visibleCodes = showRetired ? allCodes : allCodes.filter((c) => c.status !== "RETIRED");
```

`src/app/(app)/licenses/page.tsx:24-80` computes a passive summary, but those metrics do not filter the table:

```tsx
function LicenseSummary({
  activeCodes,
  usedSlots,
  expiringCount,
  retiredCount,
  myLicense,
}: {
...
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <OperationalMetricCard label="Active codes" ... />
```

`src/app/(app)/licenses/LicenseTable.tsx:162-170` uses direct status tints and renders partial as blue, which conflicts with the area doc's amber row state:

```tsx
const rowClass = cn(
  "transition-colors",
  code.status === "AVAILABLE" && "bg-green-50/50 dark:bg-green-950/10",
  code.status === "PARTIAL" && "bg-blue-50/50 dark:bg-blue-950/10",
  code.status === "CLAIMED" && "bg-red-50/30 dark:bg-red-950/10",
```

`src/app/(app)/licenses/MyLicensePanel.tsx:31-42` detects expiry but always renders the active license card as green:

```tsx
const expiryMs = license.expiresAt ? new Date(license.expiresAt).getTime() : null;
const isExpired = expiryMs != null && expiryMs < Date.now();
const daysLeft = expiryMs != null ? Math.ceil((expiryMs - Date.now()) / 86_400_000) : null;
const isExpiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 30;
...
<Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 mb-6">
```

`src/app/(app)/licenses/ConfirmClaimDialog.tsx:31-40` and `MyLicensePanel.tsx:24-28` assume clipboard writes always work:

```tsx
await navigator.clipboard.writeText(code);
toast.success("License claimed and copied to clipboard", {
  description: code,
  duration: 6000,
});
```

`src/app/(app)/licenses/AdminClaimSheet.tsx:127-142` closes the sheet after adding an unknown occupant:

```tsx
toast.success("Unknown occupant recorded");
setOccupantLabel("");
onAction();
onOpenChange(false);
```

`src/app/(app)/licenses/AddLicenseDialog.tsx:69-114`, `BulkAddSheet.tsx:79-113`, and `BulkRenewDialog.tsx:95-126` use older `Label` + raw wrapper spacing forms. The local shadcn guidance says to use existing components first, compose rather than reinvent, use semantic colors, avoid `space-y-*`, and prefer form field primitives when available.

Verification baseline from recon:

- `package.json` scripts include `lint`, `test`, `db:migrate:check`, `build`, and `codemap:check`.
- `.github/workflows/ci.yml` runs `npm ci`, `npm audit --audit-level=high`, `npm test`, and `npm run build`.
- Existing source-contract UI tests include `tests/dashboard-accessibility.test.ts` and source reads inside `tests/booking-create-ux.test.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm test -- tests/license-page-operator-polish.test.ts` | exit 0; all new contract tests pass |
| Full tests | `npm test` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Migration prefix check | `npm run db:migrate:check` | exit 0 |
| Whitespace | `git diff --check` | no output, exit 0 |
| Production build | `npm run build` | exit 0; Next build succeeds |

Notes:

- `npm run build` runs `node scripts/prisma-migrate-deploy.mjs && next build`. If your local environment lacks DB env vars, set safe placeholder values the same way CI does. Do not commit env files.
- Do not run formatters as a substitute for targeted edits.

## Suggested executor toolkit

- Use the local shadcn guidance if available: `/Users/erole/GitHub/gear-tracker/.agents/skills/shadcn/SKILL.md`.
- Before installing any new shadcn component, run `npx shadcn@latest info --json` and check `src/components/ui/`. Prefer the installed components already present in `src/components/ui/`.
- You should not need a new component registry item for this plan unless the repo already has current `field` primitives installed. If it does not, do not install new components just to satisfy this plan. Keep the form polish scoped to layout, disabled state, labels, and clear copy.

## Scope

**In scope**:

- `src/app/(app)/licenses/page.tsx`
- `src/app/(app)/licenses/LicenseTable.tsx`
- `src/app/(app)/licenses/MyLicensePanel.tsx`
- `src/app/(app)/licenses/ConfirmClaimDialog.tsx`
- `src/app/(app)/licenses/AdminClaimSheet.tsx`
- `src/app/(app)/licenses/AddLicenseDialog.tsx`
- `src/app/(app)/licenses/BulkAddSheet.tsx`
- `src/app/(app)/licenses/BulkRenewDialog.tsx`
- `src/app/(app)/licenses/types.ts` only if a small shared UI type is useful
- `tests/license-page-operator-polish.test.ts` (create)
- `docs/AREA_LICENSES.md`
- `plans/README.md` status row only

**Out of scope**:

- Prisma schema changes or migrations. The V2 model already supports this pass.
- API response shape changes.
- Authorization changes.
- New full admin per-user license report.
- Claim-history pagination.
- iOS license surfaces.
- Any broad design-system refactor outside `/licenses`.
- Any change to code masking rules for non-holders/non-admins.

## Git workflow

- Branch: `improve-exec/052-license-page-operator-polish`.
- Commit style: conventional commits. Use `feat:` for the user-facing operator queue polish or `fix:` if you split out a specific bug fix.
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Add URL-owned license queue filters

Implement a small filter state in `src/app/(app)/licenses/page.tsx`.

Required behavior:

- Supported filter values: `all`, `open`, `partial`, `full`, `expiring`, `expired`, `retired`.
- Use a query param such as `?status=open`. Pick one param name and document it in code only if needed.
- Default is `all`.
- Unknown query-param values fall back to `all`.
- `retired` filter shows retired rows without requiring the old local-only `showRetired` state.
- Header retired toggle may remain, but it must update URL state rather than a local-only boolean.
- `BulkRenewDialog` must still receive the visible active code set that matches the operator's current visible table scope. Retired records stay excluded from renewal.
- Student users must not gain visibility into retired codes. The server list for students already excludes retired codes, so the UI must not add any new fetch path.

Recommended implementation shape:

- In the client page, use `useSearchParams`, `useRouter`, and `usePathname` from `next/navigation`.
- Create a local union type:

```ts
type LicenseQueueFilter = "all" | "open" | "partial" | "full" | "expiring" | "expired" | "retired";
```

- Create helpers in the same file:

```ts
const LICENSE_QUEUE_FILTERS = new Set<LicenseQueueFilter>([
  "all",
  "open",
  "partial",
  "full",
  "expiring",
  "expired",
  "retired",
]);
```

- Apply filter after `allCodes` is available. Keep the current default hidden-retired behavior for `all`: active records only.

Filter semantics:

- `all`: non-retired codes only.
- `open`: `status === "AVAILABLE"`.
- `partial`: `status === "PARTIAL"`.
- `full`: `status === "CLAIMED"`.
- `expiring`: non-retired with `expiresAt` in the future and `days <= 30`.
- `expired`: non-retired with `expiresAt` before now.
- `retired`: `status === "RETIRED"`.

Add an explicit empty state for no rows under a filter:

- Title: `No licenses match this filter`
- Description should name the active filter and offer to clear it.
- Action clears the query param back to `all`.

**Verify**: `npx tsc --noEmit` -> exit 0.

### Step 2: Make summary metrics actionable and visually aligned

Update `LicenseSummary` in `page.tsx` so metric cards act as filter controls.

Required behavior:

- Each metric card maps to a filter:
  - Active codes -> `all`
  - Slots in use -> `partial` or `full` is ambiguous, so do not make this card clickable unless you add a clear segmented child control. Simpler preferred path: leave it passive.
  - Open slots -> `open`
  - Expiring soon -> `expiring`
  - Retired -> `retired`
- Active filter must be visually indicated. Use existing component APIs first. If `OperationalMetricCard` does not support active state, wrap with a `button` that has clear `aria-pressed` and a subtle ring/background. Do not create a nested card inside a card.
- Use button semantics for clickable cards, not `div onClick`.
- Metric keyboard behavior must work naturally via the button.
- Keep the existing compact scan-friendly metrics.

Also update `LicenseTable.tsx` row color language:

- Align PARTIAL with the area doc's amber status instead of blue.
- Prefer existing Badge variants if available. If the local Badge variants do not include amber/orange, use existing semantic/tone classes already used elsewhere in this app. Avoid adding new one-off raw palettes beyond what this page already uses.
- Do not remove masking logic.

**Verify**: `npm test -- tests/license-page-operator-polish.test.ts` -> if the test does not exist yet, create it in Step 5 first, then run it. Until then, run `npx tsc --noEmit` -> exit 0.

### Step 3: Harden stale refresh and clipboard failure recovery

Update stale-data behavior in `page.tsx`:

- Current behavior has an all-empty error state when `codesError && allCodes.length === 0`.
- Add a visible inline alert/banner when `codesError` is present and `allCodes.length > 0`.
- The banner must say the list could not refresh and that visible rows may be stale.
- Include a retry button wired to `reloadAll`.
- Use existing shadcn `Alert` if already installed in `src/components/ui/alert.tsx`; otherwise use the existing `EmptyState` only for all-empty failure.

Update clipboard behavior:

- In `ConfirmClaimDialog.tsx`, if the claim succeeds but clipboard write fails, keep the success toast truthful. Suggested copy: `License claimed. Copy failed; copy the code from your license banner.`
- Do not fail the claim because clipboard failed.
- In `MyLicensePanel.tsx`, if active-code copy fails, show a toast with a useful message and keep the code visible.
- Guard `navigator.clipboard` access so the app does not throw in unsupported contexts.

**Verify**: `npx tsc --noEmit` -> exit 0.

### Step 4: Fix expiry attention and admin sheet continuity

Update `MyLicensePanel.tsx`:

- When expired, the card should use a destructive/attention tone, not the default green custody tone.
- When expiring soon, the card should use amber/attention tone.
- When not expiring, retain the current green custody tone.
- Keep the code visible to the holder/staff exactly as today.
- Do not remove history, copy, or release actions.

Update `AdminClaimSheet.tsx` unknown occupant flow:

- After adding an unknown occupant, keep the sheet open.
- Refresh page data via `onAction()`.
- Clear the occupant input.
- Refresh sheet-local history if needed. Since `onAction()` refreshes parent data asynchronously, be careful not to render stale slot count forever. Acceptable options:
  - keep sheet open and call `loadHistory()` after success, then rely on parent refresh to update `license.claims`;
  - or keep sheet open and show a small "Refreshing..." state until parent props update.
- Do not add optimistic claims unless you handle rollback on failure. Simpler preferred path: no optimistic mutation.

**Verify**: `npx tsc --noEmit` -> exit 0.

### Step 5: Add source-contract tests for the new queue behavior

Create `tests/license-page-operator-polish.test.ts`.

Use the existing source-contract pattern from `tests/dashboard-accessibility.test.ts` and `tests/booking-create-ux.test.ts`: read the relevant `.tsx` files and assert critical contracts that TypeScript cannot protect.

Minimum tests:

- `page.tsx` imports and uses `useSearchParams`, `usePathname`, and `useRouter`.
- `page.tsx` defines all expected filter values: `open`, `partial`, `full`, `expiring`, `expired`, `retired`.
- `page.tsx` renders an inline stale refresh state for non-empty stale data. Assert source contains a phrase such as `visible rows may be stale` or the exact final copy you choose.
- `LicenseTable.tsx` does not render PARTIAL rows with `bg-blue` or `variant="blue"`.
- `MyLicensePanel.tsx` has separate expired and expiring card tone branches, not one unconditional green class on the root card.
- `ConfirmClaimDialog.tsx` handles clipboard failure without throwing the claim away. Assert it catches around clipboard write or delegates to a helper that does.

Do not make the tests brittle against harmless whitespace. Prefer `toContain` and targeted regexes over full snapshots.

**Verify**: `npm test -- tests/license-page-operator-polish.test.ts` -> exit 0, all new tests pass.

### Step 6: Polish forms without broad component churn

Update admin forms only where it improves clarity and consistency:

- Replace `space-y-*` form wrappers with `flex flex-col gap-*` in license dialogs/sheets when touching those blocks.
- Ensure all icon buttons use the existing button/icon conventions from this repo.
- If `src/components/ui/field.tsx` already exists by execution time, migrate these small forms to `FieldGroup` / `Field` / `FieldLabel` only within the license files. If it does not exist, do not install a new component unless the operator explicitly asks. Use the existing `Label`, `Input`, `Textarea`, `RadioGroup`, `Dialog`, and `Sheet`.
- Do not change API payload fields.
- Keep button disabled/loading states intact.

Files likely touched:

- `AddLicenseDialog.tsx`
- `BulkAddSheet.tsx`
- `BulkRenewDialog.tsx`
- the details and unknown occupant blocks in `AdminClaimSheet.tsx`

**Verify**: `npx tsc --noEmit` -> exit 0.

### Step 7: Update docs and final verification

Update `docs/AREA_LICENSES.md`:

- Add a change-log entry dated 2026-06-15.
- Mention URL-backed queue filters, clickable health metrics, stale refresh recovery, clipboard-failure recovery, expiry banner tones, and admin unknown-occupant continuity if all shipped.
- If you intentionally defer any of those, do not claim it shipped.
- Keep the existing deferred gaps unless you actually implement them. This plan does not implement history pagination or full per-user admin reporting.

Run final verification:

1. `npm test -- tests/license-page-operator-polish.test.ts`
2. `npm test`
3. `npx tsc --noEmit`
4. `npm run db:migrate:check`
5. `git diff --check`
6. `npm run build`

Expected results:

- All commands exit 0.
- `npm run db:migrate:check` reports no duplicate migration prefix failure.
- `git diff --check` prints no whitespace errors.
- `npm run build` completes a production Next build.

## Test plan

Create `tests/license-page-operator-polish.test.ts` as a source-contract test.

Use these existing tests as patterns:

- `tests/dashboard-accessibility.test.ts` for small source-contract assertions using `readFileSync`.
- `tests/booking-create-ux.test.ts` for larger UI source-contract checks where direct component rendering is not configured.

Coverage expectations:

- Filter values and URL-state hooks are protected.
- Stale refresh copy is protected.
- Partial-row amber correction is protected against regression to blue.
- Expired/expiring active-license tone branching is protected.
- Clipboard failure handling is protected.

Do not add Playwright or jsdom setup in this plan. Browser smoke is useful after implementation, but it is not required to keep this plan bounded.

## Done criteria

All must hold:

- [ ] `src/app/(app)/licenses/page.tsx` has URL-backed filters for `all`, `open`, `partial`, `full`, `expiring`, `expired`, and `retired`.
- [ ] Summary metrics for open, expiring, retired, and all-active are clickable or keyboard-operable filter controls with clear active state.
- [ ] The table no longer uses blue as the PARTIAL status visual.
- [ ] A failed refresh with stale rows shows a visible inline stale-data recovery state.
- [ ] Clipboard failure after successful claim/copy is handled truthfully without undoing the claim.
- [ ] Active-license banner tone changes for expired and expiring licenses.
- [ ] Adding an unknown occupant keeps the admin sheet open and refreshes state.
- [ ] No license code masking rule is weakened.
- [ ] No API response shape changes.
- [ ] No Prisma schema or migration changes.
- [ ] New `tests/license-page-operator-polish.test.ts` exists and passes.
- [ ] `docs/AREA_LICENSES.md` change log reflects exactly what shipped.
- [ ] `plans/README.md` row for 052 is updated to DONE or BLOCKED.
- [ ] Final verification commands listed in Step 7 pass.

## STOP conditions

Stop and report back instead of improvising if:

- `src/app/(app)/licenses/page.tsx` has already been substantially redesigned and no longer matches the excerpts in this plan.
- The current app already has a different shared URL-state helper that license pages are expected to use. Use it only if it is obvious and already used by nearby app pages; otherwise stop and ask.
- The license API no longer returns all active claims per row, or the client no longer owns filtering.
- Implementing URL-backed filters requires server API changes.
- A correct implementation appears to require touching files outside the in-scope list.
- `npm test -- tests/license-page-operator-polish.test.ts` fails twice after reasonable fixes.
- `npm run build` fails for unrelated existing breakage. Record the exact failure and ask whether to proceed with focused verification only.

## Maintenance notes

- This plan intentionally does not add admin per-user license reporting or claim-history pagination. Those remain separate product/reporting work.
- If a future plan moves license listing filters server-side, preserve the same URL query contract so shared links continue to work.
- Reviewers should scrutinize the masking logic in `LicenseTable.tsx`: non-admin, non-holder users must never see real codes or other holders' names.
- Reviewers should also check the expiry date math once, because this page uses local `Date.now()` and day rounding for display-only attention states.
- Any future shadcn form migration should be done as a dedicated small pass if `field.tsx` becomes installed globally.

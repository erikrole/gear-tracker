# Trade Board Ownership Pass

Date: 2026-05-14

## Sources Checked
- `docs/AREA_SHIFTS.md`
- `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `prisma/schema.prisma`
- `src/components/TradeBoard.tsx`
- `src/app/(app)/schedule/page.tsx`
- `src/app/api/shift-trades/route.ts`
- `src/app/api/shift-trades/[id]/*/route.ts`
- `src/lib/services/shift-trades.ts`
- `tests/shift-trades.test.ts`
- Peer patterns: `/schedule/assign` assignment grid and `/notifications`

## Scenario Matrix
- [x] Student sees open trades by default, plus their own posted trades.
- [x] Student filters by area, status, and My Trades.
- [x] Student posts a shift from the normal Schedule list with optional notes.
- [x] Student claims someone else's open trade.
- [x] Student cancels their own open or claimed trade.
- [x] Staff reviews claimed trades and approves or declines.
- [x] Empty states distinguish no trades from no filtered matches.
- [x] Load failure preserves a retry path.
- [x] Auth redirect and network failures do not leave buttons stuck.
- [x] Duplicate clicks cannot fire competing trade mutations.
- [x] Invalid API filter values return controlled 400s.
- [x] Already-started shifts cannot be posted, claimed, approved, or counted as open board work.

## Confirmed Work
- The current table is too dense for a right-side sheet.
- Raw status labels and raw event titles do not match the current schedule polish.
- Trade cards need notes, approval context, shift-time context, and clearer action ownership.
- Mutation handlers need `finally` cleanup and a synchronous duplicate-submit guard.
- The list API should reject invalid `status` and `area` filters instead of silently widening or risking Prisma enum errors.

## Verification Plan
- [x] Focused trade service/API tests: `npx vitest run tests/shift-trades-route.test.ts tests/shift-trades.test.ts`
- [x] TypeScript: `npx tsc --noEmit`
- [x] Migration prefix check: `npm run db:migrate:check`
- [x] Whitespace check: `git diff --check`
- [x] Production build: `npx next build`
- [x] Browser smoke: Codex browser reached the local dev server and redirected to `/login` with no console errors. Authenticated sheet verification remains manual in the user's live browser session.

## Review
- Replaced the narrow six-column sheet table with card rows that show the event title, shift window, area, approval mode, posted date, poster, claimer, notes, and row-specific actions.
- Reused schedule event-title cleanup so Trade Board rows match list/week/calendar naming.
- Changed the normal Schedule list `Trade` shortcut from one-click posting to a small notes dialog with a visible error state.
- Closed stale trade edge cases: post, claim, approve, list, and header-count paths now reject or ignore already-started open/claimed trade work.
- Included event opponent/home-away fields in the Trade Board API payload so board titles use the same cleanup as normal Schedule rows.
- Kept student claim actions student-facing, while staff/admin focus on approving or declining claimed trades.
- Added `finally` cleanup and a ref-backed duplicate-submit guard to every mutation path.
- Added route validation for status and area filters before the service query runs.

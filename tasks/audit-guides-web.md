# Audit: /guides (web) — 2026-04-25

**MVP verdict:** READY — all P0/P1/P2 closed (parity informational)
**Ship bar:** all staff + students, zero hiccups

## P0 — blocks MVP
*(none)*

## P1 — polish before ship
- [x] [Flows] Cancel / "Back to guide" / sidebar nav silently discards unsaved edits — `beforeunload` only fires on full page unload, not Next.js client navigation. — `src/app/(app)/guides/[slug]/edit/page.tsx:110-116, 250-256`
      Why: A staff member who clicks Cancel mid-edit loses work with no confirmation. Common, reversible-feeling action that isn't reversible.
      Suggested fix: Wrap Cancel in an `AlertDialog` when `dirty`; same for the Back link (or convert to button that confirms then `router.push`).

- [x] [Flows] Reader shows "Edit" to every STAFF, but STAFF can only edit guides they authored — clicking Edit on someone else's guide opens the editor and fails with 403 on Save. — `src/app/(app)/guides/[slug]/page.tsx:28` and `src/app/(app)/guides/[slug]/_components/GuideReader.tsx:185-192`
      Why: Dead-end / confusing flow on the staff golden path. Server PATCH already enforces (`src/lib/guides.ts:131-133`), but UI invites failure.
      Suggested fix: Compute `canEdit = ADMIN || (STAFF && guide.authorId === user.id)` server-side and pass through; hide the Edit button otherwise.

- [x] [Flows] Table-of-contents matches headings by exact `textContent` — duplicate heading text breaks scroll-to and active highlighting. — `src/app/(app)/guides/[slug]/_components/GuideReader.tsx:50-60, 134-142`
      Why: Real SOPs reuse short labels ("Setup", "Notes", "Examples"). With duplicates, ToC clicks scroll to the wrong block and the active indicator latches onto the first match.
      Suggested fix: Track headings by index/id; emit anchor refs on each `.bn-block-content` heading and scroll/observe by id rather than text.

- [x] [Hardening] `/api/guides/upload-image` has no rate limit and a 10MB cap per file — a single staff session can fill Vercel Blob quota. — `src/app/api/guides/upload-image/route.ts:6-30`
      Why: No throttle on a write endpoint that incurs real $/GB. Even non-malicious paste-bombing of large screenshots accumulates fast.
      Suggested fix: Add per-user rate limit (e.g. 30 uploads / 5 min) using the existing rate-limit util; consider a tighter byte cap per minute.

## P2 — post-MVP
- [x] [Gaps] Schema has `order: int` for manual sort but no UI to reorder; AC-3 covers categories only, so this is dead schema. Decide: add reorder UI or drop the field. — `prisma/schema.prisma` (Guide), `src/lib/guides.ts:67`
- [x] [Breaking] Concurrent edits on the same guide: last-write-wins silently. No `updatedAt` precondition or version check on PATCH. — `src/lib/guides.ts:141-152`
- [x] [UI polish] Empty-state when filters return no results offers no "Clear filters" action — student dead-ends if they typo a search. — `src/app/(app)/guides/page.tsx:107-118`
- [x] [UI polish] Brief flash of editor UI on `/guides/new` and `/guides/[slug]/edit` for STUDENT before the `useFetch('/api/me')` resolves and redirects. — `src/app/(app)/guides/new/page.tsx:107-110`, `src/app/(app)/guides/[slug]/edit/page.tsx:171-174`
      Suggestion: gate the page server-side via `requireAuth` + role check (already used on the reader) and have the client component render only authorized state.
- [x] [Hardening] `/api/guides/[id]` GET hits `getGuide()` first (which throws on a slug) then falls back to `getGuideBySlug()` — two DB reads on every slug lookup. Detect cuid format and route directly. — `src/app/api/guides/[id]/route.ts:13-18`
- [x] [Parity] iOS app has no Guides surface at all; deferred per project plan. Not blocking student golden path on web.

## Acceptance criteria status (from AREA_GUIDES.md)
- [x] AC-1 Staff can create/edit/publish/delete in-app — `src/app/(app)/guides/new/page.tsx`, `…/[slug]/edit/page.tsx`
- [x] AC-2 Students see published only — enforced at `src/app/api/guides/route.ts:17` and `src/app/(app)/guides/[slug]/page.tsx:24`
- [x] AC-3 Category filter chips reduce list — `src/app/(app)/guides/page.tsx:81-98`
- [x] AC-4 BlockNote rich content — `…/_components/GuideReader.tsx:96-100`
- [x] AC-5 Mobile-clean reader — `max-w-5xl`, ToC hidden under `lg:` — `…/_components/GuideReader.tsx:65, 154`
- [x] AC-6 Mutations audit-logged — `src/app/api/guides/route.ts:35-42`, `…/[id]/route.ts:35-43, 54-61`
- [x] AC-7 `npm run build` passes — last shipped 2026-04-15 per change log

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- `docs/AREA_GUIDES.md`
- `src/app/(app)/guides/page.tsx`
- `src/app/(app)/guides/[slug]/page.tsx`
- `src/app/(app)/guides/[slug]/_components/GuideReader.tsx`
- `src/app/(app)/guides/new/page.tsx`
- `src/app/(app)/guides/[slug]/edit/page.tsx`
- `src/app/api/guides/route.ts`
- `src/app/api/guides/[id]/route.ts`
- `src/app/api/guides/upload-image/route.ts`
- `src/lib/guides.ts`
- `src/lib/validation.ts` (createGuideSchema/updateGuideSchema)
- `src/lib/permissions.ts` (guide policy)

## Notes
- No `BRIEF_GUIDES*` or `tasks/guides-*` plan present in working tree (referenced as archived); audit relied on `AREA_GUIDES.md` + code.
- `docs/GAPS_AND_RISKS.md` not consulted in detail — quick grep showed no open Guides items; recheck before shipping fixes.

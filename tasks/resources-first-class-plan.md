# Resources Landing Cleanup Plan - 2026-06-29

## Goal

Make `/resources` feel like the Creative Guide library first. The landing page should help people find a guide, search across guide content, and quickly copy the one Media Drive server path without making contacts, assignments, buildings, or server paths compete with the guide library.

## Route

- Owner area: Resources
- Ledger: `tasks/resources-first-class-plan.md`
- Existing plan/archive references: `tasks/archive/guides-plan.md`, `tasks/archive/guides-knowledge-base-plan.md`, `tasks/archive/completed-2026-06/resources-rename-mvp-plan-2026-06-12.md`
- Current execution stance: Slices 1-5 shipped locally after user asked to keep moving and building

## Product Decisions Locked From Discussion

- Guides are the primary product on the landing page.
- Contacts and sport assignments are reference material, not major page sections.
- The server path is one copy/paste value. It should be a small top-right utility that looks like a server path and copies on click.
- Building numbers are deferred. Do not show an empty Buildings bucket just because the enum exists.
- Remove pinned/featured treatment from the landing page. No "pinned" section, no "featured guides" section.
- Keep visible verification badges out of the cleaned UI. Verification metadata and Mark verified can remain editor/metadata behavior.
- Avoid empty taxonomy walls. Only show meaningful guide filters or populated groupings.

## Source Checks

- `docs/AREA_RESOURCES.md` says Resources is a Markdown Guide library with live contacts support, typed focus metadata, role/area targeting, and URL-backed filters.
- `prisma/schema.prisma` already has `ResourceType`, including `CONTACTS`, `BUILDING_NUMBERS`, `MEDIA_DRIVE`, `SERVER_PATHS`, `SOP`, `HOW_TO`, `TROUBLESHOOTING`, `ACCOUNT_NOTE`, `EVENT_OPS`, and `GENERAL`.
- `prisma/schema.prisma` already has `User.sportAssignments` and `StudentSportAssignment`, so sport assignments should be sourced from user/profile assignment data instead of authored Markdown.
- `src/app/(app)/resources/page.tsx` previously computed `featuredGuides`, rendered Guide collection tiles, area guide lanes, Recently updated, Team contacts, and All guides on the home view.
- `src/lib/guide-categories.ts` currently describes Server paths as a full typed category. The cleanup should keep the type for compatibility and authoring, but stop making it a large home-page destination when the current operational need is one copyable path.
- `tasks/lessons.md` records the correction that copy-only references should be small utilities and that visible freshness badges add clutter.

## Landing Page Concept

### Header

- Left: `Resources` title and one plain sentence: "Find Creative guides, contacts, assignments, and the Media Drive path."
- Right: compact utility stack:
  - `New guide` for Staff/Admin.
  - `smb://ath01-nas.uwia.wisc.edu/users/` copy button styled like a code/path control, with copy feedback.
- No hero cards. No pinned block.

### Primary Guide Surface

- Top toolbar stays search-first:
  - Search input.
  - Guide focus filter.
  - Sort.
  - Cards/list layout.
  - Clear filters when active.
- The first content section is `Guides`.
- On the all/home view, show the full guide results immediately. Do not put collection tiles, featured guides, contacts, or reference cards above the guide results.
- Default sort can stay Recommended if the ranking is useful, but visual priority should come from the result list, not from featured/pinned sections.
- Cards should emphasize title, type, summary, audience/area if useful, author, and updated date. Avoid visible Verified/Needs review badges.

### Reference Strip

- Below or beside the guide results, show compact references:
  - Contacts: small summary module with search/filter entry and a `View contacts` action, not a full grid on the default landing page.
  - Sport assignments: read-only summary module sourced from user sport assignments, grouped by sport with assigned people count and a link to the fuller reference view.
- References should not duplicate the guide browsing controls.
- If a reference has no data, omit it from the default landing page instead of showing an empty block.

### Deferred Surfaces

- Buildings stay out of the home page until there is real content and a known lookup workflow.
- Server paths do not need a section while the job is one copied value.
- Media Drive can remain a guide type for authored "how the drive is organized" content, but it should not be confused with the top-right server-path utility.

## Target Information Architecture

- `/resources`
  - Header with server path copy utility.
  - Search/filter toolbar.
  - Guide results as the main body.
  - Compact reference strip for Contacts and Sport assignments.
- `/resources?filter=contacts`
  - Full contact reference view, profile-backed.
  - Authored contact guides can still appear, but live profiles remain the source for phone, email, Slack, area, and location.
- `/resources?filter=assignments`
  - Full sport assignment reference view, user/profile-backed.
  - First slice can be read-only and simple. Editing remains owned by existing Users/profile assignment controls unless a later slice proves Resources should own edits.
- `/resources?filter=media-drive`
  - Authored Media Drive guides only.
- `/resources?filter=server-paths`
  - Keep URL compatibility. Either redirect/normalize to the home page with the copy utility visible, or show a filtered guide view only when authored server-path guides exist.
- `/resources?filter=building-numbers`
  - Keep URL compatibility, but hide from home page and show a useful empty state only if directly linked.

## Stop Conditions

- Stop if the server path value is not available in source or agreed config. Do not invent a second source of truth silently.
- Stop if `/api/resources` or `/api/users` response shape does not provide the fields needed for contacts or sport assignments.
- Stop if sport assignment data is not safe to expose to all authenticated users. Verify existing Users visibility rules first.
- Stop if an implementation requires a schema migration just to clean up the landing page. This should be a UI/API read slice unless the source contract proves otherwise.
- Stop if browser smoke cannot authenticate. Record the blocker and run source-contract checks instead, but do not claim visual proof.

## Slices

### Slice 1: Guide-First Landing Cleanup

- Remove the home-page Featured guides section.
- Remove the home-page Guide collection tile wall.
- Keep the toolbar, URL-backed filters, cards/list toggle, and active filter chips.
- Make `Guides` the first and dominant section on the all/home view.
- Hide empty type buckets from the default landing page.
- Keep legacy filter URLs working for `view=`, `area=`, `server-paths`, and `building-numbers`.

### Slice 2: Server Path Utility

- Add a compact copyable server path control in the Resources header action area.
- Use the current Creative Media Drive path value: `smb://ath01-nas.uwia.wisc.edu/users/`.
- Provide accessible copy feedback.
- Keep it visually small. This is a utility, not a card.
- If later needed, move the value to a narrow config source, but do not add schema for this cleanup unless required.

### Slice 3: Reference Modules

- Convert default Contacts from a full card grid into a compact reference module.
- Add a compact Sport assignments reference module sourced from `StudentSportAssignment` and user profiles.
- Add or reuse a full reference view for contacts and assignments behind filters/actions.
- Keep Contacts and assignments below or beside Guides. They should support lookup, not lead the page.

### Slice 4: Guide Card And List Polish

- Tighten guide cards/list rows around the actual decision points: title, type, short summary, target area/audience, author, updated date.
- Keep visible verification badges removed.
- Revisit card density, empty states, and mobile wrapping.
- Use existing shadcn/ui primitives and local operational components.

### Slice 5: Docs And Verification

- Update `docs/AREA_RESOURCES.md` to match the cleaned landing-page reality.
- Update this plan review after each shipped slice.
- Run focused Resources tests and TypeScript.
- Run docs verification when docs/codemaps are touched.
- Run authenticated browser smoke for `/resources`, `/resources?filter=contacts`, `/resources?filter=assignments`, `/resources?filter=media-drive`, direct `server-paths`, and direct `building-numbers` compatibility paths.

## Verification Plan

- [x] `npx vitest run tests/resources-filters.test.ts`
- [x] Add or update source tests for any new `assignments` filter and server-path utility behavior.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run codemap` if codemap-owned files change.
- [x] `npm run verify:docs` if docs/codemaps/routes change.
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Authenticated browser smoke for touched Resources routes, or record why unavailable.

## Open Plan Checkpoint

- [x] Current Resources direction captured after user corrections.
- [x] User approves this cleanup plan before implementation.
- [x] Slice 1 shipped.
- [x] Slice 2 shipped.
- [x] Slice 3 shipped.
- [x] Slice 4 shipped.
- [x] Slice 5 closeout completed.

## Review

- 2026-06-29: Plan refocused around the corrected Resources IA: Guides first, no pinned/featured treatment, server path as a top-right copy utility, contacts and sport assignments as compact references, buildings deferred, and verification badges removed from visible guide chrome.
- 2026-06-29: Slices 1-5 shipped locally. `/resources` now starts with Guides, no longer renders the Guide collection tile wall or Featured guides block, includes a compact copyable Media Drive server path in the header, shows Contacts plus Sport assignments as compact supporting references, and exposes a read-only `filter=assignments` reference view backed by `/api/users` sport assignment rows. Focused Resources/Users tests, TypeScript, docs/codemap verification, focused whitespace checks, and `npm run build:app` passed. Local route smoke against the built app confirmed `/resources`, `filter=contacts`, `filter=assignments`, and `filter=server-paths` are protected and redirect to `/login`; full authenticated visual smoke still needs a localhost session.
- 2026-06-28: Resources gained a typed `ResourceType` contract, migration `0087_resource_type`, API/service validation for typed Guide focus, legacy category/type inference, and source tests for typed focus plus URL filter/layout compatibility.
- 2026-06-28: `/resources` was rebuilt as a first-class Guide library with guide collection tiles, cards/list layout, Creative-area guide lanes, active filter chips, and supporting live Contacts. `/resources/new`, `/resources/[slug]/edit`, and `/resources/[slug]` expose Guide focus and use Guide-language copy.
- 2026-06-28: Verification passed: `npx vitest run tests/resource-types.test.ts tests/resources-filters.test.ts`, `npx prisma format`, `npx prisma generate`, `npm run db:migrate:check`, `npx tsc --noEmit`, `npm run codemap`, `npm run verify:docs`, `git diff --check`, and `npm run build:app`.
- 2026-06-28: Authenticated browser smoke logged in as the seeded admin and confirmed `/resources` renders the new Guide library shell, collection tiles, layout control, Contacts section, and empty All Guides state. Full runtime smoke was blocked until the current Neon database has `0087_resource_type` applied; `/api/resources` returned Prisma P2022 because `resources.type` was not present yet.

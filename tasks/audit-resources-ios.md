# Audit: resources (iOS) - 2026-06-30

**MVP verdict:** ships for native read-only guide consumption
**Ship bar:** fast native browsing and reading, no authoring or verification controls
**Audit type:** static source plus focused contract tests

## Scope check
Native iOS now has `ios/Wisconsin/Views/GuidesView.swift`, reachable from compact Browse, compact Profile/Settings > Directory fallback, and the regular-width sidebar. The screen uses the existing read-only Resources route:

- `GET /api/resources`

The native scope is guide consumption only: load published/visible resources, search locally, filter by focus, sort, pull to refresh, and read Markdown content. Authoring, deletion, verification, image upload, Contacts references, and sport-assignment reference tools remain web-owned.

## P0 - blocks MVP
_None._

## P1 - polish before ship
- [x] [Flows] **Guides must not force a sixth compact tab.** Compact iPhone reaches Guides through the grouped Browse menu and Settings > Directory fallback. Regular-width iPad gets the sidebar-only Guides destination.

- [x] [Safety] **Native Guides must stay read-only.** The iOS API client only calls `GET /api/resources` for Guides and does not call upload, create, update, delete, or verification routes.

- [x] [Performance] **List loading must avoid extra network churn.** `GuidesViewModel` keeps a short freshness window, supports pull-to-refresh for explicit reloads, and filters/sorts locally after the first load.

- [x] [Reader] **Markdown should render natively enough for field use.** The reader handles headings, lists, quotes, code/table blocks, dividers, image links, and inline Markdown without a web view.

- [x] [Failure states] **Network and empty states must be clear.** The page uses native `ContentUnavailableView` surfaces and retry actions for load failures and no-result searches.

## P2 - post-MVP
- [ ] [Parity] Full native resource authoring, verification, file/image management, Contacts references, and sport-assignment reference tools. Deferred to the web Resources control room.
- [ ] [Audit] Runtime visual pass on iPhone and iPad after the next simulator run window.

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity

## Files read
- docs/AREA_MOBILE.md
- docs/AREA_RESOURCES.md
- docs/DECISIONS.md
- docs/GAPS_AND_RISKS.md
- prisma/schema.prisma
- src/lib/guides.ts
- src/app/api/resources/route.ts
- src/app/api/resources/[id]/route.ts
- src/app/(app)/resources/page.tsx
- src/app/(app)/resources/[slug]/page.tsx
- src/app/(app)/resources/[slug]/_components/GuideReader.tsx
- ios/Wisconsin/Views/GuidesView.swift
- ios/Wisconsin/Views/ProfileView.swift
- ios/Wisconsin/Views/AppTabView.swift
- ios/Wisconsin/Core/APIClient.swift
- ios/Wisconsin/Models/Models.swift

## Notes
- Resources is the web product name; iOS keeps the user-facing label `Guides` to match the existing Settings directory entry and staff mental model.
- Student visibility remains server-owned through `/api/resources`; iOS consumes the same filtered response as the web app.

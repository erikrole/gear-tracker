# iOS Item Detail Hierarchy Plan - 2026-07-17

## Goal
- Make native Item Detail answer item identity, current custody, due timing, and the next allowed action within the first screen while keeping metadata and attachments quiet and accessible.

## Route
- Owner area: Mobile Operations, with Items as the feature area.
- Ledger: this active plan, then `tasks/todo.md` and the relevant area-doc changelogs at closeout.
- Existing references: `tasks/audit-item-detail-ios.md`, `tasks/audit-ios-apple-design-full.md`, and Slice 13 in `tasks/ios-apple-design-remediation-slices.md`.

## Source Checks
- `ItemDetailView` already receives the identity, derived status, active booking, upcoming reservations, parent, attachments, notes, and procurement fields required for this pass. No API or Codable change is needed.
- Item Detail is a floor lookup surface for availability, holder context, and reservation entry. Custody behavior remains kiosk-owned; this page only reads custody and opens reservation creation.
- Parent-linked accessories remain labeled `Attachments`, quiet on the parent detail page, and unavailable as independent booking lines under D-023.
- Reserve stays hidden for retired assets. Checked-out or otherwise unavailable assets may still be reserved for a future window through the existing reservation sheet.
- The current worktree contains unrelated iOS, docs, tests, and App Review changes. This slice must not rewrite or stage them.

## Stop Conditions
- Stop if the current `AssetDetail` payload cannot express holder, due timing, item identity, or attachment count without an API change.
- Stop if the redesign would introduce a new custody mutation, change the status model, or require a sixth tab/custom navigation shell.
- Stop visual signoff if the simulator cannot launch an authenticated Item Detail route; report build proof separately from visual proof.

## Slices
- [x] Slice 1: Recompose Item Detail into a compact identity hero, immediate custody context, contextual reservation label, visible location, and progressively disclosed secondary details.
- [x] Slice 2: Add focused source-contract coverage for the hierarchy, toolbar actions, retired gating, empty-reservation omission, and attachment language.
- [x] Slice 3: Build and inspect the native result, then sync the Mobile and Items area changelogs plus this plan review.
- [x] Correction pass: Remove the duplicate navigation title and hero status badge, apply Gotham Bold to the asset name, move non-custody availability below the hero, normalize due copy, rename Current Location, nest attachments under Details, and simplify the tappable QR chip.
- [x] Booking access follow-up: Match the web identity weight with Gotham Black, tint the reservation CTA purple, decode the existing item history payload, and add a visible Bookings route with Upcoming Reservations and Previous Bookings sections.
- [x] Hierarchy follow-up: Surface upcoming reservations on Item Detail, keep previous bookings behind the Bookings route in newest-first incrementally revealed batches, move the plain current-location name into the hero, quiet the product subtitle, and reduce Details to a consistent disclosure row.
- [x] Final correction: Make Previous Bookings neutral and single-line, reorder active-checkout content to title/due/person, preserve the Upcoming Reservations empty state, further quiet product identity while strengthening location, and remove photo expansion.

## Verification
- [x] Focused Vitest source-contract tests for Item Detail.
- [ ] `npm run ios:project:check` (blocked by pre-existing checked-in project drift from unrelated work)
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`
- [x] Simulator launch and screenshot of the changed Item Detail when authenticated runtime state is available.
- [ ] `npm run verify:docs` (blocked by pre-existing `docs/CODEMAPS/architecture.md` drift from unrelated work)
- [x] `git diff --check`

## Review
- Shipped: Compact adaptive Gotham Black identity hero with a static photo, quiet product caption, stronger location context, title/due/requester active custody, quiet availability, a purple reservation CTA, persistent Upcoming Reservations empty/populated state, newest-first incrementally revealed previous bookings behind a neutral one-line route, matching Details/history rows, nested Attachments, a simplified tappable QR chip, contextual reservation copy, and native overflow actions.
- Verified: 211 iOS source-contract tests across 51 files; zero iOS drift violations; XcodeBuildMCP build, install, and launch; production UI snapshot proving booking title/due/requester order and absence of a photo action; production screenshot proving the visible zero-reservation state, neutral Previous Bookings row, quieter product caption, and stronger location contrast. The original audit covered 51/51 surfaces.
- Deferred: Physical-device VoiceOver, accessibility-size, dark-mode, and motion signoff remain part of the existing external iOS audit signoff.
- Blocked: `npm run ios:project:check` sees pre-existing unrelated `project.pbxproj` drift, and docs verification sees pre-existing generated architecture-codemap drift, so this slice preserved both files.
- Proof artifacts: `/private/tmp/gear-tracker-item-detail-final-correction.png`, `/private/tmp/gear-tracker-previous-bookings-final.png`, `/private/tmp/gear-tracker-item-detail-available.png`, and `/private/tmp/gear-tracker-item-detail-correction.png` (Details expanded with Attachments nested).
- Next slice or stop: Stop. Review the production-backed screenshot before considering broader booking-detail hierarchy work.

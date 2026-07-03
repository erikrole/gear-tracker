# Audit: users + user detail (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but `UserDetailView` ignores `avatarUrl` (initials-only header — same drift the kiosk surfaces had until today's pass), profile-header location/phone are not wired, and several rows aren't combined VoiceOver elements.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `UsersView` + `UsersViewModel` + `UserListRow` + `UserAvatarSmall` in `Views/UsersView.swift`, plus `UserDetailView` in `Views/UserDetailView.swift`. Slice 1 (2026-05-07) shipped the Users tab parity; slice 4 (2026-05-07) monospaced emails; slice 3 (2026-05-07) added `StatusPill.role(_:)` token treatment.

**Surrounding context:** Users is the read-only directory surface. Per `feedback_ios_vs_web_role.md` — iOS view-only, web for create/edit/bulk. Floor reach: STAFF + ADMIN looking up a student to find "what's checked out to them" or coordinate around a name. Detail view loads three things in parallel (user, checkouts, reservations).

## P0 — blocks MVP

_None._ Pagination, search debounce, filter menu, role pills, inactive marker, empty / error / loading states all work. Cancellation patterns are correct (`searchTask` and `loadTask` get cancelled on supersede). The list-row `UserAvatarSmall` already loads `avatarUrl` via `AsyncImage` with an initials fallback ✓.

## P1 — polish before ship

- [x] [Gaps] **`UserDetailView` profile header discards `avatarUrl`.** `AppUserDetail.avatarUrl: String?` is decoded but the header just renders initials in a `Color.statusBackground(tone)` circle. Same drift the kiosk roster + active-checkout strips had until today's idle-pass fix. Tapping a user from the Users tab → seeing the photo you just saw on the list row would feel continuous; today it reverts to initials.
      `ios/Wisconsin/Views/UserDetailView.swift:88-99`.
      Suggested fix: `AsyncImage(url:)` with the existing initials circle as the placeholder/failure state. Match the `UserAvatarSmall` pattern shipped on the list row already; size up to 56pt for the detail header.

- [x] [A11y] **`UserListRow` is not a combined accessibility element.** VoiceOver walks each piece (avatar, name, inactive pill, email, secondary line, role pill) — six separate announcements per row. Combined into a single "Erik Mason, Admin, MERIT, Senior, Photo" announcement is friendlier and matches the row patterns shipped across kiosk + booking-detail surfaces today.
      `ios/Wisconsin/Views/UsersView.swift:220-250`.
      Suggested fix: `.accessibilityElement(children: .combine)` + an explicit row label that puts name + role first, with inactive state surfaced when applicable.

- [x] [A11y] **`UserDetailView.profileHeader` is not combined either.** Same shape of fix.
      `ios/Wisconsin/Views/UserDetailView.swift:88-118`.
      Suggested fix: combine + explicit "Erik Mason, Admin, MERIT" label so VO doesn't read each piece separately.

- [x] [Gaps] **`AppUserDetail.phone` is decoded but never rendered.** Server returns the user's phone (`detail.phone: String?` exists in the model) — useful for floor coordination ("call them about the gear they have out"). The header HStack only renders email and location.
      `ios/Wisconsin/Views/UserDetailView.swift:100-114`, `Models/Models.swift:164`.
      Suggested fix: when `detail.phone` is non-nil, render a third row in the profile-header VStack as a tappable `Link` to `tel:{phone}`. Same monospaced treatment as the email row.

- [x] [UI polish] **Filter-menu inactive toggle exposes `eye` / `eye.slash` icon names to VoiceOver.** Same family of fix shipped across today's surfaces.
      `ios/Wisconsin/Views/UsersView.swift:201-208`.
      Suggested fix: explicit `.accessibilityLabel(vm.includeInactive ? "Hide inactive users" : "Show inactive users")` on the Button so the icon stays decorative.

- [x] [UI polish] **`UserAvatarSmall` initials use `.tint`** which inherits `Color.accentColor` (Wisconsin red). Works visually but `Color.brandPrimary` (the explicit token) is the more durable reference — survives any future change to the SwiftUI tint propagation.
      `ios/Wisconsin/Views/UsersView.swift:330`.
      Decision: **Skip.** `.tint` and `Color.brandPrimary` resolve to the same color today; switching is cosmetic and the existing pattern matches `AccountAvatar` in `AppTabView.swift`. Leave for a broader brand-token consolidation pass.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** "Clear filters" affordance — when role filter + show-inactive are both active, no single-tap reset. Could be a button at the top of the menu when `hasFilter` is true. Skip until reported as friction.
- [ ] [Polish] **Deferred.** Tap-email to open mail composer. The text is selectable + long-pressable so the path exists; a `mailto:` Link affordance would shave a step. Worth doing if floor staff actually use it.
- [ ] [Polish] **Deferred.** Active-checkout overdue indicator surfaced on the row directly. `BookingResultRow` (from `SearchResultRow.swift`) already shows the booking status pill, which carries the overdue treatment. Acceptable.
- [ ] [Polish] **Deferred.** Recent bookings list pagination. Today caps at 5 each. For floor lookup that's enough; web has the full history.

## Acceptance criteria status

Per `AREA_USERS.md` and the prior schedule audit (slice 1 shipped Users tab parity):

- [x] AC: paginated user list with search.
- [x] AC: role filter (Admin / Staff / Student) + include-inactive toggle.
- [x] AC: per-row role pill via `StatusPill.role(_:)`.
- [x] AC: list-row avatar via `AsyncImage` with initials fallback.
- [x] AC: detail view shows profile (name, email, role, location).
- [x] AC: detail surfaces active checkouts + recent reservations.
- [x] AC: detail-header avatar matches list-row avatar — **closed by P1 fix.**
- [x] AC: detail-header phone is reachable when present — **closed by P1 fix.**
- [x] AC: VoiceOver users hear each row as a combined element — **closed by P1 a11y fixes.**

## 2026-07-03 Runtime Recheck

- [x] Users list screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_1ee16b49-ecb3-478c-bb62-edcd18ef54c3.jpg`
- [x] User detail screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_32f3681c-88ff-4fdb-b6b6-3450f2f370af.jpg`
- [x] Badge gallery screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_fc880878-f579-477b-a470-c18bfa10e682.jpg`
- [x] Badge detail screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_e2be5e5c-b60d-498b-9429-acd77a0fbb87.jpg`
- [x] Runtime fix: native Users rows no longer repeat routine location copy such as `Camp Randall`; rows keep title/year and primary area. User detail already omits location.

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web has create/edit/bulk; iOS view-only by design per `feedback_ios_vs_web_role.md`)
- [x] Accessibility

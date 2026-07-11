# Sidebar Ownership Pass - 2026-07-10

## Goal
- Make the app navigation feel stable, obvious, and role-aware across expanded desktop, collapsed desktop, mobile sheet, and mobile bottom navigation without changing route or permission ownership.

## Plan
- [x] Audit navigation hierarchy, active matching, badges, quick actions, account controls, collapse state, mobile parity, docs, and tests.
- [x] Simplify grouping and strengthen current-location and count semantics.
- [x] Tighten collapse, theme, account, logout, mobile-sheet, keyboard, and accessibility behavior.
- [x] Add focused regression coverage and synchronize navigation documentation.
- [x] Run repository gates and record the authenticated browser boundary.

## Contract boundaries
- Preserve route URLs, role gates, text-first desktop search, kiosk custody boundaries, user-scoped badge counts, and the dedicated mobile bottom navigation.

## Review
- Shipped one most-specific desktop active destination, a correctly named Operations group, persistent collapse state, collapsed urgency badges, stable 40px navigation/theme controls, a labeled navigation landmark, and cleaner readable section/identity typography.
- Mobile now has a visible drawer close control, closes the drawer after navigation, announces useful workspace context, and uses Home, Schedule, Bookings, Items, and Lookup so canonical `/bookings` navigation remains active. Same-route booking changes refresh urgency counts, logout failure is visible, and the conflicting implicit Command-B shortcut is removed.
- Removed the hover-only New Booking shortcut because it disappeared under urgency badges and duplicated the Bookings page's stable creation flow.
- Verified 11 focused sidebar/navigation tests, focused ESLint, TypeScript, all 93 migration prefixes, codemap/docs, whitespace, and `npm run build:app`.
- Authenticated browser proof is not repeated or claimed because Dia continues to block local app routes with `ERR_BLOCKED_BY_CLIENT`, the established environment boundary from the immediately preceding passes.

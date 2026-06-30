# iOS Browse Tab Plan — 2026-06-30

## Scope
- Replace the compact native `Items` tab with a native `Browse` tab.
- Make Browse the first-class iPhone entry point for Items, Guides, Licenses, and Users.
- Keep Search as the system trailing search tab and avoid a sixth compact tab.
- Show Users to every authenticated role as a directory, while leaving edit/admin mutations role-gated by the existing Users surface and API rules.

## Checklist
- [x] Audit current mobile, items, users, resources, licenses, settings, schema, and iOS shell contracts.
- [x] Add a native SwiftUI `BrowseView` using system list and navigation patterns.
- [x] Wire `BrowseView` into `AppTabView` in the old Items tab slot.
- [x] Move regular-width Users into a non-admin Resources sidebar destination.
- [x] Keep Profile/Settings Directory as a fallback and ungate its Users row.
- [x] Add focused source-contract tests for Browse and update old tab/sidebar expectations.
- [x] Sync area docs, iOS patterns, audit inventory, and task review notes.
- [x] Run focused tests and iOS verification gates.

## Non-Goals
- No backend schema or permission changes.
- No custom hamburger drawer.
- No native edit/authorship tools for Guides.
- No native admin management tools for Licenses beyond the existing web link.

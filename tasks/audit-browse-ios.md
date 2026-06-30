# iOS Browse Audit — 2026-06-30

## Scope
Native iOS Browse tab in `ios/Wisconsin/Views/BrowseView.swift`.

## What Shipped
- Compact iPhone primary navigation now uses Browse instead of a standalone Items tab.
- Browse is a native SwiftUI `NavigationStack` and inset grouped `List`.
- Browse links to Items, Guides, Licenses, and Users.
- Users is visible to every authenticated role as a read directory; mutation controls remain governed by the existing Users page and server authorization.
- Settings Directory remains a fallback path for Guides, Users, and Licenses.

## Risks Checked
- Compact tab count stays at five, so Search remains the pinned trailing search tab.
- Browse uses system NavigationLinks rather than a custom hamburger or drawer.
- No backend permission, schema, or API contract changed.
- Guides and Licenses remain read/self-service native surfaces with web-owned admin workflows.

## Follow-Ups
- Consider adding non-nested navigation wrappers for Items and Users if those screens need deeper Browse-specific stack behavior.

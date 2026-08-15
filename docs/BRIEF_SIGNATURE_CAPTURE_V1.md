# BRIEF: Signature Capture Micro-App V1

## Document Control

- Feature: Signature Capture Micro-App
- Area: Signatures
- Owner: Wisconsin Athletics Creative Product
- Created: 2026-08-15
- Status: Local implementation complete; physical iPad and private-storage acceptance remain open
- Depends on: D-050

## User Outcome

Authenticated staff and admins can select a canonical team/season collection, choose an imported MBB player or coach, or open the separate Creative staff roster and choose a linked full-time Video, Photo, or Graphics user. They can capture one consistent signature with Apple Pencil on iPad Safari and manage the resulting transparent PNG/SVG files without exposing public media URLs.

## V1 Contract

1. The pilot starts with Men’s Basketball (`MBB`) plus a standalone Creative staff (`CREATIVE`) collection for the same season. Creative staff is never nested inside the MBB collection.
2. Drawing accepts pen-class pointer input only. Touch, palm, mouse, trackpad, and other non-pen pointers never add ink, while touch remains usable for buttons and navigation.
3. MBB roster members come from an allowlisted UWBadgers adapter. Players and coaching staff are required by default; support staff are imported but optional. The standalone Creative staff roster syncs explicitly from active visible full-time Video/Photo/Graphics users into linked signature members, required by default.
4. Imports persist an immutable normalized snapshot. Applying a preview requires the observed collection version and never deletes members or captures.
5. The client submits normalized strokes. The server validates them, creates a sanitized path-only SVG, renders the PNG from that SVG, and stores both privately with matching crop bounds and hashes.
6. A roster tile becomes green only after both artifacts and the database capture commit. Local drafts never count as complete.
7. Capture saves are idempotent by request ID, reject stale versions with `409`, and preserve the prior capture when an upload or finalization fails.
8. Admins own pen settings, required-state changes, archive, and collection reset. Staff/admin may capture, replace, remove, download, import, and reconcile.
9. Active-year selection hides archived collections by default; archived collections are read-only, and roster presentation preserves player-number order, UWBadgers source order for coaching/support staff, and last-name order for Creative staff.

## Data and Privacy Boundary

Signature members are not `StudentSportAssignment` rows. Imported members are external roster records with a nullable link to a Gear Tracker user; Creative staff are linked internal-user records in the standalone `CREATIVE` collection without an external snapshot. Signature artifact paths, strokes, SVG contents, and private Blob URLs never enter audit snapshots; audit records contain IDs, hashes, actor, action, and before/after metadata only. Superseded file contents are not retained after cleanup.

## Acceptance Criteria

- Identical strokes/settings produce deterministic transparent cropped PNG and SVG output.
- SVG contains only sanitized paths and no scripts, HTML, foreign objects, external references, or client-controlled metadata.
- Unchanged imports are idempotent; source duplicates collapse by profile identity; reconciliation is explicit and non-destructive.
- Failed, stale, or concurrent saves preserve the committed capture and local draft.
- Staff/admin, admin-only, student, and collaborator authorization tests pass.
- Authenticated browser smoke and physical iPad Safari proof are recorded before production rollout.

## Deferred

Box integration, native PencilKit, ZIP export, scheduled sync, additional sport adapters, pressure-sensitive width, and retention of superseded file contents.

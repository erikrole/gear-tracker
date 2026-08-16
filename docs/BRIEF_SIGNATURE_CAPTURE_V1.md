# BRIEF: Signature Capture Micro-App V1

## Document Control

- Feature: Signature Capture Micro-App
- Area: Signatures
- Owner: Wisconsin Athletics Creative Product
- Created: 2026-08-15
- Status: Local implementation complete; physical iPad and private-storage acceptance remain open
- Depends on: D-050

## User Outcome

Authenticated staff and admins can select a canonical team/season collection, choose an imported MBB, Football, or Volleyball player/coach, open the separate Creative staff roster, or create a one-off signer with a name and sport/category. They can capture one consistent signature with Apple Pencil on iPad Safari and manage the resulting transparent PNG/SVG files without exposing public media URLs.

## V1 Contract

1. The supported team collections are Men’s Basketball (`MBB`), Football (`FB`), and Volleyball (`VB`), plus a standalone Creative staff (`CREATIVE`) collection for the same season. Creative staff is never nested inside a team collection.
2. Signature capture is available only on iPadOS. Unsupported web clients show a disabled `Capture on iPad` action with a tooltip explaining that an iPad and Apple Pencil are required; direct desktop visits to the capture surface are blocked. Drawing accepts pen-class pointer input only. Touch, palm, mouse, trackpad, and other non-pen pointers never add ink, while touch remains usable for buttons and navigation.
3. MBB, Football, and Volleyball roster members come from separate allowlisted UWBadgers adapters. Football and Volleyball use the source site's starting calendar year URL segment while retaining the canonical `YYYY-YY` Gear Tracker season. Player metadata normalizes the source position and academic year into one display title. Players always require a signature; coaching staff are included in readiness by default, and support staff are imported but excluded by default. Mounting `/signatures` automatically invokes the versioned standalone Creative Staff reconciliation mutation; collection-list GET remains read-only. The reconciliation sources active visible full-time users identified by a Video/Photo/Graphics area or an explicit Creative/Digital Media job title into linked signature members, included by default. A same-season non-player team member links only through a unique exact normalized-name match and then shares the canonical Creative Staff capture across both rosters.
4. Imports persist an immutable normalized snapshot. Applying a preview requires the observed collection version and never deletes members or captures.
5. The client submits normalized strokes. The server validates them, creates a sanitized path-only SVG, renders the PNG from that SVG, and stores both privately with matching crop bounds and hashes.
6. A roster tile becomes green only after both artifacts and the database capture commit. Local drafts never count as complete.
7. Capture saves are idempotent by request ID, reject stale versions with `409`, and preserve the prior capture when an upload or finalization fails.
8. Admins own output settings, non-player readiness inclusion, archive, and collection reset. Player readiness cannot be disabled. Staff/admin may capture, replace, remove, preview, download, import, and reconcile.
9. Active-year selection hides archived collections by default; archived collections are read-only, and roster presentation preserves player-number order, UWBadgers source order for coaching/support staff, and last-name order for Creative staff.
10. A successful recapture retains prior private artifact revisions as authenticated version history. Explicit Remove and collection Reset delete every retained revision in their scope.
11. Staff/admin may add a one-off signer to the season's standalone `ADHOC` collection by entering a name and sport/category; the new signer opens directly in capture.

## Data and Privacy Boundary

Signature members are not `StudentSportAssignment` rows. Imported members are external roster records with a nullable link to a Gear Tracker user; Creative Staff are linked internal-user records in the standalone `CREATIVE` collection without an external snapshot; ad-hoc members are manual records in the standalone `ADHOC` collection. Linked team-staff rows resolve the same canonical Creative Staff capture and never duplicate private artifact files. Signature artifact paths, strokes, SVG contents, and private Blob URLs never enter audit snapshots; audit records contain IDs, hashes, actor, action, and before/after metadata only.

## Acceptance Criteria

- Identical strokes/settings produce deterministic transparent cropped PNG and SVG output.
- SVG contains only sanitized paths and no scripts, HTML, foreign objects, external references, or client-controlled metadata.
- Unchanged imports are idempotent; source duplicates collapse by profile identity; automatic Creative Staff reconciliation is version-checked, no-op safe, and non-destructive.
- Failed, stale, or concurrent saves preserve the committed capture and local draft.
- Staff/admin, admin-only, student, and collaborator authorization tests pass.
- Authenticated browser smoke and physical iPad Safari proof are recorded before production rollout.

## Deferred

Box signature-file integration, native PencilKit, ZIP export, scheduled sync, Illustrator asset backfill/matching, and pressure-sensitive width.

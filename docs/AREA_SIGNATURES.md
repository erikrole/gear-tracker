# Signatures Area Scope (V1 Local Implementation)

## Document Control

- Area: Signatures
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-08-15
- Status: Production pilot deployed; physical-input, private-storage, and cleanup acceptance gates remain open
- Version: V1.0

## Direction

Make collecting team signatures a fast, reliable iPad workflow: roster identity first, pen-only capture second, server-confirmed artifact state third.

## Core Rules

1. A collection is uniquely identified by canonical collection code and season. Men’s Basketball uses `MBB`; Creative staff use a separate `CREATIVE` collection for the same season.
2. External roster members are separate from internal Gear Tracker users. Creative staff are linked internal full-time Video, Photo, or Graphics users represented by separate signature-member records in the standalone Creative staff collection.
3. Only staff/admin users can access the area. Students and collaborators are denied by the centralized permission map.
4. Completeness is derived from active required members with a committed current artifact revision. Inactive and optional support staff do not count; Creative staff in the standalone roster are required by default and can be made optional individually by an admin.
5. Roster imports are snapshots, not destructive syncs. Apply is explicit, versioned, and never deletes historical members or captures. Creative staff sync is an explicit, versioned reconciliation of active visible full-time Video/Photo/Graphics users; the MBB collection never contains Creative staff members.
6. Capture input is normalized strokes. The server owns SVG/PNG generation, crop bounds, hashes, filenames, and private storage paths.
7. A pending or failed save is never presented as complete or downloadable.
8. Durable capture and artifact state remains in signature tables; the general audit log is supplemental evidence and is subject to its 90-day retention policy.
9. The active collection chooser hides archived seasons by default. Admins may reveal, archive, and restore historical collections; archived collections remain read-only.
10. Roster presentation keeps players in jersey-number order, keeps coaching/support staff in the order preserved by the UWBadgers source snapshot, and sorts the standalone Creative staff roster by last name.
11. A committed capture renders its private PNG beneath the signer identity. Incomplete-state copy and capture actions leave the card when the server confirms completion; secondary file and lifecycle actions remain available from the compact card action menu.

## Runtime Surfaces

- `/signatures`: separate MBB and Creative staff collection cards, completeness indicators, archive controls, and the MBB import entry point.
- `/signatures/[collectionId]`: roster grid, settings, reconciliation, and file library.
- `/signatures/[collectionId]/capture/[memberId]`: full-height pen-only capture with signer identity at the top.
- `/api/signatures/*`: authenticated collection, import, capture, artifact, and cleanup contracts.

## Acceptance State

Local implementation and automated verification are tracked in `tasks/signature-capture-micro-app-plan.md`. Production migration health reports 119/119 applied migrations with no pending rows, and the live HTTPS route `https://wisconsincreative.com/signatures` correctly redirects unauthenticated users to `/login`. The MBB Players, Coaching staff, and Support staff sections, standalone Creative staff roster, source-order staff presentation with Greg Gard first, and safe archival of the unwanted 2025–26 collection are all included in the deployed release. Physical iPad Safari proof, private Blob provisioning, and failure-injection cleanup proof remain before this area is called fully accepted.

## Changelog

- 2026-08-15: Added the V1 area contract for the Men’s Basketball signature-capture pilot.
- 2026-08-15: Deployed the Signature Capture pilot to production in Vercel deployment `dpl_5WSeBG88rhaBNKKmtfM6ETVX75Um` from commit `03d6452`. The live HTTPS route returns the expected unauthenticated redirect; physical iPad, private Blob, and cleanup failure-injection gates remain open.
- 2026-08-15: Implemented the local V1 web/API/schema/artifact/storage lifecycle; kept hardware, private-store, browser, and production rollout gates open.
- 2026-08-15: Applied `0113_signature_capture` to the linked Preview Neon database, verified 118/118 migration health, and recorded authenticated `/signatures` smoke; production rollout, private Blob, and physical iPad gates remain open.
- 2026-08-15: Corrected UWBadgers source-role classification and reconciled the Preview 2026–27 roster into 14 players, 7 required coaching staff, and 11 optional support staff. The grouped roster UI and readiness summary passed authenticated browser verification with no console errors.
- 2026-08-15: Hardened roster management and presentation: players sort by jersey number, staff follows the UWBadgers snapshot order, archived seasons stay hidden by default, and admins can restore read-only history. Preview 2025–26 was archived and 2026–27 remains the only active MBB roster.
- 2026-08-15: Added a standalone `CREATIVE` signature roster beside MBB. Staff/admin users can explicitly sync active visible full-time Video/Photo/Graphics accounts into linked signature members; Creative staff are no longer nested inside team rosters.
- 2026-08-15: Applied `0114_signature_creative_staff` to the configured development Neon database and verified the standalone roster readback: 12 active full-time Video/Photo/Graphics accounts, including Erik Role for capture testing. Production migration/deployment and physical iPad proof remain open.
- 2026-08-15: Completed signature cards now show the committed PNG below the signer identity; incomplete-state copy and capture controls clear out after server confirmation, while file and lifecycle actions remain in an accessible compact menu.
- 2026-08-15: Hardened the iPad capture path and save lifecycle: stable resize handling, complete coalesced Pencil points, recoverable draft transactions, visible one-point ink, target-bound idempotency, inactive-member rejection, and reset invalidation for in-flight saves.

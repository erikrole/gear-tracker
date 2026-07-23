# Collaborators Area Scope (V1)

## Document Control

- Area: Collaborators
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-07-23
- Status: People directory implemented locally; migration and production smoke pending
- Version: V1.3

## Direction

External users use `Role.COLLABORATOR` and an assigned database-backed affiliation policy. Affiliation names and badges are identity only. Every permission comes from the assigned policy's validated server-owned grants, and the central role map continues to default-deny Collaborator.

BTN and Learfield are active affiliations. Legacy affiliation and profile fields remain for response compatibility, but they do not authorize access. A collaborator without an assigned active policy fails closed at login and on session refresh.

## Policy Model

- `CollaboratorAffiliation` owns an immutable generated key, editable display name, 2-12 character badge, and archival state.
- Its one-to-one `CollaboratorPolicy` owns `ACTIVE` or `SUSPENDED` status and an optimistic version.
- `CollaboratorPolicyGrant` stores only validated capability keys. Unknown keys fail closed.
- `CollaboratorPolicyRevision` is immutable history. Restoring history creates a new revision and retains current identity metadata.
- Collaborators and pending collaborator invitations must reference a policy. Internal accounts and invitations cannot reference one.
- Policy and grants are loaded on every authenticated request. Reductions and suspension apply immediately without deleting sessions. Reactivation restores the existing session.
- No per-user grant exceptions or automatic expiration exist.

## Capability Catalog

The editable catalog is limited to:

- `GEAR_CATALOG_VIEW`
- `MY_GEAR_VIEW`
- `RESERVATION_CREATE`
- `RESERVATION_EDIT_OWN`
- `RESERVATION_CANCEL_OWN`
- `RESERVATION_EXTEND_OWN`
- `PUBLISHED_SCHEDULE_VIEW`
- `PEOPLE_DIRECTORY_VIEW`
- `SCHEDULE_FOLLOW`
- `KIOSK_ROSTER_ELIGIBLE`

Dependencies normalize automatically: reservation creation adds catalog and My Gear; own edit/cancel/extend add My Gear; follow adds published Schedule; kiosk eligibility adds My Gear. Removing a prerequisite removes its dependents.

Basic Home, Profile, Security, and Notifications remain account surfaces. Their content adapts to effective capabilities.

## Permanent Boundaries

`PEOPLE_DIRECTORY_VIEW` grants a minimized directory of active, non-hidden teammates. It exposes only roster identity and work context: name, role, title, primary area, location, avatar, and student standing. Search is name-only. It does not expose email, phone, Wiscard data, birthday, apparel sizes, Slack identity, presence or last-active data, assignments, direct-report structure, activity, bookings, shifts, badges, audit history, or edit actions.

The editor cannot grant private profile fields, internal notes, serial numbers, borrower identity, maintenance or audit history, internal metadata, unrestricted cross-user access, internal Schedule APIs, staffing controls, or custody mutations. Pickup and return stay kiosk-owned under D-040.

Collaborator gear responses remain sanitized and own-booking scoped. Published Schedule remains snapshot-backed and excludes drafts, unpublished edits, notes, Open Work, availability, trades, acknowledgements, candidate scores, and publication metadata.

## Administration and Lifecycle

- Only admins may create, edit, suspend, reactivate, restore, archive, invite, deactivate, or reassign collaborator policies.
- New affiliations start suspended with no grants. Activation with no effective capabilities is rejected.
- Invitation and People role-change flows select an active policy and show an effective-access summary.
- Suspended policies cannot create invitations or complete pending registration.
- Risky changes require preview and acknowledgement. Preview includes active users, pending invitations, reservations, and checkouts.
- Active obligations do not block a reduction or suspension. Staff retain operational control.
- Every mutation is rate-limited, optimistic-versioned, serializable, and writes its revision and audit record atomically.
- Reductions and suspension create deduplicated in-app notices. Grants and reactivation are silent.
- Archival requires suspension, no active collaborators, and no pending invitations. History remains.

## Web, iOS, and Kiosk

- Web navigation, mobile bottom navigation, Home content, and route guards derive from effective capabilities.
- Shared collaborator surfaces use affiliation-neutral product copy. BTN and Learfield identity appears only through assigned policy metadata and badges.
- Native iOS decodes optional policy metadata and capabilities, refreshes them after a forbidden response, and hides unavailable tabs and booking or follow actions. Browse exposes People only when the directory capability is present.
- Older internal accounts and deployed clients continue decoding because the new fields are additive and optional.
- Kiosk rosters include active collaborators only when `KIOSK_ROSTER_ELIGIBLE` is granted. They appear at every kiosk with the policy badge and do not require a Wiscard.

## Rollout

1. Migrations `0095` through `0098` are applied. Apply `0103` to grant the People directory to BTN and Learfield after the server and clients are deployed.
2. Deploy the dual-read server and web before native clients.
3. Smoke-test BTN parity and the admin editor with a temporary account.
4. Smoke-test the People directory with temporary BTN and Learfield accounts before inviting additional collaborators.

## Acceptance Criteria

- [x] Database-backed affiliation policies, grants, revisions, BTN backfill, and suspended Learfield seed exist.
- [x] The ten-key catalog normalizes dependencies and rejects unknown keys.
- [x] Current policy status and grants govern every authenticated request.
- [x] Admin APIs and Collaborator Access Settings support create, edit, preview, suspend/reactivate, history, restore, and constrained archive.
- [x] Invitations, registration, People management, auth payloads, web, iOS, and kiosk use the assigned policy.
- [x] Permanent privacy, ownership, IDOR, Schedule snapshot, and custody boundaries remain server-enforced.
- [x] Both Wisconsin targets compile with rollout-tolerant policy metadata.
- [ ] Authenticated production browser and temporary-account smoke are complete.
- [ ] Migration `0103` and authenticated BTN/Learfield People-directory smoke are complete.

## Change Log

- 2026-07-23: V1.3 adds the explicit `PEOPLE_DIRECTORY_VIEW` grant. BTN and Learfield can receive a minimized active-user directory on web and iOS without gaining contact, identity, presence, activity, booking, shift, badge, audit, or edit access.
- 2026-07-23: Retired the legacy `BTN_STANDARD` authorization fallback. Policy-less collaborators now fail closed, and shared Schedule and roster copy no longer labels every collaborator as BTN.
- 2026-07-23: Affiliation badges now preserve deliberate casing in the admin editor and policy service, allowing `Learfield` while retaining acronym labels such as `BTN`.
- 2026-07-18: Native Published Schedule now matches the internal Schedule reading order without crossing the collaborator boundary. The list is limited to current and upcoming published snapshots, grouped by date, and rendered as classification-rail cards with time, venue, crew preview, and quiet follow state. Each event opens a full-screen read-only detail grouped by operational area. Follow and mute remain capability-gated and use server-returned state; notification taps fetch only the sanitized published-event endpoint. Drafts, unpublished edits, notes, contact details, Open Work, availability, trades, acknowledgements, candidate scores, gear, and internal staffing controls remain excluded.
- 2026-07-16: V1.2 replaced the fixed BTN registry with admin-managed affiliation policies, nine validated capabilities, immutable revisions, immediate suspension, dynamic web/iOS/kiosk surfaces, and a suspended Learfield seed while preserving BTN behavior.
- 2026-07-16: V1.1 hardened response sanitization, booking audit denial, published-only event links, negative route coverage, and atomic follow behavior.
- 2026-07-16: V1 shipped the initial fixed BTN collaborator contract.

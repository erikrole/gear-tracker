# Collaborators Area Scope (V1)

## Document Control

- Area: Collaborators
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-07-16
- Status: Implemented; production smoke pending
- Version: V1.2

## Direction

External users use `Role.COLLABORATOR` and an assigned database-backed affiliation policy. Affiliation names and badges are identity only. Every permission comes from the assigned policy's validated server-owned grants, and the central role map continues to default-deny Collaborator.

BTN is active with its existing behavior. Learfield exists suspended with no grants. Legacy affiliation and profile fields remain during the compatibility rollout, but they do not override a policy.

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
- `SCHEDULE_FOLLOW`
- `KIOSK_ROSTER_ELIGIBLE`

Dependencies normalize automatically: reservation creation adds catalog and My Gear; own edit/cancel/extend add My Gear; follow adds published Schedule; kiosk eligibility adds My Gear. Removing a prerequisite removes its dependents.

Basic Home, Profile, Security, and Notifications remain account surfaces. Their content adapts to effective capabilities.

## Permanent Boundaries

The editor cannot grant private profile fields, internal notes, serial numbers, borrower identity, maintenance or audit history, internal metadata, cross-user access, People directory access, internal Schedule APIs, staffing controls, or custody mutations. Pickup and return stay kiosk-owned under D-040.

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
- Native iOS decodes optional policy metadata and capabilities, refreshes them on foreground and after a forbidden response, and hides unavailable tabs and booking or follow actions.
- Older internal accounts and deployed clients continue decoding because the new fields are additive and optional.
- Kiosk rosters include active collaborators only when `KIOSK_ROSTER_ELIGIBLE` is granted. They appear at every kiosk with the policy badge and do not require a Wiscard.

## Rollout

1. Migrations `0095` through `0098` are applied and migration health is clean.
2. Deploy the dual-read server and web before native clients.
3. Smoke-test BTN parity and the admin editor with a temporary account.
4. Keep Learfield suspended until an admin configures, reviews, and activates its policy.
5. Invite Trey only after production authorization, browser, iOS, and kiosk smoke pass.

## Acceptance Criteria

- [x] Database-backed affiliation policies, grants, revisions, BTN backfill, and suspended Learfield seed exist.
- [x] The nine-key catalog normalizes dependencies and rejects unknown keys.
- [x] Current policy status and grants govern every authenticated request.
- [x] Admin APIs and Collaborator Access Settings support create, edit, preview, suspend/reactivate, history, restore, and constrained archive.
- [x] Invitations, registration, People management, auth payloads, web, iOS, and kiosk use the assigned policy.
- [x] Permanent privacy, ownership, IDOR, Schedule snapshot, and custody boundaries remain server-enforced.
- [x] Both Wisconsin targets compile with rollout-tolerant policy metadata.
- [ ] Authenticated production browser and temporary-account smoke are complete.
- [ ] Learfield remains suspended until separately reviewed and activated.

## Change Log

- 2026-07-18: Native Published Schedule now matches the internal Schedule reading order without crossing the collaborator boundary. The list is limited to current and upcoming published snapshots, grouped by date, and rendered as classification-rail cards with time, venue, crew preview, and quiet follow state. Each event opens a full-screen read-only detail grouped by operational area. Follow and mute remain capability-gated and use server-returned state; notification taps fetch only the sanitized published-event endpoint. Drafts, unpublished edits, notes, contact details, Open Work, availability, trades, acknowledgements, candidate scores, gear, and internal staffing controls remain excluded.
- 2026-07-16: V1.2 replaced the fixed BTN registry with admin-managed affiliation policies, nine validated capabilities, immutable revisions, immediate suspension, dynamic web/iOS/kiosk surfaces, and a suspended Learfield seed while preserving BTN behavior.
- 2026-07-16: V1.1 hardened response sanitization, booking audit denial, published-only event links, negative route coverage, and atomic follow behavior.
- 2026-07-16: V1 shipped the initial fixed BTN collaborator contract.

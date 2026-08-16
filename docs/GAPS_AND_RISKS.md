# Gear Tracker — Active Gaps, Pending Decisions, and Risks

## Document Control

- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-08-16
- Status: Active registry
- Purpose: Track only open gaps, pending decisions, active risks, and intentionally deferred scope.
- Historical record: [GAPS_AND_RISKS_HISTORY.md](archive/GAPS_AND_RISKS_HISTORY.md)

## Pending Decisions

No open pending decisions are currently tracked here. Accepted decisions and their rationale live in [DECISIONS.md](DECISIONS.md). Add a pending decision here only when it has an unresolved owner, consequence, or product/architecture choice.

## Open Gaps

| ID | Description | Owner Area | Status | Notes |
|---|---|---|---|---|
| GAP-21 | `SystemConfig` has no generic all-key admin surface | AREA_SETTINGS | Expected | Low priority. Operator-facing pages exist for specific keys such as checkout policies and reservation rules. A generic key/value UI remains deferred until more keys need direct admin ownership. |
| GAP-34 | iOS Bookings list lacks the status scope filters and column sorting available on web | AREA_MOBILE | Expected | iOS currently uses `activeOnly: true`, which is acceptable for the V1 student bar. Power-user parity remains deferred. Source: `tasks/audit-bookings-ios.md`. |
| GAP-36 | iOS Item detail does not expose AC-8 admin actions: Duplicate, Retire, Delete, and Needs Maintenance | AREA_MOBILE | Expected | These destructive and lifecycle actions remain web-only by design for V1. Track staff-mobile parity separately from student operational work. Source: `tasks/audit-items-ios.md`. |
| GAP-59 | Firmware watch does not cover every live camera body | AREA_ITEMS | Expected | The inventory-driven seed covers verified Sony pages. DJI, GoPro, Insta360, and JVC remain deferred until official-source adapters exist for each vendor's page format. Source: `tasks/firmware-watch-inventory-report.md`. |
| GAP-60 | Timed Schedule release acceptance proof remains open | AREA_MOBILE / AREA_SHIFTS | Active | Migration `0109_schedule_timed_release` and the compatible server/web/native rollout are deployed. Authenticated web and native exact-version timer proof plus consolidated notification delivery proof remain open. Source: `tasks/event-shift-working-schedule-plan.md`. |
| GAP-61 | Legacy raw `PENDING_PICKUP` checkout rows and enum remain during rollout | AREA_RESERVATIONS | Active | New kiosk custody opens directly as `OPEN`, while Pending Pickup is derived from due `BOOKED` reservations. Keep legacy kiosk confirmation and expiry support until a production zero-row check proves the enum and compatibility branches can be removed safely. Source: `tasks/archive/completed-2026-07/pending-pickup-reservation-consolidation-plan.md`. |
| GAP-62 | Production WebAuthn rollout proof remains open | AREA_MOBILE / AREA_USERS | Active | Web and native iOS enrollment, discoverable login, and credential management are implemented against the shared session contract. Migration `0106_passkey_auth` is applied and live migration health matches all 111 local migrations. On 2026-07-31, production probes returned AASA `200 application/json`, registration-options `405` for unauthenticated `GET`, and passkey listing `401` for unauthenticated `GET`. Authenticated browser smoke, device-side association refresh, and real-device passkey proof remain before calling passkeys production-ready. Source: `tasks/passkey-auth-plan.md`. |
| GAP-63 | 2027 pending invitation materialization rollout | AREA_USERS / AREA_SHIFTS | Resolved | Migration `0108_social_pending_invite_profile`, the reviewed live invitation/roster data apply, and the registration-time materialization path are deployed. Production readback confirms the authenticated Allowed Emails page renders all 32 entries, including ten pending students and existing Collaborator rows. A real claim was intentionally not executed because it would create and consume a production student account. |
| GAP-64 | Durable overdue checkout escalation rollout proof | AREA_NOTIFICATIONS / AREA_SETTINGS | Active | The five-stage Workflow policy, due-version dedupe, late-stage collapse, location responders, separate caps, preference alignment, and migration `0111_checkout_overdue_notification_policy` are implemented locally. Apply the migration, deploy compatible server code, configure responders, then prove one exact-timing run, one extension supersession, requester/responder/admin channel behavior, and repair-sweep dedupe before closing. Source: `tasks/overdue-notification-hardening-plan.md`. |
| GAP-65 | Signature capture rollout proof | AREA_SIGNATURES | Active | Hardened V1 is deployed to production as Vercel deployment `dpl_Gspp8EzUCRM9VseLegodTZiXVLV6`; production reports 119/119 migrations applied, and authenticated `wisconsincreative.com` readback proves both rosters plus the revised pen-class capture UI. The MBB pilot plus standalone Creative staff roster are live, with the corrected 14-player / 7-coach / 11-support-staff hierarchy, numeric player order, UWBadgers source-order staff presentation, safe archival of 2025–26, and the separate linked Creative staff collection sourced from 12 active full-time Video/Photo/Graphics accounts. The existing media store remains public and unchanged. Dedicated private store `wisconsin-creative-signatures-private` is connected through `SIGNATURE_BLOB_READ_WRITE_TOKEN`; the application wrapper passed two-artifact private upload/read/privacy/cleanup proof, and an injected second-artifact failure left no generated object behind. A real Pencil save, authenticated artifact delivery, and physical iPad Safari pen/touch/rotation/interruption proof remain. Source: `tasks/signature-capture-micro-app-plan.md`. |

## Deferred Product Scope

| Feature | Owner Area | Decision or rationale |
|---|---|---|
| Reservation and checkout templates | AREA_RESERVATIONS | Phase C; defer until repeatable operator habits justify template ownership. |
| Board or operations view for game-day coordinators | AREA_DASHBOARD | Phase C; do not add another command surface before current queues prove insufficient. |
| Advanced behavioral analytics | NORTH_STAR | Phase C; operational workflows and trustworthy history take priority. The private first-party usage counter is intentionally limited to normalized adoption, surface, version, and workflow events and does not authorize broad analytics or replay. |
| Public accountability publishing | AREA_REPORTS | The ADMIN-only evidence and cleanup workflow must prove trustworthy first. Public identity, anonymization, institutional policy, and the safe public response contract require a separate accepted decision before any unauthenticated route ships. |
| Multi-source event ingestion beyond UW Badgers ICS | AREA_EVENTS | Defer until another source is operationally required. |
| Box or external signature-file integration | AREA_SIGNATURES | Deferred by D-050 until the private app-managed workflow proves reliable. |
| Native PencilKit capture | AREA_SIGNATURES | Deferred by D-050; the V1 surface is authenticated iPad Safari. |
| Database-configurable equipment guidance rules | AREA_CHECKOUTS | D-016 keeps V1 guidance code-defined. Revisit when operators need direct rule ownership. |

## Active Risks

| Risk | Early Signal | Defense | Owner |
|---|---|---|---|
| Analytics creep | Chart requests arrive before a workflow has a clear decision owner | Apply the Phase C filter in NORTH_STAR and keep reports read-only and operationally grounded | Product |
| Status drift | A feature writes to a stored status as authoritative | Enforce D-001 in review and keep derived status tests close to allocation logic | Engineering |
| Generic inventory thinking | A feature could ship unchanged for any business | Ask whether it reflects athletics operations, custody, events, crews, batteries, or staffed handoffs | Product |
| Mobile as afterthought | Web or dashboard changes omit native iOS review | Review AREA_MOBILE and the relevant iOS contract before closing the slice | Engineering |
| Scope expansion without brief | Behavior ships without a relevant brief, decision, or area contract | Follow the pre-implementation audit in AGENTS.md | Product |
| Premature Phase C | Templates, broad analytics, or extra ingestion starts before current workflows are stable | Keep deferred scope here and in NORTH_STAR until an operator habit or launch need is confirmed | Product |
| Equipment guidance stagnation | The three production guidance rules no longer cover recurring operator mistakes | Run a periodic rule audit with operator input before adding generic configurability | Product |
| Audit log growth | Retention deletes continue while export-before-delete evidence is still unavailable | Keep bounded retention observable and plan export-before-delete before the dataset reaches the agreed scale threshold | Engineering |
| Decision or migration provenance drift | A decision references a migration or constraint that is not present in the local migration chain | Reconcile the decision, schema, live migration health, and runbook before schema work; never recreate history by hand | Engineering |
| Collaborator rollout skew | A collaborator-aware client or invitation reaches production before server/client smoke proves dynamic policy enforcement | Deploy the People-capability server and clients before migration `0103`, then run `npm run smoke:collaborator` with temporary BTN and Learfield accounts and complete native and kiosk proof before inviting additional collaborators | Engineering |
| Schedule timed-release acceptance drift | Exact-version timer or consolidated delivery behavior changes without authenticated acceptance evidence | Keep private working payloads off worker reads, then verify one authenticated ten-minute release and notification dedupe on web and native before closing GAP-60 | Engineering |
| Kiosk landscape enforcement deprecation | Xcode 26 warns that `UIRequiresFullScreen` will be ignored in a future iOS release, allowing an unverified resized or portrait scene | Preserve the current landscape-only mounted-iPad contract for now, keep the adaptive split healthy, and complete a managed-device windowing migration before Apple removes enforcement | Mobile |
| Booking read-path growth | Booking change polling begins scanning or sorting materially more rows, or synchronous 5,000-row CSV exports approach the serverless timeout | Add composite booking/audit cursor indexes through a reviewed Prisma migration, then paginate or move large exports to an artifact-producing job before volume makes the current bounded route unreliable | Engineering |
| Companion delivery gap | APNs throttling or external-cache failure delays a Wisconsin Creative update | Keep the last trusted local snapshot, make manual refresh Upstash-only, never fall through to Neon, and validate signed macOS APNs delivery before staff distribution | Engineering |
| Overdue workflow rollout skew | Migration, Workflow code, or responder configuration reaches production without the compatible peers | Deploy migration and server together, configure at least one responder per active checkout location, then verify exact timing and repair dedupe before relying on Workflow delivery | Engineering |
| Signature input or artifact lifecycle drift | A tile turns green from local draft state, a public URL leaks, the public media store is reused, or one artifact is missing after a retry | Keep completion server-derived, require dedicated private-store auth, use private authenticated delivery, persist save-operation state, and run physical-input plus failure-injection acceptance before rollout | Engineering |
| UWBadgers roster source drift | Duplicate cards/tables or changed profile links create duplicate or misclassified members | Keep the adapter structurally scoped, dedupe by profile identity, persist exact snapshots, surface review suggestions, and require explicit versioned apply | Engineering |

## Change Log

- 2026-08-16: Reconciled the shared-signature identity slice without adding schema or artifact-copy risk. A unique exact same-season team-staff match now resolves the canonical Creative Staff capture, while ambiguity, players, ad-hoc records, and conflicting links fail closed. Automatic reconciliation is version-checked, audits only changes, and now starts from a mounted landing-page mutation rather than collection-list GET so framework prefetch stays read-only. Before that hardening, one Production-backed prefetch linked Ryan Dean and Cole Ahlgren as requested; audit readback confirmed `linkedTeamMembers: 2`, with no capture or artifact copy. GAP-65 remains open for authenticated save/delivery and physical iPad acceptance.
- 2026-08-16: Added local sport-aware Signature roster import support for Football (`FB`) and Volleyball (`VB`) in the `2026-27` season without a schema migration. The official UWBadgers source pages are mapped through separate source keys and starting-year URL segments; roster Preview/Apply and Illustrator asset backfill remain separate, explicitly reviewed mutations under GAP-65.
- 2026-08-16: Closed the Signature roster font lookup with the user-supplied Google Drive asset. CoreText identified family `WIsconsin`, PostScript name `WIsconsin-Regular`, and valid glyphs for every decimal digit; the exact 25,004-byte TTF is now bundled behind a jersey-only font token. Automated source/build proof passes; this local refinement is not yet promoted to production.
- 2026-08-16: Added the local Signature Capture follow-up for immutable recapture history and audited ad-hoc signers. Prior `READY` PNG/SVG revisions remain private and downloadable with versioned filenames; explicit Remove/Reset erase all versions in scope.
- 2026-08-16: Verified local shared-roster interaction polish across the MBB and signed Creative staff collections: exact 64px rows survive long team positions, groups collapse with visible completion summaries, optional capture actions are de-emphasized, row menus remain 44px, and locked settings expose reset only through a confirmed danger area. GAP-65 remains active for physical Pencil save/delivery and full iPad acceptance; this local UI slice is not yet promoted to production.

- 2026-08-15: Verified the local signature artifact and filename contract is collection-agnostic across the current MBB and Creative staff rosters. Player jersey numerals now use the licensed Gotham Ultra brand face, while staff rows remain icon-based. GAP-65 remains active for physical Pencil save/delivery and full iPad acceptance; these local refinements are not yet promoted to production.

- 2026-08-15: Deployed hardened Signature Capture to production as `dpl_Gspp8EzUCRM9VseLegodTZiXVLV6`; all 119 migrations were already applied, and authenticated production readback verified both rosters plus the revised capture UI. GAP-65 remains active for a real Pencil save, authenticated artifact delivery, and full physical iPad acceptance.

- 2026-08-15: Deployed the hardened Signature Capture source to authenticated Preview `dpl_acg3vUW3iUa3vgQ1CxCSiyaxXNMj`. Both rosters and Erik Role's capture route load with revised pen-class guidance and truthful disabled-until-ink Save state; GAP-65 remains active for a physical Pencil save, authenticated artifact delivery, production promotion, and full iPad acceptance.

- 2026-08-15: Provisioned the dedicated private Signature Blob store and connected a Signature-prefixed token to Production, Preview, and Development without changing the existing public-media token. Application-wrapper proof passed two private uploads/readbacks, anonymous `403`, full cleanup, and cleanup after an injected second-artifact failure; GAP-65 remains active for hardened-build deployment, authenticated application save/delivery, and physical iPad proof.

- 2026-08-15: Closed the source P1 findings from a fresh Sol Medium Signature Capture audit: frame-bounded Pencil input, terminal/interruption handling, stable rotation coordinates, truthful serialized drafts, undoable Clear, and request-ID-safe ambiguous retries are implemented with focused coverage. GAP-65 remains active for private-store provisioning, authenticated save/delivery, cleanup failure injection, and physical iPad proof.

- 2026-08-15: Signature Capture follow-up confirmed the current Blob credential targets a public store. The code now requires dedicated private-store auth and uses shared midpoint-quadratic smoothing for canvas and server artifacts; GAP-65 remains active until private-store provisioning, authenticated save, cleanup failure injection, and physical iPad proof are complete.

- 2026-08-15: Signature Capture production rollout completed in Vercel deployment `dpl_5WSeBG88rhaBNKKmtfM6ETVX75Um` from commit `03d6452`. Production migration health reported 119/119 applied migrations with no pending rows, and live unauthenticated `/signatures` smoke returned the expected redirect to `/login`; GAP-65 remains active for private storage, authenticated capture, cleanup failure injection, and physical iPad evidence.

- 2026-08-15: Added a standalone Creative staff signature collection, version-checked reconciliation from active visible full-time Video/Photo/Graphics accounts, and a separate landing-page roster card. Applied migration `0114_signature_creative_staff` to the configured development Neon database and verified 12 linked Creative staff members, including Erik Role; GAP-65 remains open for production, private storage, cleanup, and physical iPad evidence.

- 2026-08-15: Hardened Signature Capture year management and roster presentation. Players now sort by jersey number, staff follows the UWBadgers source order, the unwanted 2025–26 Preview collection is archived and hidden from active selection, and admin restore remains version-checked. GAP-65 remains open for hardware, private storage, cleanup, and production rollout evidence.

- 2026-08-15: Corrected UWBadgers source-role classification and grouped the Signature roster into Players, Coaching staff, and Support staff. Preview 2026–27 now reads back as 14 players, 7 required coaches, and 11 optional support staff; authenticated browser proof passed without console errors. GAP-65 remains open for hardware, private storage, cleanup, and production rollout evidence.

- 2026-08-15: Applied `0113_signature_capture` to the linked Preview Neon database and verified 118/118 migration health. Authenticated in-app `/signatures` smoke now loads without the missing-table error; production migration/deployment, private Blob, cleanup, and physical iPad acceptance remain open under GAP-65.

- 2026-08-10: Closed the repository-audit findings for report partial-result truth, native report request ownership, audit last-lookup fan-out, iOS audit-registry enforcement, and ignored scratch lint drift without adding a product gap. Utilization and checkout responses name unavailable sections, web and native warn before fallback values are treated as final, a selected native period owns its responses, `/api/audit/last` uses two bounded database queries, and `audit:ios:gaps` now fails on missing or unregistered surfaces. Native simulator compilation and authenticated visual acceptance remain verification boundaries rather than new product scope.

- 2026-08-10: Added GAP-64 and the rollout-skew risk for the locally complete durable overdue checkout notification policy. Production migration, responder configuration, and authenticated delivery proof remain open.

- 2026-08-10: Reconciled GAP-60 with the completed migration and deployment recorded by AREA_SHIFTS. The remaining gap is authenticated timer and consolidated delivery acceptance only. The Trade Board and instant-pickup MVP hardening introduced no new schema, authority, permission, transaction, or delivery gap.

- 2026-08-07: Reconciled booking lifecycle and API hardening without adding a
  product gap. Normal active-checkout cancellation and non-kiosk equipment edits
  are closed at route, policy, and service boundaries; optimistic snapshot
  checks now reach the serializable write transaction; bounded change polling
  has stable per-stream cursors; and draft/export inputs fail at validated API
  boundaries. Explicit audited cleanup for expired hidden drafts remains
  maintenance work rather than a user-facing correctness gap.
  A Vercel-focused review added the booking read-path growth risk: correctness
  is bounded today, while composite change-feed indexes and batched or
  asynchronous large exports remain deliberate performance follow-ups.

- 2026-08-07: Accepted neutral-site Away defaults and removed Staff event-time substitutes from call-time presentation. GAP-60 now remains open only for migration application, deployment, and authenticated timer/notification proof.
- 2026-08-07: Reframed GAP-60 around the accepted ten-minute automatic release. Source, focused tests, production-shaped web build, and the exact iPhone 16 Pro simulator build pass locally. Migration application, deployment, and authenticated timer/notification proof remain open.

- 2026-08-06: Applied the reviewed 2027 roster data after migration `0108`
  reached live health. The active roster and ten invitation-backed student
  profiles are audited and read back cleanly. Production deployment
  `dpl_9LsMSfoZtd9cw6jW8CbGzJqc3wUm` now serves the registration-time
  materialization path and the authenticated Allowed Emails page; GAP-63 is
  resolved, with real-account claim proof intentionally deferred to the first
  student who actually registers.

- 2026-08-05: With explicit authorization, the one-time settings-owned call-time override completed against the active visible future-event scope. It changed 2 groups and 2 fallback shifts, cleared 2 shift overrides and 6 assignment overrides, rebased 1 private working copy, refreshed 1 published group, preserved all-day date-only events, skipped 5 missing configurations, and wrote audit records. The web/native code remains local and GAP-60 remains open for deployment plus authenticated browser/native runtime proof.
- 2026-08-04: Native staff Schedule authoring adopted the additive working-copy API locally. Event detail quick actions now stage private versioned changes and expose native Publish/Discard review; assigned-slot convert-and-replace now has explicit web/native target-class pickers and server guards. No worker-facing notification or published read changes occur before publish. Wisconsin target compilation and source contracts pass. Authenticated native runtime/device proof and production rollout remain open under GAP-60.
- 2026-08-04: Closed the current timed call-time drift repair. Sport settings now synchronize future fallback windows through one shared service, preserve explicit overrides, keep all-day events date-only, and align active private working copies before publish. Live post-apply verification found no remaining future timed drift. GAP-60 remains open only for native staff mutation adoption and authenticated rollout proof.
- 2026-08-04: Hardened the web working-copy boundary. Assigned draft-only slots now publish into relational shifts and assignments, personal call-window edits persist at the assignment layer, one publish serialization race retries, first-publish notifications stay in the request lifecycle, and legacy live assignment/slot/pickup/trade controls reject or hide while a private draft exists. Native staff mutation adoption and authenticated runtime proof remain open under GAP-60 and the schedule rollout risk.
- 2026-08-04: Reconciled event-linked internal reservations with Schedule. A reservation now creates or reuses a safe primary-event assignment transactionally and updates published snapshot truth when needed. No new gap was added because explicit assignment links, collaborator boundaries, working-copy isolation, conflict checks, and deliberate crew setup remain enforced.
- 2026-08-04: Extended the reservation/Schedule reconciliation through event relinks, owner transfers, cancellation, no-show expiry, and requester deactivation. Durable assignment provenance, shared-link protection, explicit-link validation, working-copy review states, and post-commit notifications close the lifecycle gap locally; authenticated runtime proof and migration application remain rollout gates.

- 2026-08-03: Reconciled kiosk operations so every staffed kiosk exposes global checkout and reservation data. Checkout and pickup no longer relocate gear; explicit check-in transfers serialized assets or numbered bulk balance to the return kiosk. No new gap was added because actor, booking-state, availability, allocation, and audit controls remain enforced.

- 2026-07-31: Fixed a native iOS rollout-skew defect in GAP-62. The
  registration verifier returns a compact created-credential response, while
  iOS had decoded it as the fuller passkey-list model and surfaced a false
  `Unexpected response from server` after the credential was created. The
  client now has a dedicated confirmation model. Production app deployment
  and authenticated real-device proof remain open.

- 2026-07-31: Rechecked the deployed passkey surface after migration and AASA
  rollout. Production now serves the valid webcredentials association and the
  passkey routes are present behind authentication. The remaining GAP-62 proof
  is an invited browser flow plus a real iPhone enrollment/sign-in, not missing
  database or route infrastructure.
- 2026-07-31: Restored the exact three previously out-of-tree production
  migration files from repository history, modeled the existing nullable
  calendar result column, and recorded the historical 0104 through 0106 prefix
  collisions. The guarded Neon fallback then applied `0106_passkey_auth`.
  Final health reports 111 of 111 local migrations applied, no pending or
  failed rows, and no DB-only migrations. GAP-62 remains open for RP/origin
  configuration, application deployment, and authenticated device proof.
- 2026-07-31: Confirmed GAP-62 against production: the AASA and passkey API
  paths are not deployed and `0106_passkey_auth` remains pending. Native iOS
  now suppresses the unusable enrollment form on a route-level 404 and avoids
  email autofill in the optional credential-name field; this does not close the
  server, migration, authenticated-browser, or real-device rollout gates.
- 2026-07-31: Updated GAP-62 after native iOS passkey parity landed locally. Production RP/origin configuration, migration application, authenticated browser smoke, and real-device proof remain open.
- 2026-07-31: Closed the Snow Leopard website-wide source-level bug sweep findings for booking optimistic locking, collaborator capability boundaries, published Schedule access, draft filtering, dashboard stat visibility, and login Sentry loading. No new product gap was added. Authenticated browser/production smoke and a fresh mobile LCP measurement remain unverified and therefore stay represented by the existing rollout and runtime-proof boundaries.
- 2026-07-29: Reconciled native TipKit feature discovery without adding a
  product gap. One-display prompts attach only to existing reservation and
  internal Schedule controls, become eligible only after the relevant action
  or repeated Schedule use, do not change permissions or mutations, and leave
  the established global Scan permission education intact.
- 2026-07-28: Completed the final native hardening closeout without adding a
  product gap. Indeterminate reservation retries retain one immutable payload
  and source draft, preserve later edits as a fresh draft after replay, and
  distinguish definite HTTP 4xx rejection from retryable 5xx or transport
  uncertainty. The standalone kiosk build also caught and closed a
  target-specific shared-error compile defect. A narrow APNs remote-start
  concurrency window remains documented in
  `tasks/audit-ios-system-hardening.md`; final eligibility prevents database
  resurrection, while activities whose token never registers cannot be
  remotely addressed.
- 2026-07-28: Closed the iOS system-hardening findings without adding a new
  product gap. Session and kiosk credential generations reject obsolete 401s,
  APNs registration is rate-limited and cardinality-bounded, inactive-account
  reset and delivery paths fail closed, reservation notifications persist
  before response, and transient Live Activity ends remain queued for bounded
  retry. Physical-device APNs, scanner, privacy-snapshot, accessibility, and
  performance proof remain verification work rather than shipped-runtime
  claims.
- 2026-07-28: Closed the reservation Drafts audit follow-up without adding an
  open gap. Native failure paths preserve recoverable work, Draft API reads and
  writes enforce role/capability scope, mutations are audited transactionally,
  and reservation creation consumes its owned source draft atomically.
- 2026-07-28: Added the kiosk landscape-enforcement risk after the iOS 26
  simulator build confirmed `UIRequiresFullScreen` is deprecated and will be
  ignored in a future release. Current mounted-iPad behavior remains unchanged.
- 2026-07-23: Added GAP-61 after consolidating Pending Pickup into the due
  reservation model. Product behavior is unified now; destructive removal of
  the legacy enum and kiosk branches waits for verified zero production rows.
- 2026-07-23: Expanded the collaborator rollout defense for the policy-granted People directory. Migration `0103` must follow compatible server and client deployment, and authenticated BTN/Learfield smoke must prove both directory access and private-field denial.
- 2026-07-21: Added GAP-60 and the working-copy rollout risk. Web persistence, API, reconciliation, notifications, expanded editing, and default hardening are implemented locally; migration application, native staff mutation adoption, and authenticated runtime proof remain open.

- 2026-07-18: Reconciled the collaborator Published Schedule redesign. Native discovery now excludes ended events from the bounded first page, while detail, follow, and push routing continue using only published-snapshot data and capability-driven controls. No private Schedule data, schema, permission, policy, or custody gap was introduced. Authenticated temporary-account smoke remains part of the existing collaborator rollout risk.
- 2026-07-18: Reconciled native Schedule filtering and Shift Calendar management. Neutral and Non-game scopes are now distinct, while calendar status deliberately reports only private-feed readiness and the app's last successful handoff because Apple does not expose subscription completion or refresh state here. Existing token rotation, rate limiting, audit, assignment visibility, and scheduling authority contracts remain unchanged, so no new backend or correctness gap was introduced.
- 2026-07-18: Reconciled the native Edit Call Window and Post to Trade Board redesign. Both surfaces continue using existing shift PATCH and trade POST contracts, permission gates, ownership semantics, audit behavior, and scheduling policy, so no new backend or correctness gap was introduced.
- 2026-07-18: Reconciled the native Add Shift and Assign Person redesign. iOS now consumes the existing staff-only candidate-score read model and existing shift/assignment mutations without adding a schema, permission, policy, audit, notification, or scheduling-correctness gap.
- 2026-07-18: Reconciled the native My Availability and Trade Board redesign. Existing availability PATCH and trade/open-shift contracts now power direct mobile editing and an action-first board without creating a new schema, policy, permission, or correctness gap.
- 2026-07-18: Reconciled the native Schedule core redesign. Full-screen Event detail, role-adaptive assignment and gear actions, shared List/Calendar row semantics, and failure-only refresh feedback shipped without creating a new backend, schema, permission, or scheduling-policy gap. My Availability, Trade Board, and staff authoring sheets remain the already-planned next native design slices rather than active correctness gaps.
- 2026-07-16: Replaced the deferred BTN collaborator design with D-041 and `AREA_COLLABORATORS.md`. Production migration/client ordering and authenticated smoke remain an active rollout risk until completed.
- 2026-07-16: Closed collaborator stale-response, audit-history, and hidden/draft event-link leak paths; centralized fixed profile policy; and added representative route-level denial coverage. Production rollout ordering and smoke remain open.
- 2026-07-16: Applied the affiliation-policy migration through `0098`, preserved BTN parity, seeded Learfield suspended, and moved the remaining collaborator risk to authenticated production editor/client smoke.
- 2026-07-11: Split the active registry from the full historical ledger. Resolved gap rows, decisions, and dated reconciliation notes remain in [GAPS_AND_RISKS_HISTORY.md](archive/GAPS_AND_RISKS_HISTORY.md); this file now contains only active follow-up and deliberate deferral.

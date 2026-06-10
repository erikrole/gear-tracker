# Gear Tracker Architectural and Product Decisions

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Product: Gear Tracker
- Last Updated: 2026-06-08
- Status: Living decision log
- Purpose: track durable decisions, rationale, and downstream constraints

## Decision Index
- D-001: Asset status is derived, not stored
- D-002: Booking is a unified reservation + checkout model
- D-003: Event-centric checkout flow with default linkage
- D-004: Tag-first asset identity in UI
- D-005: B&H enrichment is isolated and non-destructive
- D-006: Data integrity is protected with SERIALIZABLE + exclusion constraints
- D-007: Audit logging is a product feature, not a backend afterthought
- D-008: Mixed-location operations are first-class
- D-009: Notification escalation threshold for overdue
- D-010: Scope and sequencing priorities
- D-011: Tiered role model with inheritance and ownership checks
- D-012: Booking lifecycle transition guardrails for checkout and reservation flows
- D-013: Item identity and item-kind behavior are explicit and non-interchangeable
- D-014: Cheqroom importer must be lossless and non-authoritative for live status
- D-015: Student-first mobile operations contract with role-adaptive action surfaces
- D-016: Equipment picker sections and guidance rules are code-defined in V1
- D-017: DRAFT booking state is valid
- D-018: Asset financial fields are Phase B
- D-019: Department model is Phase B
- D-020: Kit management is Phase B
- D-021: UW asset tag is an optional import field
- D-022: Item families with checkoutable units — one catalog row, optional unit custody
- D-023: Item Bundling via Parent-Child Accessories
- D-024: Booking reference numbers use kind prefix (CO/RV) with global sequence
- D-025: User-facing status labels are display-only — DB enum stays unchanged
- D-028: Photo requirement on checkout/checkin — camera-only, scan-only checkin
- D-029: Registration gated by admin-managed email allowlist
- D-030: Kiosk auth uses device-level token, not user sessions
- D-031: Multi-event booking via junction table with preserved primary FK
- D-034: Badge achievements are event-sourced, flag-gated, and profile-first
- D-035: Daily maintenance work is consolidated into morning-refresh
- D-036: Product image search is Brave-backed and human-picked
- D-037: Bulk onboarding uses an invitation-scoped account lifecycle

---

## D-001: Asset Status Is Derived, Not Stored
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Stored status fields drift and become operationally wrong.
- Decision:
  - Asset availability/status is computed from active allocations and booking lifecycle context.
- Consequences:
  - Fewer manual correction workflows.
  - Read-path complexity increases and requires robust query/test coverage.
- Guardrails:
  - No feature may treat stored status as authoritative.

## D-002: Booking Is Unified Reservation + Checkout
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Separate entities increase workflow friction and reconciliation risk.
- Decision:
  - Booking remains the single lifecycle container with states `BOOKED`, `OPEN`, `COMPLETED`, `CANCELLED`.
- Implementation (2026-03-22 — UI layer):
  - Detail page unified: single `BookingDetailPage` component with `kind` prop at `src/app/(app)/bookings/BookingDetailPage.tsx`
  - Route files `/checkouts/[id]/page.tsx` and `/reservations/[id]/page.tsx` are thin wrappers
  - API unified: `/api/bookings/[id]` serves GET + PATCH for both kinds; old routes redirect (308)
  - Shared hooks: `useBookingDetail` (fetch + reload + patch), `useBookingActions` (all actions)
  - Shared `InlineTitle` component at `src/components/InlineTitle.tsx`
  - Kind-specific behavior handled via conditional rendering (scan buttons, checkin UX, convert CTA)
- Consequences:
  - Simpler user mental model.
  - State transition policy must be explicit and validated.
  - UI parity enforced by sharing one component — no feature drift between checkout and reservation detail.

## D-003: Event-Centric Checkout with Default Linkage
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Athletics operations are event-driven; generic checkout defaults waste time.
- Decision:
  - Checkout creation defaults to event linkage with sport selection and upcoming event picker.
- Consequences:
  - Faster booking creation and stronger operational context.
  - Requires reliable event ingest and fallback UX for no-event cases.

## D-004: Tag-First Identity in UI
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Staff identify gear by sticker/tag, not product catalog name.
- Decision:
  - `tagName` is always primary label in list and picker surfaces.
  - `productName + brand/model` is secondary metadata.
- Consequences:
  - Faster physical lookup.
  - Import and enrichment logic must not overwrite tag identity.

## D-005: B&H Enrichment — Withdrawn
- Date: 2026-03-01
- Status: Withdrawn (2026-03-15)
- Context:
  - B&H blocks scraping; enrichment is non-functional.
- Decision:
  - Feature removed. All code, API route, and UI deleted.
  - If metadata enrichment is revisited, use a different source or API with explicit access.

## D-006: Integrity via SERIALIZABLE Transactions + Exclusion Constraints
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Overlapping reservations and race conditions are critical failure modes.
- Decision:
  - Preserve SERIALIZABLE transaction strategy for booking mutations.
  - Preserve PostgreSQL exclusion constraints for overlap prevention.
- Consequences:
  - High safety for concurrent operations.
  - Engineering changes must be tested for lock/retry behavior.

## D-007: Audit Logging Is a Product Feature
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Student-heavy operations require accountable change history.
- Decision:
  - New mutation paths must include auditable logs with meaningful diffs.
- Consequences:
  - Stronger trust and incident resolution.
  - Additional implementation overhead for every new flow.

## D-008: Mixed-Location Is First-Class
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Inventory and return behavior span Camp Randall and Kohl Center.
- Decision:
  - Mixed location support (`itemLocations`, `locationMode`) is part of baseline behavior.
- Consequences:
  - Every picker and return flow must account for location plurality.
  - UX needs clear return-location guidance.

## D-009: Overdue Escalation Policy
- Date: 2026-03-01
- Status: Accepted (2026-03-15)
- Context:
  - Overdue notifications exist, but multi-recipient escalation is not formalized.
- Decision (Implemented):
  - Escalation schedule: -4h, 0h, +2h, +24h relative to `booking.endsAt`
  - Dedup key: `"{bookingId}:{type}"` — prevents re-fire per booking per window
  - Current behavior: all 4 triggers notify the checkout requester only
  - Implementation: `src/lib/services/notifications.ts`
- Decision (Accepted — Phase B):
  - +24h escalation recipients: the requester AND all admins
  - Alert fatigue controls: admin-configurable escalation intervals and per-booking caps (settings page)
  - Email channel shipped 2026-03-16 via Resend; dual-channel (in-app + email) delivery active
- Reference: `AREA_NOTIFICATIONS.md` is the full spec for escalation behavior
- Consequences:
  - Faster recovery of missing gear once full escalation is wired.
  - Admin-configurable controls prevent alert fatigue.
- Guardrails:
  - Default: single escalation at +24h, then stop (admins can add more intervals)
  - Per-booking cap enforced server-side to prevent runaway notifications

## D-010: Sequencing Priorities
- Date: 2026-03-01
- Status: Accepted (updated 2026-03-09 to reflect shipped items)
- Context:
  - Multiple initiatives compete for near-term bandwidth.
- Decision:
  - Prioritize in this order:
    1. ✅ Checkout UX v2 — Complete (PRs 20–25)
    2. ✅ Items page finish — Complete (6-slice redesign, shadcn DataTable, 5-pass hardening 2026-03-22)
    3. ~~B&H metadata enrichment~~ — Withdrawn (D-005, scraping blocked)
    4. ✅ Event sync phase 1 — Complete (ICS ingest, hardening PRs 26–30)
    5. ✅ Equipment picker upgrade — Complete (sectioned picker, guidance rules, PRs 22–25)
    6. ✅ Notification center — Complete (in-app + email via Resend, escalation schedule, D-009 accepted 2026-03-15)
    7. ✅ Student dashboard baseline — Complete (role-adaptive My Gear, BRIEF_STUDENT_MOBILE_V1 shipped 2026-03-15)
- Consequences:
  - Maximizes immediate operational impact.
  - Advanced reporting intentionally deferred.

## D-011: Tiered Role Model with Inheritance
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Operations need broad staff control while preserving student ownership boundaries.
- Decision:
  - Roles follow inheritance: `ADMIN > STAFF > STUDENT`.
  - `ADMIN` can do everything.
  - `STAFF` can add/edit all users, items, reservations, and check-outs.
  - `STAFF` can promote and demote users between roles.
  - `STAFF` can force location exceptions.
  - `STUDENT` can view all users, items, reservations, and check-outs.
  - `STUDENT` can add/edit only their own reservations and check-outs.
  - V1 delete policy uses cancel/archive patterns, not hard delete.
- Consequences:
  - Clear, predictable authorization behavior across dashboard and mutation paths.
  - Requires consistent ownership checks and row-level action filtering.

## D-012: Booking Lifecycle Transition Guardrails
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Checkout and reservation flows are the highest-frequency workflows and the highest risk for integrity bugs.
- Decision:
  - Use explicit transition guardrails:
    - `BOOKED -> OPEN` allowed.
    - `BOOKED -> CANCELLED` allowed by role/policy.
    - `OPEN -> COMPLETED` only when all allocations are returned.
    - `OPEN -> CANCELLED` disallowed in normal flow.
    - `COMPLETED` and `CANCELLED` are terminal in V1.
  - All availability-impacting edits must re-run overlap/conflict validation.
  - Partial check-in is supported but must not complete booking early.
- Consequences:
  - Reduces invalid state transitions and custody gaps.
  - Requires strict action gating in UI and server enforcement on all mutations.

## D-013: Item Identity and Item-Kind Behavior
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Items need clearer operational identity and fewer data-shape ambiguities across list, create, and detail workflows.
- Decision:
  - Serialized assets are tag-first (`tagName`) and must preserve distinct identity semantics.
  - Bulk items follow quantity-first semantics and separate validation path.
  - UI status shown for items is derived from active allocations; no direct editable authoritative status.
  - Item detail header uses a fixed derived-status set with booking-aware deep links: `Available`, `Check Out by {user}`, `Reserved by {user}`, `Checking Out`, `Needs Maintenance`, and `Retired`.
  - Eligibility toggles (reserve/check-out/custody) are policy flags, not live status values.
  - `Delete` on items is reserved for policy-safe records with no active allocations and no historical booking links; otherwise operators use `Retire`.
  - Item detail defaults to an `Info` dashboard view that combines booking overview and editable item information, with QR thumbnail rendering and controlled fiscal-year/category inputs.
- Consequences:
  - Lower risk of identity drift and status confusion.
  - Requires explicit branching in form validation, mutation endpoints, QR uniqueness checks, and delete gating.

## D-014: Cheqroom Importer Is Lossless and Non-Authoritative for Status
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Migration data includes many columns, mixed quality, and legacy status labels that conflict with Gear Tracker derived-status architecture.
- Decision:
  - Importer must parse all source columns and preserve unmapped values in source payload metadata.
  - Source `Status` is stored for traceability only and never written as authoritative asset status.
  - Import process supports dry run, create-only, and upsert modes with row-level diagnostics.
- Consequences:
  - Low migration data loss risk and better auditability.
  - Additional implementation complexity in staging and reporting.

## D-015: Student-First Mobile Operations Contract
- Date: 2026-03-02
- Status: Accepted
- Context:
  - Students are primary day-to-day users on phones.
  - Cheqroom-style mobile can become cluttered when admin actions and dashboards are not role-adaptive.
- Decision:
  - Mobile UX is action-first and role-adaptive across dashboard, reservations, check-outs, and items.
  - V1 mobile prioritizes overdue and due-soon execution, scan access, and owned-work actions for students.
  - Event sync remains operational context for booking flows, not a required standalone dashboard module in V1.
- Consequences:
  - Lower cognitive load and faster student task completion.
  - Every area touching dashboard or list interactions must validate behavior against `AREA_MOBILE.md`.

## D-016: Equipment Picker Sections and Guidance Rules Are Code-Defined in V1
- Date: 2026-03-09
- Status: Accepted
- Context:
  - The checkout picker uses a sectioned kit-first flow with context-aware guidance hints.
  - Configuring sections and rules via a database admin UI adds complexity without clear near-term need.
- Decision:
  - Equipment sections are defined in `src/lib/equipment-sections.ts`.
  - Guidance rules are defined in `src/lib/equipment-guidance.ts`.
  - New sections or rules are added via code PR, not an admin UI.
  - Database-configurable rules are deferred to Phase C.
- Consequences:
  - Fast to add new rules; requires a code deployment.
  - Operators cannot self-serve rule changes without engineering support.
- Guardrails:
  - New guidance rules must be reviewed against actual equipment workflows, not added speculatively.

## D-017: DRAFT Booking State Is Valid
- Date: 2026-03-09
- Status: Shipped (2026-03-16)
- Context:
  - `checkout-rules.ts` handles a `DRAFT` booking state (allows `edit` and `cancel`) but AREA_CHECKOUTS.md and DECISIONS.md did not formally document this state.
- Decision:
  - DRAFT is a valid pre-BOOKED state for interrupted checkout creation flows.
  - DRAFT allows edit and cancel only; no transitions to OPEN or COMPLETED from DRAFT.
  - DRAFT records appear in dashboard Drafts section only; excluded from main checkout list.
- Implementation (2026-03-16):
  - `POST /api/drafts` — create or update a DRAFT booking with partial form data + selected equipment
  - `GET /api/drafts/[id]` — load draft for form pre-fill on resume
  - `DELETE /api/drafts/[id]` — discard a draft (cascade-deletes items)
  - Dashboard: Drafts section in My Gear column with Resume/Discard actions
  - Create flow: auto-saves as draft on cancel if form has data; deletes draft on successful creation
  - Draft items stored as `BookingSerializedItem` / `BookingBulkItem` with no allocations or stock movements
- Consequences:
  - Dashboard Drafts section recovers interrupted flows.
  - DRAFT state is explicitly excluded from checkout list queries (status filter defaults exclude it).
- Guardrails:
  - No new DRAFT behavior (auto-expiry, promotion rules, sharing) without a formal brief.

## D-018: Asset Financial Fields
- Date: 2026-03-11
- Status: Shipped (2026-03-16)
- Context:
  - Schema has `purchasePrice`, `purchaseDate`, `warrantyDate`, `residualValue` on Asset.
- Decision:
  - Financial fields exposed in item detail Info tab → Procurement section for non-STUDENT users.
  - API PATCH endpoint validates and persists all four fields.
  - Import can populate them via CSV.
- Consequences:
  - Staff and admins can view and edit procurement metadata inline on any item.
  - Students do not see financial fields (role-gated in UI).

## D-019: Department Model
- Date: 2026-03-11
- Status: Shipped (2026-03-21)
- Context:
  - `departmentId` FK exists on Asset, Department model exists in schema, but no filter or display in UI.
- Decision:
  - Department is an optional organizational grouping for items.
  - Import can populate it. Department combobox filter shipped on items list page.
- Implementation (2026-03-21):
  - Department FK on Asset, combobox filter on items page, department selectable in new item form.
  - GAPS_AND_RISKS.md Phase B entry struck through.
- Consequences:
  - Items can be filtered and organized by department.

## D-020: Kit Management Is Phase B
- Date: 2026-03-11
- Status: Accepted
- Context:
  - Full Kit/KitMembership schema exists (kit creation, item membership, active status) but zero UI.
- Decision:
  - Kit creation UI and kit-based checkout are Phase B. Schema is ready.
  - V1 imports may reference kits in `sourcePayload` metadata only.
- Consequences:
  - Kit features can be built without schema migration when prioritized.

## D-021: UW Asset Tag Is an Optional Import Field
- Date: 2026-03-11
- Status: Accepted
- Context:
  - `uwAssetTag` on Asset is a university-specific asset tracking identifier from Cheqroom import.
- Decision:
  - Keep as optional field. Importable via CSV. Expose in item detail for admin users.
  - Not a primary identity field — `tagName` remains primary per D-004.
- Consequences:
  - Supports institutional tracking without polluting the tag-first identity model.

## D-022: Item Families With Checkoutable Units
- Date: 2026-03-14
- Status: Accepted
- Context:
  - Items like batteries and consumables are still normal catalog items, but one row represents many identical checkoutable units.
  - Cameras and other serialized gear remain one row per physical asset because serial, history, condition, and identity matter at the catalog level.
  - QR-coded batteries need unit-level custody for pickup, return, loss, and audit without exploding the item catalog into 40+ rows.
- Decision:
  - Keep `BulkSku` as the implementation record for item families and `BulkSkuUnit` as the optional unit-custody record.
  - Product language treats these as item families, not a separate normal-user inventory bucket.
  - `/items` is the primary discovery surface for serialized assets, unit-tracked item families, and quantity-tracked item families.
  - `/bulk-inventory` remains an admin/staff operations cockpit for adjustments, thresholds, unit status, QR labels, and audits.
  - When enabled, numbered `BulkSkuUnit` records (1..N) are created under the parent item family.
  - Unit status (AVAILABLE, CHECKED_OUT, LOST, RETIRED) is stored directly on the unit, not derived.
  - Booking creation requests quantity. Kiosk pickup scans bind exact physical units; kiosk return scans verify those units.
  - Unit QR values derived as `{binQrCodeValue}-{unitNumber}` are accepted as a direct scan of that specific numbered unit.
  - `BookingBulkUnitAllocation` links specific units to bookings with checkout/checkin timestamps.
  - Existing quantity-only SKUs can be converted to numbered tracking via a dedicated endpoint.
- Consequences:
  - One item-family row can display availability like `43/46 available`.
  - Loss tracking works at the individual unit level without creating catalog rows for every battery.
  - Physical unit labels must match unit numbers.
  - All unit operations use `createMany`/`updateMany` to batch DB calls efficiently.
  - QR-coded batteries continue to use this model when they behave like the existing Sony battery flow: one item family with unit-level tracking beneath it.
  - Derived unit QR scans keep batteries out of top-level serialized assets while still supporting individual QR labels and custody.
  - Camera-model battery compatibility warnings are advisory at creation; they do not block checkout creation because physical battery accountability happens at kiosk pickup.
- Guardrails:
  - Unit status is NOT derived like serialized assets (D-001). It is stored directly because units lack the full allocation time-window model.
  - Checked-out units cannot be marked lost/retired — must be checked in first.
  - Unit numbers are permanent; retiring #7 does not renumber #8–40.

## D-023: Item Bundling via Parent-Child Accessories
- Date: 2026-03-16
- Status: Accepted
- Context:
  - Equipment like camera bodies ship with handles, cages, and other accessories that travel as a unit but need independent maintenance tracking.
  - Camera-tied SD cards use operational slot tags such as `MBB 17 IV 1A`, where `MBB 17 IV` is the parent camera and `1A` means camera 1, slot A.
  - Full kit management (predefined templates, kit-level bookings) is overkill for V1. Users want a simple "this cage belongs to this camera" relationship.
- Decision:
  - Self-referential FK `parentAssetId` on Asset with `ON DELETE SET NULL`. One level only — no nesting.
  - Accessories are hidden from the items list by default (filtered by `parentAssetId IS NULL`).
  - Accessories always travel with their parent — no independent booking line items.
  - Camera-tied SD cards, cages, and fixed camera parts are treated as attachments/accessories, not bulk SKUs, when they should not be individually checked out.
  - Accessories can be flagged independently for maintenance.
  - Standalone items can be converted to accessories (attach) and back (detach) at any time.
  - Accessories can be moved between parents.
  - On attach, `availableForCheckout` and `availableForReservation` are set to false (parent controls booking).
  - On detach, both flags are restored to true.
- Consequences:
  - Items list shows accessory count badge (+N) on parent items.
  - Item detail page labels the surface as Attachments, groups SD Cards / Cages and Rigging / Misc Parts, and shows "Attached to [Parent]" for child items.
  - SD card child detail and scan preview show the parsed camera slot label when the operational tag ends in a slot code like `1A`.
  - Scan preview shows parent relationship when scanning an accessory QR.
  - No schema changes to bookings — accessories ride along implicitly.
- Guardrails:
  - A parent item cannot itself be a child (no nesting).
  - Self-reference is blocked (cannot attach item to itself).
  - Staff+ permission required for attach/detach/move operations.

---

## D-024: Booking reference numbers use kind prefix (CO/RV) with global sequence
- Date: 2026-03-16
- Status: Shipped
- Context:
  - Bookings identified only by CUID internally and user-entered title for display. Neither is speakable or unambiguous on radios.
  - Staff need to say "grab gear for CO-0042" and have it be unambiguous.
  - Options considered: sport prefix (variable width, mutable risk), kind prefix (fixed width, immutable per D-002), both (too long), random (ambiguous), status quo.
- Decision:
  - Format: `{CO|RV}-{zero-padded global sequence}` (e.g., CO-0001, RV-0002).
  - Kind prefix chosen over sport prefix because BookingKind is architecturally immutable (D-002), while sportCode is only accidentally immutable.
  - Global Postgres sequence `booking_ref_seq` shared across all booking kinds — no gaps in the global ordering.
  - 4-digit zero-padding, extends naturally at 10000+.
  - DRAFT bookings do not get refNumbers — assigned only on real creation via `createBooking()`.
  - Searchable in checkouts and reservations list views.
- Consequences:
  - Every non-draft booking gets a stable, speakable, unique reference number.
  - Displayed as monospace badge in list rows, detail sheet header, and dashboard.
  - Sport context available via existing filters, not baked into the identifier.
- Guardrails:
  - Sequence value obtained inside SERIALIZABLE transaction — race-free.
  - Unique constraint on `ref_number` column prevents duplicates.

## D-026: Event Sync Runs on Daily Cron with Manual Refresh
- Date: 2026-03-24
- Status: Accepted
- Context:
  - Calendar event sync is currently manual-only (button click in Settings). Staff forget to sync, leading to stale event data that causes shift coverage gaps and missed game-day prep.
  - Vercel Hobby plan supports only one cron invocation per day. Existing notification cron runs at 8 AM UTC.
- Decision:
  - Calendar sync is implemented through `GET /api/cron/morning-refresh` in `vercel.json`, running once daily at 08:00 UTC (`0 8 * * *`) before the 09:00 UTC notification cron.
  - Morning refresh calls enabled-source sync, generates shifts for new events, and owns the related daily maintenance work documented in D-035.
  - Auth: shared cron bearer validation via `withCron()`.
  - Manual "Sync Now" button remains in Settings for on-demand refresh (existing feature).
  - Calendar source list in Settings shows staleness indicator based on `lastFetchedAt`.
  - On repeated sync failure (3+ consecutive errors), create an in-app notification to all admins.
- Consequences:
  - Events refresh daily without manual intervention. Staff can still sync on-demand when needed.
  - Shift auto-generation fires after daily sync — new events produce shifts within ~24 hours.
  - If upgraded to Vercel Pro, cron frequency can increase without code changes.
- Guardrails:
  - Sources with `enabled: false` are skipped by cron (same as manual sync).
  - Sync is idempotent — manual + cron firing close together is harmless.
  - Sequential source processing to avoid parallel DB contention.
  - Manual source sync keeps the source-scoped database lease so duplicate clicks return 409 instead of running duplicate external fetch and shift-generation work.

## D-027: Venue Mapping Is Admin-Owned with Pattern Validation
- Date: 2026-03-24
- Status: Accepted
- Context:
  - `LocationMapping` table maps ICS venue text to internal locations via regex patterns. Currently any admin can add patterns with no validation. Malformed regex silently falls back to substring match, which may produce unexpected matches.
  - PD-2 asked "who owns the mapping table?" — answer is admins, since they manage locations and calendar sources.
- Decision:
  - Venue mappings are ADMIN-only (not STAFF). Matches location and calendar source management permissions.
  - Pattern validation on create/update: test `new RegExp(pattern, "i")` and reject with 400 if it throws.
  - Canonical term is "venue mapping" in UI, `LocationMapping` in code (no rename — too much churn for no user value).
  - Priority tie-breaking: when multiple patterns match with equal priority, longest pattern wins (most specific match). Add `ORDER BY priority DESC, LENGTH(pattern) DESC` to query.
  - No audit logging in V1 — mapping changes are low-frequency and admin-only. Revisit if usage patterns change.
- Consequences:
  - Only admins manage mappings — reduces accidental misconfiguration.
  - Invalid regex patterns are rejected upfront — no silent fallback surprises.
  - Deterministic matching with priority + length tie-breaking.
- Guardrails:
  - STAFF users cannot access venue mapping CRUD (403).
  - Pattern validation is server-side only (client shows friendly error).

---

## Platform Invariants

These are non-negotiable integrity constraints. Every feature must preserve them. Previously tracked in `AREA_PLATFORM_INTEGRITY.md` (now folded here to eliminate duplication).

1. **Derived status** (D-001): Asset availability is computed from active allocations, never stored as authoritative.
2. **SERIALIZABLE transactions** (D-006): Booking mutations use SERIALIZABLE isolation + PostgreSQL exclusion constraints for overlap prevention.
3. **Audit completeness** (D-007): Every mutation path emits audit records with actor, diff, and timestamp.
4. **Concurrency safety**: Performance improvements must not weaken correctness constraints. Cache boundaries for event and metadata read paths are pending (see Pending Decisions).

## Decision Rules for Future Changes
1. Any proposal that risks D-001 or D-006 requires explicit architecture review.
2. Any workflow change touching students must preserve mobile-first usability and low cognitive load.
3. Any new ingestion or enrichment integration must be isolated and failure-tolerant.
4. Major scope changes must update both this file and `PRODUCT_SCOPE.md` in the same PR.
5. Any dashboard/list/scan UX change must also be reflected in `AREA_MOBILE.md`.

## D-025: User-Facing Status Labels Are Display-Only
- Date: 2026-03-22
- Status: Accepted
- Context: The raw `BookingStatus` enum values (DRAFT, BOOKED, PENDING_PICKUP, OPEN, COMPLETED, CANCELLED) are technical and confusing in the UI. "OPEN" means nothing to an equipment manager checking out gear.
- Decision: Introduce `statusLabel(status, kind)` helper in `src/components/booking-details/helpers.ts` that maps DB enum to user-facing labels. DB enum, API responses, and business logic remain unchanged.
- Label mapping:
  - DRAFT → "Draft"
  - BOOKED → "Confirmed" (reservations) / "Booked" (checkouts)
  - PENDING_PICKUP → "Pending Pickup"
  - OPEN → "Checked out"
  - COMPLETED → "Completed"
  - CANCELLED → "Cancelled"
- Constraint: All UI surfaces must use `statusLabel()` for display. Never show raw enum values to users.
- Downstream: List pages, search results, and any future status references should adopt `statusLabel()`.

---

## Active Risks and Mitigations
- Risk: Event data staleness or malformed ICS input.
  - Mitigation: idempotent imports, observability, fallback ad hoc booking path.
- Risk: Alert fatigue from escalation.
  - Mitigation: threshold controls + dedup keys + policy review.

## D-028: Photo Requirement on Checkout/Checkin

**Decision (2026-03-30, amended 2026-05-10):** Every checkout and checkin completion requires physical verification. The active execution path is kiosk scanning for pickup and return. The signed-in app `/scan` page is lookup-only.

**Context:** Equipment accountability requires documenting condition at both handoff points. Without photos, damage disputes lack evidence. Without scan-based checkin, items can be marked as returned without physical verification.

**Constraints:**
- Camera-only capture (no gallery upload) to ensure photo is taken at the moment of handoff
- One photo per booking per phase (equipment laid out together)
- Photos stored in Vercel Blob under `bookings/{id}/{phase}/`
- `BookingPhoto` model tracks phase, image URL, actor, and timestamp
- Completion endpoints (`completeCheckoutScan`, `completeCheckinScan`) enforce photo existence
- Admin override bypasses photo requirement (consistent with scan override pattern)
- Photos displayed on booking detail page in the info tab

**Downstream Effects:**
- Regular app checkout/check-in scan routes remain kiosk-gated 403 stubs.
- App `/scan` deep links with `checkout` or `phase` query params show kiosk handoff copy and remain in lookup mode.
- Booking detail and dashboard surfaces must not link operators to `/scan?checkout=...`.
- Kiosk pickup and return routes are the custody scan source of truth.

---

## D-029: Registration Gated by Admin-Managed Email Allowlist

**Decision (2026-04-03):** User self-registration is gated by an `AllowedEmail` table. Only email addresses pre-approved by an ADMIN or STAFF user can register. The allowlist entry also pre-assigns the user's role (STAFF or STUDENT).

**Context:** Open registration allowed anyone to create an account and access the system. For an internal tool managing university athletics equipment, access must be controlled. No email service is needed — admins tell users verbally to sign up, and the system verifies their email is on the allowlist.

**Constraints:**
- `AllowedEmail` model: email (unique), role, createdById, claimedAt, claimedById
- Registration endpoint checks allowlist before creating user; returns 403 if not found
- Allowlist entry marked as `claimed` on successful registration (prevents reuse)
- Role comes from allowlist entry, not hardcoded to STUDENT
- STAFF can only add STUDENT-role entries; ADMIN can add both STAFF and STUDENT
- Claimed entries cannot be deleted (audit trail preserved)
- Admin UI under Settings > Allowed Emails with add/delete/filter
- First-time user access now flows through the allowlist and registration. Direct temporary-password onboarding through `/api/users` is retired for beta; administrator password reset remains the forced-password recovery path.

**Downstream Effects:**
- Public `/register` still works but only for pre-approved emails
- First-time user creation via `/api/users` (POST) no longer bypasses the allowlist for beta onboarding
- Existing users unaffected (allowlist only gates new registrations)

## D-037: Bulk Onboarding Uses an Invitation-Scoped Account Lifecycle

- Date: 2026-06-03
- Status: Accepted for V1 planning
- Context:
  - Gear Tracker needs to onboard large student and staff cohorts without forcing an operator to manually create users, add allowed emails, and separately manage first sign-in handoff.
  - Existing registration security depends on D-029's `AllowedEmail` gate.
  - Direct-created accounts previously used `forcePasswordChange`.
  - The beta launch should avoid shared first-time password handoffs.
- Decision:
  - Treat invite-to-register as the first-time invitation-scoped lifecycle.
  - Keep `AllowedEmail` as the self-registration gate. Do not introduce open signup or domain-wide automatic access.
  - Add a bulk-capable onboarding workflow where an authorized operator can paste or upload roster rows, preview validation results, and commit selected rows.
  - Support `Invite to register` by creating or reusing unclaimed allowed-email entries.
  - Retire first-time `Create account with temporary password` onboarding. `/api/users` POST and `/api/users/bulk-create` should no longer mint temporary onboarding credentials.
  - Enforce role boundaries server-side on every preview and commit. STAFF may onboard STUDENT accounts only; ADMIN may onboard STAFF and STUDENT accounts.
  - Keep public registration and authentication responses safe from membership enumeration. Authenticated staff/admin preview may show operational status for records within their management scope.
  - Keep native iOS forced-password handling for administrator reset and recovery users before entering the app shell.
  - Audit every create, claim, skip, retry, and follow-up onboarding action.
- Consequences:
  - `/api/allowed-emails` and registration remain the first-time onboarding path.
  - First-time onboarding must not generate, export, or require shared temporary passwords.
  - The web operator experience should make allowlist invitations feel like the single account-access workflow.
  - iOS cannot treat login success as enough if `forcePasswordChange` is true for reset/recovery.
- Implementation Reference:
  - `docs/BRIEF_ONBOARDING_V1.md`
  - `tasks/onboarding-flow-plan.md`

## D-031: Multi-Event Booking via Junction Table with Preserved Primary FK
- Date: 2026-04-24
- Status: Accepted
- Context:
  - A single booking can cover multiple back-to-back events (game weekends, coverage days).
  - Creating one booking per event duplicates equipment picking and makes conflicts hard to reason about.
  - `Booking.eventId` is a single FK read in 36+ places across the codebase (dashboard, my-shifts, reports, shift groups, search, drafts).
- Decision:
  - Add `BookingEvent` junction table `(booking_id, event_id, ordinal)` with composite unique on `(booking_id, event_id)` and cascade delete on both FKs.
  - Preserve `Booking.eventId` as the **primary** event (ordinal 0, chronologically first). All existing readers keep working unchanged.
  - Cap at 3 linked events per booking (V1 — can grow later).
  - API accepts either `eventId` (legacy single) or `eventIds[]` (multi); mixing both returns 400.
  - `startsAt`/`endsAt` auto-derive from min-to-max of linked events plus the existing travel buffer, unless caller overrides.
  - Migration `0042_booking_events` backfills a junction row for every existing booking with `event_id`, ensuring reverse lookup works uniformly against new and legacy data.
  - Reverse lookup queries (event detail → bookings) use `OR(eventId, events.some)` to be robust against any code path that sets the primary FK without the service layer.
- Consequences:
  - Zero-rewrite migration — no existing reader needs changes.
  - `Booking.eventId` becomes slightly denormalized (redundant with the ordinal-0 junction row). Acceptable trade-off for read-path stability.
  - If the primary event is deleted, the FK nulls (`onDelete: SetNull`) but the remaining junction rows persist. A V2 trigger or service-layer rebuild can promote the next ordinal. V1 accepts brief "booking with no primary event" state.
  - Dashboard/my-shifts group-by-event still keys on primary only. Grouping by all linked events is a V2 enhancement.
  - Junction-table approach is symmetric to existing patterns (`BookingSerializedItem`, `BookingBulkItem`, kit memberships) so there's no new idiom.

---

## D-030: Kiosk Auth Uses Device-Level Token
- Date: 2026-04-07
- Status: Accepted
- Context:
  - Kiosk iPads need persistent authentication without individual user login.
  - Multiple students use the same device in quick succession.
  - Audit trail must distinguish kiosk actions from personal device actions.
- Decision:
  - New `KioskDevice` model — separate from User/Session.
  - Admin generates 6-digit activation code; iPad enters code to pair.
  - Device gets long-lived session token (7 days) stored as HTTP-only cookie.
  - `requireKiosk()` auth helper validates device token, returns `{ kioskId, locationId }`.
  - Student identity passed as `actorId` parameter on each API call (tap avatar, no password).
  - Booking/audit records include `source: "KIOSK"` metadata + kioskDeviceId.
- Consequences:
  - Kiosk session survives browser restarts (cookie-based, 30-day expiry).
  - No user credentials stored on kiosk device.
  - Admin can deactivate a kiosk remotely by toggling `active` flag.
  - All kiosk API routes use `withKiosk()` wrapper instead of `withAuth()`.

---

## D-034: Badge Achievements Are Event-Sourced, Flag-Gated, and Profile-First
- Date: 2026-05-09
- Status: Accepted for sliced implementation
- Context:
  - The prior badge implementation was reverted because it mixed schema, route wiring, profile UI, reports, and evaluator behavior in one large slice.
  - Current kiosk and scan flows have clear domain outcome boundaries, while the legacy app scan routes are 403 stubs.
  - Recognition should not compete with operational profile signals such as role, availability, overdue gear, or admin actions.
- Decision:
  - Badge events are emitted only from domain outcomes: kiosk checkout or pickup opens a checkout, checkout return completion flips to `COMPLETED`, kiosk scan succeeds or fails, and trade status flips to `COMPLETED`.
  - `BADGES_ENABLED !== "true"` returns before evaluator work, badge database queries, or side effects.
  - Launch has no retroactive backfill. Only post-enable domain events can award badges.
  - On-time return logic uses a 15-minute UTC grace window after `booking.endsAt`.
  - Badge definition `key` values are immutable. Rename display fields in place; retire bad keys with `active=false` and seed replacement keys.
  - `onCheckoutReturned` and `onTradeCompleted` must be emitted from single status-flip helpers so competing call paths do not double-award.
  - Peer badge visibility defaults to true via `SystemConfig["badges.peerVisible"]`; staff/admin can always see user badges.
  - The primary user UI is a `Badges` tab on `/users/{id}` for students, staff, and admins. No top-level nav item and no badge chrome in the profile hero.
  - The legacy `StudentBadge` model/table name remains in place until a dedicated cleanup migration. Product language and UI should say user awards or badge awards.
  - Badge progress is displayed only when it is backed by real counters or streak rows. Manual badges must not show invented progress.
- Consequences:
  - The system can ship in independent slices with the flag off until preview verification passes.
  - Historical badge data remains stable if users are deactivated or definitions are retired.
  - Reports can aggregate from the legacy-named `StudentBadge` award table without becoming the primary profile experience.
- Guardrails:
  - Legacy checkout scan stubs stay non-events.
  - Shift approval is not a badge event. Attendance-based shift badges are out of scope unless a future product decision reopens them.
  - Award notification delivery is persistent inbox first; push fan-out is deferred.

---

## D-035: Daily Maintenance Work Is Consolidated Into Morning-Refresh
- Date: 2026-05-13
- Status: Accepted
- Context:
  - Vercel cron capacity is intentionally small, and duplicated cron routes drift from the scheduled path.
  - Shift-group archiving already runs inside `morning-refresh`; the standalone `archive-shifts` route was unscheduled dead code.
  - Stale `PENDING_PICKUP` checkouts need a daily cleanup path, but adding another cron route would increase scheduling and monitoring surface.
- Decision:
  - `GET /api/cron/morning-refresh` is the single daily scheduling maintenance route for calendar sync, shift generation, shift-group archiving, stale trade expiry, and pending-pickup auto-expiry.
  - Delete duplicate standalone cron routes when their work is already owned by morning-refresh.
  - Pending-pickup checkouts auto-expire after 48 hours past `startsAt`.
- Consequences:
  - One daily maintenance response captures the operational cleanup summary.
  - Fewer unscheduled cron routes and fewer places for schedule comments to drift.
  - Pending-pickup expiry must be idempotent, audited, and safe to retry.
- Guardrails:
  - Expiry must release serialized allocations, restore held bulk stock, release scanned numbered units, cancel open scan sessions, and write a system audit entry.
  - Cleanup failures should be visible in the morning-refresh response without preventing unrelated per-source calendar sync results from being recorded.

---

## D-036: Product Image Search Is Brave-Backed and Human-Picked
- Date: 2026-05-20
- Status: Accepted
- Context:
  - D-005 withdrew B&H enrichment because scraping was blocked.
  - Staff still need a fast way to pick clean item photos during item creation and replacement.
  - Metadata enrichment remains out of scope for V1, and item identity must stay tag-first.
- Decision:
  - Use Brave Search API as the only shipped product image-search provider.
  - Hide the Search tab unless `BRAVE_SEARCH_API_KEY` is configured.
  - Seed searches from product title, brand, model, or item-family name when available.
  - Bias outbound searches toward product photos on white backgrounds while keeping the visible field editable.
  - Prefer B&H image candidates through Brave's `site:bhphotovideo.com` operator, then merge broader product-photo-biased Brave results so B&H source links do not monopolize the grid when retailer previews are blocked.
  - Keep the human in the loop: staff selects a result, sees the source domain, and the app re-hosts the chosen URL through the existing image endpoint.
  - Do not scrape B&H, Google Images HTML, retailer pages, or CDN pages.
  - Do not write metadata from search results into item identity fields.
- Consequences:
  - Setup stays to one optional provider key instead of carrying unused fallback branches.
  - Result quality is good enough for image selection but still requires human judgment.
  - Existing paste URL and upload paths remain the fallback when Brave is unconfigured or quota is exhausted.
- Guardrails:
  - Search route requires `asset.edit`, validates query length, and rate-limits by user.
  - Result saves must continue through Blob re-hosting endpoints so stored item photos are app-owned.
  - Provider failures and quota exhaustion must leave paste URL and upload available.

---

## Pending Decisions
1. ~~Event sync refresh cadence and staleness thresholds~~ — Resolved: D-026.
2. ~~Venue mapping governance owner~~ — Resolved: D-027.
3. ~~Metadata enrichment cache TTL target~~ — withdrawn with D-005.
4. ~~Student mobile KPI definitions~~ — resolved (PD-5): taps-to-checkout ≤3, scan success ≥95%, task completion <30s. Telemetry deferred to Phase B.

## Change Log
- 2026-06-08: Updated D-029/D-037 for the no-temp-password beta pivot. First-time onboarding now stays invite-first through AllowedEmail registration, while forced-password handling remains recovery-only.
- 2026-06-03: Added D-037 to make onboarding a bulk-capable, invitation-scoped account lifecycle while preserving the allowlist gate and forced-password safety.
- 2026-06-02: Updated D-026 to match shipped cron reality. Calendar sync is now documented as part of `morning-refresh` at 08:00 UTC, aligned with D-035, while manual Settings sync remains the on-demand escape hatch.
- 2026-05-20: Added D-036 for Brave-backed human-pick product image search. This replaces any revival of the withdrawn B&H scraping path for photos and keeps metadata enrichment out of scope.
- 2026-05-13: Added D-035 for daily maintenance consolidation: morning-refresh owns shift archiving, stale trade expiry, and pending-pickup auto-expiry; duplicate unscheduled cron routes should be deleted.
- 2026-05-10: Amended D-028 to match the kiosk custody boundary: app `/scan` is lookup-only, while checkout pickup and return scans run through kiosk routes.
- 2026-03-01: Initial decision log created from project memory dump.
- 2026-03-02: Added student-first mobile operations contract decision.
- 2026-03-09: Updated D-009 to reflect partial implementation and pending acceptance criteria. Updated D-010 to mark shipped items. Added D-016 (code-defined picker sections/rules) and D-017 (DRAFT booking state).
- 2026-03-11: Docs hardening — moved D-017 to Accepted. Clarified D-009 email as Phase B. Added AREA_NOTIFICATIONS.md cross-reference to D-009. Folded AREA_PLATFORM_INTEGRITY.md into Platform Invariants section. Added D-018 (asset financial fields → Phase B), D-019 (department → Phase B), D-020 (kit management → Phase B), D-021 (UW asset tag → optional import field).
- 2026-03-14: Added D-022 (item families with checkoutable units — trackByNumber flag, unit picker, conversion endpoint).
- 2026-03-15: Withdrew D-005 (B&H enrichment) — scraping blocked by source, feature removed.
- 2026-03-16: Shipped D-017 (DRAFT booking lifecycle). Shipped D-018 (asset financial fields — Procurement section in item detail).
- 2026-03-16: Added D-024 (booking reference numbers — CO/RV kind prefix + global sequence).
- 2026-03-22: Updated D-002 — UI layer now unified. Checkout and reservation detail pages share single `BookingDetailPage` component. API routes consolidated to `/api/bookings/[id]`.
- 2026-03-22: Added D-025 — user-facing status labels (OPEN→"Checked out", BOOKED→"Confirmed") via `statusLabel()` helper. DB enum unchanged.
- 2026-03-24: Added D-026 (event sync hourly cron + staleness indicator — resolves PD-3) and D-027 (venue mapping admin-only + pattern validation — resolves PD-2). All pending decisions now resolved.
- 2026-03-25: Doc sync — resolved PD-4 (student KPIs defined). Updated D-010 to reflect shipped state (B&H withdrawn, notification center shipped, student dashboard shipped). Updated D-009 email channel from "Phase B" to "Shipped 2026-03-16". Updated D-019 from "Phase B" to "Shipped 2026-03-21" (department filter + combobox).
- 2026-03-30: Added D-028 (photo requirement on checkout/checkin — camera-only capture, scan-only checkin, BookingPhoto model).
- 2026-04-03: Added D-029 (registration gated by admin-managed email allowlist — AllowedEmail table, role pre-assignment, Settings UI).
- 2026-04-07: Added D-030 (kiosk auth — device-level token, not user sessions. KioskDevice model with activation code pairing).
- 2026-04-24: Added D-031 (multi-event booking — BookingEvent junction table with preserved Booking.eventId as primary; cap 3 events per booking).
- 2026-04-29: Added D-032 (kiosk operates within `kiosk.locationId` — `users`, `dashboard`, and `student/[userId]` reads are scoped; users with `locationId = null` are visible to every kiosk as a transitional rule until rosters universally carry a location FK).
- 2026-04-29: Added D-033 (DB-enforced single active allocation per asset — partial unique index `asset_allocations_asset_id_active_unique ON asset_allocations(asset_id) WHERE active = TRUE`. Closes the cross-flow double-checkout race that no application-level guard fully prevents. Application paths now `try { create } catch P2002 → 409`; migration 0048 includes a pre-flight DO block that fails if duplicates already exist).
- 2026-05-05: Updated D-022/D-023 for camera attachment scope — camera-tied SD cards/cages/fixed parts stay as non-bookable asset attachments, while QR-coded batteries keep numbered bulk semantics.
- 2026-05-05: Updated D-022 for derived numbered bulk unit QR scans using `{binQrCodeValue}-{unitNumber}`.
- 2026-05-05: Updated D-022 for kiosk-scanned numbered batteries and non-blocking camera-model battery availability warnings.
- 2026-05-13: Reframed D-022 around first-class item families: `BulkSku` remains the implementation model, but `/items` is the normal discovery/detail surface and `/bulk-inventory` is admin operations.
- 2026-05-09: Added D-034 for badge achievements: event-sourced service boundary, feature flag off path, no retroactive backfill, 15-minute on-time grace, immutable definition keys, single-emit status helpers, peer visibility default, and profile-first UI.

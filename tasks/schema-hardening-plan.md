# Schema Hardening Plan

Last updated: 2026-07-23

## Scope

Audit the current Prisma schema and migration history for integrity, indexing,
relation, nullability, naming, and lifecycle gaps. Preserve the active booking
due-date and collaborator-directory work already present in the worktree.

## Contracts

- Derived operational status remains computed from allocations and lifecycle state.
- Mutations remain transactional, permission-gated, and auditable.
- Existing applied migrations are immutable.
- Any new database constraint must be proven compatible with current write paths.
- Database deployment is out of scope unless explicitly approved.

## Slices

- [x] Read the schema, recent migrations, migration tooling, decisions, gaps, and
      relevant area contracts end to end.
- [x] Inventory candidate integrity and performance gaps and trace each candidate
      through its API/service consumers.
- [x] Implement the smallest independently verifiable hardening slice, using a
      new additive migration if the database shape changes.
- [x] Add focused schema or service regression coverage.
- [x] Format and validate Prisma, check migration ordering, regenerate codemaps,
      and run focused tests, TypeScript, lint, docs verification, and `build:app`.
- [x] Record shipped behavior, deferred findings, proof, and deployment status.
- [x] Reconcile the complete manually applied License V2 shape in migration
      history before `0104` deploys.
- [x] Add printed-label actor referential integrity and database checks for
      accepted inventory, booking, and sport-count invariants.
- [x] Keep pull-request CI read-only by separating app compilation from
      deploy-shaped migration execution.
- [x] Deploy `0104`, inspect exact live catalog metadata, and add an immutable
      `0105` correction for the manually created expiry timestamp type.

## Stop Conditions

- Current schema work cannot be separated safely from user-owned changes.
- Live migration history disagrees with local migration folders.
- A candidate constraint requires an unbounded data cleanup or backfill.
- The schema shape conflicts with an accepted decision or owning area contract.

## Review

- **Shipped locally:** Historical release and printed-label actors are real
  optional `User` relations with supporting indexes and `ON DELETE SET NULL`.
- **Reconciled:** Migration `0104_license_claim_history_integrity` now records
  the complete manually applied License V2 shape, restores the claim-holder
  foreign key, and adds preflighted database checks for stock, numbered units,
  booking quantities/windows, and sport staffing counts.
- **CI:** Pull-request validation now runs Prisma validation, migration shape
  checks, the full test suite, and `build:app` without attempting to deploy
  migrations against placeholder or shared database credentials.
- **Live preflight:** All 105 pre-existing local migrations matched Neon.
  Seven claim rows included one attributed release and one labeled unknown
  occupant, with no orphaned release actors, duplicate active user claims, or
  codes above the two-slot limit.
- **Deployment:** Neon applied `0104_license_claim_history_integrity` through
  the repository HTTP fallback. The local artifact checksum matches migration
  history, all nine constraints are validated, all four target indexes have
  their exact definitions, and all eleven live invariant preflights remain zero.
- **Post-deploy correction:** Exact column inspection found the manually created
  `license_codes.expires_at` column used `timestamptz(6)` while Prisma and the
  empty bootstrap use `timestamp(3)` without time zone. No expiry values were
  populated. Neon applied `0105_license_expiry_timestamp_parity` through the
  repository HTTP fallback; it conditionally converts timestamp-with-time-zone
  values through UTC and no-ops on an already correct column.
- **Current migration health:** Neon reports all 107 local migrations applied,
  no pending migrations, no unresolved failures, and no database-only
  migrations. Local checksums for `0104` and `0105` match the recorded rows.
- **Proof:** Prisma format, validate, and generate passed. Nineteen focused
  schema/migration/bootstrap tests, migration-prefix validation, TypeScript,
  ESLint, codemap/docs checks, whitespace checks, and `npm run build:app`
  passed. Migration `0104` also executed successfully against a disposable
  local PostgreSQL database generated from the current Prisma schema; catalog
  inspection confirmed all nine target constraints and four target indexes,
  rejection behavior, history-preserving `SET NULL` relations, and a successful
  retry. Migration `0105` executed twice against a non-GMT disposable
  PostgreSQL session, preserved an example UTC instant to millisecond precision,
  and produced exact `timestamp(3) without time zone`. The final deploy-shaped
  `npm run build` found no pending migrations and passed.
- **Repository-suite boundary:** The full suite completed 2,627 passing tests
  with eight failed tests plus one failed suite across seven concurrently edited
  iOS, Users, badges, and collaborator-booking contract files. None exercise
  this schema slice; the focused schema suite remains green.
- **Direct-engine boundary:** Prisma's live direct PostgreSQL path returned the
  known blank schema-engine failure. The repository HTTP fallback applied
  `0104` and `0105` successfully, and the health wrapper plus exact HTTP catalog
  queries verified the result.

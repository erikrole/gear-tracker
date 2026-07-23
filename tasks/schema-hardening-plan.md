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

- [ ] Read the schema, recent migrations, migration tooling, decisions, gaps, and
      relevant area contracts end to end.
- [ ] Inventory candidate integrity and performance gaps and trace each candidate
      through its API/service consumers.
- [ ] Implement the smallest independently verifiable hardening slice, using a
      new additive migration if the database shape changes.
- [ ] Add focused schema or service regression coverage.
- [ ] Format and validate Prisma, check migration ordering, regenerate codemaps,
      and run focused tests, TypeScript, lint, docs verification, and `build:app`.
- [ ] Record shipped behavior, deferred findings, proof, and deployment status.

## Stop Conditions

- Current schema work cannot be separated safely from user-owned changes.
- Live migration history disagrees with local migration folders.
- A candidate constraint requires an unbounded data cleanup or backfill.
- The schema shape conflicts with an accepted decision or owning area contract.

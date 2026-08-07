# 2027 Sport Assignment Reconciliation Plan - 2026-08-06

## Goal

- Add Social as a first-class creative area alongside Video, Photo, and Graphics.
- Prepare ten student accounts through the existing invitation gate with their names, areas, and 2027 sport assignments ready to materialize when they register.
- Reconcile only the adjusted 2027 roster: oversight rows remain excluded, Laurie Digman remains uninvited, and the explicitly removed existing rows are not recreated.

## Route

- Owner area: `AREA_USERS` with `AREA_SHIFTS` and `AREA_MOBILE` contracts.
- Ledger: this plan.
- Source data: the supplied 2027 PDF matrix for sport coverage and the read-only Creative Staff workbook for student identity, campus email, and area grouping.

## Source Checks

- `ShiftArea` is a Prisma enum used by user profiles, area assignments, Schedule, Resources, targeting, and iOS labels.
- `AllowedEmail` is the registration gate. It now stores the pending student profile, areas, and sport payload needed to finish onboarding without creating a placeholder user.
- Registration claims an unclaimed `AllowedEmail` and creates the `User` inside one transaction.
- Existing rows are preserved by the sport roster reconciliation. `defaultTraveler` remains unchanged.
- New student sport assignments will be stored on the pending invitation and materialized into `StudentSportAssignment` on registration. No placeholder active users or passwords are created.
- Existing unclaimed invitations receive their prepared profile through the staff/admin-gated `PATCH /api/allowed-emails/[id]` path, with the profile replacement and audit entry in one transaction.

## Pending student invitation batch

The workbook supplies identity, campus email, and position. The PDF remains the
sport source for this batch. Areas listed after the primary area are secondary
area assignments. `Abigail Peterson` has no sport row in the PDF and receives
area data only.

| Student | Email | Primary / areas | PDF sport codes |
| --- | --- | --- | --- |
| Johnathan Dye | `jpdye@wisc.edu` | Photo | `WSOC`, `WTEN` |
| Amina Haniieva | `haniieva@wisc.edu` | Photo | `MTEN` |
| Maddy Nissenbaum | `nissenbaum2@wisc.edu` | Photo | `MSOC`, `MSWIM`, `WSWIM` |
| Connor Oamek | `coamek@wisc.edu` | Graphics | `WHKY`, `MXC`, `WXC`, `MTRACK`, `WTRACK` |
| Mason Howard | `mrhoward6@wisc.edu` | Graphics | `MSOC`, `WSOC`, `MTEN`, `WTEN`, `MSWIM`, `WSWIM` |
| Mateo Reynolds | `mreynolds22@wisc.edu` | Graphics | `MGOLF`, `WGOLF`, `MROW`, `WROW`, `LROW` |
| Billy Powell | `wpowell5@wisc.edu` | Graphics | `VB`, `SB`, `MSWIM`, `WSWIM` |
| Ben Xiong | `bfxiong@wisc.edu` | Video | `WRES`, `MTEN`, `MSWIM`, `WSWIM` |
| Abigail Peterson | `anpeterson6@wisc.edu` | Video, Social | none |
| Owen Phillips | `ophillips2@wisc.edu` | Video | `WHKY`, `MSOC`, `WTEN` |

Existing student identities from the same workbook are Zach Lowery (Photo),
Miles Felix (Photo), David Saddler (Video), and William Clarke (Video). Laurie
Digman is intentionally excluded from the invitation batch.

The workbook's current `Assignments` column conflicts with the 2027 PDF for
several of these students. It is retained as reference data only until a later
explicit source decision changes the plan.

## Reconciliation overrides

- Exclude Cole Ahlgren and Emma Hansen from the desired additions per the
  oversight correction.
- Remove Usman Syed from `WHKY`.
- Remove Ryan Dean from `MXC`, `WXC`, `MTRACK`, and `WTRACK`.
- Remove Erik Role and Nolan Kromke from `MROW`, `WROW`, and `LROW`.
- Do not invite Laurie Digman, and do not create accounts for any other
  unresolved name without a confirmed account mapping.

## Stop Conditions

- Stop live account or roster writes until the dry run is accepted with explicit apply approval.
- Stop if the workbook or PDF creates a conflicting identity or sport source that cannot be resolved from the current request.
- Stop if live Neon migration history cannot be verified before deployment.
- Do not invite Laurie Digman in this batch.

## Slices

- [x] Add `SOCIAL` to the ShiftArea schema, local migration, web/native area contracts, tests, and docs.
- [x] Extend pending invitations with profile, area, and sport assignment data and materialize those assignments during registration.
- [x] Add the unclaimed-invitation profile update path so existing invitation rows do not get skipped as duplicates.
- [x] Produce the read-only account and roster dry run, including existing-user updates, pending students, unresolved or excluded rows, and no-write proof.
- [x] Apply after explicit approval, using the existing roster service and audit contract for live users and invitation-backed pending profiles for new students.

## Verification

- [x] Focused area, onboarding, registration, and roster tests.
- [x] `npm run db:migrate:check`
- [x] `npx prisma validate`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs` when shared source or schema maps change.
- [x] Authenticated production browser smoke for Settings > Allowed emails: all 32 entries render, the pending count is 10, and existing Collaborator rows render correctly. The registration endpoint returned its expected validation response without creating a test account; Users and Schedule filters were not part of this deployment verification.
- [x] Run `npm run db:migrate:deploy` and the approved live apply; post-apply migration health reports 113/113 local migrations applied.

## Review

- Shipped: migration `0108_social_pending_invite_profile` is live; five missing student invitations were created, five existing unclaimed invitations were profiled, 17 active sport pairs were added, and Usman Syed was removed from `WHKY`. The isolated web artifact was deployed to production as `dpl_9LsMSfoZtd9cw6jW8CbGzJqc3wUm`.
- Verified: the live branch reports 113/113 local migrations applied; the roster has 32 rows; all `defaultTraveler` values remain false; the five missing plus five existing pending invitations carry the reviewed profile/sport payload; Laurie Digman remains absent; the 11 sport-batch adds and one removal have `ADMIN` audit entries; all ten invitation writes have matching audit entries; and the authenticated production Allowed Emails page renders all 32 entries, including Collaborator rows and the ten pending student records.
- Dry run: the adjusted target remains 65 rows after all pending students register, from 16 current rows, 50 additions, and 1 removal. The full table and live apply readback are in `tasks/2027-sport-assignment-reconciliation-dry-run.md`.
- Remaining proof boundary: a real invitation claim was intentionally not executed because it would create and consume a student's production account. The deployed registration path is covered by the production build and a no-side-effect invalid-body probe; the first real claim will provide the next natural end-to-end readback.
- Closeout: no further implementation or deployment action is required for this slice.

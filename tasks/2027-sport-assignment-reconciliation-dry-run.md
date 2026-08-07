# 2027 Sport Assignment Reconciliation Dry Run

Read-only run: 2026-08-06

Sources:

- Sport coverage: [Creative Team Content Support - 2027.pdf](/Users/erole/Library/Containers/com.apple.mail/Data/Library/Mail Downloads/1F0BF163-87C0-4B2D-AA36-3E69AC0D4921/Creative%20Team%20Content%20Support%20-%202027.pdf)
- Identity, campus email, and area: [Creative Staff workbook](https://docs.google.com/spreadsheets/d/1jCHyOKelSLKRvaYPmE0Z7TMIPCFzHdtDa-DJmoIqgJs/edit?usp=sharing)
- Current roster: live `Wisconsin Creative` production database, read-only queries only

## Result

| Measure | Dry-run result |
| --- | ---: |
| Current `StudentSportAssignment` rows | 16 |
| Active-user additions | 17 |
| Pending-profile sport assignments | 33 |
| Total additions | 50 |
| Removals | 1 |
| Target rows after all pending students register | 65 |
| `defaultTraveler` changes | 0 |
| Database writes | 0 |

The 17 active-user additions are 15 sport assignments for the four existing
students, plus two `Nolan Kromke` golf assignments present in the source matrix.
The 33 pending-profile assignments belong to the ten students listed below.

## Full sport table

`[active]` means the user already has an active, visible account. `[pending]`
means the assignment will be materialized when the student claims the prepared
invitation. Current rows are the live rows found during the dry run.

| Sport | Current live roster | Additions | Removals | Target roster after apply/claim |
| --- | --- | --- | --- | --- |
| FB | Ben Snyder; Casey McNulty; Jacob Phillips; Kelsey Sharkey | none | none | Ben Snyder; Casey McNulty; Jacob Phillips; Kelsey Sharkey |
| MBB | Cole Ahlgren; Ryan Dean | none | none | Cole Ahlgren; Ryan Dean |
| MHKY | Nolan Kromke; Usman Syed | none | none | Nolan Kromke; Usman Syed |
| MGOLF | Cole Ahlgren | Nolan Kromke [active]; Mateo Reynolds [pending] | none | Cole Ahlgren; Nolan Kromke; Mateo Reynolds |
| WGOLF | Cole Ahlgren | Nolan Kromke [active]; Mateo Reynolds [pending] | none | Cole Ahlgren; Nolan Kromke; Mateo Reynolds |
| SB | Ashley Steltenpohl | Billy Powell [pending] | none | Ashley Steltenpohl; Billy Powell |
| VB | Ashley Steltenpohl; Emma Hansen; Maddy Pehler | David Saddler [active]; Miles Felix [active]; Billy Powell [pending] | none | Ashley Steltenpohl; Emma Hansen; Maddy Pehler; David Saddler; Miles Felix; Billy Powell |
| WBB | Maddy Pehler | David Saddler [active]; William Clarke [active] | none | Maddy Pehler; David Saddler; William Clarke |
| WHKY | Usman Syed | Connor Oamek [pending]; Owen Phillips [pending]; Miles Felix [active] | Usman Syed | Connor Oamek; Owen Phillips; Miles Felix |
| WRES | none | Ben Xiong [pending]; Zach Lowery [active] | none | Ben Xiong; Zach Lowery |
| MSOC | none | Maddy Nissenbaum [pending]; Mason Howard [pending]; Owen Phillips [pending] | none | Maddy Nissenbaum; Mason Howard; Owen Phillips |
| WSOC | none | David Saddler [active]; Johnathan Dye [pending]; Mason Howard [pending] | none | David Saddler; Johnathan Dye; Mason Howard |
| MTEN | none | Amina Haniieva [pending]; Ben Xiong [pending]; Mason Howard [pending] | none | Amina Haniieva; Ben Xiong; Mason Howard |
| WTEN | none | Johnathan Dye [pending]; Mason Howard [pending]; Owen Phillips [pending] | none | Johnathan Dye; Mason Howard; Owen Phillips |
| MSWIM | none | Ben Xiong [pending]; Billy Powell [pending]; Maddy Nissenbaum [pending]; Mason Howard [pending] | none | Ben Xiong; Billy Powell; Maddy Nissenbaum; Mason Howard |
| WSWIM | none | Ben Xiong [pending]; Billy Powell [pending]; Maddy Nissenbaum [pending]; Mason Howard [pending] | none | Ben Xiong; Billy Powell; Maddy Nissenbaum; Mason Howard |
| MXC | none | Connor Oamek [pending]; William Clarke [active]; Zach Lowery [active] | none | Connor Oamek; William Clarke; Zach Lowery |
| WXC | none | Connor Oamek [pending]; William Clarke [active]; Zach Lowery [active] | none | Connor Oamek; William Clarke; Zach Lowery |
| MTRACK | none | Connor Oamek [pending]; William Clarke [active]; Zach Lowery [active] | none | Connor Oamek; William Clarke; Zach Lowery |
| WTRACK | none | Connor Oamek [pending]; William Clarke [active]; Zach Lowery [active] | none | Connor Oamek; William Clarke; Zach Lowery |
| MROW | none | Mateo Reynolds [pending] | none | Mateo Reynolds |
| WROW | none | Mateo Reynolds [pending] | none | Mateo Reynolds |
| LROW | none | Mateo Reynolds [pending] | none | Mateo Reynolds |

## Account and area table

| Student | Email | Areas | Live account state | Sport handling |
| --- | --- | --- | --- | --- |
| David Saddler | `dsaddler@wisc.edu` | Video | Active, visible | Add `WBB`, `VB`, `WSOC` |
| William Clarke | `wrclarke@wisc.edu` | Video | Active, visible | Add `WBB`, `MXC`, `WXC`, `MTRACK`, `WTRACK`; source alias `Will Clarke` |
| Zach Lowery | `zjlowery@wisc.edu` | Photo | Active, visible | Add `WRES`, `MXC`, `WXC`, `MTRACK`, `WTRACK` |
| Miles Felix | `mjfelix2@wisc.edu` | Photo | Active, visible | Add `WHKY`, `VB` |
| Johnathan Dye | `jpdye@wisc.edu` | Photo | No account; invitation row absent | Prepare `WSOC`, `WTEN` |
| Amina Haniieva | `haniieva@wisc.edu` | Photo | No account; invitation row absent | Prepare `MTEN` |
| Maddy Nissenbaum | `nissenbaum2@wisc.edu` | Photo | Unclaimed invitation exists | Prepare `MSOC`, `MSWIM`, `WSWIM` |
| Connor Oamek | `coamek@wisc.edu` | Graphics | No account; invitation row absent | Prepare `WHKY`, `MXC`, `WXC`, `MTRACK`, `WTRACK` |
| Mason Howard | `mrhoward6@wisc.edu` | Graphics | No account; invitation row absent | Prepare `MSOC`, `WSOC`, `MTEN`, `WTEN`, `MSWIM`, `WSWIM` |
| Mateo Reynolds | `mreynolds22@wisc.edu` | Graphics | Unclaimed invitation exists | Prepare `MGOLF`, `WGOLF`, `MROW`, `WROW`, `LROW` |
| Billy Powell | `wpowell5@wisc.edu` | Graphics | No account; invitation row absent | Prepare `VB`, `SB`, `MSWIM`, `WSWIM` |
| Ben Xiong | `bfxiong@wisc.edu` | Video | Unclaimed invitation exists | Prepare `WRES`, `MTEN`, `MSWIM`, `WSWIM` |
| Abigail Peterson | `anpeterson6@wisc.edu` | Video; Social | Unclaimed invitation exists | Prepare areas only; no sport row in PDF |
| Owen Phillips | `ophillips2@wisc.edu` | Video | Unclaimed invitation exists | Prepare `WHKY`, `MSOC`, `WTEN` |

The five invitation rows already present are Abigail Peterson, Ben Xiong, Maddy
Nissenbaum, Mateo Reynolds, and Owen Phillips. The five rows absent from the
allowlist are Johnathan Dye, Amina Haniieva, Connor Oamek, Mason Howard, and
Billy Powell. Miles Felix and Zach Lowery are already claimed accounts and will
not receive duplicate invitations.

Laurie Digman is excluded and does not receive access yet.

## Explicit overrides and source notes

- `Usman Syed` is removed from `WHKY`; his existing `MHKY` row remains.
- `Ryan Dean` is absent from the four cross-country/track rows, so that removal is a no-op in the live database; his existing `MBB` row remains.
- `Erik Role` and `Nolan Kromke` are absent from the three rowing rows, so those removals are no-ops; Nolan remains on `MHKY` and is added to `MGOLF` and `WGOLF` because those source cells are not marked oversight.
- Cole Ahlgren and Emma Hansen are excluded from new additions under the oversight correction; their existing live rows are preserved.
- Generic `Student`, `General Student Help`, and `Photo Team` entries are ignored.
- The workbook `Assignments` column is reference-only for this batch where it conflicts with the PDF. The PDF supplies sport codes, while the workbook supplies identity, email, and area.

## No-write proof and apply gate

The dry run used `SELECT` queries against the live production branch for database
identity, migration history, schema presence, current users, current areas,
current sport assignments, and invitation status. No `INSERT`, `UPDATE`,
`DELETE`, `ALTER`, roster API mutation, or invitation API mutation was run.

The dry-run gate was read-only and required separate approval for migration and
data writes. That approval was given on 2026-08-06. The reviewed migration and
data apply then used the existing roster service plus audit contract and the
invitation lifecycle services. The live readback reported 32 active roster
rows, 33 pending-profile sport assignments, zero non-false `defaultTraveler`
values, no Laurie Digman invitation or user, no Ryan/Erik/Nolan rowing or
cross-country/track rows targeted for removal, and matching audit entries for
all 11 sport-add batches, the Usman `WHKY` removal, five created invitations,
and five updated invitations.

## Apply result

Live schema/data apply: 2026-08-06

- `0108_social_pending_invite_profile` is applied; migration health is 113/113
  with no pending, unresolved failed, or DB-only rows.
- Five missing unclaimed Student invitations were created: Johnathan Dye,
  Amina Haniieva, Connor Oamek, Mason Howard, and Billy Powell.
- Five existing unclaimed invitations were updated: Maddy Nissenbaum, Mateo
  Reynolds, Ben Xiong, Abigail Peterson, and Owen Phillips.
- The 17 active sport pairs are materialized now, including Nolan Kromke's
  golf rows. Usman Syed's `WHKY` row is removed; his `MHKY` row remains.
- Existing oversight rows for Cole Ahlgren and Emma Hansen were preserved.
- The source implementation that materializes pending areas/sports at
  registration is deployed in production as `dpl_9LsMSfoZtd9cw6jW8CbGzJqc3wUm`.
- Authenticated production readback confirms Settings > Allowed emails renders
  all 32 entries, including the ten pending students and existing Collaborator
  rows. A no-side-effect invalid registration request returned `400`; no real
  invitation was claimed during verification.

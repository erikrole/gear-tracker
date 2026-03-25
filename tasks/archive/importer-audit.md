# Importer Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Not Ready (12/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 4/5 | AREA doc comprehensive. Two briefs (original + fix) provide context. Minor inconsistency: dry-run deferred in BRIEF_FIX but still listed as feature in AREA doc. |
| Hardening | 1/5 | No hardening pass performed. Pre-shadcn CSS throughout, no skeleton, no AbortController, no double-click guards, hardcoded hex colors (dark mode broken). Only unhardened page in the app. |
| Roadmap | 3/5 | V1 scope and out-of-scope well-defined. No forward roadmap for V2. sourcePayload is a known AREA requirement with no plan to deliver. |
| Feature completeness | 2/5 | Core workflow works (upload, map, preview, import). But AREA doc's defining requirement — lossless sourcePayload — NOT implemented. No dry-run. No import mode selection. Bulk items not routed to BulkSku model. |
| Doc sync | 2/5 | AREA doc describes features (sourcePayload, dry-run, 3 modes, dedup by sourceExternalId) that don't exist in code. Change log doesn't note unimplemented features. ACs not marked met/unmet. |

## Critical Issues

### 1. Lossless parsing violation (D-014)
`sourcePayload` field does not exist in Prisma schema. All unmapped columns (checkout snapshots, contact/custody fields, flags, geo, depreciated value) are **silently dropped**. Directly violates "Lossless Parsing Rule" and AC #1 in AREA_IMPORTER.md.

### 2. No hardening pass
Only major page in the app without 5-pass hardening. Pre-shadcn CSS classes (`data-table`, `summary-grid`, `alert-error`, `metric-value`), inline styles, hardcoded `#fffbeb` (dark mode broken).

### 3. Bulk item import broken
Rows with `Kind=Bulk` create `Asset` records with `consumable=true` instead of `BulkSku` + `BulkStockBalance` records. BulkSku model exists in schema but importer never uses it.

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Import Wizard | `/import` (701 lines) | **Not hardened** | 9 useState (no hooks extracted). No AbortController. Boolean `loading` with text change only (no skeleton/progress). Pre-shadcn CSS throughout. Inline styles with CSS vars. Hardcoded hex colors. No error boundary. No double-click guard on Import button. No client-side auth guard. |

## API Route Status
| Route | Method | Auth | Validation | Audit | Transactions | Issues |
|---|---|---|---|---|---|---|
| `/api/assets/import` | POST (606 lines) | withAuth + requirePermission (STAFF/ADMIN) | CSV row-level error collection. Missing location = hard error. | Yes (createAuditEntry with counts) | $transaction (but NOT SERIALIZABLE) | No Zod on mapping JSON. No sourcePayload. Update loop O(n) inside transaction. |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| CSV upload + parse | Shipped | AREA_IMPORTER | Client + server parsing |
| Column mapping (Cheqroom preset) | Shipped | AREA_IMPORTER | Auto-detect + manual override |
| Column mapping persistence | Shipped | AREA_IMPORTER | localStorage |
| Preview with create/update/skip counts | Shipped | AREA_IMPORTER | Summary cards + row badges |
| Batch DB operations | Shipped | D-014 | findMany, createMany, transaction |
| Duplicate detection (assetTag + serialNumber) | Shipped | AREA_IMPORTER | Single findMany lookup |
| Re-import safety (qrCode reuse) | Shipped | AREA_IMPORTER | Existing qrCodeValue preserved |
| Location + Department auto-creation | Shipped | AREA_IMPORTER | Batch upserts |
| Kit creation + membership | Shipped | AREA_IMPORTER | Kit upserts + membership createMany |
| Import report (counts + error CSV) | Shipped | AREA_IMPORTER | Summary page + downloadable errors |
| Audit logging | Shipped | D-007 | createAuditEntry with stats |
| Image download to Vercel Blob | Shipped | AREA_IMPORTER | Batched (5 concurrency, 5s timeout) |
| **Lossless parsing (sourcePayload)** | **Missing** | AREA_IMPORTER AC #1 | No field in schema. Unmapped columns dropped. |
| **Dry-run mode** | **Missing** | AREA_IMPORTER | Deferred in BRIEF_FIX but still in AREA doc |
| **Import mode selection** | **Missing** | AREA_IMPORTER | Always upserts. No create-only option. |
| **Bulk item -> BulkSku routing** | **Missing** | AREA_IMPORTER | Kind=Bulk becomes Asset with consumable=true |
| **Dedup by sourceExternalId** | **Missing** | AREA_IMPORTER | Only checks serialNumber + assetTag |
| **sourcePayload checkout snapshots** | **Missing** | AREA_IMPORTER | Check-out dates silently dropped |
| **sourcePayload contact/custody** | **Missing** | AREA_IMPORTER | Contact/Custody fields dropped |
| **Serialized qty != 1 warning** | **Missing** | AREA_IMPORTER | No validation |
| **Stream parsing for large files** | **Missing** | AREA_IMPORTER | Full file in memory |
| Bulk item (non-serialized) import | Deferred | BRIEF_FIX | V1 out of scope |
| Historical booking reconstruction | Deferred | AREA_IMPORTER | Out of scope |
| Custom preset creation UI | Deferred | AREA_IMPORTER | Out of scope |
| Undo/rollback | Deferred | BRIEF_FIX | Out of scope |

## Open Gaps & Blockers
1. **sourcePayload not in schema** — Defining AREA doc requirement (D-014 lossless parsing) unimplemented. Data silently lost on every import.
2. **Page completely unhardened** — Only page in the app without 5-pass treatment.
3. **BulkSku routing missing** — Bulk items created as wrong entity type.
4. **No import mode selection** — Users can't choose create-only vs upsert.
5. **No Zod on mapping JSON** — `JSON.parse` on user input without schema validation.
6. **AREA doc describes unbuilt features** — sourcePayload, dry-run, 3 modes, sourceExternalId dedup all documented as if shipped.
7. **Dark mode broken** — Hardcoded hex colors in warning rows and step indicators.
8. **No progress indicator for long imports** — Only boolean loading state.

## Recommended Actions (prioritized)
1. **[P0] Reconcile AREA doc with reality** — Either implement sourcePayload or update AREA_IMPORTER.md to clearly mark it as deferred. Currently the doc claims features that don't exist. This is the worst doc-sync gap in the system.
2. **[P0] Add sourcePayload to schema + importer** — Add JSON field to Asset model. Preserve all unmapped columns per D-014. This is the core architectural requirement.
3. **[P1] Fix BulkSku routing** — Route Kind=Bulk rows to BulkSku + BulkStockBalance instead of Asset with consumable=true.
4. **[P1] Add Zod validation on mapping JSON** — Replace bare JSON.parse with schema validation.
5. **[P1] Run /harden-page on import page** — shadcn migration, AbortController, skeleton, double-click guard, dark mode, error boundary.
6. **[P2] Add import mode toggle** — Let users choose create-only vs upsert.
7. **[P2] Add progress indicator** — Show row count progress during import for large files.
8. **[P3] Implement dry-run mode** — Or explicitly remove from AREA doc.

## Roadmap Status
**Rating: Partially defined**

- V1 scope and out-of-scope clearly defined in AREA doc and BRIEF_FIX.
- Plan file archived (`tasks/archive/importer-fix-plan.md`, 4 slices checked).
- No forward roadmap for V2 (sourcePayload, bulk import, generic presets).
- NORTH_STAR lists importer as Phase A complete with no Phase B/C items.
- GAPS_AND_RISKS has no open importer gaps — but should, given sourcePayload is unbuilt.

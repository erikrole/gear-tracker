# Importer Ship-Readiness Audit
**Date**: 2026-04-06
**Auditor**: Claude (automated)
**Area**: Importer (CSV Import Pipeline)
**Overall Verdict**: Nearly ready (19/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_IMPORTER.md comprehensive with generic CSV architecture, Cheqroom preset mapping, lossless parsing rules, validation categories, error handling, and security. All 6 ACs checked. |
| Hardening | 4/5 | Import page hardened with handleAuthRedirect (with returnTo), classifyError, and isAbortError on all fetch calls (preview + import). Multi-step flow now properly redirects to login on 401. Network errors distinguished from server errors. Transaction-wrapped on API side (`$transaction`). |
| Roadmap | 3/5 | No standalone roadmap. AREA doc tracks V1 scope clearly. Future presets are architecturally supported but unplanned. |
| Feature completeness | 5/5 | All 6 ACs met. Generic CSV parsing, Cheqroom preset, dry run, create/upsert modes, row-level diagnostics, lossless source payload, $transaction-wrapped. |
| Doc sync | 4/5 | Last updated 2026-03-25. Only 2 changelog entries (initial + docs hardening). Missing entries for actual feature shipping, GAP-25 sourcePayload fix. |

## Page-by-Page Status
| Page | Route | Lines | Hardening | Issues |
|---|---|---|---|---|
| Import page | `/import` | ~330 | Hardened | handleAuthRedirect + classifyError + isAbortError on preview and import fetches. returnTo param for login redirect. |

## API Route Status
| Route | Auth | Validation | Transaction | Notes |
|---|---|---|---|---|
| `POST /api/assets/import` | ADMIN/STAFF | Zod + CSV parsing | Yes ($transaction) | Dry run + create + upsert modes. Row-level errors. Lossless sourcePayload. |

## Recommended Actions (prioritized)

1. **[High] Add 401 handling to import page** — Session expiry mid-import shows confusing error. Import can take several seconds for large files — high risk of session timeout between upload and commit.

2. **[Medium] Add AbortController to import fetches** — Upload + preview + import are sequential fetches without cancellation support.

3. **[Low] Backfill AREA_IMPORTER.md changelog** — Missing entries for feature shipping and GAP-25 sourcePayload fix.

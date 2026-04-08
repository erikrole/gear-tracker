# Settings Ship-Readiness Audit
**Date**: 2026-04-06
**Auditor**: Claude (automated)
**Area**: Settings (Categories, Sports, Escalation, Database, Calendar Sources, Venue Mappings, Allowed Emails)
**Overall Verdict**: Nearly ready (19/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_SETTINGS.md updated this session with 3 new sub-pages, 10 ACs all checked. Each sub-page is self-contained with clear purpose. |
| Hardening | 4/5 | All 7 settings sub-pages migrated to useFetch hook (AbortController, 401 redirect, visibility refresh) for data loading. All mutations hardened with handleAuthRedirect + classifyError + isAbortError. CategoryRow component also hardened. Database page uses on-demand fetch with classifyError. |
| Roadmap | 4/5 | Breadcrumb + sidebar roadmaps exist and are shipped. No standalone settings roadmap but area is config-focused (low churn). |
| Feature completeness | 5/5 | All 10 ACs met. Categories tree CRUD, sports config, escalation rules, database diagnostics, calendar sources, venue mappings, allowed emails all shipped. |
| Doc sync | 3/5 | AREA_SETTINGS.md updated this session. But changelog is sparse (only 4 entries total covering months of work). |

## Page-by-Page Status
| Page | Route | Lines | Hardening | Issues |
|---|---|---|---|---|
| Settings root | `/settings` | 5 | N/A | Redirect to first sub-page. |
| Categories | `/settings/categories` | ~200 | Hardened | useFetch for load. Mutations: handleAuthRedirect + classifyError + isAbortError. CategoryRow also hardened. |
| Sports | `/settings/sports` | ~250 | Hardened | useFetch for load. Mutations: handleAuthRedirect + classifyError + isAbortError. |
| Escalation | `/settings/escalation` | ~300 | Hardened | useFetch for load. Mutations: handleAuthRedirect + classifyError + isAbortError. |
| Database | `/settings/database` | ~270 | Hardened | On-demand fetch with handleAuthRedirect + classifyError + isAbortError. |
| Calendar Sources | `/settings/calendar-sources` | ~310 | Hardened | useFetch for load. Mutations: handleAuthRedirect + classifyError + isAbortError. |
| Venue Mappings | `/settings/venue-mappings` | ~310 | Hardened | useFetch for both mappings and locations. Mutations: handleAuthRedirect + classifyError + isAbortError. |
| Allowed Emails | `/settings/allowed-emails` | ~390 | Hardened | useFetch with dynamic URL for filter. Mutations: handleAuthRedirect + classifyError + isAbortError. |

## Recommended Actions (prioritized)

1. **[High] Add 401 handling to all 7 settings sub-pages** — Session expiry during any settings mutation shows confusing error instead of login redirect. Most impactful hardening gap in the codebase.

2. **[Medium] Migrate settings pages to useFetch hook** — Would add AbortController, 401, visibility refresh automatically. Or add 401 checks to existing raw fetch calls.

3. **[Low] Add changelog entries to AREA_SETTINGS.md** — Calendar sources (2026-03-19), venue mappings (2026-03-24), allowed emails (2026-04-03) shipped but changelog entries are minimal.

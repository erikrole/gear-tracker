# Settings Ship-Readiness Audit
**Date**: 2026-04-06
**Auditor**: Claude (automated)
**Area**: Settings (Categories, Sports, Escalation, Database, Calendar Sources, Venue Mappings, Allowed Emails)
**Overall Verdict**: Nearly ready (19/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_SETTINGS.md updated this session with 3 new sub-pages, 10 ACs all checked. Each sub-page is self-contained with clear purpose. |
| Hardening | 2/5 | **No 401 handling on any of the 7 settings sub-pages.** No AbortController. No useFetch. All use raw fetch() without session expiry handling. Settings pages were not part of the 5-pass hardening passes applied to core workflow pages. |
| Roadmap | 4/5 | Breadcrumb + sidebar roadmaps exist and are shipped. No standalone settings roadmap but area is config-focused (low churn). |
| Feature completeness | 5/5 | All 10 ACs met. Categories tree CRUD, sports config, escalation rules, database diagnostics, calendar sources, venue mappings, allowed emails all shipped. |
| Doc sync | 3/5 | AREA_SETTINGS.md updated this session. But changelog is sparse (only 4 entries total covering months of work). |

## Page-by-Page Status
| Page | Route | Lines | Hardening | Issues |
|---|---|---|---|---|
| Settings root | `/settings` | 5 | N/A | Redirect to first sub-page. |
| Categories | `/settings/categories` | 192 | Not hardened | No 401 handling. No AbortController. Raw fetch. |
| Sports | `/settings/sports` | 195 | Not hardened | No 401 handling. No AbortController. Raw fetch. |
| Escalation | `/settings/escalation` | 289 | Not hardened | No 401 handling. No AbortController. Raw fetch. |
| Database | `/settings/database` | 268 | Not hardened | No 401 handling. Read-only diagnostics. |
| Calendar Sources | `/settings/calendar-sources` | 293 | Not hardened | No 401 handling. No AbortController. Raw fetch. |
| Venue Mappings | `/settings/venue-mappings` | 298 | Not hardened | No 401 handling. No AbortController. Raw fetch. |
| Allowed Emails | `/settings/allowed-emails` | 386 | Not hardened | No 401 handling. No AbortController. Raw fetch. |

## Recommended Actions (prioritized)

1. **[High] Add 401 handling to all 7 settings sub-pages** — Session expiry during any settings mutation shows confusing error instead of login redirect. Most impactful hardening gap in the codebase.

2. **[Medium] Migrate settings pages to useFetch hook** — Would add AbortController, 401, visibility refresh automatically. Or add 401 checks to existing raw fetch calls.

3. **[Low] Add changelog entries to AREA_SETTINGS.md** — Calendar sources (2026-03-19), venue mappings (2026-03-24), allowed emails (2026-04-03) shipped but changelog entries are minimal.

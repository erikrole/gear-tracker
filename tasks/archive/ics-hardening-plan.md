# ICS feeds and flows hardening plan

Audit of the outbound personal shift feed (`/api/shifts/ics/[token]`,
`/api/shifts/ics-token`) and the inbound calendar sync
(`calendar-sync.ts`, morning-refresh). Both are already well-defended:
the feed has token-format 404s, dual IP+token rate limits, active-user
gating, unique 192-bit tokens with audited rotation; sync has an SSRF
guard, locked-field preservation, batched chunked writes, and per-event
error capture. Findings below.

## Findings

### Outbound feed

**F1 (P1) -- Cancelled and archived events never leave subscribers' calendars.**
The feed query filters assignment status and a date window but not event
state. A cancelled game's shift stays on the student's phone calendar
(ICS removal works by omitting the VEVENT). Filter
`event.status: CONFIRMED, archivedAt: null` -- matching `/api/my-shifts`.
Safe for the 1-month history window: morning-refresh archives events only
after 4 months.

**F2 (P2) -- Event URLs derive from request headers.** `new URL(req.url).origin`
trusts the incoming Host; use canonical `env.appUrl` like other outbound
surfaces, so a spoofed Host can't seed poisoned links into a subscribed
calendar.

**F3 (P2) -- No RFC 5545 line folding.** Long summaries/locations/URLs exceed
the 75-octet line limit; most clients tolerate it, strict ones
(and the emoji trade prefix, which is multi-byte) can truncate or reject.
Fold generated lines byte-aware.

### Inbound sync

**I1 (P1) -- No fetch timeout or response size cap.** A hanging athletics
feed holds the serverless function until the platform kills it (starving
the rest of morning-refresh's maintenance), and `response.text()` is
unbounded. Add `AbortSignal.timeout(20s)` and a 10 MB cap with a clear
`lastError`.

**I2 (P1) -- TZID times are silently read as UTC.** `parseIcsDate` treats
`DTSTART;TZID=America/Chicago:20260901T190000` as 19:00 UTC -- a 5-6 hour
shift on every event. The current feed emits UTC so this is latent, but a
feed format change would silently corrupt every event time. Parse retains
the TZID param and converts named-zone wall times to UTC via the
Intl two-pass technique.

**I3 (P2) -- Property parser splits on colons inside quoted params.**
`DESCRIPTION;ALTREP="http://...":text` finds the colon inside the quoted
URL and corrupts the value. Scan for the first colon outside quotes.

**I4 (P2) -- Events silently removed from the source are invisible.**
A game deleted upstream (not CANCELLED, just gone) keeps its CONFIRMED
row and shifts forever. No auto-cancel (a truncated feed would mass-cancel);
instead sync diagnostics now report future non-cancelled events missing
from the parsed feed so Calendar Sources review can see them.

## Non-findings (checked, fine)
- Token entropy/rotation/rate limits on both feed routes.
- SSRF re-validation at fetch time, webcal normalization, protocol gate.
- Locked-field preservation (summary/isHome/location) through sync diffs.
- morning-refresh is cron-auth wrapped; archives are soft (archivedAt).

## Slices

- [x] S1: Feed event-state filter + canonical origin + line folding (F1-F3)
- [x] S2: Fetch timeout + size cap (I1)
- [x] S3: Quote-aware property colon + TZID-aware date parsing (I2, I3)
- [x] S4: Missing-from-source diagnostics (I4)
- [x] S5: Tests + build + docs sync

## Review

Shipped in one pass. Feed tests extended in `tests/shift-ics-feed.test.ts`,
parser/sync tests in `tests/calendar-sync.test.ts`; full suite + build green.

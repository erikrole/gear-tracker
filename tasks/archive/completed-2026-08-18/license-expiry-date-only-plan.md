# License expiry date-only plan

## Goal

Make the Photo Mechanic license page interpret annual expiry values as local calendar dates. A value such as `2027-08-18T00:00:00.000Z` must display and behave as August 18, 2027 in Central time, not August 17 after browser-local conversion.

## Contract and scope

- Keep the existing API/database representation: the date input is encoded at UTC midnight as a date-only value.
- Add one shared browser-side helper for decoding the encoded expiry date and comparing it with the local calendar day.
- Update the license table, page summary, renewal scope, current-license banner, and admin inspection status to use that helper.
- Do not change claim eligibility, notification scheduling, or unrelated schedule work.

## Verification

- Add focused regression coverage for UTC-midnight decoding, Central-style local calendar comparison, expiry-day behavior, and the 30-day boundary.
- Run the focused license tests, TypeScript, lint, and `npm run build:app`.
- Attempt authenticated `/licenses` browser proof and record the result or exact local-environment blocker.

## Stop condition

Stop after the source, focused tests, docs/ledger, and available runtime proof are reconciled. Do not stage, commit, deploy, or change production data in this slice.

## Closeout (2026-08-18)

- Implemented and verified locally.
- Authenticated browser proof is deferred because an unrelated existing Next process owns the shared `.next` runtime and the isolated local server could not return a page.
- No production data was changed; no commit or deployment was made.

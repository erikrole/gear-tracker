# Schedule Event Identity Normalization Plan

Date: 2026-06-19

## Scope

Normalize noisy event opponent and venue strings without changing schema or merging calendar venue with pickup location.

## Checklist

- [x] Add a pure event identity normalizer for opponent and venue text.
- [x] Use the normalizer in ICS sync and event revert/create edit paths.
- [x] Keep manually locked event type/opponent values authoritative.
- [x] Add focused regression coverage for opponent and venue cleanup.
- [x] Sync Events/Shifts/Gaps docs and remove stale archived-toggle Next wording.
- [x] Run focused tests plus TypeScript, migration check, docs verification, build, and whitespace check.

## Review

- 2026-06-19: Added shared opponent/venue normalization for Calendar sync, manual event creation, event edits, event revert, and Schedule title rendering. Verification passed with focused Vitest coverage, TypeScript, migration-prefix check, docs verification after codemap regeneration, app build, and whitespace check.

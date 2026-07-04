# Venue Mappings Audit Surface Plan

Date: 2026-06-19

## Scope

- Surface the existing venue mapping audit in Settings so admins can act on missing or broken venue mappings.
- Keep the slice read-only apart from existing Add/Delete mapping actions.
- Preserve Locations as the owner of Home Venue toggles and Venue Mappings as the owner of regex-to-location mapping.

## Peer Patterns Checked

- `/settings/venue-mappings`: existing mapping CRUD, regex tester, location-load recovery.
- `/settings/locations`: home venue ownership, active/inactive location treatment.
- `/settings/calendar-sources`: diagnostics-style settings feedback and recovery actions.

## Checklist

- [x] Add an admin-only venue mapping audit API.
- [x] Add focused route coverage for audit data and access control.
- [x] Render audit diagnostics on Settings > Venue Mappings.
- [x] Update docs and gaps ledger.
- [x] Run focused tests, typecheck, docs verification, build, and diff checks.

## Review

- 2026-06-19: Settings > Venue Mappings now shows a read-only Mapping Audit card for home venues without mappings, mappings to inactive or missing locations, and home-looking mappings pointed at non-home locations. Missing-home-venue rows can prefill the Add mapping form.
- 2026-06-19: Verification passed with focused venue audit tests, RBAC route-contract coverage, `tsc --noEmit`, migration-prefix check, docs verification, `build:app`, `git diff --check`, and authenticated browser smoke on `/settings/venue-mappings`.

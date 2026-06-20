# Ops V2/V3 Roadmap

Last updated: 2026-06-19

Status: Saved for later. Do not implement without a slice plan and area-doc review.

## Context

Camera attachments and numbered battery scanning are now shipped operational flows:

- Camera-tied SD cards, cages, and fixed parts are serialized item attachments.
- QR-coded batteries remain numbered bulk units.
- Booking creation requests battery quantity.
- Kiosk pickup and check-in bind specific battery units by scan.
- Battery Ops, explicit kiosk battery scan progress, battery guidance, and Missing Units battery audit reporting have shipped. GAP-37 is closed.

## V2: Ops Polish

Focus on pages people touch daily. V2 should make the shipped model easier to run without adding analytics or broad schema changes.

### Bulk Inventory / Batteries V2

- Add a battery-focused unit view: available, checked out, lost, retired. Shipped 2026-05-06.
- Make quick unit actions obvious: mark lost, retire, release. Shipped through Battery Ops adjustment hardening.
- Keep all status changes audit-backed. Shipped through Battery Ops adjustment hardening.
- Add a low compatible batteries panel by camera model (shipped 2026-05-06).
- Keep broader inventory health separate from shipped Missing Units battery reporting.

### Item Detail / Attachments V2

- Improve camera attachment management: attach, detach, replace SD card slot.
- Display camera slot identity clearly without adding a schema table yet.
- Use plain operational language: these items travel with the camera.
- Keep attachments hidden from checkout picker unless directly scanned/searched or using the attachments filter.

### Kiosk V2

- Make the battery scan step explicit during pickup. Shipped 2026-05-13.
- Improve mismatch messages (shipped 2026-05-06):
  - wrong battery type
  - already checked out
  - not part of this booking
  - retired/lost unit
- Preserve admin override, but make it visible and auditable.

### Booking Create V2

- Make battery warnings feel like guidance rather than generic alerts. Shipped 2026-05-13.
- Suggest compatible optional gear: batteries, media, readers, cages.
- Keep battery entry quantity-based at booking creation.
- Avoid forcing exact battery unit selection before pickup.

## V3: Intelligence / Reporting

Do V3 only after V2 workflows feel solid.

### Battery Audit + Reporting

Shipped 2026-05-13 through Missing Units and GAP-37 closure:

- Missing batteries by unit.
- Missing rate by family.
- Unit checkout history.
- Repeated missing-unit patterns.
- Aging checked-out battery units.

### Inventory Health Dashboard

- Low stock by location.
- Camera systems missing expected attachments.
- Batteries below threshold by camera model.
- Retired/lost trend.

### Attachment Schema Upgrade

- Add nullable `attachmentSlot` only if slot management becomes more than display/search.
- Candidate triggers:
  - slot filters
  - required attachment checks
  - camera system completeness reports
  - slot-level conflict/maintenance workflows

### Templates / Presets

- Add camera kit presets such as FX6 shoot or FX3 shoot.
- Keep batteries as separate numbered inventory.
- Let presets suggest battery quantities and optional gear instead of permanently attaching batteries to cameras.

## Recommended First Slice

Start with one of the remaining follow-ups in `tasks/bulk-battery-followups.md`: kiosk admin override visibility, optional gear suggestions, inventory health dashboard, attachment slot schema decision, templates/presets, or database-configurable equipment guidance.

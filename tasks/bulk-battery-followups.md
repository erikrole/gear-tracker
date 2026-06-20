# Bulk Battery Follow-ups - 2026-06-19

## Goal
- Keep the remaining battery-adjacent backlog separate from the shipped bulk battery hardening work.
- Treat these as future slices, not blockers for the completed kiosk battery scan, Battery Ops, picker guidance, and Missing Units reporting work.

## Source Checks
- `tasks/archive/completed-2026-06/battery-follow-through-plan-2026-05-13.md`: explicit numbered-battery scan progress shipped for kiosk pickup and return.
- `tasks/archive/completed-2026-06/battery-bulk-items-hardening-plan-2026-05-30.md`: live counts, stale-count recovery, scan custody hardening, typed-code recovery, and audited battery adjustments shipped; `npm run build` remained blocked only because it runs remote migration deploy, while `npx next build` passed.
- `docs/AREA_KIOSK.md`: pickup and return screens show dedicated numbered-battery scan progress and block pickup confirm while planned units remain unscanned.
- `docs/AREA_CHECKOUTS.md`: booking creation stays quantity-first for numbered batteries, recommends compatible battery families, and reminds staff exact units scan at kiosk pickup.
- `docs/AREA_BULK_INVENTORY.md` and `docs/AREA_REPORTS.md`: GAP-37 is closed through Missing Units battery audit reporting.
- `docs/GAPS_AND_RISKS.md`: templates and database-configurable equipment guidance remain Phase C deferred work.
- `tasks/archive/completed-2026-06/attachments-mvp-hardening-plan-2026-05-21.md`: `attachmentSlot` remains deferred until slot filters, required slot checks, completeness reports, or slot-level maintenance workflows justify schema work.

## Future Slices
- [ ] **Kiosk admin override visibility** - Preserve admin override, but make battery-related override use visible and audit-friendly in the pickup flow.
- [ ] **Booking-create optional gear suggestions** - Suggest compatible support gear such as batteries, media, readers, and cages from selected camera context.
- [ ] **Inventory health dashboard** - Add operational health signals for low stock by location, missing camera-system attachments, batteries below threshold by camera family, and retired/missing trends.
- [ ] **Attachment slot schema decision** - Revisit nullable `attachmentSlot` only if slot filters, required attachment checks, completeness reports, or slot-level maintenance workflows justify schema work.
- [ ] **Templates/presets** - Add camera kit presets such as FX6 shoot or FX3 shoot that suggest batteries and optional gear while keeping batteries as numbered bulk inventory.
- [ ] **Database-configurable equipment guidance rules** - Replace hardcoded guidance only after operators prove that guidance rules need to change without deploys.

## Review
- 2026-06-19: Split from the old `tasks/todo.md` Bulk Battery Hardening section. Shipped kiosk scan clarity, quantity-first picker guidance, Battery Ops, adjustment workflows, attachment management polish, and battery audit/reporting moved to the archive. This file keeps only unresolved future work.

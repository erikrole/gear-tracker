# Completed Item Info and Identity Firmware Cleanup - 2026-06-10

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: Item Info Sidebar Hardening (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/item-info-sidebar-hardening-plan.md` for smarter item detail field behavior.
- [x] **Field smarts** - Hardened USD purchase price handling and product link normalization/source context.
- [x] **Focused coverage** - Added source-contract coverage for the sidebar field behavior.
- [x] **Docs and verification** - Synced Items docs/tasks and reran focused plus deploy-shaped checks.

**Review**
- 2026-06-10: Item Info purchase price now behaves as a strict USD field with a dollar affordance, decimal input semantics, two-decimal display formatting, and parser-backed save normalization.
- 2026-06-10: Product links now normalize missing schemes to `https://`, reject non-http(s) URLs, open/copy the normalized target, and show the stored source host inline when valid.
- 2026-06-10: Authenticated browser smoke passed on `http://127.0.0.1:3017/items/cmmvmbdhe001hjx04hb39a7mk`; the sidebar rendered Identity/Firmware/Product/Organization/Procurement/Notes rows, the firmware modal opened, and no console warnings/errors were reported.
- 2026-06-10: Verification passed: `npx vitest run tests/item-info-sidebar-hardening.test.ts tests/item-detail-firmware-display.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome DevTools smoke.

## Completed: Item Detail Identity Firmware Refresh (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/item-detail-identity-firmware-refresh-plan.md` to integrate firmware into the admin identity block.
- [x] **Identity surface** - Renamed Scan identity to Identity and kept QR/serial in the same admin-labeled cluster.
- [x] **Firmware placement** - Moved firmware into the QR/serial row grammar with only the firmware badge inline and newest/check/release/source metadata in the badge modal.
- [x] **Docs and verification** - Synced docs/tasks and reran focused plus deploy-shaped checks.

**Review**
- 2026-06-10: Identity now renders QR, Serial, and Firmware as compact rows with QR preview on the right. Firmware no longer renders as a full nested card or repeats the badge status as adjacent text.
- 2026-06-10: Clicking the firmware badge opens a cleaned-up modal with a summary block for current/newest/checked/released values, installed-version input, Mark updated to latest, and the official Sony update-page link.
- 2026-06-10: Authenticated in-app browser smoke passed on real FX3 item `cmmvmbdhe001hjx04hb39a7mk`; no current-page console warnings/errors were reported and the smoke did not mutate live item firmware.

# Completed Wins Sprint Cleanup - 2026-04-30

Archived from `tasks/todo.md` on 2026-06-18.

## Wins Sprint (2026-04-30)

- [x] Replace `img` with `next/image` in booking detail condition photos
- [x] Remove silent JSON parse swallowing in booking + scan client flows
- [x] Add missing indexes (`notifications.sent_at`, `override_events.created_at`, `bulk_stock_balances.bulk_sku_id`)
- [x] Run `npm run test` (fails on pre-existing unrelated tests: equipment-guidance, shift-trades, create-booking)
- [x] Run `npm run build` (follow-up 2026-05-12: full build now passes through the shared Prisma/Neon migration wrapper)

### Review
- Shipped low-effort hardening on booking + scan client paths and added missing operational indexes.
- Verification complete for compilation. Follow-up 2026-05-12: full `npm run build` succeeds through the shared Prisma/Neon migration wrapper. Test suite was red at the time for unrelated pre-existing failures.

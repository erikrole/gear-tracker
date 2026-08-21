# Automatic Badge Catalog Expansion: 50

Revised: 2026-08-21
Status: Implemented locally; migration deployment and authenticated runtime proof pending

## Contract

Add exactly 50 new badge definitions. Every definition is automatic and is
earned from an existing durable event family: checkout opened, checkout
returned, a completed schedule assignment, or an authenticated app open. No
definition uses `trigger="manual"`, a client-supplied clock, or a staff award.

Schedule badges use the confirmed event attached to an ended assignment. The
server may use the event's result, site, sport, opponent, mapped venue, and
assignment conflict flag because those values are already source-of-truth
schedule data. Loss badges remain visible schedule milestones; problem-return
and conflict badges are hidden until earned so the surprise is private
recognition, not a locked-grid warning.

The catalog deliberately avoids new first/second/third/fifth/ten-step ladders
over the same raw total. Measured goals combine facts, require sustained
history, or represent meaningful depth across gear, returns, trades, and the
schedule.

## New catalog

| # | Key | Name | Source / rule | Threshold | Shape |
|---:|---|---|---|---:|---|
| 1 | `checkout_sprint` | Burst Mode | `checkout_week_burst` | 5 | compound |
| 2 | `checkout_calendar` | Calendar Commitment | `checkout_months` | 12 | sustained |
| 3 | `on_time_clean` | Clean Timing | `return_on_time_clean` | 20 | compound |
| 4 | `return_steady` | Steady Hands | `return_clean_streak` | 15 | streak |
| 5 | `category_combo` | Category Crossfade | `checkout_categories_4` | 3 | compound |
| 6 | `return_no_intervention` | No Follow-Ups | `return_no_intervention` | 25 | compound |
| 7 | `shift_cross_training` | Cross-Trained | `shift_sport_area_pairs` | 8 | compound |
| 8 | `shift_schedule_span` | Calendar Crew | `shift_months` | 6 | sustained |
| 9 | `trade_two_way` | Two-Way Teammate | `trade_both_sides` | 1 | compound |
| 10 | `family_archivist` | Family Archivist | `checkout_distinct_families` | 8 | collection |
| 11 | `battery_bank` | Battery Bank | `checkout_family_batteries` | 25 | collection |
| 12 | `lens_library` | Lens Library | `checkout_family_lenses` | 25 | collection |
| 13 | `audio_aisle` | Audio Aisle | `checkout_family_audio` | 15 | collection |
| 14 | `lighting_grid` | Lighting Grid | `checkout_family_lighting` | 10 | collection |
| 15 | `family_mixer` | Family Mixer | `checkout_families_5` | 5 | compound |
| 16 | `full_rig_heavy` | Full Rig, Full Load | `checkout_full_rig_heavy` | 3 | compound |
| 17 | `gear_volume_150` | Warehouse Shift | `checkout_item_volume` | 150 | depth |
| 18 | `mixed_inventory` | Mixed Inventory | `checkout_mixed_inventory` | 5 | compound |
| 19 | `kit_variety` | Kit Collector | `checkout_distinct_kits` | 3 | collection |
| 20 | `checkout_month_streak` | Month-to-Month | `checkout_consecutive_months` | 4 | streak |
| 21 | `home_and_away` | Home and Away | `shift_home_and_away` | 1 | compound |
| 22 | `schedule_spectrum` | Schedule Spectrum | `shift_spectrum` | 1 | compound |
| 23 | `away_win` | Road Win | `shift_away_wins` | 3 | compound |
| 24 | `result_site_sweep` | Three-Site Scoreboard | `shift_result_sites` | 1 | compound |
| 25 | `long_day_crew` | Long-Day Crew | `shift_early_late_mix` | 1 | compound |
| 26 | `reservation_event` | Reserved for Game Day | `checkout_reserved_event` | 3 | compound |
| 27 | `distinct_event_loadout` | Event Roster | `checkout_distinct_events` | 10 | depth |
| 28 | `multi_event` | Multi-Event Loadout | `checkout_multiple_events` | 5 | compound |
| 29 | `full_context_loadout` | Full Context Loadout | `checkout_full_context` | 3 | compound |
| 30 | `shift_loadout_heavy` | Crew Loadout Pro | `checkout_for_shift_heavy` | 3 | compound |
| 31 | `result_sweep` | Scoreboard Across Sports | `shift_scored_sports` | 4 | compound |
| 32 | `winning_record` | Winning Record | `shift_winning_record` | 1 | compound |
| 33 | `win_streak` | Hot Streak | `shift_win_streak` | 5 | streak |
| 34 | `bounce_back` | Bounce Back | `shift_bounce_back` | 1 | compound |
| 35 | `battle_tested` | Battle Tested | `shift_battle_tested` | 1 | compound |
| 36 | `home_field` | Home Field | `shift_home` | 15 | collection |
| 37 | `neutral_ground` | Neutral Ground | `shift_neutral` | 5 | collection |
| 38 | `venue_hopper` | Venue Hopper | `shift_venues` | 7 | collection |
| 39 | `venue_regular` | Venue Regular | `shift_same_venue` | 15 | depth |
| 40 | `opponent_rollcall` | Opponent Rollcall | `shift_opponents` | 7 | collection |
| 41 | `rivalry_rematch` | Rivalry Rematch | `shift_same_opponent` | 5 | depth |
| 42 | `site_sweep` | Three-Site Tour | `shift_sites` | 3 | collection |
| 43 | `oops_damaged` | Oops, That Was Damaged | `return_damaged` | 1 | negative |
| 44 | `oops_missing` | Where Did That Go? | `return_missing` | 1 | negative |
| 45 | `running_late` | Running Late | `return_late` | 5 | negative |
| 46 | `due_date_dancer` | Due Date Dancer | `return_due_date_changed` | 3 | negative |
| 47 | `calendar_tetris` | Calendar Tetris | `shift_conflicts` | 5 | negative |
| 48 | `midnight_oil` | Midnight Oil | `local_hour_0` | rule | easter egg |
| 49 | `weekend_warrior` | Weekend Warrior | `local_weekend` | rule | easter egg |
| 50 | `leap_day` | Leap Day | `local_leap_day` | rule | easter egg |

## Verification

- [x] Migration and seed each contain exactly these 50 new immutable keys.
- [x] All 50 have an automatic trigger; app-open eggs have no invented backfill.
- [x] Checkout, return, shift, and schedule derivations use the same evidence
  selects for evaluator awards and profile progress.
- [x] Negative and app-open surprises are present in both web and iOS hidden-key
  lists.
- [x] Focused automatic-rule, catalog, evaluator, and migration tests pass.
- [x] Full badge test surface passes: 22 files and 150 tests.
- [x] `npx tsc --noEmit --pretty false`, focused ESLint, `npm run db:migrate:check`,
  `npx prisma validate`, and `npm run build:app` pass.
- [x] The `Wisconsin` target builds on the required iPhone 16 Pro simulator
  destination (iOS 26.5) with signing disabled.

## Deferred release gates

- [ ] Apply migration `0127_badge_catalog_expansion` in a controlled database
  environment and verify read-back.
- [ ] Capture authenticated web/iOS profile proof for schedule-derived wins,
  losses, venues, and related hidden outcomes.
- [ ] Complete physical-device acceptance; the simulator build is not a device
  or production proof.

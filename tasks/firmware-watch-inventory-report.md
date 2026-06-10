# Firmware Watch Inventory Report

Date: 2026-06-10

## Source
- Live Neon query against `assets` joined to `categories` where category name is `Camera Bodies`.
- Official Sony support pages fetched by `scripts/seed-firmware-watch-targets.mjs`.
- The seed script validates expected Sony model tags before accepting a support URL.

## Seeded Watch Targets
| Product | Canonical model | Inventory count | Statuses | Latest firmware | Release date | Support mode | Source |
|---|---:|---:|---|---:|---|---|---|
| Sony a1 | ILCE-1 | 1 | AVAILABLE: 1 | 4.00 | 2025-12-10 | ACTIVE | https://www.sony.co.uk/electronics/support/e-mount-body-ilce-1-series/ilce-1/software/00343093 |
| Sony a7 III | ILCE-7M3 | 1 | AVAILABLE: 1 | 4.04 | 2026-04-15 | MAINTENANCE | https://www.sony.com/electronics/support/e-mount-body-ilce-7-series/ilce-7m3/software/00257843 |
| Sony a7 IV | ILCE-7M4 | 2 | AVAILABLE: 2 | 6.02 | 2026-05-28 | ACTIVE | https://www.sony.com/electronics/support/e-mount-body-ilce-7-series/ilce-7m4/software/00280505 |
| Sony a7S III | ILCE-7SM3 | 2 | AVAILABLE: 2 | 5.01 | 2026-05-28 | ACTIVE | https://www.sony.co.uk/electronics/support/e-mount-body-ilce-7-series/ilce-7sm3/software/00345065 |
| Sony FX3 | ILME-FX3 | 4 | AVAILABLE: 4 | 7.02 | 2026-03-17 | ACTIVE | https://www.sony.com/electronics/support/interchangeable-lens-camcorders-ilme-series/ilme-fx3/software/00287451 |
| Sony FX3A | ILME-FX3A | 2 | AVAILABLE: 2 | 2.02 | 2026-03-17 | ACTIVE | https://www.sony.com/electronics/support/interchangeable-lens-camcorders-ilme-series/ilme-fx3a/software/00364947 |
| Sony FX6 | ILME-FX6V | 4 | AVAILABLE: 4 | 6.00 | 2026-03-18 | ACTIVE | https://www.sony.com/electronics/support/software/00259043 |

## Skipped Live Camera Bodies
| Product group | Inventory count | Statuses | Reason |
|---|---:|---|---|
| DJI DJMAVIC3CRC | 1 | AVAILABLE: 1 | No official-source adapter configured. |
| GoPro CHDHX-112-TH | 1 | AVAILABLE: 1 | No official-source adapter configured. |
| Insta360 CINSAATA_GO3S13 | 1 | AVAILABLE: 1 | No official-source adapter configured. |
| Insta360 CINSABMA | 1 | AVAILABLE: 1 | No official-source adapter configured. |
| JVC GY-HM250U | 3 | AVAILABLE: 3 | No official-source adapter configured. |
| Sony ILCE-1M2 | 2 | AVAILABLE: 2 | Official support page not resolved during this seed pass. |
| Sony ILCE-7M5 | 4 | AVAILABLE: 4 | Official support page not resolved during this seed pass. |
| Sony ILCE-9M3 | 1 | AVAILABLE: 1 | Official support page not resolved during this seed pass. |

## Notes
- Canon is not seeded and the active runtime has no Canon parser.
- `ILME-FX3` and `ILME-FX3A` are tracked separately because Sony publishes separate firmware branches.
- `LCE-7M5/B` inventory typos are grouped under `ILCE-7M5`.
- All live camera-body groups in this query are currently `AVAILABLE`; no camera bodies are in item-status maintenance.

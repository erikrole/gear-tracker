# Item QR Physical Review

Created: 2026-06-26
Owner area: Items
Status: Open physical-code lookup queue, reduced after Cheqroom CSV crosscheck

## Purpose

Some camera, gimbal, and flash rows still store a legacy label such as `E1-041` or `D1-0006` in both `qrCodeValue` and `primaryScanCode`. The cleanup script cannot safely replace those rows because neither the database nor the archived Cheqroom CSV preserves a matching alphanumeric QR value.

Rows where `qrCodeValue` already held a real alphanumeric code were repaired on 2026-06-26 by moving that value into `primaryScanCode`. A later 2026-06-26 crosscheck against `docs/archive/imports/cheqroom-items-2026-02-27.csv` repaired 22 additional rows where `Barcodes` matched the legacy label and `Codes` contained exactly one unique alphanumeric QR value. The rows below still need physical QR lookup, a different source export, or manual operator confirmation before mutation.

## Review Rows

| Asset tag | Current QR | Reason |
|---|---:|---|
| DJI Mavic 3 | D1-0006 | Cheqroom CSV row has blank `Codes`; only `Barcodes` contains the legacy label |
| DJI Ronin-S | E1-025 | Cheqroom CSV row has blank `Codes`; only `Barcodes` contains the legacy label |
| FB Wireless Flash | E1-041 | Cheqroom CSV row has blank `Codes`; only `Barcodes` contains the legacy label |
| GoPro Hero 11 Black | E1-007 | Cheqroom CSV row has blank `Codes`; only `Barcodes` contains the legacy label |
| Godox XPro II TTL Wireless Flash Trigger (FB) | E1-044 | Cheqroom CSV row has blank `Codes`; only `Barcodes` contains the legacy label |
| Godox XT16 Receiver (FB) | E1-042 | Cheqroom CSV row has blank `Codes`; only `Barcodes` contains the legacy label |
| Insta 360 X4 | E1-043 | Cheqroom CSV row has blank `Codes`; only `Barcodes` contains the legacy label |
| MBB Wireless Flash | E1-039 | Cheqroom CSV row has blank `Codes`; only `Barcodes` contains the legacy label |

## Next Safe Action

For each row, scan or recover the real physical QR code, verify it is unique across `Asset.assetTag`, `Asset.qrCodeValue`, `Asset.primaryScanCode`, and active `BulkSku.binQrCodeValue`, then update both `qrCodeValue` and `primaryScanCode` through an audited data cleanup script.

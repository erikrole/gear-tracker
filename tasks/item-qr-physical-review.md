# Item QR Physical Review

Created: 2026-06-26
Owner area: Items
Status: Open physical-code lookup queue

## Purpose

Some camera, lens, gimbal, and flash rows still store a legacy label such as `E1-041` or `D1-0006` in both `qrCodeValue` and `primaryScanCode`. The cleanup script cannot safely replace those rows because the database does not preserve a matching alphanumeric QR value.

Rows where `qrCodeValue` already held a real alphanumeric code were repaired on 2026-06-26 by moving that value into `primaryScanCode`. The rows below need physical QR lookup, source CSV recovery, or manual operator confirmation before mutation.

## Review Rows

| Asset tag | Current QR | Reason |
|---|---:|---|
| 100-400 1 | E1-008 | No stored alphanumeric QR code to use safely |
| 100-400 2 | E1-009 | No stored alphanumeric QR code to use safely |
| 17-28 1 | E1-012 | No stored alphanumeric QR code to use safely |
| 17-28 2 | E1-062 | No stored alphanumeric QR code to use safely |
| 25-250 1 | D1-0008 | No stored alphanumeric QR code to use safely |
| 25-250 2 | D1-0009 | No stored alphanumeric QR code to use safely |
| 28-75 2 | E1-065 | No stored alphanumeric QR code to use safely |
| 28-75 3 | E1-014 | No stored alphanumeric QR code to use safely |
| 35-150 1 | E1-015 | No stored alphanumeric QR code to use safely |
| 35-150 2 | E1-050 | No stored alphanumeric QR code to use safely |
| 50-500 1 | E1-022 | No stored alphanumeric QR code to use safely |
| 70 macro 1 | E1-020 | No stored alphanumeric QR code to use safely |
| 70-200 1 | E1-011 | No stored alphanumeric QR code to use safely |
| 70-200 2 | E1-051 | No stored alphanumeric QR code to use safely |
| DJI Mavic 3 | D1-0006 | No stored alphanumeric QR code to use safely |
| DJI Ronin-S | E1-025 | No stored alphanumeric QR code to use safely |
| FB 100-400 1 | E1-056 | No stored alphanumeric QR code to use safely |
| FB 100-400 2 | E1-057 | No stored alphanumeric QR code to use safely |
| FB 24-105 1 | E1-016 | No stored alphanumeric QR code to use safely |
| FB 70-200 2 | E1-017 | No stored alphanumeric QR code to use safely |
| FB 70-200 3 | E1-069 | No stored alphanumeric QR code to use safely |
| FB Wireless Flash | E1-041 | No stored alphanumeric QR code to use safely |
| GoPro Hero 11 Black | E1-007 | No stored alphanumeric QR code to use safely |
| Godox XPro II TTL Wireless Flash Trigger (FB) | E1-044 | No stored alphanumeric QR code to use safely |
| Godox XT16 Receiver (FB) | E1-042 | No stored alphanumeric QR code to use safely |
| Insta 360 X4 | E1-043 | No stored alphanumeric QR code to use safely |
| MBB 28-75 1 | E1-021 | No stored alphanumeric QR code to use safely |
| MBB Wireless Flash | E1-039 | No stored alphanumeric QR code to use safely |
| Ronin RS3 1 | E1-023 | No stored alphanumeric QR code to use safely |
| Ronin RS3 2 | E1-024 | No stored alphanumeric QR code to use safely |

## Next Safe Action

For each row, scan or recover the real physical QR code, verify it is unique across `Asset.assetTag`, `Asset.qrCodeValue`, `Asset.primaryScanCode`, and active `BulkSku.binQrCodeValue`, then update both `qrCodeValue` and `primaryScanCode` through an audited data cleanup script.

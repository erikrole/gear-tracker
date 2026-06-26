# Serialized Metadata Review

Created: 2026-06-26
Owner area: Items
Status: Physical/source truth required before mutation

## Completed Safe Metadata Fixes

The item-data cleanup applied three deterministic serialized metadata corrections:

- `Dell UltraSharp 38" Curved Monitor-3`: brand changed from `Unknown` to `Dell`.
  - Evidence: asset name, model `U3824DW`, and Dell product link all identify Dell.
- `Monitor Battery`: brand/model changed from `Unknown`/`Unknown` to `Watson`/`B-4205`.
  - Evidence: stored B&H link identifies Watson B-4205 NP-F770 lithium-ion battery pack.
- `SMOKE-20260512-1`: retired and disabled for checkout, reservation, and custody.
  - Evidence: active smoke-test asset with no booking, allocation, scan, kit, or attachment history.

Verification after apply:

- Serialized unknown brand: 0.
- Serialized unknown model: 0.
- Cleanup dry-run safe mutations: 0.

## Remaining Physical Gaps

| Asset | Remaining gap | Status | Decision needed |
|---|---|---|---|
| `10mm 1` | Missing serial number | Available | Read serial from the physical Laowa 10mm f/2.8 lens or accepted purchase/source record. |
| `FX3 3 Handle` | Missing serial number and image | Attached to `FX3 3` | Read serial from physical Sony XLR-H1 handle and add a real image if useful for attachment recognition. |
| `Logitech MX Mechanical Wireless Keyboard` | Missing serial number | Available | Read serial from the physical keyboard label or accepted purchase/source record. |
| `SMOKE-20260512-1` | Missing serial number and image | Retired | No action unless the test record must be retained with complete fake-test metadata; it no longer behaves as active gear. |

## Apply Rule

1. Do not invent serial numbers for real gear.
2. For attached child parts, image is optional unless it improves recognition in direct scan/search or attachment management.
3. Keep retired smoke/test assets disabled unless a test harness explicitly needs them active.

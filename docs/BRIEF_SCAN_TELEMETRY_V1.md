# BRIEF: Scan Telemetry Phase B

## Document Control
- Feature: Scan Flow Telemetry
- Owner: Wisconsin Athletics Creative Product
- Created: 2026-03-25
- Status: Draft

## Problem
No visibility into scan flow usage patterns. Cannot measure: success rates, session durations, camera vs manual entry split, error frequency, or device types. Makes it impossible to prioritize UX improvements.

## KPIs to Track
1. **Scan success rate** — % of scans that resolve to a valid asset/booking
2. **Average session duration** — time from session start to completion
3. **Manual entry fallback rate** — % of sessions using manual code entry vs camera
4. **Error breakdown** — camera permission denied, unrecognized barcode, duplicate scan, network failure
5. **Device distribution** — mobile vs desktop, iOS vs Android

## Events to Instrument

| Event | Trigger | Context |
|---|---|---|
| `scan_session_start` | User opens scan page | userId, mode (checkout/checkin), device |
| `scan_submitted` | Barcode detected or manual entry | method (camera/manual), barcode format |
| `scan_success` | Asset/booking resolved | assetId, bookingId, time_since_session_start |
| `scan_error` | Lookup fails | error_type, barcode_value |
| `unit_picker_shown` | Bulk item triggers unit picker | bulkSkuId, available_count |
| `scan_session_complete` | All items processed | total_items, duration_ms, errors_count |
| `camera_permission_denied` | NotAllowedError caught | device, browser |

## Technical Approach

### Option A: Vercel Analytics (Recommended for V1)
- Use `@vercel/analytics` `track()` for custom events
- Zero infrastructure — already deployed on Vercel
- Dashboard in Vercel project settings
- Limitations: 30-day retention on Hobby, no SQL queries

### Option B: Custom Event Endpoint
- `POST /api/telemetry/scan` with batch event payload
- Store in `ScanTelemetryEvent` table
- Full retention and queryability
- More work to build and maintain

## Acceptance Criteria
- [ ] AC-1: All 7 events instrumented in scan hooks
- [ ] AC-2: Events fire correctly in production (verified via Vercel Analytics)
- [ ] AC-3: No impact on scan flow performance (events are fire-and-forget)
- [ ] AC-4: Events include device context (mobile/desktop, browser)

## Out of Scope
- Real-time dashboard (use Vercel Analytics built-in)
- Alerting on low success rates
- A/B testing infrastructure

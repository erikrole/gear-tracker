# Audit: scanner debugger (iOS) - 2026-06-15

**MVP verdict:** ships as a staff/admin hardware-debug utility. It captures HID keyboard scanner input, preserves the raw and trimmed values, submits through the same native lookup service as Scan, and reuses the existing scan result hero-card sheet.
**Ship bar:** prove a paired hand scanner can open the normal scan card without changing kiosk custody behavior.
**Audit type:** static source plus automated drift/audit/build checks.

Scope: `ScannerDebuggerView` in `ios/Wisconsin/Views/DevTools/ScannerDebuggerView.swift`, reachable from Settings -> Tools -> Scanner Debugger for staff/admin users. The Settings row presents the debugger modally instead of using `ProfileDestination` value navigation, so the tool owns the `NavigationStack` used by scan-result hero card links.

## P0 - blocks MVP

_None._

## P1 - polish before ship

- [x] [Boundary] The debugger is lookup-only. It calls `SearchService.shared.search(query:rawScan:)` and never invokes checkout, pickup, return, or kiosk custody mutation endpoints.
- [x] [UX] The surface shows raw scan value, trimmed scan value, and lookup status before presenting the normal result sheet.
- [x] [Reuse] The result presentation reuses `ScanResultSheet`, so serialized assets and item-family unit matches get the same hero card as the Scan tab.
- [x] [Fallback] Manual typed entry is available from the debugger and routes through the same handler as hardware scanner input.
- [x] [A11y] The status card is combined for VoiceOver, and the row labels use native `LabeledContent`.
- [x] [Navigation] The Settings entry presents a dedicated debugger sheet, avoiding orphaned `ProfileDestination` value links and preserving the debugger's local scan-result navigation stack.

## P2 - post-MVP

- [ ] [Polish] Deferred. Add explicit focus/Return detection if real hardware testing proves a scanner can type visible characters without submitting. The current HID field follows the kiosk implementation and submits when the scanner sends Return.
- [ ] [Polish] Deferred. Add an export/share diagnostic summary if staff need to report scanner failures remotely.

## Acceptance Criteria

- [x] Staff/admin users can open Scanner Debugger from Settings -> Tools.
- [x] Hardware scanner input is captured through the existing hidden HID text-field pattern.
- [x] A successful serialized or item-family lookup opens the scan hero card.
- [x] Empty and error results preserve the existing Scan retry/type-code recovery paths.
- [x] Custody scans remain kiosk-owned.

## Lenses Checked

- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity
- [x] Accessibility

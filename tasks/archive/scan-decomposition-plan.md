# Scan Page Decomposition Plan

**Goal**: Reduce `src/app/(app)/scan/page.tsx` from 1,038 lines → ~250 lines by extracting hooks and components.

## Architecture (Following Dashboard Model)

```
ScanPage (thin orchestrator, ~250 lines)
  ├─ useScanSession()     → status loading, polling, session start, celebration
  ├─ useScanSubmission()  → scan processing, feedback, vibration, submit logic
  │
  ├─ ScanControls         → camera + manual entry + inline feedback
  ├─ ScanChecklist        → serialized + bulk item rendering
  ├─ UnitPickerSheet      → numbered bulk unit picker
  ├─ ItemPreviewSheet     → lookup mode item preview
  └─ CelebrationOverlay   → all-items-scanned overlay (inline, simple)
```

## Slices

### Slice 1: Hooks
- [x] `src/hooks/use-scan-session.ts` — manages scanStatus, loadScanStatus(), 15s polling, session start, celebration detection, completion handler
- [x] `src/hooks/use-scan-submission.ts` — manages processing state, feedback, handleScan routing, handleLookupScan, handleBookingScan, submitScan, unit picker state

### Slice 2: Components
- [x] `src/app/(app)/scan/_components/ScanControls.tsx` — camera toggle, QrScanner, manual entry input, inline feedback banner
- [x] `src/app/(app)/scan/_components/ScanChecklist.tsx` — serialized items list + bulk items list with unit badges
- [x] `src/app/(app)/scan/_components/UnitPickerSheet.tsx` — numbered bulk unit selection sheet
- [x] `src/app/(app)/scan/_components/ItemPreviewSheet.tsx` — lookup mode bottom sheet with item details

### Slice 3: Rewrite page.tsx
- [x] Wire hooks to components as thin orchestrator
- [x] Keep mode determination, navigation guard, and layout in page

### Slice 4: Verify & Document
- [x] `npm run build` passes
- [x] Create `docs/AREA_SCAN.md`
- [x] Update `docs/GAPS_AND_RISKS.md` (close GAP-14)

## Types
Shared types extracted to `src/app/(app)/scan/_components/types.ts` for reuse across hooks and components.

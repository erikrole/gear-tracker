# Kiosk Visual Rework — Slice Plan

Approved plan: `/Users/erole/.claude/plans/zippy-hatching-wren.md` (2026-07-02).
Direction: same DNA (dark, Wisconsin red, standby clock, Gotham), executed much better. All screens. UI-only — no API, no KioskStore, no scanner-logic changes.

## Slices

- [x] Slice 1 — Foundation: KioskSpacing/KioskLayout tokens, gradient depth in `kioskCard()`, `KioskBackdrop`, screen transitions in shell, inactivity warning restyle, `KioskFlowHeader` subtitle/trailing slots. New file `Kiosk/KioskChrome.swift`.
- [x] Slice 2 — Checkout setup: fix clipped-title overflow (header pinned, form scrolls, CTA pinned), delete dead `scanZone` wrapper, section icons + step overlines.
- [x] Slice 3 — Success screen: branded phaseAnimator/keyframeAnimator moment, draining countdown, Reduce Motion fallback.
- [x] Slice 4 — Unify scan screens: `KioskScanZoneColumn` + `KioskSideRail` (430 rail everywhere), shared `KioskScanTarget` corner brackets.
- [x] Slice 5a — Idle extraction (zero visual change): sleep view, event sheet, checkout drawer, roster, date formatting → own files + mechanical test path updates.
- [x] Slice 5b — Idle restyle: dashboard hierarchy, red-accent stat selection, quiet-day card, roster tiles/footer, sleep clock upgrade.
- [x] Slice 6 — Student hub: identity hero, hero checkout card, thumbnail strips + due chips, calendar-block reservations, session summary, real empty state.
- [ ] Slice 7 — Activation polish: tokens migration, brand overline, gradient numpad, active-slot underline.
- [ ] Slice 8 — Sweep: one-off color grep, both schemes build, docs sync, archive this plan.

## Per-slice verification
xcodegen (if files added, check entitlements diff clean) → `xcodebuild -scheme WisconsinKiosk` → `npm test` → AREA_KIOSK.md change-log entry in same commit.

## Do-not-change
HIDScannerField / KioskNativeTextField / KioskBarcodeCameraView / KioskStore / KioskAPIClient / KioskModels; scanner gating expressions (re-parent only, never reword); monospaced clock; pixel-shift sleep; inactivity timings; accessibility strings; wheel date picker.

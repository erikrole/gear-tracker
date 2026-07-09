# Kiosk Liquid Glass Controls

## Goal

Adopt iOS 26 Liquid Glass where it clarifies the dedicated kiosk's interactive hierarchy without reducing custody or form legibility.

## Scope

- Use native glass button styles for shared kiosk header actions and completion CTAs.
- Use native glass button styles for active-checkout Done and Save actions.
- Let native glass controls inherit iOS accessibility behavior, including Reduce Transparency.
- Keep item rows, text/date inputs, timing context, warnings, and destructive removal controls opaque.

## Out Of Scope

- A whole-kiosk visual rewrite.
- Checkout mutation or navigation behavior changes.
- Liquid Glass on dense custody rows or form fields.
- Swift 6 language-mode work or the kiosk orientation-policy follow-up.

## Checklist

- [x] Add shared iOS 26 native glass control treatments.
- [x] Apply the treatments to shared actions and the active-checkout editor.
- [x] Re-arm HID scanner capture after active-checkout title editing ends.
- [x] Add focused source-contract coverage.
- [x] Sync kiosk/mobile documentation and verification notes.
- [x] Run focused tests, iOS audits, docs checks, and kiosk plus main-app builds.
- [ ] Confirm visual hierarchy and scanner handoff on a managed M2 iPad Air with its paired scanner.

## Review

- 2026-07-09: Adopted native iOS 26 glass button styles for shared kiosk header actions and completion CTAs plus active-checkout Done/Save. Kept scanner status, form fields, timing, custody rows, warnings, and destructive removal controls opaque. Added explicit HID capture rearming when active-checkout title editing ends and corrected the stale iOS 17 project contract. Verification passed: 309 Vitest files / 1,868 tests, iOS drift and gap audits, XcodeGen parity, docs/codemaps, whitespace, production app build, and simulator plus generic-device builds for both `WisconsinKiosk` and `Wisconsin`. The subsequent kiosk windowing/compiler cleanup resolved the former `UIRequiresFullScreen` and scanner default-argument warnings. Managed-device visual and scanner confirmation remains open.

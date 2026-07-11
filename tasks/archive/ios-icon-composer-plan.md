# iOS Icon Composer Modernization Plan

## Goal

Replace the flat, boxed Wisconsin Creative app icon with a brand-faithful layered Icon Composer source that renders cleanly in Default, Dark, and Mono appearances on current iOS and iPadOS, while retaining a verified flat fallback for the existing asset catalog.

## Scope

- Audit the current app and kiosk icon wiring and editable brand sources.
- Prepare deterministic vector layers from the approved Wisconsin artwork.
- Build and wire one shared `AppIcon.icon` source for both native targets.
- Preserve a 1024 px flattened fallback and document the Icon Composer editing workflow.
- Verify Xcode project generation, icon compilation, both native targets, and repository documentation gates.

## Slices

- [x] Slice 1: Source audit and layered artwork specification
- [x] Slice 2: Icon Composer package and Xcode target wiring
- [x] Slice 3: Flattened fallback, documentation, and automated checks
- [x] Slice 4: Native build and rendered-icon verification

## Review

### 2026-07-11

- Confirmed the app and kiosk targets both use the single `AppIcon` asset catalog.
- Confirmed the editable `ios/App Icon.ai` source is a 1024 × 1024 vector-capable Illustrator/PDF document.
- Exported four ordered SVG layers into `ios/IconSources/AppIconLayers` and documented the Default, Dark, Mono, background, fallback, and source-of-truth contracts in `ios/IconSources/README.md`.
- Validated all four SVG files with `xmllint`.
- Blocked before Slice 2: the installed Icon Composer app is available in Xcode 26.6, but the local GUI-control bridge required to save and preview the proprietary `.icon` document is not exposed in this task. Project wiring and build proof must wait for a real `AppIcon.icon`; hand-authoring that proprietary document would be unsafe.

### 2026-07-11 candidate expansion

- Added five approved SVG identities supplied by the user: Motion W, Vintage Bucky Block, Vintage Bucky, Vintage Helmet, and Metallic W.
- Selected Motion W as the default icon candidate because it has the strongest small-size and Mono recognition.
- Staged five deterministic Icon Composer import folders under `ios/IconSources/IconComposerCandidates`.
- Documented Default, Dark, Mono, background, optical-scale, material, naming, and risk guidance for the primary and four alternate candidates.
- Saved the user's current Bucky Block work as `AppIconHeritage.icon` through Icon Composer.
- Staged `AppIcon.icon`, `AppIconBucky.icon`, `AppIconHelmet.icon`, and `AppIconMetallic.icon` packages from the same saved-package schema so each candidate opens independently in Icon Composer for final visual review.
- Alternate-icon Xcode and Settings wiring remains a separate follow-up slice after the `.icon` documents are visually approved.

### 2026-07-11 wiring closeout

- Copied the finalized primary and four alternate Icon Composer documents into `ios/Wisconsin/AppIcons` as target resources.
- Configured `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon` and the four `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES` values through `ios/project.yml`.
- Added Settings > App Icon with system-truth selection, primary restoration, in-flight protection, and recoverable errors.
- Regenerated the checked-in Xcode project and confirmed the generated project check passes.
- Built the Wisconsin simulator target successfully with Xcode 26.6.
- Inspected the compiled app: `CFBundlePrimaryIcon` names `AppIcon`; `CFBundleAlternateIcons` contains Heritage, Bucky, Helmet, and Metallic; all icon output is compiled into `Assets.car`.
- Preserved the existing flat catalog icon as the compatibility fallback. The dedicated kiosk target retains its fixed icon and does not expose alternates.

### 2026-07-11 manual-source resync

- Replaced every wired `.icon` package with an exact full-directory copy of the user's latest manually saved Icon Composer document.
- Regenerated all five Settings picker previews from the newly referenced artwork and current Composer base colors.
- Updated the candidate README to define the `.icon` documents, not sibling SVGs or hand-edited JSON, as source of truth.

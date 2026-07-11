# Wisconsin Creative Icon Composer Sources

The files in `AppIconLayers` are the ordered, 1024 × 1024 vector inputs for Apple Icon Composer. They are derived from the approved `ios/App Icon.ai` artwork and intentionally contain no enclosure mask, shadow, blur, gradient, or baked glass effect.

## Layer order

Import the files together and keep this back-to-front order:

1. `01-block-w-base.svg` — white Block W backing
2. `02-wisconsin-red.svg` — Wisconsin red Block W and Bucky accents
3. `03-bucky-white.svg` — Bucky whitework
4. `04-bucky-ink.svg` — Bucky linework

Use no more than four groups. The numbered filenames preserve the correct order when the folder is dragged into Icon Composer.

## Composer setup

- Canvas: 1024 × 1024
- Platforms: iOS and iPadOS
- Background: opaque near-black `#111111`
- Default: preserve the source colors; keep material effects restrained so the detailed Bucky linework remains legible at small sizes
- Dark: use the same near-black background and increase edge separation only as needed
- Mono: use the Block W and Bucky silhouette as the hierarchy; do not depend on the red layer for recognition
- Enclosure: none in the source artwork; the system owns the crop and platform shape

Preview Default, Dark, and Mono at the smallest Home Screen size before saving. Export the source as `AppIcon.icon` at `ios/Wisconsin/AppIcon.icon`. Xcode uses that file as the app icon source for current systems and renders compatibility output when supported by the selected deployment target.

## Flat fallback

`ios/Wisconsin/Assets.xcassets/AppIcon.appiconset/AppIcon_1024.png` remains the approved flat fallback until `AppIcon.icon` has been saved and compiled. Do not remove or replace the catalog icon merely by adding the Composer file: Apple documents that a Composer icon replaces the asset-catalog app icon and may generate a similar flattened icon for earlier systems.

## Source of truth

- Editable master: `ios/App Icon.ai`
- Layer exports: `ios/IconSources/AppIconLayers`
- Current flat fallback: `ios/Wisconsin/Assets.xcassets/AppIcon.appiconset/AppIcon_1024.png`
- Composer output: `ios/Wisconsin/AppIcon.icon`

The Illustrator file is licensed brand artwork. Do not redraw Bucky with generative tools.

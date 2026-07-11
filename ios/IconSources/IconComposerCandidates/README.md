# Icon Composer Candidate Set

These folders contain the manually finalized Icon Composer documents for the primary Wisconsin Creative icon and alternate-icon set. The `.icon` documents are the source of truth; the sibling SVG files are editable inputs only. Icon Composer owns the background, enclosure, lighting, material, and appearance annotations.

## Shared setup

- Canvas: 1024 × 1024 for iOS and iPadOS.
- Design generation: 27.
- Keep artwork centered and optically scaled, with approximately 15% clear space around the widest visible edge.
- Use one group named `Mark`. Do not wrap a single mark in empty groups.
- Keep refraction and translucency off on detailed mascot linework.
- Use a small, soft system shadow only when it materially separates the mark from the background.
- Validate Default, Dark, and Mono at 60 pt and 1024 pt.
- Never bake an app-icon corner radius into the SVG.

## Candidates

### `primary-motion-w/Motion W.icon`

- Role: default app icon.
- Background and appearance annotations: use the values saved in the finalized Icon Composer document.
- Mark: use the artwork referenced by `icon.json`; do not substitute the sibling source SVG during app sync.
- Material: use the finalized group shadow, specular, translucency, and scale values from the document.
- Rationale: best recognition and least detail loss at Home Screen size.

### `heritage-bucky-block/AppIconHeritage.icon`

- Role: alternate icon named `Heritage`.
- Background: Wisconsin red `#A00000` in Default; near-black `#111111` in Dark.
- Mark: keep the existing white, red, and ink artwork intact.
- Mono: prioritize the outer Block W silhouette. The Bucky interior may simplify at small sizes.
- Material: opaque mark, subtle shadow, no refraction through linework.

### `vintage-bucky/AppIconBucky.icon`

- Role: alternate icon named `Bucky`.
- Background: warm off-white `#F5F2EB` in Default; near-black `#111111` in Dark.
- Mark: Wisconsin red in Default; warm white in Dark.
- Mono: use the full mascot silhouette as one opaque foreground.
- Material: no translucency; restrained shadow only.

### `vintage-helmet/AppIconHelmet.icon`

- Role: alternate icon named `Helmet`.
- Background: Wisconsin red `#A00000` in Default; near-black `#111111` in Dark.
- Mark: optically enlarge the helmet more than the other candidates because of its horizontal silhouette.
- Mono: use a solid helmet silhouette; preserve the face-mask opening only if it remains legible at 60 pt.
- Material: low specular edge on the shell, no glass on the face mask.

### `metallic-w/AppIconMetallic.icon`

- Role: alternate icon named `Metallic` after visual verification.
- Background: near-black `#111111` for Default and Dark.
- Mark: preserve the source metallic gradient and red accent.
- Mono: replace gradient dependence with one opaque W silhouette.
- Material: keep Composer effects minimal because the SVG already contains metallic shading.
- Risk: gradient and mask behavior must be checked in Icon Composer and a compiled build before this candidate ships.

## Output names

Save finished documents beside the candidate folders using these names:

- `AppIcon.icon`
- `AppIconHeritage.icon`
- `AppIconBucky.icon`
- `AppIconHelmet.icon`
- `AppIconMetallic.icon`

The wired copies live in `ios/Wisconsin/AppIcons`. After any manual Icon Composer edit, copy the complete `.icon` directory again; never merge only `icon.json` or only the `Assets` directory.

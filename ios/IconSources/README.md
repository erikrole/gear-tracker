# Wisconsin Creative App Icon Source

The approved app identity is the Block W Icon Composer document at `IconComposerCandidates/vintage-helmet/BlockW.icon`.

The main Wisconsin target compiles its complete copy at `ios/Wisconsin/AppIcons/AppIcon.icon`. The dedicated kiosk target continues to use the fixed `Assets.xcassets/AppIcon.appiconset` fallback. Do not remove that catalog icon while both targets share the asset catalog.

After editing in Icon Composer, sync the complete package and verify the Wisconsin target build. The app does not ship alternate icons or expose an icon picker.

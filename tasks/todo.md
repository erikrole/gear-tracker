# Apple-design pass — iOS settings pages (2026-07-11)

- [x] NotificationSettingsView: split mega-section into real sections (Status / Pause Alerts / Delivery / Notification Types); delete fake categoryHeaderRow
- [x] NotificationSettingsView: de-duplicate pause chip labels; drop saving-disable input lockout on toggles
- [x] AccountSecuritySettingsView: preserve focus on show/hide passwords; animate status messages
- [x] ProfileView SettingsRowIcon + notification icons: Dynamic Type scaling
- [x] Build iOS target (clean), update AREA_MOBILE.md changelog, commit + push

## Review
All four settings surfaces audited (SettingsView, NotificationSettingsView, AccountSecuritySettingsView, ProfileView hub). SettingsView itself needed nothing — the recent system-Settings redesign already holds. The big structural win was NotificationSettingsView's section hierarchy. Deliberately NOT changed: the SettingsRow (solid icon square) vs SettingsMenuRow (tinted icon) split — SettingsMenuRow is the app-wide row language (Browse, Licenses) and unifying it is a bigger cross-app pass, out of scope here.

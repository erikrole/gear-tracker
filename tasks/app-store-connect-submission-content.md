# App Store Connect Submission Content — Wisconsin Creative

Drafted: 2026-07-08. Updated: 2026-08-04 for the post-rejection native auth slice. Paste-ready copy for the `Wisconsin` app's first Unlisted App Store submission. Kiosk (`WisconsinKiosk`) stays off the Store entirely; this content is for the main app only.

Sources used: `docs/AREA_PUBLIC_SHOWROOM.md`, `src/lib/public-showroom.ts`, `tasks/app-privacy-data-inventory.md`, `ios/Wisconsin/Supporting/PrivacyInfo.xcprivacy`, `scripts/seed-app-review-demo.mjs`, `ios/project.yml`.

---

## App Review Information

**Sign-in required:** Yes

**Demo account**
- Email: `appreview@wisconsincreative.com`
- Password: use the secret stored in App Store Connect after seeding the isolated review environment with `APP_REVIEW_DEMO_PASSWORD`; no reviewer password is committed to this repository

**Important:** Do not submit these credentials until `review.wisconsincreative.com` is deployed against the isolated App Review database and the demo seed has been verified there. Production `wisconsincreative.com` should not contain the App Review demo records.

**Notes to reviewer**
```
This submission is intended for unlisted app distribution. Do not resubmit this
rejected version while an unlisted distribution request is pending. Resubmit the
corrected build only after Apple's request outcome is confirmed.

Wisconsin Creative is an internal equipment-management tool for a university athletics
creative/production department. It is not a public consumer app — access is invitation-only,
which is why the demo account above is required to sign in.

When the demo account signs in, the iOS app routes that account to an isolated App Review
environment at review.wisconsincreative.com. Normal invited users continue to use the
production wisconsincreative.com environment.

Build 21 adds a native Welcome flow for invited users with incomplete profiles. The demo
account intentionally keeps fictional profile data incomplete, so Welcome may appear after
sign-in. Tap "Remind tomorrow" on the first Welcome step to enter the app without supplying
any personal information. This bypass is expected and does not change the demo dataset.

The Login screen keeps sign-in, invited account registration, and password-recovery requests
inside the native iOS app. Registration remains restricted to administrator-approved email
addresses. If password recovery is configured, the reset email opens the canonical password
reset form on the web.

What the demo account can see:
- A staff-role home screen with sample reservations, checked-out gear, and shift context.
- Search and camera/QR scan lookup for sample equipment (the scan target is a fictional
  catalog seeded for this review; no physical gear is required to test lookup).
- Reservation creation and the equipment picker.
- Schedule/shift views.

Sample lookup and QR codes:
- DEMO-CAM-001
- DEMO-LENS-001
- DEMO-AUDIO-001
- DEMO-BATT-1

To test without a printed QR code, open Search, choose the scan action, tap Type Code, and
enter any code above. Matching QR images may also be attached to the review submission.

What is intentionally NOT reachable from this app on the App Store:
- Checkout, pickup, and return custody actions run exclusively through a separate iPad
  kiosk app used at a staffed physical equipment counter (bundle ID
  com.erikrole.WisconsinKiosk). That kiosk app is not distributed on the App Store — it is
  installed on department-owned hardware only. This app is intentionally lookup/planning-only
  for custody actions; that is expected behavior, not a missing feature.
- Admin-only configuration and reporting surfaces are gated by role and may not appear for
  the demo account, which is seeded as a staff reviewer.

Camera permission is used only to scan equipment barcodes/QR codes for lookup (see
NSCameraUsageDescription). No location, contacts, or other sensitive hardware access is
requested.

Privacy policy: https://wisconsincreative.com/privacy
```

---

## App Information

**Name:** Wisconsin Creative
**Subtitle** (30 char max): `Gear reservations & schedule` (28 chars)
**Primary category:** Business (or Productivity — both fit; Business reads slightly better for an internal ops tool)
**Secondary category:** Productivity
**Expected Age Rating:** 4+

Use the current App Store Connect questionnaire rather than a blanket answer:
- In-App Controls: Parental Controls **No**; Age Assurance **No**.
- Capabilities: Unrestricted Web Access **No**; User-Generated Content **No**; Social Media **No**; Social Media Disabled for Users Under 13 **No**; Messaging and Chat **No**; Advertising **No**.
- Mature Themes, Medical or Wellness, Sexuality or Nudity, and Violence: **None** for every descriptor.
- Chance-Based Activities: Gambling **No**; Simulated Gambling **None**; Contests **None**; Loot Boxes **No**.
- Age Categories and Override: **Not Applicable**. Do not select Made for Kids and do not override the calculated rating.

The operational records, internal guides, reservations, and equipment notes in this build are not broadly distributed user-created media, a social feed, public posting, or direct messaging. Recheck these answers if a future build adds any such feature.
**Content rights:** You own or have rights to all submitted content (confirm — app icon/branding assets are internal).

## Pricing and Availability

**Price:** Free
**Distribution during submission:** Intended to be **Unlisted App**. The current rejected submission must not be resubmitted while Apple's unlisted request is pending.
**Unlisted request:** Submit Apple's unlisted app distribution request and wait for the email outcome. If Apple approves it, update App Store Connect to the approved unlisted distribution method before resubmitting the corrected build. If Apple declines it, do not assume that public distribution with a gated login is acceptable; choose the next distribution path based on Apple's response.

## URLs

- **Support URL:** `https://wisconsincreative.com/support` (dedicated public support page with a direct contact email; deploy and verify the production URL before submission)
- **Marketing URL** (optional): `https://wisconsincreative.com/about`
- **Privacy Policy URL:** `https://wisconsincreative.com/privacy` (required, already live — verified rendering during domain cutover checks)

## Screenshot Capture Set

Capture these from Build 23 while signed into the isolated fictional reviewer account. Use portrait orientation, no alpha channel, no real people, and no production records. Recapture both complete sets even when a screen appears unchanged from earlier builds so every submitted image matches the selected binary.

**Required device sets**
- iPhone 6.9-inch: `1320 x 2868` pixels using iPhone 17 Pro Max or another accepted 6.9-inch simulator size.
- iPad 13-inch: `2064 x 2752` pixels using iPad Pro 13-inch or iPad Air 13-inch.

**Seven-shot order for both device sets**
1. Dashboard action queue with demo checkout and operational context.
2. Bookings list showing fictional checkouts and reservations across multiple statuses.
3. Schedule list showing the fictional event and shift context.
4. Item detail for the Sony FX6 Demo Kit, including status and reservation action.
5. Users directory showing fictional staff and student roles.
6. Reservation creation or equipment-picker screen tied to fictional inventory.
7. Search result for `DEMO-CAM-001`.

The first three images communicate the app's daily operational utility. The remaining four demonstrate catalog depth, people context, creation, and direct lookup. Keep the raw in-app presentation unless a later marketing pass adds truthful text overlays.

## Optional Reviewer Walkthrough Video

No video is required for the initial submission. The written notes, fictional account, typed sample codes, and attached QR images cover the non-obvious review path. Record and attach a short walkthrough only if final device acceptance reveals a step that remains difficult to explain in text.

## Version Information

**Build 23 release notes** (TestFlight/internal candidate):
```
Account and access
- Added passkey sign-in and Account & Security management with clearer enrollment,
  recovery, and removal states.
- Improved session and error handling when access or follow-up data is incomplete.

Badges and operations
- Improved badge progress and automatic recognition across serialized and bulk gear,
  including clean returns.
- Kept dashboard overdue and due-today counts stable when a partial read cannot be trusted.

Polish
- Improved failure feedback, accessibility behavior, and recovery across the latest native
  and web-connected workflows.
```

**Promotional text** (170 char max, editable anytime without re-review):
```
Plan reservations, track shift context, and look up gear by scan or search — built for
Wisconsin Creative's equipment operations.
```
(129 chars)

**Description** (4000 char max):
```
Wisconsin Creative is the equipment operations app for Wisconsin Athletics' creative and
production department. It connects gear reservations, event and shift schedules, and
equipment lookup in one native iOS app.

RESERVATIONS
Plan checkouts ahead of a shoot, game, or event. Pick equipment from the full catalog,
resolve scheduling conflicts before you arrive at the counter, and see reservation status
at a glance — mine, all, or needs-attention.

SCHEDULE
See your shifts, call times, and event assignments in one place, connected to the gear
that event needs. Trade shifts and stay current on schedule changes without leaving the app.

SEARCH AND SCAN
Look up any item, item family, reservation, or person by typed search or by scanning its
barcode/QR code. Get routed straight to the right detail screen — no digging through menus.

BUILT AROUND A STAFFED COUNTER
Physical equipment handoff — checkout, pickup, and return — happens at a staffed kiosk
counter, which keeps custody accountable and auditable. This app handles the planning side:
reservations, schedule, and lookup, so you arrive at the counter ready to go.

Access to Wisconsin Creative is invitation-only through the Wisconsin Athletics creative
and production department.
```
(1,243 chars — well under the limit; trim or expand once you've seen it rendered on a device)

**Keywords** (100 char max, comma-separated, no spaces after commas needed but improves readability):
```
gear,equipment,reservation,checkout,inventory,schedule,shift,scan,barcode,athletics,kiosk
```
(89 chars — Apple strips App Name/Subtitle words automatically, so avoid repeating "Wisconsin Creative" here)

**Copyright:** enter `2026 <copyright owner>` using the exact owner confirmed by the App Store Connect Account Holder. Do not include the copyright symbol because App Store Connect asks for the year followed by the owner. `Wisconsin Athletics` is the product-facing organization name, but the repository does not prove that it is the legal copyright owner.

## Compliance and Legal Fields

- **Export compliance:** No non-exempt encryption. The submitted target declares `ITSAppUsesNonExemptEncryption = false`. Confirm the processed Build 23 record shows the same answer.
- **Content rights:** confirm Yes only after the Account Holder confirms rights to the Wisconsin branding, app icon, submitted screenshots, and fictional review assets.
- **Digital Services Act:** use the organization-level trader status already established by the Account Holder. Do not infer or change this from repository content.
- **Custom license agreement:** none is required by the app. Use Apple's standard EULA unless the Account Holder has an approved institutional agreement.

---

## TestFlight

**What to Test** (Build 23, full user-facing release notes attached to App Store Connect):
```
Account & Security
- Added passkey sign-in with Face ID or Touch ID.
- Added passkey management in Account & Security, including named credentials,
  last-used details, clearer setup and removal, and password-protected changes.
- Improved recovery when setup is unavailable or a credential list refresh is delayed,
  and fixed false enrollment failures.

Reservations
- Added native reservation drafts. Minimize a reservation while checking gear, events,
  or bookings, then resume from the same step without losing your work.
- Save drafts on iPhone and continue them on the web. Save, Discard, Keep Editing, and
  Start New choices are clearer, and retry protection prevents duplicate reservations.
- Added contextual guidance for new reservations, continuous scanning, and resuming a
  saved draft.

Messages and updates
- Staff can send targeted updates to event crews and groups.
- Recipients see updates in the app and through push notifications, then acknowledge
  them from the dashboard.

Schedule and daily work
- Added contextual guidance for Open Work, Shift Calendar, and Availability.
- Simplified crew rows across Schedule and event details so assignments, areas, call
  times, and actions are easier to scan.
- Improved recovery when multiple people act on the same shift or trade.
- Dashboard timing now uses Today, Tomorrow, and Yesterday where helpful, with clearer
  date and time emphasis.
- Draft reservations no longer inflate active booking totals.

Inventory and access
- Add Item can stage an image from search, URL, or upload before saving, with retry
  available without recreating the item.
- Tightened role-aware access so collaborators see only permitted reservations, gear,
  schedules, and personal information.

Recognition and polish
- Badge progress now includes bulk equipment, and clean returns receive recognition
  even when returned late.
- Improved badge detail, recent-award display, and error feedback.
- Improved sign-out and account switching so old account alerts, drafts, and cached data
  do not appear for the next account.
- Refined accessibility announcements, loading states, and recovery behavior.
```

**Beta App Review Information:** same demo account and notes as App Review Information above — TestFlight external testing also goes through Apple review on first submission.

---

## Privacy Nutrition Label (App Privacy section in Connect)

Reconciled against `tasks/app-privacy-data-inventory.md`, the native project/dependencies, API/server diagnostics, schema, public privacy policy, and `ios/Wisconsin/Supporting/PrivacyInfo.xcprivacy`. Answer "No" to "Do you use data to track users."

| Data type | Linked to user | Used for | Notes |
|---|---|---|---|
| Name | Yes | App Functionality | Account identity |
| Email Address | Yes | App Functionality | Sign-in, invitations |
| Phone Number | Yes | App Functionality | Contact/roster field |
| User ID | Yes | App Functionality | Account identity |
| Device ID | Yes | App Functionality | Push notification targeting |
| Other Usage Data | Yes | App Functionality | Operational records (reservations, scans) |
| Other Diagnostic Data | Yes | App Functionality | Authenticated API/server reliability and security diagnostics |

No native crash-reporting, session-replay, performance-upload, or generic product-interaction analytics SDK is embedded in the iOS target. No location, contacts, browsing history, financial info, health, advertising data, third-party tracking, or data-broker sharing applies to this build.

---

## Pre-Submission Checklist Pointer

### Guideline audit gates

- [ ] Guideline 2.1: isolated demo login, live review backend, fictional dataset, and a sample QR/code are verified for the full review path.
- [ ] Guideline 2.3: screenshots and metadata are captured from the exact candidate and contain no real-person data.
- [ ] Guideline 4.2: screenshots and Review notes visibly demonstrate the app's native reservations, schedule, search/scan, notifications, and operational utility.
- [x] Guideline 5.1.1(i): the privacy policy is reachable inside the native app, not only through App Store Connect metadata.
- [x] Guideline 5.1.1(v): account deletion is available in the native app with password reauthentication and explicit destructive confirmation.
- [x] Guideline 5.1.1: the privacy nutrition label, privacy manifest, privacy policy, permission prompts, SDK inventory, retention/deletion behavior, and actual server data flows agree in source. Recheck against live App Store Connect answers before submission.
- [ ] Guideline 4.8: confirm the submitted build uses only first-party education/business credentials. If any third-party/social primary login is added, reassess the equivalent-login requirement before submission.

Do not treat the current privacy-label table below as final until the data-flow inventory is complete. The checked-in privacy manifest does not by itself prove every App Store Connect answer.

Code-side readiness, domain cutover verification, and Snow Leopard hardening are tracked in:
- `tasks/todo.md` → "Active: Unlisted iOS App Store launch readiness"
- `tasks/wisconsincreative-domain-cutover-plan.md`
- `tasks/ios-snow-leopard-release-plan.md`
- `tasks/ios-testflight-readiness-2026-05-11.md` (remaining hardware-only QA)

This file covers only the App Store Connect *content*. Account-level setup still happens in Connect: keep the new app publicly available for its initial App Review submission, enter this text, upload screenshots, submit the version, and then send Apple's separate unlisted-distribution request.

# App Store Connect Submission Content — Wisconsin Creative

Drafted: 2026-07-08. Paste-ready copy for the `Wisconsin` app's first Unlisted App Store submission. Kiosk (`WisconsinKiosk`) stays off the Store entirely — this content is for the main app only.

Sources used: `docs/AREA_PUBLIC_SHOWROOM.md`, `src/lib/public-showroom.ts`, `ios/Wisconsin/Supporting/PrivacyInfo.xcprivacy`, `scripts/seed-app-review-demo.mjs`, `ios/project.yml`.

---

## App Review Information

**Sign-in required:** Yes

**Demo account**
- Email: `appreview@wisconsincreative.com`
- Password: `ReviewDemo!2026` (or whatever `APP_REVIEW_DEMO_PASSWORD` was set to when `npm run demo:seed:app-review` last ran against the isolated App Review environment)

**Important:** Do not submit these credentials until `review.wisconsincreative.com` is deployed against the isolated App Review database and the demo seed has been verified there. Production `wisconsincreative.com` should not contain the App Review demo records.

**Notes to reviewer**
```
Wisconsin Creative is an internal equipment-management tool for a university athletics
creative/production department. It is not a public consumer app — access is invitation-only,
which is why the demo account above is required to sign in.

When the demo account signs in, the iOS app routes that account to an isolated App Review
environment at review.wisconsincreative.com. Normal invited users continue to use the
production wisconsincreative.com environment.

What the demo account can see:
- A staff-role home screen with sample reservations, checked-out gear, and shift context.
- Search and camera/QR scan lookup for sample equipment (the scan target is a fictional
  catalog seeded for this review; no physical gear is required to test lookup).
- Reservation creation and the equipment picker.
- Schedule/shift views.

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
**Age Rating:** 4+ — no objectionable content, no user-generated content exposed to strangers, no unrestricted web access, no gambling. Answer every questionnaire toggle "No."
**Content rights:** You own or have rights to all submitted content (confirm — app icon/branding assets are internal).

## Pricing and Availability

**Price:** Free
**Availability:** Unlisted (Distribution tab → set to "Unlisted" so the app doesn't appear in search/browse; installable only via direct link, TestFlight-style sharing, or QR/link the department distributes to staff and students)

## URLs

- **Support URL:** `https://wisconsincreative.com/about` (no dedicated `/support` page exists yet — `/about` is live, reachable, and describes the product; consider adding a real support/contact page later, but this satisfies the requirement now)
- **Marketing URL** (optional): `https://wisconsincreative.com/about`
- **Privacy Policy URL:** `https://wisconsincreative.com/privacy` (required, already live — verified rendering during domain cutover checks)

## Version Information

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

**Copyright:** `© 2026 Wisconsin Athletics` (confirm exact legal entity name before submitting)

---

## TestFlight

**What to Test** (this build, draft — edit per actual build contents):
```
This build focuses on release hardening ahead of the first App Store submission:
- Search tab: try typed search, then the QR scan button (top-right) — test a camera-denied
  state if you can (deny camera access once, confirm you get a clear recovery path with a
  "Type code instead" option).
- Create a reservation: use the equipment picker, add a few items, then open the cart
  (bottom bar) and remove one — confirm it removes cleanly.
- Bookings tab: switch between Mine / All / Attention scopes and pull to refresh.
- Schedule tab: check your shifts and try a shift trade if you have one available.
- Report anything that feels slow, crashes, or where an error message isn't clear about
  what went wrong or what to do next.
```

**Beta App Review Information:** same demo account and notes as App Review Information above — TestFlight external testing also goes through Apple review on first submission.

---

## Privacy Nutrition Label (App Privacy section in Connect)

Derived directly from `ios/Wisconsin/Supporting/PrivacyInfo.xcprivacy` — every category below is already declared there with `NSPrivacyTracking: false` and no tracking domains, so answer "No" to "Do you use data to track users."

| Data type | Linked to user | Used for | Notes |
|---|---|---|---|
| Name | Yes | App Functionality | Account identity |
| Email Address | Yes | App Functionality | Sign-in, invitations |
| Phone Number | Yes | App Functionality | Contact/roster field |
| User ID | Yes | App Functionality | Account identity |
| Device ID | Yes | App Functionality | Push notification targeting |
| Product Interaction | Yes | App Functionality, Analytics | In-app usage |
| Other Usage Data | Yes | App Functionality | Operational records (reservations, scans) |
| Crash Data | Yes | App Functionality, Analytics | Stability |
| Performance Data | Yes | App Functionality, Analytics | Stability |
| Other Diagnostic Data | Yes | App Functionality, Analytics | Stability |

No location, contacts, browsing history, financial info, health, or advertising data is collected. No third-party tracking or data-broker sharing.

---

## Pre-Submission Checklist Pointer

Code-side readiness, domain cutover verification, and Snow Leopard hardening are tracked in:
- `tasks/todo.md` → "Active: Unlisted iOS App Store launch readiness"
- `tasks/wisconsincreative-domain-cutover-plan.md`
- `tasks/ios-snow-leopard-release-plan.md`
- `tasks/ios-testflight-readiness-2026-05-11.md` (remaining hardware-only QA)

This file covers only the App Store Connect *content* — the account-level setup (creating the app record, selecting Unlisted distribution, entering this text, uploading screenshots) still has to happen in Connect itself.

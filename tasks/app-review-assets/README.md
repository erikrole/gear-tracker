# App Review Attachments

These files are fictional review resources generated from `scripts/seed-app-review-demo.mjs`.

Attach the QR images to App Review when the submission UI allows supporting files. Reviewers can also type the same values through Search, scan action, and Type Code.

- `DEMO-CAM-001.png`
- `DEMO-LENS-001.png`
- `DEMO-AUDIO-001.png`
- `DEMO-BATT-1.png`

Do not place the reviewer password or production information in this directory.

## App Store Screenshots

Captured from the Build 22 Release simulator build on 2026-07-23 while signed into the isolated fictional reviewer account. Files are opaque JPEGs at live App Store Connect accepted dimensions.

### iPhone 6.9-inch, 1320 x 2868

- `screenshots/iphone/iphone-01-home.jpg`
- `screenshots/iphone/iphone-02-bookings.jpg`
- `screenshots/iphone/iphone-03-schedule.jpg`
- `screenshots/iphone/iphone-04-item-detail.jpg`
- `screenshots/iphone/iphone-05-users.jpg`
- `screenshots/iphone/iphone-06-create.jpg`
- `screenshots/iphone/iphone-07-search.jpg`

### iPad 13-inch, 2064 x 2752

- `screenshots/ipad/ipad-01-home.jpg`
- `screenshots/ipad/ipad-02-bookings.jpg`
- `screenshots/ipad/ipad-03-schedule.jpg`
- `screenshots/ipad/ipad-04-item-detail.jpg`
- `screenshots/ipad/ipad-05-users.jpg`
- `screenshots/ipad/ipad-06-create.jpg`
- `screenshots/ipad/ipad-07-search.jpg`

The seven-image order tells the product story consistently on both devices: Dashboard, Bookings, Schedule, Items, Users, Create, and Search.

All fourteen screenshots were visually checked for fictional-only content, accepted dimensions, portrait orientation, and absence of an alpha channel. Local `asc` validation passed all seven iPhone files as `APP_IPHONE_67` and all seven iPad files as `APP_IPAD_PRO_3GEN_129`. The iPhone and iPad create sheets were dismissed without creating a reservation.

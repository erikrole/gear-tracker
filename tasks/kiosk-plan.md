# Kiosk Mode — Slice Plan

## Overview
iPad-based self-serve gear checkout/return station. Students tap their name, scan gear, and go. No login required.

## Slices

- [ ] **Slice 1: Schema + Kiosk Device Admin**
  - KioskDevice model + migration
  - Settings > Kiosk Devices admin page (ADMIN only)
  - CRUD API for kiosk devices

- [ ] **Slice 2: Activation + Kiosk Auth**
  - `/kiosk` activation code entry page
  - `POST /api/kiosk/activate` endpoint
  - `requireKiosk()` + `withKiosk()` auth helpers
  - Heartbeat endpoint
  - Kiosk layout (full-screen, no sidebar)

- [ ] **Slice 3: Idle Screen + Avatar Grid**
  - Kiosk dashboard API (stats, schedule, team checkouts)
  - Idle screen: stats cards, today's events, active checkouts
  - Avatar grid with search
  - Inactivity timer (5 min → idle)

- [ ] **Slice 4: Student Hub**
  - Student's active checkouts + reservations
  - Action buttons: Check Out, Return, Scan Item
  - "View all team checkouts" toggle

- [ ] **Slice 5: Checkout Flow (Scan-First)**
  - ScanInput component (hand scanner + camera + manual)
  - Scan items → running list → Done → auto-create booking
  - Success screen with auto-return

- [ ] **Slice 6: Return Flow**
  - Select active checkout → scan items back in
  - Progress indicator
  - Complete checkin → success screen

- [ ] **Slice 7: Scan Lookup + Hardening**
  - Quick scan → item status display
  - iPad CSS hardening (no zoom, no selection, landscape)
  - PWA manifest for "Add to Home Screen"
  - Session refresh before expiry

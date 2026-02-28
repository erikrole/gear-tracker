# Gear Tracker Feature Build

## 1. Locations API + Seed Data
- [ ] Create `GET /api/locations` endpoint (list all active locations)
- [ ] Seed "Camp Randall" and "Kohl Center" locations via the DB

## 2. Add Item Modal (Items page)
- [ ] Wire "Add item" button to open a modal form
- [ ] Form fields: asset tag, type, brand, model, serial number, QR code, purchase date, price, location (dropdown from API), status, notes
- [ ] POST to `/api/assets` on submit, refresh list

## 3. New Checkout Modal (Checkouts page)
- [ ] Wire "New check-out" button to open a modal form
- [ ] Form: title, requester (user dropdown), location, dates, item picker, notes
- [ ] POST to `/api/checkouts` on submit, refresh list

## 4. New Reservation Modal (Reservations page)
- [ ] Wire "New reservation" button to open a modal form
- [ ] Form: title, requester (user dropdown), location, dates, item picker, notes
- [ ] POST to `/api/reservations` on submit, refresh list

## 5. Profile Page
- [ ] Create `/profile` route with user info display
- [ ] Change password form (current + new password)
- [ ] Update role selector (ADMIN/STAFF/STUDENT)
- [ ] Create `PATCH /api/me` endpoint (password change, role update)
- [ ] Add profile link in sidebar footer (click avatar/name)

## 6. Cheqroom Import
- [ ] Awaiting file upload from user

## Review
- [ ] Verify all forms submit correctly
- [ ] Verify navigation and routing

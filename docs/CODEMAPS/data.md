<!-- Generated: 2026-04-14 | Files scanned: 142 | Token estimate: ~700 -->
# Data Architecture — gear-tracker

## Database
- PostgreSQL via Neon serverless
- ORM: Prisma 6.19.3 with `@prisma/adapter-neon`
- Schema: `prisma/schema.prisma`
- Seed: `prisma/seed.mjs`

## Entity Map

### Users & Auth
```
User              id, email, name, role(ADMIN|STAFF|STUDENT), passwordHash, avatarUrl, active
Session           id, userId, expiresAt
PasswordResetToken id, userId, token, expiresAt
AllowedEmail      id, email, note
```

### Organization
```
Location          id, name, address
Department        id, name, locationId
Category          id, name, parentId (hierarchical), color, icon
ShiftArea         id, name, locationId
```

### Assets & Inventory
```
Asset             id, name, sku, qrCode, status(AVAILABLE|MAINTENANCE|RETIRED),
                  categoryId, locationId, brand, model, serialNumber, notes,
                  imageUrl, purchaseDate, purchasePrice
                  ─ indexes on status, category, brand/model

BulkSku           id, name, sku, description, categoryId, locationId,
                  totalQuantity, alertThreshold
BulkStockBalance  id, bulkSkuId, locationId, quantity
BulkStockMovement id, bulkSkuId, locationId, kind(CHECKOUT|CHECKIN|ADJUSTMENT),
                  quantity, userId, bookingId, notes, createdAt
BulkSkuUnit       id, bulkSkuId, unitNumber, status(AVAILABLE|CHECKED_OUT|LOST|RETIRED), qrCode
```

### Bookings
```
Booking           id, kind(RESERVATION|CHECKOUT), status(DRAFT|BOOKED|OPEN|COMPLETED|CANCELLED),
                  requesterId, locationId, eventId, startAt, endAt, notes,
                  createdAt, updatedAt
                  ─ indexes on location+status, requester, time ranges

BookingSerializedItem  id, bookingId, assetId, checkedOutAt, checkedInAt, condition
BookingBulkItem        id, bookingId, bulkSkuId, quantity, checkedOutQty, checkedInQty
BookingBulkUnitAllocation id, bookingBulkItemId, bulkSkuUnitId, status
AssetAllocation        id, assetId, bookingId, startAt, endAt (availability blocking)
```

### Scanning
```
ScanSession       id, checkoutId, phase(CHECKOUT|CHECKIN), createdBy, completedAt
ScanEvent         id, sessionId, type(SERIALIZED|BULK_BIN), assetId, bulkSkuId,
                  result, userId, createdAt
OverrideEvent     id, bookingId, userId, reason, createdAt
```

### Kits
```
Kit               id, name, description, locationId, imageUrl
KitMembership     id, kitId, assetId, quantity, notes
KitBulkMembership id, kitId, bulkSkuId, quantity
```

### Scheduling
```
ShiftGroup        id, name, startDate, endDate, locationId, areaId, generatedAt
Shift             id, groupId, areaId, startAt, endAt, capacity, notes
ShiftAssignment   id, shiftId, userId, status(PENDING|APPROVED|DECLINED), hours,
                  requestedAt, approvedAt
ShiftTrade        id, fromAssignmentId, toUserId, status(PENDING|APPROVED|DECLINED|CANCELLED),
                  reason, createdAt
StudentSportAssignment  id, userId, sportCode, season
StudentAreaAssignment   id, userId, areaId, active
```

### Calendar & Events
```
CalendarSource    id, name, url (ICS feed), syncedAt, active
CalendarEvent     id, sourceId, externalId, title, startAt, endAt,
                  status(CONFIRMED|TENTATIVE|CANCELLED), locationId, sportCode, visible
```

### Audit & Compliance
```
AuditLog          id, entityType, entityId, action, before(JSON), after(JSON),
                  userId, createdAt
CheckinItemReport id, checkoutId, assetId, bulkSkuId, condition, notes, photoUrl
BookingPhoto      id, bookingId, userId, url, phase, createdAt
Notification      id, userId, type, title, body, read, createdAt, relatedId
FavoriteItem      id, userId, assetId, createdAt
```

## Key Relationships
```
User ──< Booking (requester)
Booking ──< BookingSerializedItem >── Asset
Booking ──< BookingBulkItem >── BulkSku
Booking ──< ScanSession ──< ScanEvent
Asset ──< AssetAllocation (prevents double-booking)
BulkSku ──< BulkSkuUnit (numbered tracking)
Kit ──< KitMembership >── Asset
ShiftGroup ──< Shift ──< ShiftAssignment >── User
CalendarSource ──< CalendarEvent
```

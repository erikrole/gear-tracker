# Importer Area Scope (V1 Cheqroom CSV)

## Document Control
- Area: Importer
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-01
- Status: Active
- Version: V1

## Direction
Build a lossless Cheqroom CSV importer that parses every column, maps supported fields into Gear Tracker models, and preserves unmapped values for audit.

## Goals
1. Parse entire CSV without silent data loss.
2. Import items as serialized or bulk records based on source kind.
3. Preserve all source values even when no first-class target field exists.
4. Produce deterministic import report with row-level errors and warnings.
5. Keep asset status derived from allocations, not imported status text.

## Input Contract
- Supported source: Cheqroom item export CSV.
- Expected shape: wide CSV with item, metadata, location, financial, tracking, and custody/check-out columns.
- Parser must tolerate:
  - Extra columns
  - Missing optional columns
  - Empty cells
  - Mixed timestamp formats

## High-Level Import Pipeline
1. Upload CSV and run header normalization.
2. Parse all rows into raw staging records.
3. Validate required minimum fields for item creation.
4. Map normalized fields into target item model.
5. Persist mapped data + full source payload snapshot.
6. Return import report (`created`, `updated`, `skipped`, `errors`, `warnings`).

## Lossless Parsing Rule
Every source column must be handled by exactly one path:
1. Mapped to target canonical field, or
2. Stored in `sourcePayload` migration JSON for that row.

No column is discarded.

## Source to Target Mapping (V1)

### Identity and Classification
- `Name` -> `tagName` (serialized primary label)
- `Category` -> `category`
- `Kind` -> `itemKind`
  - `Individual` -> `SERIALIZED`
  - `Bulk` -> `BULK`
- `Quantity` ->
  - bulk: `quantity`
  - serialized: validate as 1 (warn if not 1)

### Product Metadata
- `Brand` -> `brand`
- `Model` -> `model`
- `Link` -> `productUrl`
- `Description` -> `description`
- `Image Url` -> `imageUrl` (if valid URL)

### Tracking and Identifiers
- `Codes` -> tracking code list (normalized token split)
- `Barcodes` -> tracking code list (barcode type)
- `Serial number` -> `serialNumber`
- `UW Asset Tag` -> `uwAssetTag`
- `Id` -> `sourceExternalId` (Cheqroom id)

### Location and Context
- `Location` -> primary location mapping
- `Geo` -> `sourcePayload.geo`
- `Check-out Location Name` -> `sourcePayload.checkoutLocationName`
- `Kit` -> `sourcePayload.kit`

### Financial and Lifecycle Metadata
- `Purchase Price` -> `purchasePrice`
- `Purchase Date` -> `purchaseDate`
- `Warranty Date` -> `warrantyDate`
- `Residual Value` -> `residualValue`
- `Depreciated Value` -> `sourcePayload.depreciatedValue`
- `Department` -> `department`
- `Fiscal Year Purchased` -> `fiscalYearPurchased`
- `Created` -> `sourcePayload.createdAtSource`
- `Retired` -> `sourcePayload.retiredAtSource`

### Flags and Ownership
- `Flag` -> `flag` or `sourcePayload.flag`
- `Owner` -> `sourcePayload.owner`

### Contact and Custody Snapshot (Migration Context)
- `Contact Name` -> `sourcePayload.contactName`
- `Contact Email` -> `sourcePayload.contactEmail`
- `Contact Company` -> `sourcePayload.contactCompany`
- `Custody (via name)` -> `sourcePayload.custodyViaName`
- `Custody (via email)` -> `sourcePayload.custodyViaEmail`

### Check-out Snapshot Fields (Do Not Drive Live Status)
- `Check-out Started` -> `sourcePayload.checkoutStarted`
- `Check-out Due` -> `sourcePayload.checkoutDue`
- `Check-out Finished` -> `sourcePayload.checkoutFinished`
- `Check-out Id` -> `sourcePayload.checkoutId`
- `Status` -> `sourcePayload.sourceStatus`

## Derived Status Policy During Import
1. Source `Status` is not imported as authoritative asset status.
2. Source `Status` is stored for migration traceability only.
3. Live status remains derived from allocation and booking data in Gear Tracker.

## Dedup and Upsert Strategy
1. Primary matching key order:
   - `sourceExternalId` (Cheqroom id)
   - tracking code (`Codes`/`Barcodes`)
   - `serialNumber`
   - `tagName`
2. Import mode options:
   - Dry run
   - Create only
   - Upsert
3. Duplicate matches in a single run are blocked with explicit row errors.

## Validation Rules
1. Required minimum for serialized:
   - `Name`, `Category`, `Location`
2. Required minimum for bulk:
   - `Name`, `Category`, `Location`, `Quantity`
3. Date parsing accepts common ISO and timestamp formats.
4. Numeric fields parse with currency and decimal sanitization.
5. URL fields validate scheme and hostname format.

## Error Handling

### Hard Errors (Row Skipped)
- Missing required fields.
- Invalid item kind.
- Unresolvable duplicate key conflict.
- Invalid numeric parse for required numeric fields.

### Soft Warnings (Row Imported)
- Unknown category/location mapped to fallback.
- Partial metadata parse.
- Serialized quantity not equal to 1.
- Invalid optional URL or timestamp field.

## Import Report Output
- Total rows read
- Created count
- Updated count
- Skipped count
- Error count
- Warning count
- CSV row number + reason list for each error/warning

## Security and Audit
1. Import action requires `STAFF` or `ADMIN`.
2. Full source row snapshot stored for traceability.
3. Import runs generate audit log entry with actor, file name, and summary.

## Performance Targets (V1)
1. Handle typical inventory export size without timeout.
2. Stream parse to avoid memory spikes.
3. Support resumable batch processing for large files.

## Edge Cases
- Header name variants (`Check-out Due` vs `Checkout Due`).
- Hidden Excel formatting and stray Unicode characters.
- Rows with commas/newlines inside quoted fields.
- Duplicate tracking codes across different rows.
- Rows with empty `Name` but filled serial and code.
- Mixed bulk and serialized rows sharing same category/name.

## Acceptance Criteria
1. Every source column is either mapped or stored in `sourcePayload`.
2. Import does not write authoritative asset status from CSV `Status`.
3. Serialized and bulk rows follow separate validation rules.
4. Duplicate handling is deterministic and reported.
5. Dry run output matches actual import result counts when rerun unchanged.
6. Import report includes row-level diagnostics.

## Dependencies
- `AREA_ITEMS.md` for target field semantics.
- `AREA_USERS.md` for import permissions.
- `AREA_PLATFORM_INTEGRITY.md` for audit and integrity guardrails.

## Out of Scope (V1)
1. Auto-creating historical bookings from checkout snapshot columns.
2. Attachment file ingestion from remote image URLs beyond metadata linking.
3. Interactive column mapping UI.

## Developer Brief (No Code)
1. Build a staged importer with raw-row preservation and deterministic mapping.
2. Implement strict validation with hard-error vs soft-warning categories.
3. Keep status derivation invariant by storing source status as non-authoritative metadata.
4. Provide dry run, create-only, and upsert modes.
5. Emit detailed import report and full audit events.

## Change Log
- 2026-03-01: Initial importer area scope created for Cheqroom CSV migration.

Cheqroom CSV Import requirements (from real export):

Support these columns:
Name, Category, Brand, Model, Quantity, Kind, Serial number,
Purchase Date, Purchase Price, Warranty Date, Residual Value,
Link, Image Url, Location, Kit, Department, UW Asset Tag, Retired,
Codes, Barcodes
(Other Cheqroom columns may exist; ignore unknown columns safely.)

Rules:
1) Ignore these fields entirely:
   - Status
   - Check-out Started/Due/Finished
   - Check-out Id
   - Contact Name/Email/Company
   - Custody (via name/email)
   - Geo
   - Cheqroom internal Id

2) Name -> asset_tag + name
3) Unique asset_tag is required:
   - If duplicates, auto-append “-1”, “-2”… and show this in preview
4) Location:
   - Auto-create if missing
   - Map to home_location_id
5) Department:
   - Auto-create if missing
   - Map to department_id
6) Kind/Quantity:
   - If Kind="Bulk" => consumable=true, quantity=Quantity
   - Else consumable=false, quantity=1
7) Serial number -> serial_number
8) UW Asset Tag -> uw_asset_tag
9) Codes/Barcodes:
   - If Barcodes or Codes contains a single unique code, store it as primary_scan_code and/or qr_value
   - If multiple codes, store as an array/table (ItemCode) but maintain one “primary”
10) Kit:
   - Create Case per unique Kit name
   - Link membership after items created

Wizard UX:
- Upload -> preview -> mapping -> validation -> import -> summary
- Summary includes created/updated/skipped + downloadable error CSV
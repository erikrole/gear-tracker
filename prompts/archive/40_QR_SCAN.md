QR + scanning requirements

- Items + Cases have qr_value defaults:
  bg://item/<uuid>, bg://case/<uuid>
- Also support scanning primary_scan_code from import (barcodes)
- Mobile camera scanning using a proven library (zxing or similar)
- “Quick Checkout” mode supports continuous scanning into a cart
- “Quick Check-in” supports scan -> find open checkout -> confirm
- Printable labels page:
  simple grid of QR + asset_tag + small secondary code (optional)
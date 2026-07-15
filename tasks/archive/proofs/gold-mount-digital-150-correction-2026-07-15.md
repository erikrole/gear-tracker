# Gold Mount Digital 150 Correction Proof - 2026-07-15

## Scope
- Production branch: `br-gentle-sky-aisuwcsf`
- Active family: `cmnrtqudx0009jp049epk5si3` (`Gold Mount Battery`)
- Archived source family: `cmnrtqudd0005jp04hlg8vauz` (`Anton Bauer Digital 150 Gold-Mount Battery`)

## Preflight
- Gold Mount reported 10 available units and an on-hand balance of 10.
- Anton/Bauer Dionic XT 150Wh owned units 1-8. Unit 1 had one closed historical allocation; units 2-8 had no allocations.
- Archived Anton Bauer Digital 150 owned units 9-10. Both were available, unprinted, and had zero allocation history.
- The inactive source family had zero units and zero balance, but retained two historical booking rows and one adjustment movement.

## Mutation
- Deleted Gold Mount unit records 9 and 10.
- Deleted the archived Anton Bauer Digital 150 product record beneath Gold Mount.
- Set the Gold Mount stock balance from 10 to 8.
- Wrote a `-2` adjustment movement and atomic audit entries for the product deletion and inventory correction.
- Preserved the hidden inactive source family and its historical booking evidence.

## Postflight
- Gold Mount balance: 8.
- Gold Mount numbered units: 8.
- Available units: 8.
- Products: Anton/Bauer Dionic XT 150Wh, active, 8 assigned units.
- Anton Bauer Digital 150 product: absent.
- Inactive Digital source family: hidden, zero balance, zero units, historical rows preserved.

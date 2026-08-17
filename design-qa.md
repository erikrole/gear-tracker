# Signature roster design QA

- Source visual truth: `/Users/role/.codex/generated_images/01a00787-0134-78c2-98b4-b99071bcb09b/exec-c593a80f-6171-4314-8711-7a008e41dfdc.png`
- Source pixels: 1487 x 1058
- Implementation route: `http://127.0.0.1:3000/signatures/cmsuuo6v2000bp5uym0kx3c24`
- Dark implementation: `/Users/role/Code/wisconsin-creative/design-qa-signature-roster-dark-final.png`
- Light implementation: `/Users/role/Code/wisconsin-creative/design-qa-signature-roster-light-final.png`
- Responsive implementation: `/Users/role/Code/wisconsin-creative/design-qa-signature-roster-1024.png`
- Side-by-side comparison: `/Users/role/Code/wisconsin-creative/design-qa-signature-roster-comparison.png`
- Intended viewport: desktop, 1487 x 1058 CSS pixels, device scale factor 1
- State: Creative staff roster, one committed signature

## Final visual comparison

The source and authenticated implementation were compared together at the same 1487 x 1058 dimensions. The implementation preserves the selected compact horizontal roster while retaining the product's existing shell, alphabetical Creative staff order, collection controls, and permission model. Creative staff rows intentionally omit title sublines; team rosters continue to show position/title.

All 12 roster rows measure exactly 64px. The Signature heading, saved PNG proof, and unsigned capture actions share the same center rail: heading x-center 1294px, capture x-center 1294px, and image x-center 1293.996px. Capture controls measure 160 x 44px; the signature proof is capped at 28px high so completion does not change row height.

Dark mode renders the decoded transparent signature white with `brightness(0) invert(1)`. Light mode renders the same decoded asset black with `brightness(0)`. At a 1024px viewport the page itself does not overflow; the fixed roster grid uses its own horizontal scroll surface and every row remains 64px.

## Artifact and download proof

The action menu exposes Replace, Download PNG, Download SVG, Remove, and requirement controls. Both explicit download actions completed through browser download events and landed in the macOS Downloads folder with clean filenames.

- PNG: `/Users/role/Downloads/erik-role-signature.png`
  - 1600 x 645 pixels
  - 4-channel RGBA PNG
  - Alpha range 0-255; `isOpaque: false`
  - 63,757 bytes
  - No white background; transparent pixels surround the signature ink
- SVG: `/Users/role/Downloads/erik-role-signature.svg`
  - 33,096 bytes
  - A real `viewBox` and four vector `<path>` elements
  - No `<image>`, embedded raster data, scripts, `foreignObject`, or external references

Newly saved PNG artifacts are rendered at up to 1600 x 900 while preserving aspect ratio, never below 1000px wide. Existing captures are regenerated from their stored SVG vector on explicit PNG download, so the same quality contract applies retroactively. Inline roster previews remain private, authenticated, and non-download-disposition responses.

## Comparison history

- Pass 1: localhost authentication blocked the first capture.
- Pass 2: authenticated layout proof passed, but private Blob credentials were absent locally.
- Pass 3: private delivery and decoded dark/light proof passed; explicit PNG download still opened inline.
- Pass 4: attachment behavior passed; the first SVG attachment was zero bytes because local Blob metadata supplied a zero content length.
- Final pass: PNG and SVG bodies are delivered with measured byte lengths, browser downloads complete, file metadata passes, responsive behavior passes, and no visual P0/P1/P2 findings remain.

## Findings

No remaining P0, P1, or P2 visual or artifact-delivery findings.

The one browser console `InvalidStateError: Transition was aborted because of invalid state` occurred during repeated automated download handling after successful file creation. It did not reproduce as a page-load or roster interaction failure and did not affect either downloaded artifact.

final result: passed

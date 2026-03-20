# Slice 5.1: Button Migration

## Goal
Replace 182+ `.btn` / `.btn-*` CSS class usages with shadcn `<Button>` component across 60+ files.

## Mapping

| CSS Pattern | shadcn Equivalent |
|---|---|
| `btn` | `<Button variant="outline">` |
| `btn btn-primary` | `<Button>` (default variant) |
| `btn btn-danger` | `<Button variant="destructive">` |
| `btn btn-ghost` | `<Button variant="ghost">` |
| `btn btn-sm` | `<Button variant="outline" size="sm">` |
| `btn btn-primary btn-sm` | `<Button size="sm">` |
| `btn btn-danger btn-sm` | `<Button variant="destructive" size="sm">` |
| `btn btn-ghost btn-sm` | `<Button variant="ghost" size="sm">` |
| `btn btn-sm text-red` | `<Button variant="ghost" size="sm" className="text-destructive">` |
| `login-btn` | `<Button className="w-full h-11 text-base font-semibold">` |
| `btn-link` | `<Button variant="link">` |
| `btn-danger-outline` | `<Button variant="outline" className="text-destructive border-destructive">` |
| `btn-checkin` | `<Button className="bg-green-500 text-white border-green-500 hover:bg-green-600">` |
| `btn-full` | add `className="w-full"` |

## Execution Plan
1. Migrate auth pages (login-btn → Button) — 4 files
2. Migrate settings pages — ~5 files
3. Migrate user/profile pages — ~4 files
4. Migrate items pages — ~3 files
5. Migrate booking/checkout/reservation components — ~10 files
6. Migrate remaining pages (dashboard, reports, schedule, etc.) — ~15 files
7. CSS cleanup — remove `.btn*` rules from globals.css
8. Build + push

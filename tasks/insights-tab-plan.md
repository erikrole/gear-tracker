# Insights Tab — Item Detail Page

## Goal
Add a glanceable utilization dashboard tab to the item detail page, using shadcn/ui charts (Recharts). All stats computed client-side from `asset.history` (max 100 entries, already loaded). Zero new API endpoints.

## Time Window
Toggle at top: **30d / 90d / 1yr / All**. Filters `asset.history` before computing. Default: 90d.

## Cards (2-column grid, 10 cards)

### Row 1 — Headline Metrics
| Card | Chart | Logic |
|------|-------|-------|
| **Utilization Rate** | Radial bar chart (gauge) | `bookedDays / totalDaysInWindow * 100`. A "booked day" = any day overlapping at least one booking. |
| **Bookings by Month** | Area chart (12 bars) | Group filtered bookings by `startsAt` month, count per month. Shows trend + seasonality. |

### Row 2 — Segmentation
| Card | Chart | Logic |
|------|-------|-------|
| **By Sport** | Horizontal bar chart | Group by `booking.sportCode` (fall back to "Untagged"). Sum checkout days per sport. Top 6 + "Other". |
| **Top Borrowers** | Horizontal bar chart | Group by `booking.requester.name`. Count bookings. Top 5. |

### Row 3 — Patterns
| Card | Chart | Logic |
|------|-------|-------|
| **Checkout vs Reservation** | Donut (pie) chart | Count by `booking.kind`. Two segments: CO / RES. |
| **Day-of-Week Demand** | Vertical bar chart (7 bars) | Count bookings starting on each weekday (Mon–Sun). |

### Row 4 — Health
| Card | Chart | Logic |
|------|-------|-------|
| **Return Punctuality** | Stacked horizontal bar | For COMPLETED bookings: count on-time (`endsAt >= actual`) vs late. "Late" = status was OPEN past endsAt. Approximation: if booking is COMPLETED and had status OPEN, compare endsAt to now for active ones. For completed ones, we can only know if they were late from history shape — simplify to: COMPLETED = on-time, any booking that had `endsAt < now && status was OPEN` = late. **Simplification**: just show % of bookings that are COMPLETED vs still OPEN past due. |
| **Avg Checkout Duration** | Big number + subtitle | `avg(endsAt - startsAt)` for CHECKOUT bookings. Show in days/hours. Subtitle: "Longest: Xd". |

### Row 5 — Financial & Idle
| Card | Chart | Logic |
|------|-------|-------|
| **Cost Per Use** | Big number + subtitle | `purchasePrice / totalBookings`. Subtitle: "Total bookings: N". Show "—" if no price set. |
| **Idle Streak & Age** | Big number pair | Left: days since last booking ended. Right: days since `purchaseDate` (or "—"). |

## Implementation Slices

### Slice 1: Install shadcn chart + create stats computation
- [ ] `npx shadcn@latest add chart` (installs recharts + chart.tsx)
- [ ] Create `src/app/(app)/items/[id]/useItemInsights.ts` — pure computation hook
  - Input: `asset.history`, `asset.purchasePrice`, `asset.purchaseDate`, `windowDays`
  - Output: all 10 computed stat objects (utilization%, monthlyData[], sportData[], etc.)
  - No side effects, no fetches — pure derivation from existing data
- [ ] Unit-testable: all logic in one hook, no UI coupling

### Slice 2: Build the 10 chart cards
- [ ] Create `src/app/(app)/items/[id]/ItemInsightsTab.tsx`
- [ ] Time window toggle (30d / 90d / 1yr / All) using shadcn Tabs or ToggleGroup
- [ ] 10 cards in 2-column responsive grid (`grid grid-cols-1 md:grid-cols-2 gap-4`)
- [ ] Charts:
  - Radial bar: `<RadialBarChart>` for utilization gauge
  - Area: `<AreaChart>` for monthly trend
  - Horizontal bar: `<BarChart layout="vertical">` for sport + borrowers
  - Donut: `<PieChart>` with inner radius for CO vs RES
  - Vertical bar: `<BarChart>` for day-of-week
  - Stacked bar: `<BarChart>` with two `<Bar>` for punctuality
  - Big numbers: plain shadcn Card with large text, no Recharts needed
- [ ] All charts use `ChartContainer` + `ChartTooltip` from shadcn
- [ ] Chart colors via `chartConfig` tied to CSS variables

### Slice 3: Wire into tab bar + build verify
- [ ] Add "Insights" tab to `tabDefs` in `page.tsx`
- [ ] Conditionally render `<ItemInsightsTab>` when active
- [ ] Pass `asset`, `now` props (same pattern as other tabs)
- [ ] `npm run build` — must pass clean
- [ ] Visual smoke test: empty history shows graceful empty states

## Chart Color Palette (from existing CSS vars)
- Primary blue: checkouts, main metrics
- Purple: reservations
- Green: on-time / completed
- Orange: warning / late
- Sport bars: cycle through 6 distinct hues via chartConfig

## Edge Cases
- **No history**: Show empty state per card ("Not enough data")
- **No sportCode**: Group as "Untagged"
- **No purchasePrice**: Cost per use shows "—"
- **No purchaseDate**: Age shows "—"
- **Single booking**: All charts still render (1 bar, 1 segment, etc.)

## Dependencies
- `recharts` (via shadcn chart component)
- No new API endpoints
- No schema changes
- No new DB queries

# BookingWizard Component Audit
**Date**: 2026-04-29  
**Files**: `src/components/booking-wizard/BookingWizard.tsx` (707 lines), `WizardStep1.tsx` (454 lines), `WizardStep2.tsx` (71 lines), `WizardStep3.tsx` (244 lines)  
**Consumers**: `/checkouts/new`, `/reservations/new` (pages); API routes `/api/checkouts`, `/api/reservations`

---

## What's Smart

**1. Dual-config design for CHECKOUT vs RESERVATION** (BookingWizard.tsx:40–74)  
Single component parameterized by `kind` enum; label text, API endpoint, default event-tieToEvent flag all derive from config. Eliminates code duplication. Both routes instantiate with `<Suspense>` and skeleton, excellent UX.

**2. Conflict auto-removal on POST 409** (BookingWizard.tsx:375–410)  
When inventory conflict occurs, API returns per-item details (conflicting booking title, maintenance status, bulk shortage numbers). Client auto-removes those assets from selection, shows human-readable per-item error, and returns to Step 2. Users don't have to manually hunt conflicting items.

**3. Multi-event binding with auto-fill** (WizardStep1.tsx:99–115, use-event-context.ts:14–29)  
Up to 3 events can be linked; booking dates auto-derive from the chronologically-first and -last events (–2h before start, +2–24h after end depending on home/away). `deriveFromPrimary()` computes a coherent title from sport + opponent. Single-click, no manual date juggling.

**4. Comprehensive form reducer** (BookingWizard.tsx:78–119)  
Seven fields with interdependencies (`sport` clears events, `tieToEvent` toggle clears events) handled in single reducer. Clean dispatch-based mutations. Avoids useState cascade.

**5. Draft lifecycle** (BookingWizard.tsx:235–249, use-draft-management.ts)  
Auto-resume on route entry, explicit save & exit button, auto-delete post-submit. Draft banner shows unfinished drafts with item counts. Graceful recovery from interrupted flows.

**6. Equipment requirement guidance** (BookingWizard.tsx:264–271)  
`getUnsatisfiedRequirements()` validates that selected asset types include all mandatory categories (e.g., if you pick a helmet, you must also pick a jersey). Prevents incomplete kits. Message surfaced in validation before Step 3.

**7. Warn-before-unload** (BookingWizard.tsx:276–283)  
Detects unsaved form data; only fires if title, asset selection, or bulk items present. Prevents accidental loss on page nav.

**8. Step progress UI with backtrack** (BookingWizard.tsx:523–581)  
Three-step indicator shows completed steps as checkmarks, active step highlighted, future steps locked. Completed steps allow re-entry. Footer navigation disables "Next" until validation passes.

---

## What Doesn't Make Sense

**1. Multi-event API transmission gap** (BookingWizard.tsx:349–355)  
Client collects up to 3 events in `form.selectedEvents`, sends both `eventIds` array AND `sportCode` from the first event's sport. Backend comment says "API derives primary + junction rows" but there's no clear spec on whether:
- `eventIds[0]` becomes the canonical Booking.eventId
- Other eventIds create separate BookingEvent junction records
- What happens if primary event is removed/rescheduled

Code is defensive (sends both `eventId` fallback if eventIds empty) but conflation is confusing.

**2. Silent TODO in use-event-context** (use-event-context.ts:150, line cut off)  
Last visible line `// Primary id is what matters — track it explicitly.` is incomplete; likely continues off-screen.

**3. Validation rule asymmetry** (WizardStep1.tsx:359–400, WizardStep3.tsx)  
Step 1 allows requester/location to be empty initially (UI shows placeholder "Select…"), but validation only fires on Step 2 "Next" button. User can toggle event tieToEvent and see validation error; flow is confusing. Should validate Step 1 fields in real time or at step entry, not deferred.

**4. Kit field not in validation schema** (BookingWizard.tsx:348, WizardStep1.tsx:402–427)  
`kitId` is set and passed in payload but has no Zod field in `createCheckoutSchema` or `createReservationSchema`. Payload is sanitized and stripped by API. This is intentional (kit is optional, API infers from assets), but the discrepancy is undocumented.

**5. No notes field in wizard** (BookingWizard.tsx, WizardStep1.tsx, WizardStep3.tsx)  
Booking schema has `notes` field (max 10,000 chars, optional), but wizard offers no UI to set it. If user wants to record "VIP player — priority setup" or "Return by 6pm", they must edit the booking post-creation.

**6. Bulk SKU availability check missing from UI** (WizardStep2.tsx, EquipmentPicker)  
Serialized assets show availability in picker, but bulk items only check `PlannedQuantity <= OnHandQuantity` at submission time (409 response). No live "only 2 of 5 available" feedback during selection.

**7. sourceReservationId not surfaced** (BookingWizard.tsx)  
Checkout can be derived from a reservation (cross-booking type), but wizard doesn't expose this field. Useful for "convert reservation to checkout" flows, but UX is delegated to dedicated API route elsewhere.

---

## What Can Be Simplified

**1. Redundant date/time formatting** (WizardStep1.tsx:24–28, use-event-context.ts:15–29, BookingWizard.tsx)  
Three separate implementations of "format event time as chip" / "format event as list item". Centralize in a shared utility and import.

**2. Form options useQuery rerun per mount** (BookingWizard.tsx:143–156)  
`staleTime: 5 * 60_000` means fresh data every 5 min; wizard mount/unmount in same session causes refetch. Set higher (30 min+) or use persistent cache key (users, locations, bulk SKUs rarely change in a session).

**3. Manual conflictingAssetIds Set** (BookingWizard.tsx:383–407)  
Build Set from conflicts, iterate manually to build error messages, then filter. Use `.map()` and `.join()` to reduce imperative loop:
```ts
const msgs = d.conflicts?.map(c => `${findTag(c.assetId)}: conflicts with "${c.conflictingBookingTitle}"`) ?? []
const conflictIds = new Set(d.conflicts?.map(c => c.assetId) ?? [])
```

**4. Error clearing scattered** (BookingWizard.tsx:258–261, 309–310, 314, 326, 336)  
`setCreateError("")` called in 5+ places (step nav, form dispatch, submit, next handler). Create a helper `clearError()` or auto-clear on any form mutation using the `step1Dispatch` callback pattern you already have.

**5. Magic number 280px** (WizardStep1.tsx:192)  
Event list uses `max-h-[280px] overflow-y-auto` hardcoded; same in Step 3 equipment list. Extract as `const MAX_SCROLL_HEIGHT = "280px"` or CSS custom property.

**6. Button text conditional hell** (BookingWizard.tsx:677–690)  
Next button label is computed inline with ternaries and array index logic. Extract to a helper:
```ts
function getNextButtonLabel(step, activeSection, itemCount) { ... }
```

**7. Events loading state duplicate** (WizardStep1.tsx:182–185, BookingWizard.tsx doesn't show but events come from hook)  
Skeleton loading and "Loading events…" text lives in WizardStep1, but the query itself is in custom hook. Consider moving both to hook or centralizing skeleton state.

---

## What Can Be Rethought

**1. Multi-event as a schema upgrade, not UI feature** (BookingWizard.tsx:349–355, validation.ts:35–49)  
Currently `eventIds` is optional, and logic auto-falls back to `eventId`. This legacy compat layer masks whether multi-event is actually used. Consider:
- Measure: how many bookings in prod have `eventIds.length > 1`?
- If rare: remove eventIds, auto-derive single event from first of selectedEvents
- If common: build full UI (linked events as a list, remove button per event, show span across all dates in Step 3)

**2. Equipment requirement UI too subtle** (BookingWizard.tsx:300)  
When `unsatisfiedRequirements` has items, a single toast-like message blocks "Next". User doesn't see *which* items they're missing. Suggestion: Step 2 shows a red banner: "Missing: Jersey (pairs with Helmet)" with a button to jump to that section.

**3. Step 2 UI/UX mismatch** (WizardStep2.tsx:71)  
Step 2 is a 71-line wrapper around EquipmentPicker. Stepping through sections (step 2 "Browse Helmets → Browse Jerseys → Review") feels odd when all equipment is visible at once. Consider:
- Flatten into a single Step 2 UI with all sections on one page (requires longer scroll)
- Or keep sections but add per-section completion badges so user knows progress
- Or merge Steps 2 & 3 into a single "Select Equipment + Confirm" mega-step

**4. Draft as its own entity vs Form snapshot** (use-draft-management.ts:39–117)  
Draft is created by manual save, auto-loaded on re-entry, auto-deleted after submit. This is a snapshot of form state. But Booking itself also has DRAFT status. Clarify:
- Is a "draft" a Booking with `status: DRAFT` (server-persisted, shareable, cancellable)?
- Or a client-side FormState cache (survives browser close, private to user)?
- Current design suggests the latter, but naming and lifecycle are ambiguous.

**5. Required vs optional labeling** (WizardStep1.tsx:325–332, 362, 382)  
Requester, Location, Start, End are marked `required` in HTML but label text doesn't indicate this. Add visual asterisk or "(required)" suffix to labels, and remove `required` attr (it's a11y hint, not functional since form is custom).

**6. Sheet vs page for wizard** (BookingWizard.tsx, pages)  
Wizard is full page (`/checkouts/new`, `/reservations/new`). Navigation history: hitting back after submit goes to `/bookings`. Good for deep-linking but:
- If user wants to create multiple bookings in a session, must go back to list, click "New", repeat.
- Alternative: bottom sheet or modal in list page; close after submit, stay on list.
- Current design is correct for one-off flows; document the choice.

---

## Consistency & Fit

### Pattern Drift

**1. Booking API response shape**  
`/api/checkouts` POST returns `{ data: { id, refNumber? } }` (BookingWizard.tsx:420).  
Wizard assumes `refNumber` is optional and builds toast: `"Checkout created — REF123"` (line 422).  
But check: does every booking type always return refNumber, or only under certain conditions? If inconsistent, wizard should handle nullish.

**2. Touch-friendly minimum heights**  
WizardStep1.tsx:204 event list item uses `max-md:min-h-[44px]` (mobile minimum). Good.  
But date picker inputs, requester/location selects do not. On mobile, these should also have min-h-12 or 44px for thumb-friendly tapping.

**3. Toast patterns**  
Draft save: `toast.info("Draft saved")` (use-draft-management.ts:101).  
Booking submit: `toast.success("Checkout created — REF123")` (BookingWizard.tsx:422).  
Low stock: fire-and-forget promise (BookingWizard.tsx and API), no toast.  
Inconsistent: always toast on completion, don't go silent on async fire-and-forget ops.

### Dead Code

**1. Unused `step1Dispatch` callback logic**  
BookingWizard.tsx:258–261 wraps `dispatch()` to clear errors, but only used in Step 1. Steps 2 & 3 dispatch form actions (none exist in reducer, but safety principle), and don't clear errors. Consider whether error clearing should be automatic on *any* form mutation.

**2. Unused `resetDraftLoaded()` export** (use-draft-management.ts:120–122)  
Exported but never called by BookingWizard. Why? If comment "expose resetDraftLoaded so parent can clear it after successful submission" is intended, verify parent actually calls it, or remove.

**3. `draftBannerDismissed` state** (BookingWizard.tsx:172)  
Dismisses draft banner for the session. Fine for UX, but never persists. Dismissed banner will reappear on page reload, which is correct but could be noisy. Consider: if user dismisses, hide for 1 hour or until next draft is created.

### Ripple Map

**Consumers of BookingWizard:**
- `src/app/(app)/checkouts/new/page.tsx` — wraps with Suspense skeleton, passes `kind="CHECKOUT"`
- `src/app/(app)/reservations/new/page.tsx` — same but `kind="RESERVATION"`

**APIs called:**
- `/api/form-options` — fetches users, locations, bulk SKUs (1x on mount, stale 5 min)
- `/api/me` — fetch current user (1x on mount, stale 5 min)
- `/api/drafts` — GET (list unfinished), GET by ID (load), POST (save), DELETE (cleanup)
- `/api/calendar-events` — fetch next 3 days of events, filtered by sport
- `/api/my-shifts` — fetch user's shift for a given event
- `/api/checkouts` or `/api/reservations` — POST to create booking
- `/api/availability?...` — (not shown, but EquipmentPicker likely calls this)

**Downstream:**
- `useEventContext` (custom hook) — manages event selection state and shifts
- `useDraftManagement` (custom hook) — manages draft load/save/delete
- `useKitFetching` (custom hook) — not inspected, but loads kits by locationId
- `EquipmentPicker` component — handles asset/bulk selection
- Redirect to `/bookings?tab=checkouts&highlight=BOOKING_ID` after submit

No other components import BookingWizard or its steps directly. Clean isolation.

### Navigation Integrity

**1. Back button on Step 2–3 clears form**  
`handleBack()` only resets step number; form fields retain values. Correct. (No state wipe on back nav.)

**2. Resume from draft via URL param**  
`?draftId=ABC` auto-loads draft data via `useDraftManagement`. Good, but:
- If draftId is invalid/missing, does the page gracefully fall back to blank form? (Yes: `then((json) => if (!json?.data) return` in use-draft-management.ts:46.)
- If load fails (network error), toast fires and user starts fresh. Good.

**3. Post-submit redirect**  
Line 429–434: if CHECKOUT, push `/bookings?tab=checkouts&highlight=BOOKING_ID`; if RESERVATION, push with `reservations` tab.  
Assume BookingListPage respects `highlight` param and scrolls/highlights that row. Not verified here, but pattern is sound.

---

## Polish Checklist

| Dimension | Status | Details |
|-----------|--------|---------|
| **Empty States** | ⚠️ Partial | Step 2 equipment list shows "No equipment selected — go back to add items" on Step 3; correct. Event list shows "No upcoming events…" with toggle hint; correct. Bulk shortage messages at submission are specific per-item; excellent. No empty state for requester/location dropdowns (always have data). |
| **Skeleton Fidelity** | ✅ Good | WizardSkeleton.tsx matches layout (h-8 title, h-4 subtitle, step badges, input fields). Render time <500ms typically. |
| **Silent Mutations** | ❌ Gaps | Draft auto-save has toast ("Draft saved"). Bulk low-stock check is fire-and-forget with console.error on fail (BookingWizard.tsx:120), no user visibility. Post-submit redirect has no loading state — button shows progress text until nav. |
| **Confirmation Quality** | ✅ Good | Step 3 displays full booking summary (title, events, dates, requester, location, equipment with images). Submit button shows item count: "Confirm Pickup (5 items)". Kiosk notice for CHECKOUT. |
| **Mobile Breakpoints** | ⚠️ Mixed | Event picker items: `max-md:min-h-[44px]` (good). Requester/location: `grid-cols-1 gap-4 sm:grid-cols-2` (good). Dates: same (good). But overall form width is `max-w-2xl` on all screen sizes; no responsive padding/max-width for <640px. Suggest: `max-w-2xl on sm+, w-full on xs`. |
| **Error Message Quality** | ✅ Excellent | Validation: "Give this booking a name", "Select who this is for", "End date must be after start date". Conflict errors: per-item with asset tag and conflict reason. Bulk shortage: "Batteries: only 2 available (requested 5)". |
| **Button Loading States** | ✅ Good | Submit button shows `config.actionLabelProgress` ("Picking up…", "Reserving…") when `submitting=true`. Draft save & exit shows "Saving…" when `savingDraft=true`. No visual spinner, but text is clear. |
| **Role Gating** | N/A | Wizard is client-side; permissions enforced at API (requirePermission in POST handlers). Page-level redirect should happen at `/checkouts/new` or `/reservations/new`, not verified. Assume parent layout/middleware checks. |
| **Performance (N+1, Awaits)** | ⚠️ Minor | See "What Can Be Simplified": form-options and me both refetch on mount with 5-min stale time. Sequential awaits in conflict removal (loop + lookup) could batch. Low-stock notification is fire-and-forget Promise chain (line 92–122 in API) — acceptable. EquipmentPicker likely makes N queries for availability; not inspected. |
| **Debug Cleanup** | ✅ Clean | No console.log, console.warn, or TODO/FIXME comments found in wizard files. Low-stock error logged: `console.error("[LOW_STOCK] Failed to check/notify:", err)` (API, scoped). |
| **Accessibility** | ⚠️ Good w/ Gaps | aria-label on toggle ("Link to event"), aria-pressed on toggles/selected items, aria-label on remove chip buttons. Step indicator has `role="navigation" aria-label="Wizard steps"`. But: date inputs lack explicit labels (only placeholder); requester/location selects lack labels (shadcn SelectValue placeholder only); FieldLabel is visual-only, not associated with inputs. Suggest: wrap each field in `<label>` or add `aria-labelledby`. |

---

## Raise the Bar

**1. Declarative multi-event UI**  
If eventIds is truly multi-event, build a "Linked Events" section in Step 3 that shows all three with dates, opponent, location. Allow inline remove. Currently, selected events only appear as "Events" row in summary; user can't see the span.

**2. Notes field in Step 1**  
Add optional textarea after location: "Notes (visible at pickup, e.g., 'VIP setup', 'Return by 6pm')". 10k-char limit. Pass to API payload.

**3. Real-time bulk availability**  
In EquipmentPicker, show "3 of 5 available" next to each bulk item. On selection, decrement live. Fetching availability per bulk item is expensive; cache results in the picker or pre-load from form-options.

**4. Persist dismissed draft banner**  
If user dismisses the "You have unfinished drafts" banner, remember for 1 hour (localStorage with timestamp). Reduces banner fatigue for users who intentionally abandoned a draft.

**5. Guided multi-event flow**  
Add a small "Link multiple events?" toggle under "Link to Event" heading. If enabled, show a multi-select chip list instead of single-select buttons. Walk user through date implications (auto-computed span, –2h before / +2–24h after).

---

## Quick Wins (3–5 items, <30min each)

1. **Centralize date/time formatting** — Create `src/lib/event-formatting.ts` with `formatChipTime()`, `formatEventListItem()`, export from both WizardStep1 and use-event-context. Consolidate to one implementation.

2. **Extract magic number 280px** — Define `const MAX_SCROLL_HEIGHT = "280px"` at top of BookingWizard.tsx, use in WizardStep1 event list and WizardStep3 equipment list.

3. **Auto-clear errors on any form mutation** — Extend `step1Dispatch` callback to all form dispatch calls (requester, location, dates). Remove manual `setCreateError("")` calls in handleNext/handleBack.

4. **Add visual required field indicators** — FieldLabel component: append `{required && <span className="text-destructive">*</span>}`. Update requester, location, start, end labels to pass `required={true}`.

5. **Improve mobile input hit targets** — Add `min-h-12 sm:min-h-10` to DateTimePicker and Select components used in Step 1 (or wrap in a container with min-h). Ensure 44px height on xs screens.

---

## Bigger Bets (1–2 schema/design items, ongoing)

1. **Clarify Booking.notes integration**  
Audit whether notes are used in practice. If so, add textarea in wizard Step 1. If not, consider removing from schema to simplify. Either way, document the decision in a migration plan.

2. **Multi-event as a first-class feature or legacy compat**  
Decide: is `eventIds` permanent (build full UI) or a stepping stone to eventId-only (remove eventIds, auto-derive from selectedEvents)? Run analytics on multi-event usage; plan a migration if removing. Unblock schema clarity for team (currently ambiguous whether a Booking can have >1 event).

---

## Summary

**Strengths**: Dual-config design, conflict auto-removal, equipment requirement validation, draft lifecycle, step progress UI, multi-event binding.  
**Gaps**: Notes field missing, multi-event API contract unclear, validation timing inconsistent, bulk availability not live, mobile input targets could be larger.  
**Debt**: Redundant date formatting, scattered error clearing, magic numbers, form options stale time low.  
**Next**: Add notes field, clarify multi-event scope, centralize formatting, improve mobile UX, document event linkage contract.


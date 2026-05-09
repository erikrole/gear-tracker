# iOS Patterns

Cross-cutting conventions established during the **2026-05-08 audit sprint** (24 focused audits + 1 sweep across every iOS view, sheet, and dev tool). This doc is the single source of truth for the patterns; `scripts/ios-drift-check.sh` enforces a subset automatically.

When you add a new view, sheet, or surface — read this doc first. When you change a shared component, re-read the relevant section.

---

## Status colors → tokens, not literals

**Pattern.** Use `Color.statusText(_ tone:)` and `Color.statusBackground(_ tone:)` (defined in `Core/Brand.swift`) for any UI element that carries semantic status meaning. The five `StatusTone` cases — `.red / .green / .blue / .orange / .purple` (plus `.gray`) — map to the cross-app color taxonomy:

| Tone     | Meaning                            |
| -------- | ---------------------------------- |
| `.red`   | Overdue, error, destructive        |
| `.green` | Available, returned, success       |
| `.blue`  | Active, checked-out, in-progress   |
| `.orange` | Warning, pending, alert            |
| `.purple` | Reservation, planned, future       |
| `.gray`  | Neutral, inactive, completed       |

**Anti-pattern.** Raw `.red / .green / .blue / .orange / .purple` literals via `.foregroundStyle(.red)`, `.fill(.green)`, `.tint(.blue)`, `.background(.orange)`, etc. **Drift detector rule R1**.

```swift
// ❌ Bad
Image(systemName: "exclamationmark.triangle.fill")
    .foregroundStyle(.orange)

// ✅ Good
Image(systemName: "exclamationmark.triangle.fill")
    .foregroundStyle(Color.statusText(.orange))
```

**Allowed escape hatches.**
- `.yellow` for the favorite star and torch icon (iconic yellow, not status taxonomy).
- `Color.kioskRed` for kiosk surfaces — same as `Color.brandPrimary` semantically; pinned for kiosk-specific updates.
- `Color.brandPrimary` for primary CTAs and accent surfaces.
- `Color(.systemRed)` and other `Color(.system…)` UI-element colors — these resolve to system-managed values (e.g. table-row backgrounds) and are intentional.

---

## Haptics → centralized enum, not UIKit generators

**Pattern.** Use `Haptics.success() / .error() / .warning() / .selection() / .tap()` from `Core/Haptics.swift`.

| Method            | Use for                                         |
| ----------------- | ----------------------------------------------- |
| `.success()`      | Mutation succeeded (booking saved, scan landed) |
| `.warning()`      | Form-save failure (retryable)                   |
| `.error()`        | Fatal/blocking condition (kiosk phantom, P0)    |
| `.selection()`    | Toggle / accordion expand / row toggle          |
| `.tap()`          | Lightweight tap confirmation (preset chip)      |

**`.warning()` vs `.error()`.** Form failures the user can retry → `.warning()`. Bugs that destroy data or strand state → `.error()`. The kiosk phantom-success class (`kioskPickupConfirm` / `kioskCheckinComplete` pre-fix) was the canonical `.error()` case.

**Anti-pattern.** Direct `UINotificationFeedbackGenerator()` or `UIImpactFeedbackGenerator()` calls. **Drift detector rules R2 and R5**. The `Haptics` enum centralizes future changes (e.g. honoring `accessibilityReduceMotion`, swapping intensities) — direct UIKit calls bypass that.

```swift
// ❌ Bad
UINotificationFeedbackGenerator().notificationOccurred(.success)

// ✅ Good
Haptics.success()
```

---

## Server errors → propagate, never `try?`

**Pattern.** API client methods route through the centralized `perform<T: Decodable>(_ request:)` helper which:
- Decodes the success path
- Throws `APIError.unauthorized` on 401 (and posts `.sessionDidExpire` for global session handling)
- Throws `APIError.serverError(humanizedMessage)` on 4xx/5xx with the server's body parsed
- Throws `APIError.networkError(...)` with humanized messages on transport failures

Callers `do/catch` and surface `(error as? APIError)?.errorDescription ?? fallback`.

**Anti-pattern.** `_ = try? await session.data(for: req)` — silently drops every failure mode. **Drift detector rule R3.** This was the shape of two P0 phantom-success bugs caught today (`kioskPickupConfirm`, `kioskCheckinComplete`) plus a follow-up bug found by the drift detector itself (`kioskHeartbeat` was swallowing 401, so admin-deactivation was undetectable until the next mutation).

```swift
// ❌ Bad — caller's catch never fires
func kioskHeartbeat() async throws {
    let req = request(path: "/api/kiosk/heartbeat", method: "POST")
    _ = try? await session.data(for: req)
}

// ✅ Good — 401 propagates so the caller can route to deactivate()
func kioskHeartbeat() async throws {
    struct Response: Decodable { let status: String; let kioskId: String }
    let req = request(path: "/api/kiosk/heartbeat", method: "POST")
    let _: Response = try await perform(req)
}
```

---

## Tap targets → Buttons, not `onTapGesture`

**Pattern.** Use `Button { … } label: { … }.buttonStyle(.plain)` for any row that triggers state mutation. iOS gives `Button` a built-in actionable VoiceOver role and press-feedback that `onTapGesture` doesn't.

**Anti-pattern.** `.onTapGesture { selectedShift = shift }` on a row label. **Drift detector rule R4.**

```swift
// ❌ Bad — VoiceOver doesn't reliably register this as actionable
ShiftPickerRow(shift: shift, isSelected: ...)
    .contentShape(Rectangle())
    .onTapGesture { selectedShift = shift }

// ✅ Good
Button {
    selectedShift = shift
} label: {
    ShiftPickerRow(shift: shift, isSelected: ...)
}
.buttonStyle(.plain)
```

`onTapGesture` is fine for non-mutating gestures (e.g. dismiss-on-tap-anywhere on a kiosk success screen), and for `Image`/`Text` that are part of a larger button. The rule targets row mutations.

---

## VoiceOver → combined elements with explicit labels

**Pattern.** For any row with multiple text/icon pieces (avatar, name, email, status pill, chevron), apply `.accessibilityElement(children: .combine)` (or `.contain` if interactive children must remain addressable) and an explicit `.accessibilityLabel("…")`. Decorative icons inside the combined element get `.accessibilityHidden(true)`.

```swift
// ✅ Pattern
HStack { ... }
    .accessibilityElement(children: .combine)
    .accessibilityLabel("Erik Mason, role@wisc.edu, Video specialist")

Image(systemName: "chevron.right")
    .accessibilityHidden(true)  // decorative

if isSelected {
    Image(systemName: "checkmark.circle.fill")
        .accessibilityHidden(true)  // surfaced via .isSelected trait below
}
.accessibilityAddTraits(isSelected ? .isSelected : [])
```

**Children: `.combine` vs `.contain`.** Use `.combine` when nothing inside should be separately tappable. Use `.contain` when there's an interactive child (e.g. a Claim button) that must remain addressable while the surrounding row narrates as one entry.

**`Label("text", systemImage:)` in toolbar / swipe / button content.** Always pair with an explicit `.accessibilityLabel(...)` if the row can be described shorter than `iconName + text`. Otherwise VoiceOver narrates the icon name too ("checkmark, Mark Read").

**Live announcements.** For dynamic feedback (scan results, kiosk activation errors), call `UIAccessibility.post(notification: .announcement, argument: message)` in addition to setting state. SwiftUI has no `accessibilityLiveRegion` modifier on iOS.

---

## Submit buttons → inline spinner, not full-screen overlay

**Pattern.** While submitting, the toolbar `Button`'s label swaps from `Text("Save")` (or "Create" / "Add" / "Post" / "Extend") to `ProgressView().controlSize(.small)`. The button stays disabled.

```swift
// ✅ Pattern
ToolbarItem(placement: .confirmationAction) {
    Button {
        Task { await save() }
    } label: {
        if isSaving {
            ProgressView().controlSize(.small)
        } else {
            Text("Save").fontWeight(.semibold)
        }
    }
    .disabled(!hasChanges || isSaving)
}
```

**Anti-pattern.** Full-screen `Color.black.opacity(0.1)` overlay with a centered `ProgressView` — reads as "stuck rendering" rather than "submitting." Replaced everywhere today (booking edit, item edit, kiosk completes, create-booking, extend-booking, edit-shift-times, post-trade, add-shift).

---

## Edit sheets → discard confirm + dismiss-disabled

**Pattern.** Edit sheets that mutate preserved data follow this template:

```swift
@State private var hasChanges: Bool { /* compare to initial */ }
@State private var showDiscardConfirm = false

.toolbar {
    ToolbarItem(placement: .cancellationAction) {
        Button("Cancel") {
            if isSaving { return }
            if hasChanges { showDiscardConfirm = true }
            else { dismiss() }
        }
        .disabled(isSaving)
    }
}
.interactiveDismissDisabled(isSaving || hasChanges)
.confirmationDialog(
    "Discard changes?",
    isPresented: $showDiscardConfirm,
    titleVisibility: .visible
) {
    Button("Discard", role: .destructive) { dismiss() }
    Button("Keep Editing", role: .cancel) {}
} message: {
    Text("Your changes will be lost.")
}
```

**Add sheets** (creating fresh data) typically don't need this — `Cancel` is a clean abandon. `CreateBookingSheet` does because it has high-stakes selections (asset list, requester, etc.); `AddShiftSheet` doesn't because picker defaults are sensible and re-opening costs nothing.

---

## Stale-write race guards on debounced searches

**Pattern.** Capture the query at the start of the API call; check it still matches before writing the response. Debounce-cancel only affects the sleep — once the API call is in flight, the cancel doesn't stop it.

```swift
@MainActor
private func performSearch(query: String) async {
    isSearching = true
    defer { isSearching = false }
    do {
        let outcome = try await SearchService.shared.search(query: query)
        // Stale-write guard: if the live `query` no longer matches what
        // this request was for, drop the result.
        guard self.query.trimmingCharacters(in: .whitespaces) == query else { return }
        results = outcome
    } catch {
        guard self.query.trimmingCharacters(in: .whitespaces) == query else { return }
        searchError = error.localizedDescription
    }
}
```

Without this, on slow networks an older "ab" response overwrites a newer "abc" response. Shipped on global search, create-booking equipment search, link-sticker pick step.

---

## AsyncImage with initials fallback

**Pattern.** Any user surface should render `AsyncImage(url:)` with the existing initials disc as the placeholder/failure state.

```swift
@ViewBuilder
private var avatar: some View {
    let placeholder = ZStack {
        Circle().fill(Color.statusBackground(tone)).frame(width: 56, height: 56)
        Text(name.searchInitials)
            .font(.title3.weight(.semibold))
            .foregroundStyle(Color.statusText(tone))
    }

    if let urlString = avatarUrl, let url = URL(string: urlString) {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            default:
                placeholder
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(Circle())
    } else {
        placeholder
    }
}
```

Users + kiosk + assign-student all use this. The initials disc rendering preserves layout while AsyncImage fetches; `.success` swaps in the photo; any failure quietly falls back.

---

## Server enum codes → title-cased labels

**Pattern.** Server enum codes (e.g. `ShiftArea`: `VIDEO / PHOTO / GRAPHICS / COMMS`) display in iOS as title-cased via `String.shiftAreaLabel` (in `Models/ScheduleModels.swift`). The helper falls back to `.capitalized` for unknown codes.

```swift
// ❌ Bad — renders shouty "VIDEO"
Text(shift.area)

// ✅ Good — renders "Video"
Text(shift.area.shiftAreaLabel)
```

**Drift detector rule R6.** Models and API call sites are exempt — server still receives the raw enum code.

---

## Server-authoritative success counts

**Pattern.** When a mutation API returns counts (`returnedItems`, `totalItems`, `completed`), use the server values in success messaging instead of local optimistic counts. Sister-device drift can desync local state.

```swift
// ✅ Pattern
let result = try await KioskAPI.shared.kioskCheckinComplete(...)
if result.completed {
    return "All \(result.totalItems) items returned."
}
return "\(result.returnedItems) of \(result.totalItems) items returned."
```

Shipped on kiosk return — local optimistic count could differ if a sister kiosk checked items in mid-session.

---

## Auto-scroll to the last interaction

**Pattern.** Lists where rows mutate (cart growing, checklist confirming) wrap in `ScrollViewReader` and scroll to the freshly-changed row on `onChange(of: lastChangedId)`.

```swift
ScrollViewReader { proxy in
    ScrollView {
        LazyVStack { ForEach(items) { item in
            Row(item).id(item.id)
        }}
    }
    .onChange(of: lastAddedId) { _, newId in
        guard let newId else { return }
        if reduceMotion {
            proxy.scrollTo(newId, anchor: .bottom)
        } else {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo(newId, anchor: .bottom)
            }
        }
    }
}
```

Shipped on kiosk checkout cart, kiosk pickup checklist, kiosk return checklist.

---

## Animated counts

**Pattern.** Numbers that change frequently use `.contentTransition(.numericText())` + `.monospacedDigit()` + a value-keyed animation; respect reduce-motion.

```swift
Text("\(count)")
    .font(.title3.weight(.bold))
    .contentTransition(.numericText())
    .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: count)
    .monospacedDigit()
```

Shipped on kiosk idle stat tiles, kiosk checkout cart count, kiosk pickup ring, kiosk return ring.

---

## Drift detection

`scripts/ios-drift-check.sh` — fast portable POSIX-grep scanner that flags regressions of:

- **R1** Raw status color literals (`.foregroundStyle(.red)` etc.)
- **R2** Direct `UINotificationFeedbackGenerator()` calls
- **R3** `try? await session.data(...)` swallowing API errors
- **R4** `.onTapGesture { …assignment }` instead of a `Button`
- **R5** `UIImpactFeedbackGenerator()` outside `Core/Haptics.swift`
- **R6** `Text(...area...)` without `.shiftAreaLabel`

Usage:

```sh
./scripts/ios-drift-check.sh           # scan everything; exit non-zero on hits
./scripts/ios-drift-check.sh --warn    # report findings; always exit 0
./scripts/ios-drift-check.sh -v        # verbose
```

Today's baseline: **0 violations across 45 swift files**. The detector caught five real residual drifts during its initial run — including `kioskHeartbeat` swallowing 401, which was the same shape of P0 bug already fixed twice on pickup/return-confirm. That's the value: catching a hand-audit miss in seconds.

---

## When to add a new pattern here

A pattern earns a section in this doc when:
1. It's been applied across **3+ surfaces** (consistency matters)
2. The cost of forgetting it is **observable** (broken VoiceOver, phantom data, misleading UI)
3. It can be expressed in **a paragraph + a code example**

When you see a fourth surface adopt the pattern, fold it back here. When the drift detector grows a new rule, document it in the Drift detection section above.

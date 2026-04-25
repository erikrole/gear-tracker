# Audit: login (iOS) — 2026-04-24

**MVP verdict (post-fix, pre-Xcode-verify):** all P1 addressed; needs build verification.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)

Scope: `LoginView` + `SessionStore.login` + `APIClient.login` (cookie-based session, `HTTPCookieStorage` shared, no keychain).

## P0 — blocks MVP

_None._ Auth uses HTTPS, cookies persist via `HTTPCookieStorage.shared`, errors surface via `session.error`, button disables during request. No force-unwraps on user input, no auth bypass.

## P1 — polish before ship

- [x] [Flows] No "Forgot password?" affordance — a student who forgets their password is stranded on iOS. Web has `src/app/forgot-password/` shipped.
      `ios/Wisconsin/Views/LoginView.swift:54-111`.
      Why it matters: gear-tracker is for students; lockouts will happen on game day. iOS has zero recovery path. They can use the web flow but must know the URL — student-hostile.
      Suggested fix: add a "Forgot password?" link below the Sign In button that opens `https://gear.erikrole.com/forgot-password` in `Safari`/`SFSafariViewController`. If a native flow is wanted, reuse `/api/auth/forgot-password` with a tiny sheet (POST email → confirm-sent screen).

- [x] [Hardening] Email is not trimmed before submit — a student typing `"jane@uw.edu "` with a trailing space hits a 401 with no clue why.
      `ios/Wisconsin/Views/LoginView.swift:73, 90` (`session.login(email: email, password: password)`); also the on-submit guard at `:72` only checks `isEmpty`.
      Why it matters: classic mobile-keyboard footgun. Long-press selection + autocomplete habitually leaves trailing whitespace.
      Suggested fix: `email.trimmingCharacters(in: .whitespacesAndNewlines)` everywhere the field is read; also lowercase before send (server is case-insensitive but the cookie attribution audit logs the literal).

- [x] [Flows] Pressing Return on the password field calls `session.login` directly without dismissing the keyboard or showing the button's loading state — keyboard hangs over the form during the request.
      `ios/Wisconsin/Views/LoginView.swift:71-74`.
      Why it matters: the user can't see whether their tap registered (button is hidden behind keyboard). They start mashing Return, fire double submits.
      Suggested fix: in the `onSubmit` closure, set `focused = nil` before the `Task`. Match the explicit Sign In button's flow exactly.

- [x] [UI polish] Form input shadows use hardcoded `Color.black.opacity(0.05)` — invisible in dark mode; the input cards lose definition against `systemGroupedBackground`.
      `ios/Wisconsin/Views/LoginView.swift:66, 77`.
      Suggested fix: switch to `Color.primary.opacity(0.06)` or add a `Color(.separator)` border, matching the FormCard pattern just shipped on bookings.

## P2 — post-MVP

- [ ] [Hardening] **Deferred.** No biometric (Face ID / Touch ID) re-auth. Cookie persists across launches; Face ID would only shave seconds off post-logout. Needs LocalAuthentication framework + Keychain-backed session marker. Logged for later.

- [x] [Parity] iOS now exposes "Need an account?" Link to web `/register`; register itself stays web-only behind the AllowedEmail allowlist (D-2026-04-03).

- [x] [Flows] `SessionStore.clearError()` added; LoginView calls it from `.onChange(of:)` on both fields so a stale 401 disappears the moment the user starts typing.

- [x] [Hardening] Logout body now carries an explanatory comment for the `try?` swallow ("a stuck server must not strand the user signed in").

- [ ] [Hardening] **Deferred.** iPad cosmetic: brand header dark band can look cramped at the top safe area. Wait until iPad becomes a launch target.

## Acceptance criteria status

There is no `AREA_LOGIN.md` or dedicated auth area doc. AC inferred from `AREA_USERS.md` + `AREA_MOBILE.md`:

- [x] AC: cookie-based session persists across cold launch (`APIClient.session` uses `HTTPCookieStorage.shared`; `SessionStore.restoreSession` calls `/api/me` on init).
- [x] AC: invalid credentials surface a user-readable error (`SessionStore.error` → `LoginView` red footnote).
- [x] AC: button disables during request and shows a `ProgressView` (`LoginView.swift:88-110`).
- [x] AC: no plaintext password storage (`SecureField`, no `@AppStorage`, no UserDefaults writes).
- [x] AC: HTTPS-only base URL (`APIClient.swift:25`).
- [x] AC: password recovery reachable from iOS — Link to `gear.erikrole.com/forgot-password` shipped.

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- `ios/Wisconsin/Views/LoginView.swift`
- `ios/Wisconsin/Core/SessionStore.swift`
- `ios/Wisconsin/Core/APIClient.swift` (auth methods + URLSession config)
- `ios/Wisconsin/App/WisconsinApp.swift` (RootView + push registration on user change)
- `docs/AREA_USERS.md` (acceptance + finalized policy decisions)
- `docs/DECISIONS.md` (D-2026-04-03 AllowedEmail allowlist; kiosk auth)
- `docs/AREA_MOBILE.md` (no auth-specific ACs)
- Web auth surface `src/app/{login,register,forgot-password}` (existence check only)

## Notes
- Static audit only.
- Cookie-based session means no keychain needed for tokens — that's correct given the web parity.
- `HTTPCookieStorage` is unencrypted and persisted in the app sandbox; if a stolen-device threat model becomes relevant, switch session token to keychain. Out of scope for V1.
- The `.ignoresSafeArea(.keyboard, edges: .bottom)` on the outer container is intentional — keeps the brand header from animating up; the inner ScrollView still scrolls focus into view. Verified the chain reads correctly.

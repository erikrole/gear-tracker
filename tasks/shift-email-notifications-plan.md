# Shift Email Notifications Plan

Date: 2026-05-05
Status: Slice 1 shipped

## Context

Shift trade lifecycle already creates in-app notifications from `src/lib/services/shift-trades.ts`.
The notification stack already has Resend-backed best-effort email delivery in `src/lib/email.ts` and per-user email preferences in `src/lib/services/notification-prefs.ts`.

This slice should extend the existing trade lifecycle notifications to email. It should not add a new notification settings surface, a new email provider, or a new shift assignment policy.

## Slice 1: Trade Lifecycle Email Companions

- [x] Add a small helper for shift trade emails.
- [x] Send best-effort email after a trade is claimed and awaiting approval.
- [x] Send best-effort email after an instant trade completes.
- [x] Send best-effort email after staff approves a claimed trade.
- [x] Send best-effort email after staff declines a claimed trade.
- [x] Respect existing email notification preferences and paused state.

## Out Of Scope

- Emailing staff when any trade is claimed.
- Emailing every direct shift assignment or request.
- New email templates beyond a compact trade lifecycle template.
- Kiosk or app scan behavior.

## Verification

- [x] Targeted trade tests.
- [x] TypeScript check.
- [x] Next build.

## Review

- Trade lifecycle email now mirrors the existing in-app trade notifications.
- Email is sent after the database transaction resolves, is best-effort, and honors per-user email notification preferences.
- Staff-wide email fanout for claimed trades remains out of scope.

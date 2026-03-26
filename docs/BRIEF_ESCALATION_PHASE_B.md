# BRIEF: Escalation Phase B

## Document Control
- Feature: Notification Escalation Phase B
- Owner: Wisconsin Athletics Creative Product
- Created: 2026-03-25
- Status: Draft
- Depends on: D-009 (Overdue Escalation Policy — Accepted)

## V1 Status (Shipped)
Phase A escalation is fully operational:
- 4 triggers: -4h reminder, 0h due now, +2h overdue, +24h overdue (admin escalation)
- Dual channels: in-app notifications + email (Resend)
- Deduplication via `dedupeKey` (idempotent, safe to re-run)
- Admin-configurable triggers, recipients, and per-booking notification cap
- Settings UI at `/settings/escalation`
- Cron: daily at 8:00 AM UTC (Vercel Hobby plan — once/day limit)

## Phase B Opportunities

### 1. Sub-hourly Escalation (requires Vercel Pro)
- Current: daily cron means escalation triggers fire with up to ~24h latency
- Target: `*/15 * * * *` (every 15 minutes) for timely alerts
- Blocker: Vercel Hobby plan limits to 1 cron/day. Pro plan required.
- Effort: Config change in `vercel.json` only — code is already idempotent

### 2. Shift Notification Channel
- Trigger: shift assignment created, trade claimed, trade approved
- Channel: in-app + email (same pattern as checkout notifications)
- Recipients: assigned user, trade claimant, shift managers
- Not yet scoped — needs dedicated brief

### 3. Repeat Offender Policy
- Track overdue frequency per user (count of +24h escalations in last 90 days)
- Configurable threshold (e.g., 3 overdues → auto-hold on future checkouts)
- Admin override to lift holds
- Dashboard badge for "users with active holds"

### 4. SMS Channel
- Add SMS via Twilio or similar for critical escalations (+24h)
- Opt-in per user (phone number field exists on User model)
- Cost consideration: SMS per-message pricing vs email (free tier)

### 5. Custom Escalation Policies per Sport
- Different sports may have different urgency levels
- Allow sport-specific trigger windows and recipient lists
- UI: per-sport tab in `/settings/escalation`

## Recommended Phase B Scope (Minimal)
1. Upgrade to Vercel Pro + set `*/15 * * * *` cron
2. Add shift notification channel (3 trigger types)
3. Defer: repeat offender, SMS, per-sport policies (Phase C)

## Acceptance Criteria
- [ ] AC-1: Escalation triggers fire within 15 minutes of their window
- [ ] AC-2: Shift assignments generate in-app + email notifications
- [ ] AC-3: Trade claims notify both poster and claimant
- [ ] AC-4: All new notification types have audit logging

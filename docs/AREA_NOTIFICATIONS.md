# Notifications Area Scope

## Document Control
- Area: Notifications
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-01
- Status: Active

## Direction
Move from basic reminders to actionable, policy-driven escalation.

## Now
1. Keep overdue detection stable.
2. Keep in-app notification baseline and deep links reliable.
3. Keep email support behavior consistent for existing alerts.

## Next
1. Add admin escalation when overdue exceeds 24 hours.
2. Improve notification center with read state, priority, and filtering.
3. Add dedup rules so retries do not spam recipients.

## Later
1. Extend alerts to external channels such as Slack.
2. Tune policy by sport, role, or location.

## Acceptance Criteria
1. Escalation triggers once per policy window.
2. Admin recipients are configurable and auditable.
3. Notification links route to relevant booking or item context.
4. Read and unread state is clear and stable.

## Edge Cases
- Duplicate overdue triggers due to retry logic.
- Reopened booking after completion.
- Clock skew around 24-hour threshold boundaries.

## Dependencies
- Booking state and due-time data.
- Role and recipient management.
- Audit logging for escalation events.

## Out of Scope (Current Window)
- Complex multi-channel campaign orchestration.
- Messaging templates with per-team branding variants.

## Developer Brief (No Code)
1. Add threshold-based escalation engine with dedup keys.
2. Improve notification center read model and filtering behavior.
3. Keep deep-link routing stable and testable.
4. Add audit visibility for escalation decisions.

## Change Log
- 2026-03-01: Initial standalone area scope created.

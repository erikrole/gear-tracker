Overdue notifications + escalation

Implement email + in-app notifications with dedupe:
- 4 hours before due
- at due time
- +2 hours overdue
- +24 hours overdue: notify Managers + student again

Requirements:
- Notification table: user_id, type, payload_json, channel, sent_at, dedupe_key
- Job runner that scans open checkouts and schedules/sends notices
- Dev mode: log emails to console
- SMTP via env vars
- In-app notification center (simple list, mark read optional)
- Dashboard widgets: overdue count, open checkouts
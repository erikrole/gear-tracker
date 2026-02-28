ICS Calendar Sync (UW HOME events)

Source URL:
webcal://uwbadgers.com/api/v2/Calendar/subscribe?type=ics&locationIndicator=H

Requirements:
- Normalize webcal:// to https:// before fetching
- CalendarSource table: name, url, enabled, last_fetched_at, last_error
- Background job every 30 minutes + Admin “Sync now”
- Parse ICS and upsert Events by UID (external_id)
- Store raw_summary, raw_location_text, raw_description for debugging
- Handle STATUS:CANCELLED => mark event CANCELLED (do not delete)

Location mapping:
- LocationMapping table: pattern (regex/keyword) -> location_id
- Apply mapping against raw_location_text and summary
- If no match, location_id null and show “Needs mapping” badge in admin UI

Event detail page must include CTAs:
- Reserve gear for this event
- Checkout to this event
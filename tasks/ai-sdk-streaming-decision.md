# AI SDK / Streaming — Audit Decision

**Status:** Deferred. No-op for current product.
**Date:** 2026-04-25

## Audit findings

- No `@ai-sdk/*` packages installed.
- No OpenAI / Anthropic / model-provider SDK calls anywhere.
- No long-running request/response surfaces that would visibly improve from token streaming.
- Calendar sync (`/api/calendar-sources/[id]/sync`) is the longest-running route — but it's deterministic ICS parsing + bulk DB writes, not LLM output. Streaming progress would require turning it into a Server-Sent Events surface, which is a separate non-AI project.

## What would change this

Adopt AI SDK once any of these ship:
1. **AI-generated booking descriptions** (assist staff drafting reservation titles).
2. **Smart calendar mapping suggestions** when a new venue regex is being authored.
3. **Natural-language reports** ("how many checkouts last week?") in the dashboard.
4. **Scan-result narration** for accessibility (audio readout of asset details).

None of these are on the roadmap today. Re-open this file when the first one is.

## Adjacent improvement worth doing now (non-AI)

The calendar-sync long-running flow could ship a Server-Sent Events progress channel. That's UX, not AI. Not in scope for the current upgrade pass — file separately if desired.

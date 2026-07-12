# AI Collaboration Workflow (Codex + Claude Code)

This project supports a **dual-agent senior dev workflow** where Codex and Claude Code can alternate implementation safely. [AGENTS.md](../AGENTS.md) is the canonical repository contract; this document covers handoff mechanics only.

## Branching strategy

- Use one task branch per slice (for example: `feature/import-cheqroom-metadata`) and do not rebase a branch another agent may be using.
- Keep commits small and thematic (API, UI, tests).
- Before handoff, fetch current remote state and report divergence. Reconcile or rebase only when the branch is private and no other agent has based work on it.

## Handoff contract

Each handoff should include:

1. **Intent**: what was changed and why.
2. **State**: what is complete vs. pending.
3. **Validation**: exact commands run and results.
4. **Known risks**: edge cases or assumptions.
5. **Next actions**: concrete, ordered steps.

Use this template:

```md
## Handoff

### Done
- ...

### Not Done
- ...

### Validation
- ✅ `npm test`
- ✅ `npm run build:app`
- ✅ `npm run verify:docs`
- ⚠️ Full `npm run build` only when deploy-shaped migration validation was intentionally approved

### Risks / Notes
- ...

### Next 3 Steps
1. ...
2. ...
3. ...
```

## Code ownership boundaries (recommended)

To reduce merge conflicts in concurrent sessions:

- Agent A owns API + schema changes.
- Agent B owns UI + integration wiring.
- Either agent can add tests for touched areas.

If both must touch the same file, coordinate with a short checkpoint commit first.

## Definition of done for either agent

- Feature behavior works end-to-end for the intended flow.
- No placeholder UI (`prompt`, `alert`-only interactions, or dead buttons).
- Tests/build run locally and are documented in handoff.
- Relevant area docs, risks, and task records are synchronized when behavior changed.
- Commit message clearly describes user-facing outcome.

## Escalation rules

If one agent is blocked:

- Log blocker and fallback attempted.
- Leave a minimal reproducible command.
- Stop and hand off instead of speculative refactors.

Do not use broad staging, overwrite another agent's uncommitted work, or claim browser/device proof from static checks alone.

This keeps both agents moving without stepping on each other.

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimat Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

---

## Project-Specific Rules

### 7. Pre-Implementation Audit (NON-NEGOTIABLE)
Before implementing any feature:
- Read ALL `docs/BRIEF_*` and `docs/AREA_*` files for the feature area
- Cross-reference `prisma/schema.prisma` for existing models, field names, and cascade rules
- Check `docs/DECISIONS.md` for prior architectural choices
- Review `docs/GAPS_AND_RISKS.md` for related pending decisions or known gaps
- Skipping this causes missed field requirements, schema mismatches, and rework

### 8. Vercel Deployment Constraints
This project deploys to Vercel (Node.js runtime):
- Database: Neon serverless PostgreSQL via `@prisma/adapter-neon`
- No edge runtime — all routes run as standard Node.js serverless functions
- Serverless function timeout: 10s on Hobby, 60s on Pro — keep API routes fast
- Batch DB operations where possible for performance (avoid N+1 queries)
- Vercel Blob for file storage (replaces Cloudflare R2)
- Vercel Cron Jobs for scheduled tasks (configure in `vercel.json` or dashboard)
- Always run `npm run build` before committing — build failures are the #1 avoidable time waster
- If build fails, fix it before pushing. Never leave a broken build on any branch.

### 9. Commit Message Format
Follow conventional commits strictly:
- `feat:` — new user-facing functionality
- `fix:` — bug fix (include root cause in message)
- `chore:` — build/tooling/dependency changes only
- Never create a standalone `chore: update tsconfig.tsbuildinfo` commit — bundle with the related feature commit or omit
- Commit messages should describe the **user-facing outcome**, not the code change

### 10. Thin Slice Protocol
All non-trivial features must be implemented in progressive slices:
- Each slice must be independently mergeable and independently testable
- Slice order: Schema/migration → API/service → UI wiring → Tests → Hardening
- Maximum one PR per slice — no mega-PRs that mix concerns
- Write the slice plan in `tasks/[feature]-plan.md` before starting

### 11. Post-Merge Cleanup (Dual-Agent Workflow)
After merging Codex or any parallel branch:
- Scan for duplicate type definitions (especially in `src/app/(app)/*/page.tsx`)
- Check for duplicate function names (e.g. `window.prompt` wrappers)
- Remove dead modal code or stale imports from merge artifacts
- Run `npm run build` to confirm clean compilation before declaring done

### 12. Doc Sync on Ship (NON-NEGOTIABLE)
Every commit that ships functionality MUST include doc updates in the same commit:
- Update the relevant `AREA_*.md` file's change log and mark acceptance criteria as met
- Update `docs/GAPS_AND_RISKS.md` if the feature closes a gap or pending decision
- Update `tasks/lessons.md` if you learned something worth capturing
- Move completed plan files to `tasks/archive/` when all slices ship
- No feature is "done" until its area doc reflects shipped reality
- This applies to ALL work — not just PRs. Every push must leave docs in sync with code.

### 13. shadcn/ui Component Standard (NON-NEGOTIABLE)
All UI work MUST use shadcn/ui components as the standard component library:
- Use existing shadcn components from `src/components/ui/` for all new features and edits
- Install new shadcn components via `npx shadcn@latest add <component>` when needed
- Never build custom UI primitives (buttons, inputs, dialogs, tables, etc.) when a shadcn equivalent exists
- All components must wire together cleanly — no dead code, no orphaned imports, no unused exports
- When refactoring, remove old custom components that shadcn replaces
- Reference installed components: check `src/components/ui/` for what's available before building

### 14. Plan File Lifecycle
Plan files in `tasks/` follow this lifecycle:
1. `tasks/[feature]-plan.md` — created during planning
2. Active during implementation (slices checked off)
3. Moved to `tasks/archive/` when all slices ship
4. Never deleted — archive preserves decision context

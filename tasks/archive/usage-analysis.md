# Claude Code Usage Pattern Analysis

**Date**: 2026-03-08
**Project**: gear-tracker (Creative Ops)
**Data sources**: Git history (80+ commits, 30 PRs), session data, prompts/, docs/, tasks/, hooks, skills, settings

---

## 1. What You Do Most Frequently

### Feature Implementation (17 feat commits — dominant pattern)
Your primary workflow is **spec-driven feature building** in thin slices:
- Write detailed specs in `docs/BRIEF_*.md` and `docs/AREA_*.md`
- Create step-by-step plans in `tasks/`
- Implement in progressive slices (checkout UX V2 had 4 slices + 2 hardening rounds)
- Each slice: API → UI → Tests → Commit → PR → Merge

### Bug Fixing / Hardening (6 fix commits)
Second most common. Calendar sync alone had **5 sequential hardening commits**:
1. Harden so one bad event can't crash sync
2. Eliminate remaining unguarded throw paths
3. Add production-safe sync diagnostics
4. Use Date.UTC consistently
5. Batch DB operations for Worker subrequest limits

This is a pattern of **iterative production debugging** — fix, observe, fix deeper.

### Build/Deploy Troubleshooting (5 commits)
Cloudflare Worker build issues consumed multiple early commits:
- Fix build command binary name (3 attempts)
- Fix edge runtime errors
- tsconfig cache updates (6 chore commits)

### Merge Conflict Cleanup (3 commits)
Dual-agent workflow (Codex + Claude) creates merge conflicts:
- Duplicate types, dead modal code, window.prompt functions

### Hotspot Directories (files most frequently changed)
| Directory | Touches | Pattern |
|---|---|---|
| `src/lib/services/` | 19 | Business logic — the core of every feature |
| `src/components/` | 24 | UI components — always paired with services |
| `src/app/(app)/checkouts/` | 16 | The most iterated feature area |
| `tests/` | 15 | Tests accompany every feature |
| `docs/` | 19 | Specs updated alongside implementation |
| `prisma/` | 9 | Schema changes for new features |

---

## 2. What Should Become Skills (Reusable Workflows)

Skills = repeatable multi-step workflows that Claude should execute the same way every time.

### Skill: `thin-slice`
**Trigger**: "Implement [feature] from brief"
**What it does**:
1. Read the relevant `docs/BRIEF_*.md` and `docs/AREA_*.md` files
2. Write a plan to `tasks/[feature]-plan.md` with checklist
3. Implement API/service layer first
4. Wire UI second
5. Add tests
6. Verify build (`npm run build`)
7. Commit with conventional commit format
8. Push and create PR

**Why**: This is your dominant pattern. You do it every time but re-explain the workflow each session.

### Skill: `harden`
**Trigger**: "Harden [feature]" or after production bug reports
**What it does**:
1. Read existing service code + related tests
2. Identify unguarded throw paths, missing error handling, edge cases
3. Add defensive code + error boundaries
4. Add targeted tests for each hardened path
5. Verify build, commit, push

**Why**: Calendar sync hardening took 5 separate sessions. A skill would batch this into one pass.

### Skill: `plan-from-brief`
**Trigger**: "Plan [feature]" with a brief doc
**What it does**:
1. Read ALL files in `prompts/` and relevant `docs/BRIEF_*.md`
2. Cross-reference with `prisma/schema.prisma` for existing models
3. Write plan to `tasks/` with: Problem, Changes, Open Questions, Risks, Checklist
4. Exit plan mode for approval

**Why**: Your lessons.md explicitly says "Read ALL prompt files before planning." This should be automated.

### Skill: `merge-cleanup`
**Trigger**: After merging branches or resolving conflicts
**What it does**:
1. Scan for duplicate type definitions
2. Find dead/unreachable code from merge
3. Check for duplicate function names
4. Clean up and verify build

**Why**: You had 3 separate merge cleanup commits. This is predictable post-merge work.

---

## 3. What Should Become Plugins (Standalone Tools)

Plugins = external tools that extend Claude's capabilities.

### Plugin: `prisma-audit`
**What it does**: Analyzes Prisma schema against docs/AREA_* specs to find:
- Missing fields specified in docs but not in schema
- Orphaned fields in schema not referenced in any spec
- Missing indexes for common query patterns
- Cascade/SET NULL correctness for deletions

**Why**: Your lessons say "audit before implementing." This automates the schema-vs-spec audit.

### Plugin: `cloudflare-build-validator`
**What it does**: Pre-flight check before commit:
- Runs `npm run build` and parses Cloudflare-specific errors
- Checks for `edge-runtime` incompatible imports
- Validates Worker subrequest limits against service code
- Checks bundle size

**Why**: Build issues consumed 5+ commits. Catching them before commit saves cycles.

### Plugin: `tsconfig-cache-manager`
**What it does**: Auto-updates `tsconfig.tsbuildinfo` and handles the "chore: update tsconfig" commits automatically as part of the build step rather than as separate commits.

**Why**: 6 separate "chore: update tsconfig" commits are noise. This should be invisible.

---

## 4. What Should Become Agents (Autonomous Subagents)

Agents = autonomous workers that handle complex multi-step tasks independently.

### Agent: `spec-reviewer`
**Trigger**: Before implementing any feature
**What it does**:
1. Reads all docs in `docs/` and `prompts/`
2. Cross-references the feature request against existing specs
3. Identifies conflicts, gaps, and dependencies
4. Returns a structured report: what's specified, what's ambiguous, what's missing

**Why**: Your lessons learned says "Read ALL prompt files before planning." An agent does this exhaustively without cluttering the main context.

### Agent: `dual-agent-conflict-detector`
**Trigger**: Before merging Codex/Claude branches
**What it does**:
1. Diffs both branches against main
2. Identifies overlapping file changes
3. Flags duplicate type definitions, conflicting imports
4. Suggests resolution strategy

**Why**: Your AI_COLLABORATION.md defines a dual-agent workflow. Merge conflicts are a known risk. An agent can pre-screen before you merge.

### Agent: `production-debugger`
**Trigger**: "Debug [feature] in production" or when iterative fix patterns emerge
**What it does**:
1. Reads service code + existing error handling
2. Traces all throw/error paths
3. Identifies unguarded paths, missing try/catch, unsafe type assertions
4. Generates a comprehensive fix with tests
5. Returns a single PR-ready changeset

**Why**: Calendar sync required 5 iterative fixes. An agent that does exhaustive error-path analysis in one pass would have caught all 5 issues at once.

### Agent: `test-gap-analyzer`
**Trigger**: Before marking a feature complete
**What it does**:
1. Reads the feature's service + API + UI code
2. Reads existing tests
3. Identifies untested paths, edge cases, error conditions
4. Generates missing test cases

**Why**: Tests accompany every feature (15 touches to tests/), but the iterative hardening pattern suggests gaps slip through.

---

## 5. What Belongs in CLAUDE.md

Your current CLAUDE.md is good but missing patterns that emerged from actual usage.

### Add: Pre-Implementation Audit Checklist
```markdown
### 7. Pre-Implementation Audit
- Read ALL files in `prompts/` relevant to the feature
- Read ALL `docs/BRIEF_*` and `docs/AREA_*` files for the feature area
- Cross-reference `prisma/schema.prisma` for existing models
- Check `docs/DECISIONS.md` for prior architectural choices
- This is NON-NEGOTIABLE — skip this and you'll miss field requirements
```

### Add: Cloudflare-Specific Build Rules
```markdown
### 8. Cloudflare Worker Constraints
- No Node.js-only APIs (fs, child_process, etc.)
- Worker subrequest limit: batch DB operations
- Edge runtime compatibility: verify imports
- Always run `npm run build` before committing — build failures are the #1 time waster
```

### Add: Conventional Commit Enforcement
```markdown
### 9. Commit Message Format
- feat: new user-facing functionality
- fix: bug fix
- chore: build/tooling changes (tsconfig, deps)
- Never commit tsconfig.tsbuildinfo as a standalone commit — bundle with the feature
```

### Add: Thin Slice Protocol
```markdown
### 10. Thin Slice Implementation
- Every feature gets implemented in progressive slices
- Each slice must be: independently mergeable, independently testable
- Slice order: API/service → UI wiring → Tests → Hardening
- Maximum 1 PR per slice — no mega-PRs
```

### Add: Dual-Agent Merge Protocol
```markdown
### 11. Post-Merge Cleanup
After merging Codex/Claude branches:
- Scan for duplicate type definitions (especially in page files)
- Check for duplicate function names (window.prompt was duplicated)
- Remove dead modal code from merge artifacts
- Verify build compiles cleanly
```

---

## Summary Matrix

| Category | Count | Items |
|---|---|---|
| **Skills** | 4 | thin-slice, harden, plan-from-brief, merge-cleanup |
| **Plugins** | 3 | prisma-audit, cloudflare-build-validator, tsconfig-cache-manager |
| **Agents** | 4 | spec-reviewer, dual-agent-conflict-detector, production-debugger, test-gap-analyzer |
| **CLAUDE.md additions** | 5 | pre-implementation audit, Cloudflare constraints, commit format, thin slice protocol, post-merge cleanup |

### Top 3 Highest-Impact Recommendations

1. **`thin-slice` skill** — This is 60%+ of your usage. Automating the spec→plan→implement→test→PR pipeline would save the most time.

2. **`production-debugger` agent** — The calendar sync pattern (5 iterative fixes) is expensive. An exhaustive error-path agent would collapse multiple sessions into one.

3. **Pre-implementation audit in CLAUDE.md** — Your own lessons.md calls this out. Making it a hard rule prevents the "missed field requirements" class of bugs entirely.

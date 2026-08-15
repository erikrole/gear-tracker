# Internal Public Beta Release Cut Follow-up

Date opened: 2026-06-19
Source: split from `tasks/todo.md` Internal Public Beta Launch Readiness.

## Goal

Cut the next CalVer beta release only after the current local dependency
hardening and task cleanup work is intentionally committed, pushed, and
verified. New versions use `YYYY.M.N` (for example, `2026.8.1`).

## Remaining Work

- [ ] Confirm the worktree is clean and the intended branch is `main`.
- [ ] Confirm the final production verification gate and launch smoke remain valid for the exact commit being released.
- [ ] Run `npm run release` when ready to create the version commit, tag, and push; the tag-triggered GitHub Action creates the GitHub Release.

## Guardrails

- Do not run `npm run release` from a dirty worktree; `scripts/release.sh` exits in that state.
- Do not cut a release from the middle of this cleanup batch.
- Keep release approval separate from task archival and dependency hardening.

## Review

- 2026-06-19: Split out from the completed Internal Public Beta Launch Readiness section. The release script updates the package versions, commits, tags, and pushes; the GitHub Release is created from the pushed tag, so this remains an explicit ship step rather than queue cleanup.

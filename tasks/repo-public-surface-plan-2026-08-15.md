# Repository Public Surface Plan - 2026-08-15

## Goal

- Make the public GitHub repository landing page immediately understandable to
  a reviewer, collaborator, or future operator.
- Align the GitHub About panel with the canonical production site and product
  identity.
- Use GitHub Releases as intentional `YYYY.M.N` milestone records while Vercel
  continues to deploy the `main` production line.

## Route

- Owner area: Public Showroom / repository maintenance
- Ledger: this plan; closeout should be summarized in `tasks/todo.md` if the
  external GitHub metadata change is completed.
- Existing references: `docs/AREA_PUBLIC_SHOWROOM.md`,
  `tasks/internal-public-beta-release-cut-followup.md`, and
  `scripts/release.sh`

## Source Checks

- `README.md` is a short internal/developer-oriented feature and stack summary
  with no production link, public showroom link, or clear invite-only boundary.
- GitHub About metadata is currently empty for description/topics and points to
  the stale `gear-tracker-delta.vercel.app` homepage.
- `wisconsincreative.com` is the canonical production site and the public
  showroom is documented under `/about`.
- Vercel is connected to GitHub deployments; `main` currently produces the
  site's deployment stream. `scripts/release.sh` creates the version commit and
  CalVer tag, while a tag-triggered GitHub Action creates the GitHub Release.
- The repository has one historical four-part release (`2026.04.08.1`). New
  releases use the simpler three-part `YYYY.M.N` format; historical tags remain
  unchanged.

## Stop Conditions

- Stop before changing Vercel production-branch, deployment-hook, or promotion
  settings; versioned GitHub Releases do not require that separate pipeline
  change.
- Stop before cutting a new release; this cleanup configures the system but is
  not release approval and must not create a version commit, tag, push, or
  GitHub Release.
- Stop before saving GitHub About metadata if the logged-in account or target
  repository is not visibly confirmed as `erikrole/wisconsin-creative`.

## Slices

- [ ] Slice 1: Rewrite the root README as the first public orientation surface.
- [ ] Slice 2: Align GitHub About description, homepage, and topics with the
  canonical product identity.
- [ ] Slice 3: Make `YYYY.M.N` the canonical release version and create a
  tag-triggered GitHub Release without changing Vercel production promotion.

## Verification

- [ ] `git diff --check`
- [ ] Link and stale-identity sweep for the README and release notes
- [ ] `npm run verify:docs` if task-index or generated documentation references
  change
- [ ] Re-read the final README and confirm the GitHub page shows the updated
  About metadata and canonical website

## Review

- Shipped:
- Verified:
- Deferred:
- Blocked:
- Proof artifacts:
- Next slice or stop:

#!/bin/bash
# tsconfig-cache-clean: Remove tsconfig.tsbuildinfo from git tracking and staging.
# Prevents the noise of standalone "chore: update tsconfig.tsbuildinfo" commits.
#
# Run once to set up: bash scripts/tsconfig-cache-clean.sh --setup
# Run before commit: bash scripts/tsconfig-cache-clean.sh
#
# Usage:
#   --setup   Add tsconfig.tsbuildinfo to .gitignore and untrack it
#   (no args) Just unstage any tsbuildinfo changes if accidentally staged

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

SETUP=false
if [[ "${1:-}" == "--setup" ]]; then
  SETUP=true
fi

if $SETUP; then
  echo "Setting up tsconfig cache management..."

  # Add to .gitignore if not already there
  GITIGNORE="$ROOT/.gitignore"
  if ! grep -q "tsconfig.tsbuildinfo" "$GITIGNORE" 2>/dev/null; then
    echo "" >> "$GITIGNORE"
    echo "# TypeScript build cache — not useful to track in git" >> "$GITIGNORE"
    echo "tsconfig.tsbuildinfo" >> "$GITIGNORE"
    echo "*.tsbuildinfo" >> "$GITIGNORE"
    echo "✅ Added tsconfig.tsbuildinfo to .gitignore"
  else
    echo "✅ Already in .gitignore"
  fi

  # Untrack from git if currently tracked
  if git ls-files --error-unmatch tsconfig.tsbuildinfo 2>/dev/null; then
    git rm --cached tsconfig.tsbuildinfo
    echo "✅ Removed tsconfig.tsbuildinfo from git tracking"
  else
    echo "✅ tsconfig.tsbuildinfo not currently tracked"
  fi

  echo ""
  echo "Done. Commit the .gitignore change:"
  echo "  git add .gitignore && git commit -m 'chore: ignore tsconfig.tsbuildinfo build cache'"
else
  # Just unstage any accidentally staged tsbuildinfo files
  staged=$(git diff --cached --name-only | grep tsbuildinfo || true)
  if [[ -n "$staged" ]]; then
    git restore --staged $staged
    echo "✅ Unstaged tsbuildinfo files: $staged"
  else
    echo "✅ No tsbuildinfo files staged"
  fi
fi

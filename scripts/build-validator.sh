#!/bin/bash
# build-validator: Pre-commit build checks for Vercel deployment.
# Catches common issues and build failures before they hit CI.
#
# Usage: bash scripts/build-validator.sh
#        Or install as a pre-commit hook: cp scripts/build-validator.sh .git/hooks/pre-commit

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

error() { echo -e "${RED}❌ ERROR: $1${NC}"; ERRORS=$((ERRORS + 1)); }
warn()  { echo -e "${YELLOW}⚠️  WARN:  $1${NC}"; WARNINGS=$((WARNINGS + 1)); }
ok()    { echo -e "${GREEN}✅ OK:    $1${NC}"; }

echo ""
echo "══════════════════════════════════════════════"
echo "  Vercel Build Validator"
echo "══════════════════════════════════════════════"
echo ""

# ── 1. N+1 query patterns — loops with DB calls ──────────────────────────────
echo "── Checking for potential N+1 query patterns..."

# Look for .forEach/.map with await inside — classic N+1 pattern
loop_await=$(grep -rn "\.forEach\|\.map\b" src/lib/services/ --include="*.ts" -A 3 2>/dev/null | grep -B 3 "await" || true)
if [[ -n "$loop_await" ]]; then
  warn "Potential N+1 query: async operations inside forEach/map in services/"
  warn "Consider using Promise.all() or batching into a single query"
  echo "$loop_await" | head -20
fi

# Look for await inside for loops
for_await=$(grep -rn "for.*of\|for.*in" src/lib/services/ --include="*.ts" -A 2 2>/dev/null | grep -B 2 "await" || true)
if [[ -n "$for_await" ]]; then
  warn "Potential N+1 query: 'await' inside for loop in services/ — batch if this makes multiple DB calls"
fi

ok "Query pattern check done"

# ── 2. TypeScript check ───────────────────────────────────────────────────────
echo ""
echo "── Running TypeScript type check..."

if ! npx tsc --noEmit 2>&1; then
  error "TypeScript errors found — fix before committing"
fi

ok "TypeScript check done"

# ── 3. Build ──────────────────────────────────────────────────────────────────
echo ""
echo "── Running full build..."

if ! npm run build 2>&1; then
  error "Build failed — do not commit broken build"
else
  ok "Build succeeded"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}  FAILED: $ERRORS error(s), $WARNINGS warning(s)${NC}"
  echo "  Fix errors before committing."
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}  PASSED with $WARNINGS warning(s) — review above${NC}"
else
  echo -e "${GREEN}  ALL CHECKS PASSED${NC}"
fi
echo "══════════════════════════════════════════════"
echo ""

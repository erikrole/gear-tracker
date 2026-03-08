#!/bin/bash
# cloudflare-build-validator: Pre-commit build checks for Cloudflare Worker deployment.
# Catches edge-runtime issues, subrequest patterns, and build failures before they hit CI.
#
# Usage: bash scripts/cloudflare-build-validator.sh
#        Or install as a pre-commit hook: cp scripts/cloudflare-build-validator.sh .git/hooks/pre-commit

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
echo "  Cloudflare Worker Build Validator"
echo "══════════════════════════════════════════════"
echo ""

# ── 1. Node-only API imports ──────────────────────────────────────────────────
echo "── Checking for Node.js-only API imports..."

NODE_ONLY=("'fs'" "'path'" "'child_process'" "'os'" "'crypto'" "'stream'" "'net'" "'dns'" "'readline'")
for pkg in "${NODE_ONLY[@]}"; do
  results=$(grep -r "from $pkg\|require($pkg)" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
  if [[ -n "$results" ]]; then
    error "Node-only import '$pkg' found in src/ — not available in Cloudflare edge runtime"
    echo "$results" | head -5
  fi
done

# Node crypto is fine if using Web Crypto API, but flag direct node:crypto
node_crypto=$(grep -r "from 'node:crypto'\|require('node:crypto')" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [[ -n "$node_crypto" ]]; then
  error "node:crypto import found — use Web Crypto API (crypto.subtle) instead"
fi

ok "Node-only imports check done"

# ── 2. Subrequest patterns — loops with DB calls ──────────────────────────────
echo ""
echo "── Checking for potential subrequest limit violations..."

# Look for .forEach/.map with await inside — classic subrequest blowup pattern
loop_await=$(grep -rn "\.forEach\|\.map\b" src/lib/services/ --include="*.ts" -A 3 2>/dev/null | grep -B 3 "await" || true)
if [[ -n "$loop_await" ]]; then
  warn "Potential subrequest issue: async operations inside forEach/map in services/"
  warn "Consider using Promise.all() or batching into a single query"
  echo "$loop_await" | head -20
fi

# Look for await inside for loops
for_await=$(grep -rn "for.*of\|for.*in" src/lib/services/ --include="*.ts" -A 2 2>/dev/null | grep -B 2 "await" || true)
if [[ -n "$for_await" ]]; then
  warn "Potential subrequest issue: 'await' inside for loop in services/ — batch if this makes multiple DB calls"
fi

ok "Subrequest pattern check done"

# ── 3. Edge runtime incompatible patterns ─────────────────────────────────────
echo ""
echo "── Checking for edge runtime incompatibilities..."

# process.env in components (ok in server components but flag for awareness)
proc_env_client=$(grep -rn "process\.env" src/components/ --include="*.tsx" 2>/dev/null || true)
if [[ -n "$proc_env_client" ]]; then
  warn "process.env in src/components/ — ensure these are server components, not client"
fi

# Dynamic requires
dyn_require=$(grep -rn "require(" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "//\|node_modules\|scripts" || true)
if [[ -n "$dyn_require" ]]; then
  warn "Dynamic require() found — use ES imports instead for edge runtime compatibility"
  echo "$dyn_require" | head -5
fi

ok "Edge runtime check done"

# ── 4. TypeScript check ───────────────────────────────────────────────────────
echo ""
echo "── Running TypeScript type check..."

if ! npx tsc --noEmit 2>&1; then
  error "TypeScript errors found — fix before committing"
fi

ok "TypeScript check done"

# ── 5. Build ──────────────────────────────────────────────────────────────────
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

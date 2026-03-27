#!/usr/bin/env bash
set -euo pipefail

# Release script for Gear Tracker
# Usage: npm run release [-- --dry-run] [-- --yes]
#
# Creates a CalVer tag (YYYY.MM.DD.N) and updates package.json.
# If on main, also creates a GitHub Release with auto-generated notes.
#
# Flags:
#   --dry-run   Show what would happen without creating anything
#   --yes       Skip confirmation prompts (for automated use)

DRY_RUN=false
AUTO_YES=false
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --yes|-y) AUTO_YES=true ;;
  esac
done

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean. Commit or stash changes first."
  exit 1
fi

# Ensure we're on main
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "Warning: Not on main branch (currently on '$BRANCH')."
  if [ "$AUTO_YES" = false ]; then
    read -rp "Continue anyway? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 0
    fi
  fi
fi

# Calculate today's CalVer tag
TODAY=$(date +%Y.%m.%d)
EXISTING=$(git tag -l "${TODAY}.*" | sort -t. -k4 -n | tail -1)

if [ -z "$EXISTING" ]; then
  BUILD=1
else
  LAST_BUILD=$(echo "$EXISTING" | awk -F. '{print $4}')
  BUILD=$((LAST_BUILD + 1))
fi

VERSION="${TODAY}.${BUILD}"

echo "Release: ${VERSION}"
echo ""

# Show what's new since the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  echo "Changes since ${LAST_TAG}:"
  git log --oneline "${LAST_TAG}..HEAD"
else
  echo "First release — all commits included."
  git log --oneline -20
fi
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] Would create tag: ${VERSION}"
  echo "[dry-run] Would update package.json version to: ${VERSION}"
  exit 0
fi

if [ "$AUTO_YES" = false ]; then
  read -rp "Create release ${VERSION}? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Update package.json version
if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = '${VERSION}';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  git add package.json
  git commit -m "chore: release ${VERSION}"
fi

# Create annotated tag
git tag -a "${VERSION}" -m "Release ${VERSION}"

# Push commit + tag
git push origin "${BRANCH}"
git push origin "${VERSION}"

echo ""
echo "Released ${VERSION}"
echo ""

# Create GitHub Release if gh CLI is available
if command -v gh &>/dev/null; then
  if [ -n "$LAST_TAG" ]; then
    gh release create "${VERSION}" \
      --title "${VERSION}" \
      --generate-notes \
      --notes-start-tag "${LAST_TAG}"
  else
    gh release create "${VERSION}" \
      --title "${VERSION}" \
      --generate-notes
  fi
  echo "GitHub Release created: ${VERSION}"
else
  echo "Tip: Install GitHub CLI (gh) to auto-create GitHub Releases."
  echo "  https://cli.github.com/"
fi

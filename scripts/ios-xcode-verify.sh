#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCHEME="${IOS_SCHEME:-Wisconsin}"
CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-${TMPDIR:-/tmp}/gear-tracker-xcode-derived-data}"
PROJECT_PATH="ios/Wisconsin.xcodeproj"
XCODEBUILD_FLAGS=()

if [[ "${IOS_XCODEBUILD_VERBOSE:-0}" != "1" ]]; then
  XCODEBUILD_FLAGS+=("-quiet")
fi

run_step() {
  local label="$1"
  shift
  printf '\n== %s ==\n' "$label"
  "$@"
}

printf 'iOS Xcode verification\n'
printf 'Project: %s\n' "$PROJECT_PATH"
printf 'Scheme: %s\n' "$SCHEME"
printf 'Configuration: %s\n' "$CONFIGURATION"
printf 'DerivedData: %s\n' "$DERIVED_DATA_PATH"

if [[ "${IOS_SKIP_PROJECT_CHECK:-0}" != "1" ]]; then
  run_step "XcodeGen project drift" npm run ios:project:check
fi

if [[ "${IOS_SKIP_STATIC_GATES:-0}" != "1" ]]; then
  run_step "iOS drift check" npm run drift:ios
  run_step "iOS gap audit" npm run audit:ios:gaps
fi

run_step "Xcode simulator build" \
  xcodebuild \
    "${XCODEBUILD_FLAGS[@]}" \
    -project "$PROJECT_PATH" \
    -scheme "$SCHEME" \
    -destination "generic/platform=iOS Simulator" \
    -configuration "$CONFIGURATION" \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    build

if [[ "${IOS_SKIP_DEVICE_BUILD:-0}" != "1" ]]; then
  run_step "Xcode generic iOS build" \
    xcodebuild \
      "${XCODEBUILD_FLAGS[@]}" \
      -project "$PROJECT_PATH" \
      -scheme "$SCHEME" \
      -destination "generic/platform=iOS" \
      -configuration "$CONFIGURATION" \
      -derivedDataPath "$DERIVED_DATA_PATH" \
      build
fi

printf '\nOK: iOS Xcode verification passed for %s.\n' "$SCHEME"

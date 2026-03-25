#!/bin/bash
# Publish all 14 @oraclaw SDK packages to npm
# Run: bash scripts/publish-all-npm.sh

set -e

SDK_DIR="packages/sdk"
PACKAGES=(bandit solver decide graph calibrate simulate evolve bayesian ensemble risk pathfind forecast anomaly cmaes)

echo "Publishing ${#PACKAGES[@]} @oraclaw packages to npm..."
echo ""

SUCCESS=0
FAIL=0

for pkg in "${PACKAGES[@]}"; do
  echo "─── Publishing @oraclaw/$pkg ───"
  cd "$SDK_DIR/$pkg"
  if npm publish --access public 2>&1; then
    echo "✓ @oraclaw/$pkg published"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "✗ @oraclaw/$pkg FAILED"
    FAIL=$((FAIL + 1))
  fi
  cd ../../..
  echo ""
done

echo "════════════════════════════════"
echo "Results: $SUCCESS published, $FAIL failed"
echo "════════════════════════════════"

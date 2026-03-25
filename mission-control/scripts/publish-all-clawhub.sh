#!/bin/bash
# Publish all 14 OraClaw skills to ClawHub
# Run: bash scripts/publish-all-clawhub.sh

set -e

SKILLS_DIR="packages/clawhub-skills"
SKILLS=(oraclaw-bandit oraclaw-solver oraclaw-decide oraclaw-graph oraclaw-calibrate oraclaw-simulate oraclaw-evolve oraclaw-bayesian oraclaw-ensemble oraclaw-risk oraclaw-pathfind oraclaw-forecast oraclaw-anomaly oraclaw-cmaes)

echo "Publishing ${#SKILLS[@]} OraClaw skills to ClawHub..."
echo ""

SUCCESS=0
FAIL=0

for skill in "${SKILLS[@]}"; do
  echo "─── Publishing $skill ───"
  if clawhub publish "$SKILLS_DIR/$skill" 2>&1; then
    echo "✓ $skill published"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "✗ $skill FAILED"
    FAIL=$((FAIL + 1))
  fi
  echo ""
done

echo "════════════════════════════════"
echo "Results: $SUCCESS published, $FAIL failed"
echo "════════════════════════════════"

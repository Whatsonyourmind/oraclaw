#!/bin/bash
# Publish all 14 OraClaw skills to ClawHub
# Run: bash scripts/publish-all-clawhub.sh
#
# Features:
# - Skip already-published skills (version check)
# - Retry failed publishes up to 3 times
# - Summary of published/skipped/failed at the end

set -euo pipefail

SKILLS_DIR="packages/clawhub-skills"
SKILLS=(
  oraclaw-bandit
  oraclaw-anomaly
  oraclaw-bayesian
  oraclaw-calibrate
  oraclaw-cmaes
  oraclaw-decide
  oraclaw-ensemble
  oraclaw-evolve
  oraclaw-forecast
  oraclaw-graph
  oraclaw-pathfind
  oraclaw-risk
  oraclaw-simulate
  oraclaw-solver
)

MAX_RETRIES=3

PUBLISHED=0
SKIPPED=0
FAILED=0
PUBLISHED_LIST=()
SKIPPED_LIST=()
FAILED_LIST=()

echo "================================================================"
echo "  OraClaw ClawHub Publisher -- ${#SKILLS[@]} skills"
echo "================================================================"
echo ""

for skill in "${SKILLS[@]}"; do
  skill_dir="$SKILLS_DIR/$skill"

  if [ ! -f "$skill_dir/SKILL.md" ]; then
    echo "SKIP $skill (no SKILL.md found)"
    SKIPPED=$((SKIPPED + 1))
    SKIPPED_LIST+=("$skill (no SKILL.md)")
    continue
  fi

  # Check if already published (clawhub info returns 0 if skill exists)
  version=$(node -p "require('./$skill_dir/package.json').version" 2>/dev/null || echo "unknown")
  if clawhub info "$skill" 2>/dev/null | grep -q "$version"; then
    echo "SKIP $skill@$version (already published)"
    SKIPPED=$((SKIPPED + 1))
    SKIPPED_LIST+=("$skill@$version")
    continue
  fi

  # Publish with retry
  attempt=0
  success=false
  while [ $attempt -lt $MAX_RETRIES ]; do
    attempt=$((attempt + 1))
    echo "Publishing $skill@$version (attempt $attempt/$MAX_RETRIES)..."

    if clawhub publish "$skill_dir" 2>&1; then
      echo "  OK $skill@$version published"
      PUBLISHED=$((PUBLISHED + 1))
      PUBLISHED_LIST+=("$skill@$version")
      success=true
      break
    else
      echo "  RETRY $skill (attempt $attempt failed)"
      sleep 2
    fi
  done

  if [ "$success" = false ]; then
    echo "  FAIL $skill@$version (all $MAX_RETRIES attempts failed)"
    FAILED=$((FAILED + 1))
    FAILED_LIST+=("$skill@$version")
  fi

  echo ""
done

echo ""
echo "================================================================"
echo "  RESULTS: $PUBLISHED published, $SKIPPED skipped, $FAILED failed"
echo "================================================================"

if [ ${#PUBLISHED_LIST[@]} -gt 0 ]; then
  echo ""
  echo "Published:"
  for item in "${PUBLISHED_LIST[@]}"; do echo "  + $item"; done
fi

if [ ${#SKIPPED_LIST[@]} -gt 0 ]; then
  echo ""
  echo "Skipped:"
  for item in "${SKIPPED_LIST[@]}"; do echo "  - $item"; done
fi

if [ ${#FAILED_LIST[@]} -gt 0 ]; then
  echo ""
  echo "Failed:"
  for item in "${FAILED_LIST[@]}"; do echo "  ! $item"; done
  exit 1
fi

echo ""
echo "Done."

#!/bin/bash
# Publish all 14 @oraclaw SDK packages + MCP server to npm
# Features: version-check (skip already-published), retry (up to 3 attempts), summary
# Run: cd mission-control && bash scripts/publish-all.sh

set -euo pipefail

SDK_DIR="packages/sdk"
MCP_DIR="packages/mcp-server"
PACKAGES=(bandit solver decide graph calibrate simulate evolve bayesian ensemble risk pathfind forecast anomaly cmaes)

PUBLISHED=()
SKIPPED=()
FAILED=()

publish_package() {
  local pkg_dir="$1"
  local label="$2"

  local name version published_version
  name=$(node -p "require('./$pkg_dir/package.json').name")
  version=$(node -p "require('./$pkg_dir/package.json').version")

  # Check if this exact version is already on the registry
  published_version=$(npm view "$name@$version" version 2>/dev/null || echo "")
  if [ "$published_version" = "$version" ]; then
    echo "SKIP $name@$version (already published)"
    SKIPPED+=("$label")
    return 0
  fi

  # Build and publish with up to 3 retries
  local attempt=0
  local max_retries=3
  while [ $attempt -lt $max_retries ]; do
    attempt=$((attempt + 1))
    echo "Publishing $name@$version (attempt $attempt/$max_retries)..."
    if (cd "$pkg_dir" && npm run build && npm publish --access public) 2>&1; then
      echo "OK $name@$version published"
      PUBLISHED+=("$label")
      return 0
    fi
    if [ $attempt -lt $max_retries ]; then
      echo "Retry $name@$version in 5s..."
      sleep 5
    fi
  done

  echo "FAIL $name@$version after $max_retries attempts"
  FAILED+=("$label")
  return 1
}

echo "==========================================="
echo " OraClaw npm Publish (${#PACKAGES[@]} SDK + 1 MCP)"
echo "==========================================="
echo ""

# Publish all 14 SDK packages
for pkg in "${PACKAGES[@]}"; do
  echo "--- @oraclaw/$pkg ---"
  publish_package "$SDK_DIR/$pkg" "$pkg" || true
  echo ""
done

# Publish MCP server
echo "--- @oraclaw/mcp-server ---"
publish_package "$MCP_DIR" "mcp-server" || true
echo ""

# Summary
echo "==========================================="
echo " Summary"
echo "==========================================="
echo "Published (${#PUBLISHED[@]}): ${PUBLISHED[*]:-none}"
echo "Skipped   (${#SKIPPED[@]}): ${SKIPPED[*]:-none}"
echo "Failed    (${#FAILED[@]}): ${FAILED[*]:-none}"
echo "==========================================="

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Some packages failed to publish. Check output above."
  exit 1
fi

echo "All packages published or skipped successfully."
exit 0

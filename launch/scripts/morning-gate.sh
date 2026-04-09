#!/usr/bin/env bash
# morning-gate.sh
#
# Session-start audit. Run at the start of every GitHub/OraClaw work session
# to catch signals that slip through the notification feed:
#   - new stargazers on Whatsonyourmind/oraclaw (diffed vs yesterday)
#   - new forks (diffed vs yesterday)
#   - unread notifications
#   - own-repo issues
#   - active mention threads updated today
#   - registry PR status deltas
#
# Usage:
#   bash launch/scripts/morning-gate.sh
#
# State is kept in launch/scripts/.morning-gate-state/ (gitignored, per-session
# JSON snapshots for delta comparison).
#
# Exit codes:
#   0 = clean, nothing actionable
#   1 = actionable items detected (new stars, new forks, unread notifications)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${SCRIPT_DIR}/.morning-gate-state"
mkdir -p "${STATE_DIR}"

# On Git Bash / MSYS, pwd returns /c/... paths that Python on Windows
# cannot open directly. Convert to native Windows form when available.
if command -v cygpath >/dev/null 2>&1; then
  STATE_DIR="$(cygpath -w "${STATE_DIR}")"
fi

# Use whichever python is available. Windows Git Bash ships `python`,
# Linux/macOS typically have `python3`.
if command -v python >/dev/null 2>&1; then
  PY=python
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  echo "ERROR: python not found on PATH" >&2
  exit 2
fi

TODAY="$(date -u +%Y-%m-%d)"
YESTERDAY="$(date -u -d 'yesterday' +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)"
ACTIONABLE=0

print_header() {
  printf '\n\033[1;36m━━ %s ━━\033[0m\n' "$1"
}

print_ok() {
  printf '  \033[32m✓\033[0m %s\n' "$1"
}

print_warn() {
  printf '  \033[33m!\033[0m %s\n' "$1"
  ACTIONABLE=1
}

print_new() {
  printf '  \033[1;35m★\033[0m %s\n' "$1"
  ACTIONABLE=1
}

# ── 1. Stargazer delta on public repo ────────────────────────
print_header "1. OraClaw stargazer delta"

CURRENT_STARS_FILE="${STATE_DIR}/stars-${TODAY}.json"
YESTERDAY_STARS_FILE="${STATE_DIR}/stars-${YESTERDAY}.json"

gh api "repos/Whatsonyourmind/oraclaw/stargazers" \
  -H "Accept: application/vnd.github.v3.star+json" \
  -q '[.[] | {login: .user.login, starred_at: .starred_at}]' \
  > "${CURRENT_STARS_FILE}" 2>/dev/null

CURRENT_COUNT=$(${PY} -c "import sys, json; print(len(json.load(open(sys.argv[1]))))" "${CURRENT_STARS_FILE}" 2>/dev/null || echo "?")

if [[ -f "${YESTERDAY_STARS_FILE}" ]]; then
  NEW_STARS=$(${PY} -c "
import sys, json
cur = {s['login'] for s in json.load(open(sys.argv[1]))}
prev = {s['login'] for s in json.load(open(sys.argv[2]))}
new = cur - prev
for s in sorted(new):
    print(s)
" "${CURRENT_STARS_FILE}" "${YESTERDAY_STARS_FILE}" 2>/dev/null)
  if [[ -n "${NEW_STARS}" ]]; then
    echo "${NEW_STARS}" | while read -r user; do
      print_new "NEW stargazer: ${user}  — investigate: gh api users/${user}"
    done
  else
    print_ok "No new stargazers since yesterday (total: ${CURRENT_COUNT})"
  fi
else
  print_ok "Baseline captured (total: ${CURRENT_COUNT}). Re-run tomorrow for deltas."
fi

# ── 2. Fork delta ──────────────────────────────────────────────
print_header "2. OraClaw fork delta"

CURRENT_FORKS_FILE="${STATE_DIR}/forks-${TODAY}.json"
YESTERDAY_FORKS_FILE="${STATE_DIR}/forks-${YESTERDAY}.json"

gh api "repos/Whatsonyourmind/oraclaw/forks" \
  -q '[.[] | {login: .owner.login, created_at: .created_at}]' \
  > "${CURRENT_FORKS_FILE}" 2>/dev/null

CURRENT_FORK_COUNT=$(${PY} -c "import sys, json; print(len(json.load(open(sys.argv[1]))))" "${CURRENT_FORKS_FILE}" 2>/dev/null || echo "?")

if [[ -f "${YESTERDAY_FORKS_FILE}" ]]; then
  NEW_FORKS=$(${PY} -c "
import sys, json
cur = {s['login'] for s in json.load(open(sys.argv[1]))}
prev = {s['login'] for s in json.load(open(sys.argv[2]))}
new = cur - prev
for s in sorted(new):
    print(s)
" "${CURRENT_FORKS_FILE}" "${YESTERDAY_FORKS_FILE}" 2>/dev/null)
  if [[ -n "${NEW_FORKS}" ]]; then
    echo "${NEW_FORKS}" | while read -r user; do
      print_new "NEW fork: ${user}/oraclaw  — check for commits: gh api repos/${user}/oraclaw/commits"
    done
  else
    print_ok "No new forks since yesterday (total: ${CURRENT_FORK_COUNT})"
  fi
else
  print_ok "Baseline captured (total: ${CURRENT_FORK_COUNT})"
fi

# ── 3. Unread notifications ─────────────────────────────────
print_header "3. Unread notifications"

UNREAD_COUNT=$(gh api "notifications?all=false&per_page=50" -q 'length' 2>/dev/null || echo "0")
if [[ "${UNREAD_COUNT}" == "0" ]]; then
  print_ok "Inbox clean"
else
  print_warn "${UNREAD_COUNT} unread notifications — run full sweep"
  gh api "notifications?all=false&per_page=10" \
    -q '.[] | "    - [" + .reason + "] " + .repository.full_name + ": " + .subject.title[:60]' 2>/dev/null
fi

# ── 4. Own-repo issues (non-bot) ─────────────────────────────
print_header "4. Own-repo inbound issues (non-bot)"

NON_BOT_ISSUES=$(gh api "repos/Whatsonyourmind/oraclaw/issues?state=open&per_page=50" \
  -q '[.[] | select(.user.type != "Bot") | select(.pull_request == null)] | length' 2>/dev/null || echo "0")

if [[ "${NON_BOT_ISSUES}" == "0" ]]; then
  print_ok "Zero human-opened issues (telemetry signal: 0 external users with bugs)"
else
  print_new "${NON_BOT_ISSUES} human-opened issues — review immediately"
  gh api "repos/Whatsonyourmind/oraclaw/issues?state=open&per_page=10" \
    -q '.[] | select(.user.type != "Bot") | "    #" + (.number|tostring) + " [" + .user.login + "] " + .title[:60]' 2>/dev/null
fi

# ── 5. Mentions updated today ────────────────────────────────
print_header "5. Mentions on other repos (updated today)"

MENTIONS_JSON=$(gh api "search/issues?q=mentions:Whatsonyourmind+updated:>=${TODAY}&per_page=20" 2>/dev/null)
MENTIONS_COUNT=$(echo "${MENTIONS_JSON}" | ${PY} -c "import sys, json; print(json.load(sys.stdin).get('total_count', 0))" 2>/dev/null || echo "0")

if [[ "${MENTIONS_COUNT}" == "0" ]]; then
  print_ok "No mentions updated today"
else
  print_warn "${MENTIONS_COUNT} mention threads updated today"
  echo "${MENTIONS_JSON}" | ${PY} -c "
import sys, json
d = json.load(sys.stdin)
for i in d.get('items', [])[:10]:
    repo = i['repository_url'].split('repos/')[-1]
    print(f\"    [{repo}#{i['number']}] {i['title'][:60]}\")
" 2>/dev/null
fi

# ── 6. Public repo traffic (14-day window) ───────────────────
print_header "6. 14-day traffic snapshot"

TRAFFIC_JSON=$(gh api "repos/Whatsonyourmind/oraclaw/traffic/clones" 2>/dev/null || echo '{}')
CLONES=$(echo "${TRAFFIC_JSON}" | ${PY} -c "import sys, json; d=json.load(sys.stdin); print(f\"{d.get('count', 0)} clones / {d.get('uniques', 0)} unique\")" 2>/dev/null)
print_ok "Clones: ${CLONES}"

VIEWS_JSON=$(gh api "repos/Whatsonyourmind/oraclaw/traffic/views" 2>/dev/null || echo '{}')
VIEWS=$(echo "${VIEWS_JSON}" | ${PY} -c "import sys, json; d=json.load(sys.stdin); print(f\"{d.get('count', 0)} views / {d.get('uniques', 0)} unique\")" 2>/dev/null)
print_ok "Views:  ${VIEWS}"

# ── 7. Admin usage endpoint (if configured) ──────────────────
print_header "7. Live usage telemetry (if ADMIN_KEY set)"

if [[ -n "${ORACLAW_ADMIN_KEY:-}" ]]; then
  USAGE=$(curl -s -H "X-Admin-Key: ${ORACLAW_ADMIN_KEY}" "https://oraclaw-api.onrender.com/api/v1/admin/usage" 2>/dev/null || echo '{}')
  TOTAL=$(echo "${USAGE}" | ${PY} -c "import sys, json; print(json.load(sys.stdin).get('totalRequests', 0))" 2>/dev/null)
  UNIQUE=$(echo "${USAGE}" | ${PY} -c "import sys, json; print(json.load(sys.stdin).get('uniqueKeyIdCount', 0))" 2>/dev/null)
  if [[ "${TOTAL}" != "0" ]]; then
    print_new "${TOTAL} total requests / ${UNIQUE} unique API keys"
  else
    print_ok "Total: ${TOTAL} requests, ${UNIQUE} unique keys (still zero)"
  fi
else
  print_ok "ORACLAW_ADMIN_KEY not set in env — skip. (export it once billing is activated.)"
fi

# ── Summary ────────────────────────────────────────────────
echo ""
if [[ "${ACTIONABLE}" == "0" ]]; then
  printf '\033[32m━━ ALL CLEAR ━━\033[0m  No actionable items detected.\n'
  exit 0
else
  printf '\033[33m━━ ACTION NEEDED ━━\033[0m  Review items marked with ★ or !\n'
  exit 1
fi

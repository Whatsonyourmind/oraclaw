#!/usr/bin/env bash
#
# Ralph Wiggum - Autonomous AI Agent Loop
# Runs Claude Code repeatedly until all PRD items are complete.
# Memory persists through git history, progress.txt, and prd.json.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
TOOL="claude"
MAX_ITERATIONS=50

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tool)
            TOOL="$2"
            shift 2
            ;;
        *)
            if [[ "$1" =~ ^[0-9]+$ ]]; then
                MAX_ITERATIONS="$1"
            fi
            shift
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           RALPH WIGGUM - AUTONOMOUS AGENT LOOP                ║${NC}"
echo -e "${BLUE}║         'Me fail English? That's unpossible!'                 ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Tool:${NC} $TOOL"
echo -e "${YELLOW}Max Iterations:${NC} $MAX_ITERATIONS"
echo -e "${YELLOW}Project Root:${NC} $PROJECT_ROOT"
echo ""

# Check for required files
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
PROMPT_FILE="$SCRIPT_DIR/CLAUDE.md"

if [[ ! -f "$PRD_FILE" ]]; then
    echo -e "${RED}Error: prd.json not found at $PRD_FILE${NC}"
    exit 1
fi

if [[ ! -f "$PROMPT_FILE" ]]; then
    echo -e "${RED}Error: CLAUDE.md not found at $PROMPT_FILE${NC}"
    exit 1
fi

# Initialize progress file if it doesn't exist
if [[ ! -f "$PROGRESS_FILE" ]]; then
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date -Iseconds)" >> "$PROGRESS_FILE"
    echo "" >> "$PROGRESS_FILE"
fi

# Track branch changes for archiving
CURRENT_BRANCH=""
if command -v jq &> /dev/null && [[ -f "$PRD_FILE" ]]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
fi

# Main loop
for ((i=1; i<=MAX_ITERATIONS; i++)); do
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ITERATION $i of $MAX_ITERATIONS${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    # Log iteration start
    echo "---" >> "$PROGRESS_FILE"
    echo "Iteration $i started: $(date -Iseconds)" >> "$PROGRESS_FILE"

    # Check completion status before running
    if command -v jq &> /dev/null; then
        TOTAL=$(jq '.userStories | length' "$PRD_FILE" 2>/dev/null || echo "0")
        COMPLETED=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo "0")
        echo -e "${YELLOW}Progress: $COMPLETED / $TOTAL stories complete${NC}"

        if [[ "$COMPLETED" == "$TOTAL" ]] && [[ "$TOTAL" != "0" ]]; then
            echo ""
            echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║                    ALL STORIES COMPLETE!                      ║${NC}"
            echo -e "${GREEN}║                   <promise>COMPLETE</promise>                 ║${NC}"
            echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
            echo ""
            echo "COMPLETE: All stories passed at $(date -Iseconds)" >> "$PROGRESS_FILE"
            exit 0
        fi
    fi

    # Run the AI tool
    cd "$PROJECT_ROOT"

    OUTPUT_FILE=$(mktemp)

    if [[ "$TOOL" == "claude" ]]; then
        echo -e "${BLUE}Running Claude Code...${NC}"
        # Run claude with the prompt file, capture output
        if claude --dangerously-skip-permissions --print < "$PROMPT_FILE" 2>&1 | tee "$OUTPUT_FILE"; then
            echo -e "${GREEN}Claude Code completed iteration $i${NC}"
        else
            echo -e "${YELLOW}Claude Code exited with non-zero status${NC}"
        fi
    elif [[ "$TOOL" == "amp" ]]; then
        echo -e "${BLUE}Running Amp...${NC}"
        if amp --dangerously-allow-all < "$SCRIPT_DIR/prompt.md" 2>&1 | tee "$OUTPUT_FILE"; then
            echo -e "${GREEN}Amp completed iteration $i${NC}"
        else
            echo -e "${YELLOW}Amp exited with non-zero status${NC}"
        fi
    else
        echo -e "${RED}Unknown tool: $TOOL${NC}"
        exit 1
    fi

    # Check for completion signal in output
    if grep -q "<promise>COMPLETE</promise>" "$OUTPUT_FILE"; then
        echo ""
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║              COMPLETION SIGNAL DETECTED!                      ║${NC}"
        echo -e "${GREEN}║                <promise>COMPLETE</promise>                    ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "COMPLETE: Completion signal received at $(date -Iseconds)" >> "$PROGRESS_FILE"
        rm -f "$OUTPUT_FILE"
        exit 0
    fi

    rm -f "$OUTPUT_FILE"

    # Log iteration end
    echo "Iteration $i completed: $(date -Iseconds)" >> "$PROGRESS_FILE"

    # Small delay between iterations
    sleep 2
done

echo ""
echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║           MAX ITERATIONS REACHED WITHOUT COMPLETION           ║${NC}"
echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "INCOMPLETE: Max iterations ($MAX_ITERATIONS) reached at $(date -Iseconds)" >> "$PROGRESS_FILE"
exit 1

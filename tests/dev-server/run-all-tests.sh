#!/bin/bash

# ============================================================================
# Master Test Runner - Development PLM Server
# ============================================================================
# Runs all agent test suites and generates a comprehensive report
# Server: plm.windchill.com/Windchill (Server ID: 2)
# ============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Test suite list
TEST_SUITES=(
    "01-part-agent-tests.sh"
    "02-document-agent-tests.sh"
    "03-change-agent-tests.sh"
    "04-workflow-agent-tests.sh"
    "05-project-agent-tests.sh"
    "06-dataadmin-agent-tests.sh"
    "07-servermanager-agent-tests.sh"
)

# Results tracking
TOTAL_SUITES=${#TEST_SUITES[@]}
SUITES_PASSED=0
SUITES_FAILED=0
declare -a SUITE_RESULTS

# Timestamp for this test run
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_ID="test-run-$TIMESTAMP"

# ============================================================================
# Banner
# ============================================================================

print_banner() {
    echo ""
    echo -e "${CYAN}========================================================================"
    echo -e "${BOLD}Windchill MCP Server - Comprehensive Test Suite${NC}"
    echo -e "${CYAN}========================================================================${NC}"
    echo -e "${BLUE}Server:${NC}     Development PLM (plm.windchill.com/Windchill)"
    echo -e "${BLUE}Server ID:${NC}  2"
    echo -e "${BLUE}Run ID:${NC}     $RUN_ID"
    echo -e "${BLUE}Started:${NC}    $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "${CYAN}========================================================================${NC}"
    echo ""
}

# ============================================================================
# Pre-Flight Checks
# ============================================================================

check_prerequisites() {
    echo -e "${BLUE}[INFO]${NC} Running pre-flight checks..."

    # Check for required commands
    for cmd in curl jq; do
        if ! command -v "$cmd" &> /dev/null; then
            echo -e "${RED}[ERROR]${NC} Required command not found: $cmd"
            echo -e "${YELLOW}[INFO]${NC} Please install: brew install $cmd"
            exit 1
        fi
    done

    # Check MCP server health
    MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3000}"
    health_response=$(curl -s -w "\n%{http_code}" "${MCP_SERVER_URL}/health" 2>&1)
    http_code=$(echo "$health_response" | tail -n1)

    if [[ "$http_code" != "200" ]]; then
        echo -e "${RED}[ERROR]${NC} MCP server is not running at $MCP_SERVER_URL"
        echo -e "${YELLOW}[INFO]${NC} Please start the server with: npm run dev:server"
        exit 1
    fi

    # Check Windchill server configuration
    server_info=$(curl -s "${MCP_SERVER_URL}/api/servers/current" 2>&1)
    server_id=$(echo "$server_info" | jq -r '.id' 2>/dev/null)
    server_name=$(echo "$server_info" | jq -r '.name' 2>/dev/null)

    if [[ "$server_id" != "2" ]]; then
        echo -e "${YELLOW}[WARN]${NC} Active server is not Development PLM (ID: $server_id)"
        echo -e "${BLUE}[INFO]${NC} Attempting to switch to server 2..."

        switch_response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d '{"serverId": 2}' \
            "${MCP_SERVER_URL}/api/servers/switch" 2>&1)

        if echo "$switch_response" | grep -q '"success":true'; then
            echo -e "${GREEN}[SUCCESS]${NC} Switched to Development PLM server"
        else
            echo -e "${RED}[ERROR]${NC} Failed to switch to Development PLM server"
            echo -e "${YELLOW}[INFO]${NC} Response: $switch_response"
            exit 1
        fi
    else
        echo -e "${GREEN}[SUCCESS]${NC} Connected to: $server_name"
    fi

    echo -e "${GREEN}[SUCCESS]${NC} All pre-flight checks passed"
    echo ""
}

# ============================================================================
# Test Suite Execution
# ============================================================================

run_test_suite() {
    local suite_script="$1"
    local suite_number=$((${#SUITE_RESULTS[@]} + 1))

    echo ""
    echo -e "${CYAN}========================================================================"
    echo -e "${BOLD}Test Suite $suite_number/$TOTAL_SUITES: $suite_script${NC}"
    echo -e "${CYAN}========================================================================${NC}"

    local start_time=$(date +%s)

    # Run the test suite
    if bash "$SCRIPT_DIR/$suite_script"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        ((SUITES_PASSED++))
        SUITE_RESULTS+=("{\"suite\":\"$suite_script\",\"status\":\"PASS\",\"duration\":$duration}")

        echo -e "${GREEN}[PASSED]${NC} $suite_script (${duration}s)"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        ((SUITES_FAILED++))
        SUITE_RESULTS+=("{\"suite\":\"$suite_script\",\"status\":\"FAIL\",\"duration\":$duration}")

        echo -e "${RED}[FAILED]${NC} $suite_script (${duration}s)"
    fi
}

# ============================================================================
# Final Report
# ============================================================================

print_final_report() {
    echo ""
    echo -e "${CYAN}========================================================================"
    echo -e "${BOLD}Final Test Report${NC}"
    echo -e "${CYAN}========================================================================${NC}"
    echo -e "${BLUE}Run ID:${NC}          $RUN_ID"
    echo -e "${BLUE}Completed:${NC}       $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo -e "${BOLD}Test Suite Summary:${NC}"
    echo -e "  Total Suites:    $TOTAL_SUITES"
    echo -e "  ${GREEN}Passed:${NC}          $SUITES_PASSED"
    echo -e "  ${RED}Failed:${NC}          $SUITES_FAILED"
    echo ""

    # List individual suite results
    echo -e "${BOLD}Individual Suite Results:${NC}"
    for i in "${!TEST_SUITES[@]}"; do
        local suite="${TEST_SUITES[$i]}"
        local result="${SUITE_RESULTS[$i]}"

        if echo "$result" | grep -q '"status":"PASS"'; then
            echo -e "  ${GREEN}✓${NC} $suite"
        else
            echo -e "  ${RED}✗${NC} $suite"
        fi
    done

    echo ""
    echo -e "${CYAN}========================================================================${NC}"

    if [[ $SUITES_FAILED -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}All test suites passed!${NC}"
    else
        echo -e "${RED}${BOLD}Some test suites failed. See individual logs above.${NC}"
    fi

    echo -e "${CYAN}========================================================================${NC}"
    echo ""
}

# Save combined results
save_combined_results() {
    local results_file="$SCRIPT_DIR/results/complete-test-run-$TIMESTAMP.json"

    # Build JSON array of suite results
    local results_json=$(printf '%s,' "${SUITE_RESULTS[@]}")
    results_json="[${results_json%,}]"

    cat > "$results_file" << EOF
{
  "runId": "$RUN_ID",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "server": {
    "name": "Development PLM",
    "url": "http://plm.windchill.com/Windchill",
    "serverId": 2
  },
  "summary": {
    "totalSuites": $TOTAL_SUITES,
    "passed": $SUITES_PASSED,
    "failed": $SUITES_FAILED
  },
  "suites": $results_json,
  "individualResults": {
    "part": "results/part-agent-results-$TIMESTAMP.json",
    "document": "results/document-agent-results-$TIMESTAMP.json",
    "change": "results/change-agent-results-$TIMESTAMP.json",
    "workflow": "results/workflow-agent-results-$TIMESTAMP.json",
    "project": "results/project-agent-results-$TIMESTAMP.json"
  }
}
EOF

    echo -e "${BLUE}[INFO]${NC} Combined results saved to: $results_file"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Print banner
    print_banner

    # Run pre-flight checks
    check_prerequisites

    # Run all test suites
    echo -e "${BLUE}[INFO]${NC} Starting test execution..."

    for suite in "${TEST_SUITES[@]}"; do
        run_test_suite "$suite"
    done

    # Print final report
    print_final_report

    # Save combined results
    save_combined_results

    # Exit with appropriate code
    if [[ $SUITES_FAILED -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"

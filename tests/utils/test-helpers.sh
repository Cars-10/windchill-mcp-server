#!/bin/bash

# ============================================================================
# Windchill MCP Server Test Utilities
# ============================================================================
# Shared helper functions for testing Windchill MCP server tools
#
# Usage: source this file in your test scripts
#   source ../utils/test-helpers.sh
# ============================================================================

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Test results array
declare -a TEST_RESULTS

# Default configuration
MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3000}"
SERVER_ID="${SERVER_ID:-2}"
TIMEOUT="${TIMEOUT:-30}"

# ============================================================================
# Logging Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
}

# ============================================================================
# Test Execution Functions
# ============================================================================

# Call an MCP tool via HTTP
# Usage: call_tool <tool_name> <params_json>
# Returns: HTTP response body
call_tool() {
    local tool_name="$1"
    local params="$2"
    local response

    # Make HTTP POST request to tool endpoint
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$params" \
        --max-time "$TIMEOUT" \
        "${MCP_SERVER_URL}/api/tools/${tool_name}" 2>&1)

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    # Export for use in assertions
    export LAST_HTTP_CODE="$http_code"
    export LAST_RESPONSE="$body"

    echo "$body"
}

# Start a test
# Usage: start_test "Test Name" "Description"
start_test() {
    local test_name="$1"
    local test_desc="$2"

    export CURRENT_TEST_NAME="$test_name"
    export CURRENT_TEST_DESC="$test_desc"
    export CURRENT_TEST_START=$(date +%s)

    ((TESTS_RUN++))

    log_info "Testing: $test_name - $test_desc"
}

# Mark test as passed
test_pass() {
    local duration=$(($(date +%s) - CURRENT_TEST_START))
    ((TESTS_PASSED++))

    log_success "$CURRENT_TEST_NAME (${duration}s)"

    TEST_RESULTS+=("{\"name\":\"$CURRENT_TEST_NAME\",\"status\":\"PASS\",\"duration\":$duration,\"description\":\"$CURRENT_TEST_DESC\"}")
}

# Mark test as failed
# Usage: test_fail "Error message"
test_fail() {
    local error_msg="$1"
    local duration=$(($(date +%s) - CURRENT_TEST_START))
    ((TESTS_FAILED++))

    log_error "$CURRENT_TEST_NAME (${duration}s): $error_msg"

    # Escape quotes in error message for JSON
    local escaped_error=$(echo "$error_msg" | sed 's/"/\\"/g')

    TEST_RESULTS+=("{\"name\":\"$CURRENT_TEST_NAME\",\"status\":\"FAIL\",\"duration\":$duration,\"description\":\"$CURRENT_TEST_DESC\",\"error\":\"$escaped_error\"}")
}

# Mark test as skipped
# Usage: test_skip "Reason"
test_skip() {
    local reason="$1"
    ((TESTS_SKIPPED++))

    log_skip "$CURRENT_TEST_NAME: $reason"

    local escaped_reason=$(echo "$reason" | sed 's/"/\\"/g')

    TEST_RESULTS+=("{\"name\":\"$CURRENT_TEST_NAME\",\"status\":\"SKIP\",\"duration\":0,\"description\":\"$CURRENT_TEST_DESC\",\"reason\":\"$escaped_reason\"}")
}

# ============================================================================
# Assertion Functions
# ============================================================================

# Assert that HTTP response is successful (200-299)
assert_http_success() {
    if [[ "$LAST_HTTP_CODE" -ge 200 && "$LAST_HTTP_CODE" -lt 300 ]]; then
        return 0
    else
        test_fail "Expected HTTP 2xx, got $LAST_HTTP_CODE. Response: $LAST_RESPONSE"
        return 1
    fi
}

# Assert that HTTP response has specific status code
# Usage: assert_http_code 200
assert_http_code() {
    local expected="$1"
    if [[ "$LAST_HTTP_CODE" == "$expected" ]]; then
        return 0
    else
        test_fail "Expected HTTP $expected, got $LAST_HTTP_CODE. Response: $LAST_RESPONSE"
        return 1
    fi
}

# Assert that response contains a specific string or JSON field
# Usage: assert_contains "fieldName" or assert_contains '"value"'
assert_contains() {
    local search_term="$1"

    if echo "$LAST_RESPONSE" | grep -q "$search_term"; then
        return 0
    else
        test_fail "Response does not contain '$search_term'. Response: $LAST_RESPONSE"
        return 1
    fi
}

# Assert that response is valid JSON
assert_valid_json() {
    if echo "$LAST_RESPONSE" | jq empty 2>/dev/null; then
        return 0
    else
        test_fail "Response is not valid JSON. Response: $LAST_RESPONSE"
        return 1
    fi
}

# Assert that JSON response has a specific field
# Usage: assert_json_field ".ID"
assert_json_field() {
    local field="$1"

    if ! assert_valid_json; then
        return 1
    fi

    local value=$(echo "$LAST_RESPONSE" | jq -r "$field" 2>/dev/null)

    if [[ "$value" != "null" && -n "$value" ]]; then
        return 0
    else
        test_fail "JSON field '$field' not found or is null. Response: $LAST_RESPONSE"
        return 1
    fi
}

# ============================================================================
# Data Generation Functions
# ============================================================================

# Generate a unique timestamp-based identifier
generate_test_id() {
    echo "TEST-$(date +%Y%m%d-%H%M%S)-$$"
}

# Generate a unique part number
generate_part_number() {
    echo "PRT-TEST-$(date +%Y%m%d%H%M%S)-$(( RANDOM % 10000 ))"
}

# Generate a unique document number
generate_document_number() {
    echo "DOC-TEST-$(date +%Y%m%d%H%M%S)-$(( RANDOM % 10000 ))"
}

# Generate a unique change request number
generate_change_number() {
    echo "CR-TEST-$(date +%Y%m%d%H%M%S)-$(( RANDOM % 10000 ))"
}

# ============================================================================
# Server Health Check
# ============================================================================

check_server_health() {
    log_info "Checking MCP server health at $MCP_SERVER_URL..."

    local health_response=$(curl -s -w "\n%{http_code}" "${MCP_SERVER_URL}/health" 2>&1)
    local http_code=$(echo "$health_response" | tail -n1)

    if [[ "$http_code" == "200" ]]; then
        log_success "MCP server is healthy"
        return 0
    else
        log_error "MCP server health check failed (HTTP $http_code)"
        return 1
    fi
}

# Check if server is using the correct Windchill server
check_windchill_server() {
    log_info "Verifying active Windchill server..."

    local info_response=$(curl -s "${MCP_SERVER_URL}/api/servers/current" 2>&1)
    local server_id=$(echo "$info_response" | jq -r '.id' 2>/dev/null)
    local server_name=$(echo "$info_response" | jq -r '.name' 2>/dev/null)
    local server_url=$(echo "$info_response" | jq -r '.url' 2>/dev/null)

    if [[ "$server_id" == "$SERVER_ID" ]]; then
        log_success "Using Windchill server: $server_name ($server_url)"
        return 0
    else
        log_error "Expected server ID $SERVER_ID, but got $server_id"
        log_warning "Please switch to the correct server using: curl -X POST $MCP_SERVER_URL/api/servers/switch -d '{\"serverId\":$SERVER_ID}'"
        return 1
    fi
}

# ============================================================================
# Report Generation Functions
# ============================================================================

# Print test summary
print_summary() {
    echo ""
    echo "========================================================================"
    echo "Test Summary"
    echo "========================================================================"
    echo "Total Tests:  $TESTS_RUN"
    echo -e "${GREEN}Passed:${NC}       $TESTS_PASSED"
    echo -e "${RED}Failed:${NC}       $TESTS_FAILED"
    echo -e "${YELLOW}Skipped:${NC}      $TESTS_SKIPPED"
    echo "========================================================================"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}Some tests failed.${NC}"
        return 1
    fi
}

# Save test results to JSON file
save_results() {
    local output_file="$1"
    local test_suite_name="$2"

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Build JSON array of results
    local results_json=$(printf '%s,' "${TEST_RESULTS[@]}")
    results_json="[${results_json%,}]"

    # Create complete JSON report
    cat > "$output_file" << EOF
{
  "testSuite": "$test_suite_name",
  "timestamp": "$timestamp",
  "summary": {
    "total": $TESTS_RUN,
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "skipped": $TESTS_SKIPPED
  },
  "tests": $results_json
}
EOF

    log_success "Test results saved to: $output_file"
}

# ============================================================================
# Initialization
# ============================================================================

# Check for required commands
check_dependencies() {
    local missing_deps=()

    for cmd in curl jq; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Please install: brew install curl jq"
        exit 1
    fi
}

# Initialize test environment
init_test_environment() {
    check_dependencies
    check_server_health || exit 1
    check_windchill_server || exit 1
}

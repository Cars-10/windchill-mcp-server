#!/bin/bash

# ============================================================================
# NavCriteria Agent Tests - Development PLM Server
# ============================================================================
# Tests all NavCriteria Agent tools (BOM navigation and filtering)
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="NavCriteria Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: NAVIGATION CRITERIA MANAGEMENT
# ============================================================================

start_test "navcriteria_list_nav_criteria" "List all navigation criteria"
call_tool "navcriteria_list_nav_criteria" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "NavCriteria endpoint not available in this Windchill version"
    else
        CRITERIA_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export CRITERIA_ID
        if [[ -n "$CRITERIA_ID" ]]; then
            log_info "Found navigation criteria ID: $CRITERIA_ID"
        fi
        test_pass
    fi
fi

start_test "navcriteria_search_nav_criteria" "Search navigation criteria"
call_tool "navcriteria_search_nav_criteria" '{"query": "Design", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "NavCriteria search not available"
    else
        test_pass
    fi
fi

if [[ -n "$CRITERIA_ID" ]]; then
    start_test "navcriteria_get_nav_criteria" "Get specific navigation criteria"
    call_tool "navcriteria_get_nav_criteria" "{\"criteriaId\": \"$CRITERIA_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "navcriteria_get_nav_criteria" "Get navigation criteria"
    test_skip "No criteria ID available"
fi

# ============================================================================
# PRIORITY 2: FILTER CONFIGURATION
# ============================================================================

if [[ -n "$CRITERIA_ID" ]]; then
    start_test "navcriteria_get_filter_expression" "Get filter expression"
    call_tool "navcriteria_get_filter_expression" "{\"criteriaId\": \"$CRITERIA_ID\"}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "FilterExpression navigation not available"
        else
            test_pass
        fi
    fi
else
    start_test "navcriteria_get_filter_expression" "Get filter expression"
    test_skip "No criteria ID available"
fi

start_test "navcriteria_list_filter_types" "List available filter types (EXPERIMENTAL)"
call_tool "navcriteria_list_filter_types" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "FilterTypes endpoint not available"
    else
        test_pass
    fi
fi

# ============================================================================
# PRIORITY 3: APPLICATION & USAGE
# ============================================================================

start_test "navcriteria_get_criteria_by_view" "Get criteria by view name"
call_tool "navcriteria_get_criteria_by_view" '{"viewName": "Design", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "View-based filtering not available"
    else
        test_pass
    fi
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

print_summary
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$SCRIPT_DIR/results"
RESULTS_FILE="$SCRIPT_DIR/results/navcriteria-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

#!/bin/bash

# ============================================================================
# Quality Agent Tests - Development PLM Server
# ============================================================================
# Tests all Quality Agent tools
# Requires: Windchill Quality Management Solutions (QMS) module
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="Quality Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: QUALITY INSPECTIONS
# ============================================================================

start_test "quality_list_inspections" "List quality inspections"
call_tool "quality_list_inspections" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Quality inspections endpoint not available - QMS may not be installed"
    else
        INSPECTION_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export INSPECTION_ID
        test_pass
    fi
fi

start_test "quality_search_inspections" "Search quality inspections"
call_tool "quality_search_inspections" '{"query": "Inspection", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Inspection search not available"
    else
        test_pass
    fi
fi

# ============================================================================
# PRIORITY 2: NONCONFORMANCE REPORTS
# ============================================================================

start_test "quality_list_nonconformances" "List nonconformance reports"
call_tool "quality_list_nonconformances" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Nonconformance reports endpoint not available"
    else
        NCR_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export NCR_ID
        test_pass
    fi
fi

start_test "quality_search_nonconformances" "Search NCRs"
call_tool "quality_search_nonconformances" '{"query": "NCR", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "NCR search not available"
    else
        test_pass
    fi
fi

# ============================================================================
# PRIORITY 3: CORRECTIVE ACTIONS
# ============================================================================

start_test "quality_list_corrective_actions" "List corrective actions"
call_tool "quality_list_corrective_actions" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Corrective actions endpoint not available"
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
RESULTS_FILE="$SCRIPT_DIR/results/quality-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

#!/bin/bash

# ============================================================================
# Manufacturing Agent Tests - Development PLM Server
# ============================================================================
# Tests all Manufacturing Agent tools
# Requires: Windchill MPMLink (Manufacturing Process Management) module
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="Manufacturing Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: MANUFACTURING PARTS
# ============================================================================

start_test "manufacturing_list_mfg_parts" "List manufacturing parts"
call_tool "manufacturing_list_mfg_parts" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Manufacturing parts endpoint not available - MPMLink may not be installed"
    else
        MFG_PART_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export MFG_PART_ID
        test_pass
    fi
fi

start_test "manufacturing_search_mfg_parts" "Search manufacturing parts"
call_tool "manufacturing_search_mfg_parts" '{"query": "MFG", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Manufacturing search not available"
    else
        test_pass
    fi
fi

# ============================================================================
# PRIORITY 2: PROCESS PLANS
# ============================================================================

start_test "manufacturing_list_process_plans" "List process plans"
call_tool "manufacturing_list_process_plans" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Process plans endpoint not available"
    else
        PLAN_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export PLAN_ID
        test_pass
    fi
fi

# ============================================================================
# PRIORITY 3: OPERATIONS
# ============================================================================

start_test "manufacturing_list_operations" "List manufacturing operations"
call_tool "manufacturing_list_operations" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Operations endpoint not available"
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
RESULTS_FILE="$SCRIPT_DIR/results/manufacturing-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

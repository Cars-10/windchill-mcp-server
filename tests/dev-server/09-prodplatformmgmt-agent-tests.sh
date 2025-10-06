#!/bin/bash

# ============================================================================
# ProdPlatformMgmt Agent Tests - Development PLM Server
# ============================================================================
# Tests all ProdPlatformMgmt Agent tools (Options & Variants)
# Requires: Windchill Product Platform Management (Options & Variants) module
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="ProdPlatformMgmt Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: OPTION MANAGEMENT
# ============================================================================

start_test "prodplatformmgmt_list_options" "List all options"
call_tool "prodplatformmgmt_list_options" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Options endpoint not available - module may not be installed"
    else
        # Try to extract an option ID for later tests
        OPTION_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export OPTION_ID
        if [[ -n "$OPTION_ID" ]]; then
            log_info "Found option ID: $OPTION_ID"
        fi
        test_pass
    fi
fi

start_test "prodplatformmgmt_search_options" "Search options by name"
call_tool "prodplatformmgmt_search_options" '{"query": "Color", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Options endpoint not available"
    else
        test_pass
    fi
fi

if [[ -n "$OPTION_ID" ]]; then
    start_test "prodplatformmgmt_get_option" "Get specific option details"
    call_tool "prodplatformmgmt_get_option" "{\"optionId\": \"$OPTION_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "prodplatformmgmt_get_option" "Get specific option details"
    test_skip "No option ID available"
fi

if [[ -n "$OPTION_ID" ]]; then
    start_test "prodplatformmgmt_get_option_choices" "Get choices for option"
    call_tool "prodplatformmgmt_get_option_choices" "{\"optionId\": \"$OPTION_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Choices navigation not available"
        else
            test_pass
        fi
    fi
else
    start_test "prodplatformmgmt_get_option_choices" "Get option choices"
    test_skip "No option ID available"
fi

# ============================================================================
# PRIORITY 2: OPTION SET MANAGEMENT
# ============================================================================

start_test "prodplatformmgmt_list_option_sets" "List all option sets"
call_tool "prodplatformmgmt_list_option_sets" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Option sets endpoint not available"
    else
        OPTIONSET_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export OPTIONSET_ID
        if [[ -n "$OPTIONSET_ID" ]]; then
            log_info "Found option set ID: $OPTIONSET_ID"
        fi
        test_pass
    fi
fi

start_test "prodplatformmgmt_search_option_sets" "Search option sets"
call_tool "prodplatformmgmt_search_option_sets" '{"query": "Default", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Option sets not available"
    else
        test_pass
    fi
fi

if [[ -n "$OPTIONSET_ID" ]]; then
    start_test "prodplatformmgmt_get_option_set" "Get specific option set"
    call_tool "prodplatformmgmt_get_option_set" "{\"optionSetId\": \"$OPTIONSET_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "prodplatformmgmt_get_option_set" "Get option set details"
    test_skip "No option set ID available"
fi

if [[ -n "$OPTIONSET_ID" ]]; then
    start_test "prodplatformmgmt_get_option_set_assignments" "Get option set assignments"
    call_tool "prodplatformmgmt_get_option_set_assignments" "{\"optionSetId\": \"$OPTIONSET_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "AssignedObjects navigation not available"
        else
            test_pass
        fi
    fi
else
    start_test "prodplatformmgmt_get_option_set_assignments" "Get assignments"
    test_skip "No option set ID available"
fi

# ============================================================================
# PRIORITY 3: CHOICE MANAGEMENT
# ============================================================================

start_test "prodplatformmgmt_list_choices" "List all choices"
call_tool "prodplatformmgmt_list_choices" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Choices endpoint not available"
    else
        CHOICE_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export CHOICE_ID
        test_pass
    fi
fi

start_test "prodplatformmgmt_search_choices" "Search choices by name"
call_tool "prodplatformmgmt_search_choices" '{"query": "Red", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Choices search not available"
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
RESULTS_FILE="$SCRIPT_DIR/results/prodplatformmgmt-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

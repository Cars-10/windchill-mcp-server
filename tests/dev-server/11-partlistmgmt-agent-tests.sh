#!/bin/bash

# ============================================================================
# PartListMgmt Agent Tests - Development PLM Server
# ============================================================================
# Tests all PartListMgmt Agent tools (parts lists and favorites)
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="PartListMgmt Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: PART LIST MANAGEMENT
# ============================================================================

start_test "partlistmgmt_list_part_lists" "List all part lists"
call_tool "partlistmgmt_list_part_lists" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "PartLists endpoint not available in this Windchill version"
    else
        LIST_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export LIST_ID
        if [[ -n "$LIST_ID" ]]; then
            log_info "Found part list ID: $LIST_ID"
        fi
        test_pass
    fi
fi

start_test "partlistmgmt_search_part_lists" "Search part lists by name"
call_tool "partlistmgmt_search_part_lists" '{"query": "Favorites", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "PartLists search not available"
    else
        test_pass
    fi
fi

if [[ -n "$LIST_ID" ]]; then
    start_test "partlistmgmt_get_part_list" "Get specific part list"
    call_tool "partlistmgmt_get_part_list" "{\"listId\": \"$LIST_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "partlistmgmt_get_part_list" "Get part list details"
    test_skip "No part list ID available"
fi

if [[ -n "$LIST_ID" ]]; then
    start_test "partlistmgmt_get_part_list_items" "Get parts in list"
    call_tool "partlistmgmt_get_part_list_items" "{\"listId\": \"$LIST_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Parts navigation not available"
        else
            test_pass
        fi
    fi
else
    start_test "partlistmgmt_get_part_list_items" "Get list items"
    test_skip "No part list ID available"
fi

start_test "partlistmgmt_get_shared_lists" "Get shared part lists"
call_tool "partlistmgmt_get_shared_lists" '{"limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Shared lists filter not available"
    else
        test_pass
    fi
fi

# ============================================================================
# PRIORITY 2: LIST OPERATIONS (EXPERIMENTAL)
# ============================================================================

start_test "partlistmgmt_create_part_list" "Create new part list (EXPERIMENTAL)"
call_tool "partlistmgmt_create_part_list" '{"name": "Test List", "description": "Automated test list", "shared": false}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "405" || "$LAST_HTTP_CODE" == "501" ]]; then
    if [[ "$LAST_HTTP_CODE" == "405" || "$LAST_HTTP_CODE" == "501" ]]; then
        test_skip "POST operations not supported in OData API"
    else
        TEST_LIST_ID=$(echo "$LAST_RESPONSE" | jq -r '.ID // .id // empty' 2>/dev/null)
        export TEST_LIST_ID
        test_pass
    fi
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

print_summary
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$SCRIPT_DIR/results"
RESULTS_FILE="$SCRIPT_DIR/results/partlistmgmt-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

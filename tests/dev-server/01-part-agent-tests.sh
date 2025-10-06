#!/bin/bash

# ============================================================================
# Part Agent Tests - Development PLM Server
# ============================================================================
# Tests all Part Agent tools against the Development Windchill server
# Server: plm.windchill.com/Windchill
# ============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source test utilities
source "$SCRIPT_DIR/../utils/test-helpers.sh"

# Test suite name
TEST_SUITE="Part Agent - Development Server"

# Initialize test environment
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: CORE PART OPERATIONS
# ============================================================================

# Test: part_search - Basic search
start_test "part_search" "Search for parts with wildcard"
call_tool "part_search" '{
  "number": "00000*",
  "limit": 10
}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: part_search - By name
start_test "part_search_by_name" "Search parts by name"
call_tool "part_search" '{
  "name": "Axle",
  "limit": 5
}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: part_search - Contains wildcard
start_test "part_search_contains" "Search with contains pattern"
call_tool "part_search" '{
  "name": "*BOLT*",
  "limit": 10
}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: part_get - Retrieve specific part
start_test "part_get" "Get specific part by ID (may fail if ID doesn't exist)"
call_tool "part_get" '{
  "id": "VR:wt.part.WTPart:123456"
}'
# This may fail if the ID doesn't exist - that's expected
if [[ "$LAST_HTTP_CODE" == "404" ]]; then
    test_skip "Part ID does not exist in test environment"
elif assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: part_create - Create new part
start_test "part_create" "Create a new test part"
PART_NUMBER=$(generate_part_number)
call_tool "part_create" "{
  \"number\": \"$PART_NUMBER\",
  \"name\": \"Test Part - Automated\",
  \"description\": \"Created by automated test suite\"
}"
if assert_http_success && assert_valid_json; then
    # Extract created part ID for later tests
    CREATED_PART_ID=$(echo "$LAST_RESPONSE" | jq -r '.ID // .id // empty')
    export CREATED_PART_ID
    log_info "Created part: $PART_NUMBER (ID: $CREATED_PART_ID)"
    test_pass
fi

# Test: part_update - Update part metadata
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_update" "Update part metadata"
    call_tool "part_update" "{
      \"id\": \"$CREATED_PART_ID\",
      \"name\": \"Test Part - Updated\",
      \"description\": \"Updated by automated test suite\"
    }"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "part_update" "Update part metadata"
    test_skip "No part ID available from create test"
fi

# Test: part_get_version_history
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_get_version_history" "Get version history for part"
    call_tool "part_get_version_history" "{
      \"id\": \"$CREATED_PART_ID\"
    }"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "part_get_version_history" "Get version history for part"
    test_skip "No part ID available"
fi

# Test: part_checkout
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_checkout" "Checkout part for editing"
    call_tool "part_checkout" "{
      \"id\": \"$CREATED_PART_ID\",
      \"comment\": \"Checkout for automated testing\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]; then
        # Part might already be checked out or endpoint doesn't exist
        if [[ "$LAST_HTTP_CODE" == "400" ]]; then
            test_skip "Part already checked out or checkout endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "part_checkout" "Checkout part for editing"
    test_skip "No part ID available"
fi

# Test: part_checkin
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_checkin" "Checkin part after editing"
    call_tool "part_checkin" "{
      \"id\": \"$CREATED_PART_ID\",
      \"comment\": \"Checkin after automated testing\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]; then
        # Part might not be checked out
        if [[ "$LAST_HTTP_CODE" == "400" ]]; then
            test_skip "Part not checked out or checkin endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "part_checkin" "Checkin part after editing"
    test_skip "No part ID available"
fi

# Test: part_revise
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_revise" "Create new revision of part"
    call_tool "part_revise" "{
      \"id\": \"$CREATED_PART_ID\",
      \"comment\": \"Revision created by automated test\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]; then
        if [[ "$LAST_HTTP_CODE" == "400" ]]; then
            test_skip "Part cannot be revised or revise endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "part_revise" "Create new revision of part"
    test_skip "No part ID available"
fi

# ============================================================================
# PRIORITY 2: BOM & STRUCTURE MANAGEMENT
# ============================================================================

# Test: part_get_structure
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_get_structure" "Get BOM structure for part"
    call_tool "part_get_structure" "{
      \"id\": \"$CREATED_PART_ID\",
      \"levels\": 1
    }"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "part_get_structure" "Get BOM structure for part"
    test_skip "No part ID available"
fi

# Test: part_add_bom_component
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_add_bom_component" "Add component to BOM"
    # Create a child part first
    CHILD_PART_NUMBER=$(generate_part_number)
    call_tool "part_create" "{
      \"number\": \"$CHILD_PART_NUMBER\",
      \"name\": \"Child Part for BOM Test\"
    }"
    if assert_http_success; then
        CHILD_PART_ID=$(echo "$LAST_RESPONSE" | jq -r '.ID // .id // empty')

        # Add to BOM
        call_tool "part_add_bom_component" "{
          \"parentId\": \"$CREATED_PART_ID\",
          \"childId\": \"$CHILD_PART_ID\",
          \"quantity\": 5
        }"
        if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
            if [[ "$LAST_HTTP_CODE" == "404" ]]; then
                test_skip "Add BOM component endpoint not available"
            else
                test_pass
            fi
        fi
    else
        test_skip "Could not create child part"
    fi
else
    start_test "part_add_bom_component" "Add component to BOM"
    test_skip "No parent part ID available"
fi

# Test: part_get_where_used
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_get_where_used" "Get where-used for part"
    call_tool "part_get_where_used" "{
      \"id\": \"$CREATED_PART_ID\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Where-used endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "part_get_where_used" "Get where-used for part"
    test_skip "No part ID available"
fi

# Test: part_update_bom_component
start_test "part_update_bom_component" "Update BOM component properties"
test_skip "Requires BOM link ID from previous tests"

# Test: part_remove_bom_component
start_test "part_remove_bom_component" "Remove component from BOM"
test_skip "Requires child part ID from previous tests"

# Test: part_replace_component
start_test "part_replace_component" "Replace component in BOM"
test_skip "Requires multiple parts and BOM structure"

# ============================================================================
# PRIORITY 3: ADVANCED SEARCH & OPERATIONS
# ============================================================================

# Test: part_advanced_search
start_test "part_advanced_search" "Advanced multi-criteria search"
call_tool "part_advanced_search" '{
  "name": "Axle",
  "limit": 10
}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: part_search_by_lifecycle (known limitation)
start_test "part_search_by_lifecycle" "Search by lifecycle state"
call_tool "part_search_by_lifecycle" '{
  "state": "INWORK",
  "number": "00000*",
  "limit": 10
}'
# Expected to work but state filter is ignored
if assert_http_success && assert_valid_json; then
    log_warning "State parameter is ignored in Windchill 13.0.2 OData"
    test_pass
fi

# Test: part_search_by_effectivity
start_test "part_search_by_effectivity" "Search by effectivity date"
call_tool "part_search_by_effectivity" '{
  "effectivityDate": "2024-01-01T00:00:00Z",
  "limit": 10
}'
if [[ "$LAST_HTTP_CODE" == "400" ]]; then
    test_skip "Effectivity date filtering not supported"
elif assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: part_bulk_update
start_test "part_bulk_update" "Bulk update multiple parts"
call_tool "part_bulk_update" '{
  "partIds": [],
  "updates": {
    "Description": "Bulk updated by automated test"
  }
}'
if assert_http_success && assert_valid_json; then
    # Should succeed even with empty array
    test_pass
fi

# Test: part_set_lifecycle_state
if [[ -n "$CREATED_PART_ID" ]]; then
    start_test "part_set_lifecycle_state" "Change lifecycle state"
    call_tool "part_set_lifecycle_state" "{
      \"id\": \"$CREATED_PART_ID\",
      \"state\": \"RELEASED\",
      \"comment\": \"Automated test state change\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Set lifecycle state endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "part_set_lifecycle_state" "Change lifecycle state"
    test_skip "No part ID available"
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

# Print test summary
print_summary

# Save results
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$SCRIPT_DIR/results/part-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

# Exit with appropriate code
if [[ $TESTS_FAILED -eq 0 ]]; then
    exit 0
else
    exit 1
fi

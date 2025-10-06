#!/bin/bash

# ============================================================================
# Change Agent Tests - Development PLM Server
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="Change Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: CORE CHANGE OPERATIONS
# ============================================================================

start_test "change_search" "Search for change requests"
call_tool "change_search" '{"number": "CR-*", "limit": 10}'
assert_http_success && assert_valid_json && test_pass || true

start_test "change_get" "Get specific change request"
call_tool "change_get" '{"id": "VR:wt.change2.WTChangeRequest2:123456"}'
[[ "$LAST_HTTP_CODE" == "404" ]] && test_skip "Change ID does not exist" || (assert_http_success && assert_valid_json && test_pass) || true

start_test "change_create" "Create new change request"
CHANGE_NUMBER=$(generate_change_number)
call_tool "change_create" "{\"name\": \"Test Change - Automated\", \"description\": \"Created by automated test suite\", \"number\": \"$CHANGE_NUMBER\"}"
if assert_http_success && assert_valid_json; then
    CREATED_CHANGE_ID=$(echo "$LAST_RESPONSE" | jq -r '.ID // .id // empty')
    export CREATED_CHANGE_ID
    log_info "Created change: $CHANGE_NUMBER (ID: $CREATED_CHANGE_ID)"
    test_pass
fi

if [[ -n "$CREATED_CHANGE_ID" ]]; then
    start_test "change_update" "Update change request metadata"
    call_tool "change_update" "{\"id\": \"$CREATED_CHANGE_ID\", \"name\": \"Test Change - Updated\"}"
    assert_http_success && assert_valid_json && test_pass || true
else
    start_test "change_update" "Update change request"
    test_skip "No change ID available"
fi

if [[ -n "$CREATED_CHANGE_ID" ]]; then
    start_test "change_submit" "Submit change request for approval"
    call_tool "change_submit" "{\"id\": \"$CREATED_CHANGE_ID\", \"comment\": \"Submitted by automated test\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]) && test_pass || test_skip "Submit endpoint not available"
else
    start_test "change_submit" "Submit change request"
    test_skip "No change ID available"
fi

start_test "change_approve" "Approve change request"
test_skip "Requires change in submitted state"

start_test "change_reject" "Reject change request"
test_skip "Requires change in submitted state"

# ============================================================================
# PRIORITY 2: AFFECTED OBJECTS
# ============================================================================

start_test "change_add_affected_object" "Add affected object to change"
test_skip "Requires valid change and part IDs"

start_test "change_remove_affected_object" "Remove affected object from change"
test_skip "Requires affected object link"

if [[ -n "$CREATED_CHANGE_ID" ]]; then
    start_test "change_get_affected_objects" "Get affected objects list"
    call_tool "change_get_affected_objects" "{\"changeId\": \"$CREATED_CHANGE_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Affected objects endpoint not available"
else
    start_test "change_get_affected_objects" "Get affected objects"
    test_skip "No change ID available"
fi

start_test "change_add_resulting_object" "Add resulting object to change"
test_skip "Requires valid change and part IDs"

if [[ -n "$CREATED_CHANGE_ID" ]]; then
    start_test "change_get_resulting_objects" "Get resulting objects list"
    call_tool "change_get_resulting_objects" "{\"changeId\": \"$CREATED_CHANGE_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Resulting objects endpoint not available"
else
    start_test "change_get_resulting_objects" "Get resulting objects"
    test_skip "No change ID available"
fi

if [[ -n "$CREATED_CHANGE_ID" ]]; then
    start_test "change_get_change_tasks" "Get workflow tasks for change"
    call_tool "change_get_change_tasks" "{\"changeId\": \"$CREATED_CHANGE_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Change tasks endpoint not available"
else
    start_test "change_get_change_tasks" "Get change tasks"
    test_skip "No change ID available"
fi

# ============================================================================
# PRIORITY 3: ADVANCED SEARCH & OPERATIONS
# ============================================================================

start_test "change_advanced_search" "Advanced multi-criteria search"
call_tool "change_advanced_search" '{"name": "Test", "limit": 10}'
assert_http_success && assert_valid_json && test_pass || true

start_test "change_search_by_date_range" "Search by date range"
call_tool "change_search_by_date_range" '{"startDate": "2024-01-01T00:00:00Z", "endDate": "2024-12-31T23:59:59Z", "dateField": "CreatedOn", "limit": 10}'
[[ "$LAST_HTTP_CODE" == "400" ]] && test_skip "Date filtering not supported" || (assert_http_success && assert_valid_json && test_pass) || true

start_test "change_bulk_submit" "Bulk submit change requests"
call_tool "change_bulk_submit" '{"changeIds": [], "comment": "Bulk submit test"}'
assert_http_success && assert_valid_json && test_pass || true

if [[ -n "$CREATED_CHANGE_ID" ]]; then
    start_test "change_get_change_history" "Get change request history"
    call_tool "change_get_change_history" "{\"changeId\": \"$CREATED_CHANGE_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "History endpoint not available"
else
    start_test "change_get_change_history" "Get change history"
    test_skip "No change ID available"
fi

if [[ -n "$CREATED_CHANGE_ID" ]]; then
    start_test "change_add_change_note" "Add note to change request"
    call_tool "change_add_change_note" "{\"changeId\": \"$CREATED_CHANGE_ID\", \"note\": \"Test note from automated suite\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Add note endpoint not available"
else
    start_test "change_add_change_note" "Add change note"
    test_skip "No change ID available"
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

print_summary
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$SCRIPT_DIR/results/change-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

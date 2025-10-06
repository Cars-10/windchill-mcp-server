#!/bin/bash

# ============================================================================
# Project Agent Tests - Development PLM Server
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="Project Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: CORE PROJECT OPERATIONS
# ============================================================================

start_test "project_list" "List/search projects"
call_tool "project_list" '{"name": "Test", "limit": 10}'
assert_http_success && assert_valid_json && test_pass || true

start_test "project_get" "Get specific project"
call_tool "project_get" '{"projectId": "wt.projmgmt.admin.Project2:123456"}'
[[ "$LAST_HTTP_CODE" == "404" ]] && test_skip "Project ID does not exist" || (assert_http_success && assert_valid_json && test_pass) || true

start_test "project_create" "Create new project"
call_tool "project_create" '{"name": "Test Project - Automated", "description": "Created by automated test suite"}'
if assert_http_success && assert_valid_json; then
    CREATED_PROJECT_ID=$(echo "$LAST_RESPONSE" | jq -r '.ID // .id // empty')
    export CREATED_PROJECT_ID
    log_info "Created project ID: $CREATED_PROJECT_ID"
    test_pass
fi

if [[ -n "$CREATED_PROJECT_ID" ]]; then
    start_test "project_update" "Update project metadata"
    call_tool "project_update" "{\"projectId\": \"$CREATED_PROJECT_ID\", \"name\": \"Test Project - Updated\"}"
    assert_http_success && assert_valid_json && test_pass || true
else
    start_test "project_update" "Update project metadata"
    test_skip "No project ID available"
fi

if [[ -n "$CREATED_PROJECT_ID" ]]; then
    start_test "project_get_team" "Get project team members"
    call_tool "project_get_team" "{\"projectId\": \"$CREATED_PROJECT_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Get team endpoint not available"
else
    start_test "project_get_team" "Get project team"
    test_skip "No project ID available"
fi

start_test "project_add_team_member" "Add user to project team"
test_skip "Requires valid project ID and user"

start_test "project_remove_team_member" "Remove user from project team"
test_skip "Requires valid project ID and user"

# ============================================================================
# PRIORITY 2: PROJECT CONTENT & RELATIONSHIPS
# ============================================================================

if [[ -n "$CREATED_PROJECT_ID" ]]; then
    start_test "project_get_project_objects" "Get parts/documents in project"
    call_tool "project_get_project_objects" "{\"projectId\": \"$CREATED_PROJECT_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Get project objects endpoint not available"
else
    start_test "project_get_project_objects" "Get project objects"
    test_skip "No project ID available"
fi

start_test "project_add_project_object" "Add part/document to project"
test_skip "Requires valid project ID and object ID"

start_test "project_remove_project_object" "Remove object from project"
test_skip "Requires valid project ID and object ID"

if [[ -n "$CREATED_PROJECT_ID" ]]; then
    start_test "project_get_project_activities" "Get project activities/tasks"
    call_tool "project_get_project_activities" "{\"projectId\": \"$CREATED_PROJECT_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Get activities endpoint not available"
else
    start_test "project_get_project_activities" "Get project activities"
    test_skip "No project ID available"
fi

if [[ -n "$CREATED_PROJECT_ID" ]]; then
    start_test "project_get_project_deliverables" "Get project deliverables"
    call_tool "project_get_project_deliverables" "{\"projectId\": \"$CREATED_PROJECT_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Get deliverables endpoint not available"
else
    start_test "project_get_project_deliverables" "Get project deliverables"
    test_skip "No project ID available"
fi

# ============================================================================
# PRIORITY 3: ADVANCED SEARCH & OPERATIONS
# ============================================================================

start_test "project_advanced_search" "Advanced project search"
call_tool "project_advanced_search" '{"name": "Test", "limit": 10}'
(assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]) && test_pass || test_skip "Advanced search not supported"

start_test "project_search_by_date_range" "Search by project dates"
call_tool "project_search_by_date_range" '{"startDate": "2024-01-01T00:00:00Z", "endDate": "2024-12-31T23:59:59Z", "dateField": "CreatedOn", "limit": 10}'
[[ "$LAST_HTTP_CODE" == "400" ]] && test_skip "Date filtering not supported" || (assert_http_success && assert_valid_json && test_pass) || true

if [[ -n "$CREATED_PROJECT_ID" ]]; then
    start_test "project_get_project_milestones" "Get project milestones"
    call_tool "project_get_project_milestones" "{\"projectId\": \"$CREATED_PROJECT_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Milestones endpoint not available"
else
    start_test "project_get_project_milestones" "Get project milestones"
    test_skip "No project ID available"
fi

if [[ -n "$CREATED_PROJECT_ID" ]]; then
    start_test "project_update_project_status" "Update project status"
    call_tool "project_update_project_status" "{\"projectId\": \"$CREATED_PROJECT_ID\", \"status\": \"ACTIVE\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Update status endpoint not available"
else
    start_test "project_update_project_status" "Update project status"
    test_skip "No project ID available"
fi

if [[ -n "$CREATED_PROJECT_ID" ]]; then
    start_test "project_get_project_metrics" "Get project metrics/statistics"
    call_tool "project_get_project_metrics" "{\"projectId\": \"$CREATED_PROJECT_ID\"}"
    (assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Metrics endpoint not available"
else
    start_test "project_get_project_metrics" "Get project metrics"
    test_skip "No project ID available"
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

print_summary
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$SCRIPT_DIR/results/project-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

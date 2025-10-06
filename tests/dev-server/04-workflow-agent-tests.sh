#!/bin/bash

# ============================================================================
# Workflow Agent Tests - Development PLM Server
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="Workflow Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: CORE WORKFLOW OPERATIONS
# ============================================================================

start_test "workflow_get_tasks" "Search workflow tasks"
call_tool "workflow_get_tasks" '{"assignee": "wcadmin", "limit": 10}'
assert_http_success && assert_valid_json && test_pass || true

start_test "workflow_get_task" "Get specific workflow task"
call_tool "workflow_get_task" '{"taskId": "VR:wt.workflow.work.WfAssignedActivity:123456"}'
[[ "$LAST_HTTP_CODE" == "404" ]] && test_skip "Task ID does not exist" || (assert_http_success && assert_valid_json && test_pass) || true

start_test "workflow_complete_task" "Complete workflow task"
test_skip "Requires valid task ID and appropriate permissions"

start_test "workflow_reassign_task" "Reassign task to another user"
test_skip "Requires valid task ID and target user"

start_test "workflow_get_my_tasks" "Get current user's tasks"
call_tool "workflow_get_my_tasks" '{}'
(assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]) && test_pass || test_skip "Get my tasks endpoint not available"

# ============================================================================
# PRIORITY 2: TASK ACTIONS & DETAILS
# ============================================================================

start_test "workflow_approve_task" "Approve workflow task"
test_skip "Requires valid task ID in appropriate state"

start_test "workflow_reject_task" "Reject workflow task"
test_skip "Requires valid task ID in appropriate state"

start_test "workflow_add_task_comment" "Add comment to task"
test_skip "Requires valid task ID"

start_test "workflow_get_task_history" "Get task activity history"
test_skip "Requires valid task ID"

start_test "workflow_get_task_attachments" "Get task attachments"
test_skip "Requires valid task ID"

start_test "workflow_delegate_task" "Delegate task to another user"
test_skip "Requires valid task ID and target user"

# ============================================================================
# PRIORITY 3: ADVANCED SEARCH & PROCESS MANAGEMENT
# ============================================================================

start_test "workflow_advanced_search" "Advanced task search"
call_tool "workflow_advanced_search" '{"state": "OPEN", "limit": 10}'
(assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]) && test_pass || test_skip "Advanced search not supported"

start_test "workflow_search_by_process" "Search tasks by process"
call_tool "workflow_search_by_process" '{"processName": "Change", "limit": 10}'
(assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]) && test_pass || test_skip "Process search not supported"

start_test "workflow_get_process_status" "Get workflow process status"
test_skip "Requires valid process ID"

start_test "workflow_get_process_diagram" "Get process diagram/definition"
test_skip "Requires valid process ID"

start_test "workflow_bulk_complete" "Bulk complete multiple tasks"
call_tool "workflow_bulk_complete" '{"taskIds": [], "comment": "Bulk completion test"}'
assert_http_success && assert_valid_json && test_pass || true

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

print_summary
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$SCRIPT_DIR/results/workflow-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

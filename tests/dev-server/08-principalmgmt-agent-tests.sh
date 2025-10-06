#!/bin/bash

# ============================================================================
# PrincipalMgmt Agent Tests - Development PLM Server
# ============================================================================
# Tests all PrincipalMgmt Agent tools against the Development Windchill server
# Server: plm.windchill.com/Windchill
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="PrincipalMgmt Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: USER MANAGEMENT
# ============================================================================

start_test "principalmgmt_list_users" "List all users"
call_tool "principalmgmt_list_users" '{"limit": 20}'
if assert_http_success && assert_valid_json; then
    # Try to extract a user ID for later tests
    USER_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
    export USER_ID
    if [[ -n "$USER_ID" ]]; then
        log_info "Found user ID: $USER_ID"
    fi
    test_pass
fi

start_test "principalmgmt_list_users_active" "List active users only"
call_tool "principalmgmt_list_users" '{"active": true, "limit": 10}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

start_test "principalmgmt_search_users" "Search users by name"
call_tool "principalmgmt_search_users" '{"query": "admin", "limit": 10}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

start_test "principalmgmt_search_users_by_email" "Search users by email"
call_tool "principalmgmt_search_users" '{"email": "@", "limit": 10}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

if [[ -n "$USER_ID" ]]; then
    start_test "principalmgmt_get_user" "Get specific user details"
    call_tool "principalmgmt_get_user" "{\"userId\": \"$USER_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "principalmgmt_get_user" "Get specific user details"
    test_skip "No user ID available from list test"
fi

if [[ -n "$USER_ID" ]]; then
    start_test "principalmgmt_get_user_groups" "Get user's groups"
    call_tool "principalmgmt_get_user_groups" "{\"userId\": \"$USER_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Groups navigation property not available"
        else
            test_pass
        fi
    fi
else
    start_test "principalmgmt_get_user_groups" "Get user's groups"
    test_skip "No user ID available"
fi

if [[ -n "$USER_ID" ]]; then
    start_test "principalmgmt_get_user_teams" "Get user's teams"
    call_tool "principalmgmt_get_user_teams" "{\"userId\": \"$USER_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Teams navigation property not available"
        else
            test_pass
        fi
    fi
else
    start_test "principalmgmt_get_user_teams" "Get user's teams"
    test_skip "No user ID available"
fi

# ============================================================================
# PRIORITY 2: GROUP MANAGEMENT
# ============================================================================

start_test "principalmgmt_list_groups" "List all groups"
call_tool "principalmgmt_list_groups" '{"limit": 20}'
if assert_http_success && assert_valid_json; then
    # Try to extract a group ID for later tests
    GROUP_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
    export GROUP_ID
    if [[ -n "$GROUP_ID" ]]; then
        log_info "Found group ID: $GROUP_ID"
    fi
    test_pass
fi

start_test "principalmgmt_search_groups" "Search groups by name"
call_tool "principalmgmt_search_groups" '{"query": "Administrator", "limit": 10}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

if [[ -n "$GROUP_ID" ]]; then
    start_test "principalmgmt_get_group" "Get specific group details"
    call_tool "principalmgmt_get_group" "{\"groupId\": \"$GROUP_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "principalmgmt_get_group" "Get specific group details"
    test_skip "No group ID available from list test"
fi

if [[ -n "$GROUP_ID" ]]; then
    start_test "principalmgmt_get_group_members" "Get group members"
    call_tool "principalmgmt_get_group_members" "{\"groupId\": \"$GROUP_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Members navigation property not available"
        else
            test_pass
        fi
    fi
else
    start_test "principalmgmt_get_group_members" "Get group members"
    test_skip "No group ID available"
fi

# ============================================================================
# PRIORITY 3: TEAM MANAGEMENT
# ============================================================================

start_test "principalmgmt_list_teams" "List all teams"
call_tool "principalmgmt_list_teams" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Teams endpoint not available in this Windchill version"
    else
        # Try to extract a team ID for later tests
        TEAM_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export TEAM_ID
        if [[ -n "$TEAM_ID" ]]; then
            log_info "Found team ID: $TEAM_ID"
        fi
        test_pass
    fi
fi

start_test "principalmgmt_search_teams" "Search teams by name"
call_tool "principalmgmt_search_teams" '{"query": "Team", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Teams endpoint not available"
    else
        test_pass
    fi
fi

if [[ -n "$TEAM_ID" ]]; then
    start_test "principalmgmt_get_team" "Get specific team details"
    call_tool "principalmgmt_get_team" "{\"teamId\": \"$TEAM_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "principalmgmt_get_team" "Get specific team details"
    test_skip "No team ID available"
fi

if [[ -n "$TEAM_ID" ]]; then
    start_test "principalmgmt_get_team_members" "Get team members with roles"
    call_tool "principalmgmt_get_team_members" "{\"teamId\": \"$TEAM_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Team Members navigation not available"
        else
            test_pass
        fi
    fi
else
    start_test "principalmgmt_get_team_members" "Get team members"
    test_skip "No team ID available"
fi

# ============================================================================
# PRIORITY 4: ROLE MANAGEMENT (EXPERIMENTAL)
# ============================================================================

start_test "principalmgmt_list_roles" "List all roles (EXPERIMENTAL)"
call_tool "principalmgmt_list_roles" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Roles endpoint not available - may require custom configuration"
    else
        test_pass
    fi
fi

if [[ -n "$USER_ID" ]]; then
    start_test "principalmgmt_get_user_roles" "Get user role assignments (EXPERIMENTAL)"
    call_tool "principalmgmt_get_user_roles" "{\"userId\": \"$USER_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "User Roles navigation not available"
        else
            test_pass
        fi
    fi
else
    start_test "principalmgmt_get_user_roles" "Get user roles"
    test_skip "No user ID available"
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

print_summary
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$SCRIPT_DIR/results"
RESULTS_FILE="$SCRIPT_DIR/results/principalmgmt-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

#!/bin/bash

# ============================================================================
# DataAdmin Agent Tests - Development PLM Server
# ============================================================================
# Tests all DataAdmin Agent tools against the Development Windchill server
# Server: plm.windchill.com/Windchill
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="DataAdmin Agent - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# PRIORITY 1: CONTAINER DISCOVERY
# ============================================================================

start_test "dataadmin_list_containers" "List all containers"
call_tool "dataadmin_list_containers" '{"limit": 20}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

start_test "dataadmin_list_products" "List all product containers"
call_tool "dataadmin_list_products" '{"limit": 10}'
if assert_http_success && assert_valid_json; then
    # Try to extract a product ID for later tests
    PRODUCT_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
    export PRODUCT_ID
    if [[ -n "$PRODUCT_ID" ]]; then
        log_info "Found product ID: $PRODUCT_ID"
    fi
    test_pass
fi

start_test "dataadmin_list_libraries" "List all library containers"
call_tool "dataadmin_list_libraries" '{"limit": 10}'
if assert_http_success && assert_valid_json; then
    # Try to extract a library ID for later tests
    LIBRARY_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
    export LIBRARY_ID
    if [[ -n "$LIBRARY_ID" ]]; then
        log_info "Found library ID: $LIBRARY_ID"
    fi
    test_pass
fi

start_test "dataadmin_list_organizations" "List all organization containers"
call_tool "dataadmin_list_organizations" '{"limit": 10}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

start_test "dataadmin_list_projects" "List all project containers"
call_tool "dataadmin_list_projects" '{"limit": 10}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test with filter
start_test "dataadmin_list_products_filtered" "List products with name filter"
call_tool "dataadmin_list_products" '{"name": "Demo", "limit": 5}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: get_container - Get specific container
if [[ -n "$PRODUCT_ID" ]]; then
    start_test "dataadmin_get_container" "Get specific container by ID"
    call_tool "dataadmin_get_container" "{\"containerId\": \"$PRODUCT_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "dataadmin_get_container" "Get specific container"
    test_skip "No product ID available from list test"
fi

# Test: get_site_container
start_test "dataadmin_get_site_container" "Get site container information"
call_tool "dataadmin_get_site_container" '{}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# ============================================================================
# PRIORITY 2: CONTAINER CONTENT & STRUCTURE
# ============================================================================

if [[ -n "$PRODUCT_ID" ]]; then
    start_test "dataadmin_get_container_folders" "Get folders in container"
    call_tool "dataadmin_get_container_folders" "{\"containerId\": \"$PRODUCT_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Folders navigation property not available"
        else
            FOLDER_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
            export FOLDER_ID
            test_pass
        fi
    fi
else
    start_test "dataadmin_get_container_folders" "Get folders in container"
    test_skip "No container ID available"
fi

if [[ -n "$PRODUCT_ID" && -n "$FOLDER_ID" ]]; then
    start_test "dataadmin_get_folder_contents" "Get folder contents"
    call_tool "dataadmin_get_folder_contents" "{\"containerId\": \"$PRODUCT_ID\", \"folderId\": \"$FOLDER_ID\", \"limit\": 10}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Folder contents endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "dataadmin_get_folder_contents" "Get folder contents"
    test_skip "No container ID or folder ID available"
fi

start_test "dataadmin_search_containers" "Advanced container search"
call_tool "dataadmin_search_containers" '{"name": "Demo", "type": "Product", "limit": 5}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

start_test "dataadmin_search_containers_all_types" "Search all container types"
call_tool "dataadmin_search_containers" '{"limit": 20}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# ============================================================================
# PRIORITY 3: PRODUCT/LIBRARY OPTIONS
# ============================================================================

if [[ -n "$PRODUCT_ID" ]]; then
    start_test "dataadmin_get_product_options" "Get product option pool"
    call_tool "dataadmin_get_product_options" "{\"productId\": \"$PRODUCT_ID\"}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "OptionPool not configured for this product or not available"
        else
            test_pass
        fi
    fi
else
    start_test "dataadmin_get_product_options" "Get product option pool"
    test_skip "No product ID available"
fi

if [[ -n "$PRODUCT_ID" ]]; then
    start_test "dataadmin_get_product_option_groups" "Get product option groups"
    call_tool "dataadmin_get_product_options" "{\"productId\": \"$PRODUCT_ID\", \"optionType\": \"OptionGroup\"}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "OptionPool/OptionGroup not available"
        else
            test_pass
        fi
    fi
else
    start_test "dataadmin_get_product_option_groups" "Get product option groups"
    test_skip "No product ID available"
fi

if [[ -n "$LIBRARY_ID" ]]; then
    start_test "dataadmin_get_library_options" "Get library option pool"
    call_tool "dataadmin_get_library_options" "{\"libraryId\": \"$LIBRARY_ID\"}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "OptionPool not configured for this library or not available"
        else
            test_pass
        fi
    fi
else
    start_test "dataadmin_get_library_options" "Get library option pool"
    test_skip "No library ID available"
fi

if [[ -n "$PRODUCT_ID" ]]; then
    start_test "dataadmin_get_option_sets" "Get assigned option sets for product"
    call_tool "dataadmin_get_option_sets" "{\"containerId\": \"$PRODUCT_ID\", \"containerType\": \"Product\"}"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "AssignedOptionSet not available or not configured"
        else
            test_pass
        fi
    fi
else
    start_test "dataadmin_get_option_sets" "Get assigned option sets"
    test_skip "No product ID available"
fi

# Test with expansion
start_test "dataadmin_list_products_with_expansion" "List products with OptionPool expansion"
call_tool "dataadmin_list_products" '{"expand": "OptionPool", "limit": 5}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]; then
    if [[ "$LAST_HTTP_CODE" == "400" ]]; then
        test_skip "OptionPool expansion not supported in this Windchill version"
    else
        test_pass
    fi
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

print_summary
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$SCRIPT_DIR/results/dataadmin-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

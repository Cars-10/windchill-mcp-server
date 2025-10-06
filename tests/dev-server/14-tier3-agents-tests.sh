#!/bin/bash

# ============================================================================
# Tier 3 Agents Tests - Development PLM Server
# ============================================================================
# Tests for specialized feature agents:
# - Visualization, Effectivity, CADDocument, Classification, SavedSearch,
#   ServiceInfo, and PTC agents
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="Tier 3 Agents - Development Server"
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# VISUALIZATION AGENT
# ============================================================================

start_test "visualization_list_visualizations" "List visualizations"
call_tool "visualization_list_visualizations" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Visualization endpoint not available - Creo View may not be installed"
    else
        test_pass
    fi
fi

start_test "visualization_get_thumbnail" "Get object thumbnail (EXPERIMENTAL)"
call_tool "visualization_get_thumbnail" '{"objectId": "VR:wt.part.WTPart:12345"}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" || "$LAST_HTTP_CODE" == "400" ]]; then
    if [[ "$LAST_HTTP_CODE" != "200" ]]; then
        test_skip "Thumbnail endpoint not available or invalid object ID"
    else
        test_pass
    fi
fi

# ============================================================================
# EFFECTIVITY MANAGEMENT AGENT
# ============================================================================

start_test "effectivitymgmt_list_effectivities" "List effectivity definitions"
call_tool "effectivitymgmt_list_effectivities" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Effectivity endpoint not available"
    else
        EFFECTIVITY_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export EFFECTIVITY_ID
        test_pass
    fi
fi

start_test "effectivitymgmt_list_effectivities_by_type" "List date effectivities"
call_tool "effectivitymgmt_list_effectivities" '{"effectivityType": "Date", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Date effectivity filtering not available"
    else
        test_pass
    fi
fi

# ============================================================================
# CAD DOCUMENT MANAGEMENT AGENT
# ============================================================================

start_test "caddocumentmgmt_list_cad_documents" "List CAD documents"
call_tool "caddocumentmgmt_list_cad_documents" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "CAD documents endpoint not available"
    else
        CAD_DOC_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export CAD_DOC_ID
        test_pass
    fi
fi

start_test "caddocumentmgmt_list_cad_by_type" "List CAD docs by type"
call_tool "caddocumentmgmt_list_cad_documents" '{"cadType": "Creo", "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "CAD type filtering not available"
    else
        test_pass
    fi
fi

# ============================================================================
# CLASSIFICATION STRUCTURE AGENT
# ============================================================================

start_test "clfstructure_list_classification_nodes" "List classification nodes"
call_tool "clfstructure_list_classification_nodes" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Classification endpoint not available"
    else
        CLASSIFICATION_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export CLASSIFICATION_ID
        test_pass
    fi
fi

if [[ -n "$CLASSIFICATION_ID" ]]; then
    start_test "clfstructure_get_classification_node" "Get classification node details"
    call_tool "clfstructure_get_classification_node" "{\"nodeId\": \"$CLASSIFICATION_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "clfstructure_get_classification_node" "Get node details"
    test_skip "No classification node ID available"
fi

# ============================================================================
# SAVED SEARCH AGENT
# ============================================================================

start_test "savedsearch_list_saved_searches" "List saved searches"
call_tool "savedsearch_list_saved_searches" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Saved searches endpoint not available"
    else
        SEARCH_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export SEARCH_ID
        test_pass
    fi
fi

if [[ -n "$SEARCH_ID" ]]; then
    start_test "savedsearch_get_saved_search" "Get saved search details"
    call_tool "savedsearch_get_saved_search" "{\"searchId\": \"$SEARCH_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "savedsearch_get_saved_search" "Get search details"
    test_skip "No saved search ID available"
fi

start_test "savedsearch_list_shared_searches" "List shared searches"
call_tool "savedsearch_list_saved_searches" '{"shared": true, "limit": 10}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Shared searches filtering not available"
    else
        test_pass
    fi
fi

# ============================================================================
# SERVICE INFO MANAGEMENT AGENT
# ============================================================================

start_test "serviceinfomgmt_list_service_documents" "List service documents"
call_tool "serviceinfomgmt_list_service_documents" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Service info endpoint not available - module may not be installed"
    else
        SERVICE_DOC_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export SERVICE_DOC_ID
        test_pass
    fi
fi

if [[ -n "$SERVICE_DOC_ID" ]]; then
    start_test "serviceinfomgmt_get_service_document" "Get service document details"
    call_tool "serviceinfomgmt_get_service_document" "{\"documentId\": \"$SERVICE_DOC_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "serviceinfomgmt_get_service_document" "Get service doc details"
    test_skip "No service document ID available"
fi

# ============================================================================
# PTC AGENT (COMMON UTILITIES)
# ============================================================================

start_test "ptc_list_entities" "List PTC common entities (EXPERIMENTAL)"
call_tool "ptc_list_entities" '{"limit": 20}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "PTC entities endpoint not available"
    else
        PTC_ENTITY_ID=$(echo "$LAST_RESPONSE" | jq -r '.value[0].ID // .value[0].id // empty' 2>/dev/null)
        export PTC_ENTITY_ID
        test_pass
    fi
fi

if [[ -n "$PTC_ENTITY_ID" ]]; then
    start_test "ptc_get_entity" "Get PTC entity details"
    call_tool "ptc_get_entity" "{\"entityId\": \"$PTC_ENTITY_ID\"}"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "ptc_get_entity" "Get entity details"
    test_skip "No PTC entity ID available"
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

print_summary
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$SCRIPT_DIR/results"
RESULTS_FILE="$SCRIPT_DIR/results/tier3-agents-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1

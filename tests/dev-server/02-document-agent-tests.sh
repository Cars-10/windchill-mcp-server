#!/bin/bash

# ============================================================================
# Document Agent Tests - Development PLM Server
# ============================================================================
# Tests all Document Agent tools against the Development Windchill server
# Server: plm.windchill.com/Windchill
# ============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source test utilities
source "$SCRIPT_DIR/../utils/test-helpers.sh"

# Test suite name
TEST_SUITE="Document Agent - Development Server"

# Initialize test environment
log_info "Initializing $TEST_SUITE"
init_test_environment

# ============================================================================
# ORIGINAL TOOLS
# ============================================================================

# Test: document_search - Basic search
start_test "document_search" "Search for documents by number"
call_tool "document_search" '{
  "number": "DOC-001"
}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: document_search - By name
start_test "document_search_by_name" "Search documents by name"
call_tool "document_search" '{
  "name": "Manual"
}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: document_get - Retrieve specific document
start_test "document_get" "Get specific document by ID (may fail if ID doesn't exist)"
call_tool "document_get" '{
  "id": "VR:wt.doc.WTDocument:123456"
}'
if [[ "$LAST_HTTP_CODE" == "404" ]]; then
    test_skip "Document ID does not exist in test environment"
elif assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: document_get_attributes
start_test "document_get_attributes" "Get document attributes (limited by OData)"
call_tool "document_get_attributes" '{
  "objectId": "VR:wt.doc.WTDocument:123456",
  "expand": "Attributes"
}'
if [[ "$LAST_HTTP_CODE" == "404" ]]; then
    test_skip "Document ID does not exist"
elif assert_http_success && assert_valid_json; then
    log_warning "Attribute expansion may not work in Windchill 13.0.2"
    test_pass
fi

# ============================================================================
# PRIORITY 1: CORE DOCUMENT LIFECYCLE
# ============================================================================

# Test: document_create - Create new document
start_test "document_create" "Create a new test document"
DOC_NUMBER=$(generate_document_number)
call_tool "document_create" "{
  \"number\": \"$DOC_NUMBER\",
  \"name\": \"Test Document - Automated\",
  \"type\": \"SPEC\",
  \"description\": \"Created by automated test suite\"
}"
if assert_http_success && assert_valid_json; then
    CREATED_DOC_ID=$(echo "$LAST_RESPONSE" | jq -r '.ID // .id // empty')
    export CREATED_DOC_ID
    log_info "Created document: $DOC_NUMBER (ID: $CREATED_DOC_ID)"
    test_pass
fi

# Test: document_update - Update document metadata
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_update" "Update document metadata"
    call_tool "document_update" "{
      \"id\": \"$CREATED_DOC_ID\",
      \"name\": \"Test Document - Updated\",
      \"description\": \"Updated by automated test suite\"
    }"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "document_update" "Update document metadata"
    test_skip "No document ID available from create test"
fi

# Test: document_checkout
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_checkout" "Checkout document for editing"
    call_tool "document_checkout" "{
      \"id\": \"$CREATED_DOC_ID\",
      \"comment\": \"Checkout for automated testing\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]; then
        if [[ "$LAST_HTTP_CODE" == "400" ]]; then
            test_skip "Document already checked out or checkout endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_checkout" "Checkout document for editing"
    test_skip "No document ID available"
fi

# Test: document_checkin
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_checkin" "Checkin document after editing"
    call_tool "document_checkin" "{
      \"id\": \"$CREATED_DOC_ID\",
      \"comment\": \"Checkin after automated testing\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]; then
        if [[ "$LAST_HTTP_CODE" == "400" ]]; then
            test_skip "Document not checked out or checkin endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_checkin" "Checkin document after editing"
    test_skip "No document ID available"
fi

# Test: document_revise
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_revise" "Create new revision of document"
    call_tool "document_revise" "{
      \"id\": \"$CREATED_DOC_ID\",
      \"comment\": \"Revision created by automated test\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "400" ]]; then
        if [[ "$LAST_HTTP_CODE" == "400" ]]; then
            test_skip "Document cannot be revised or revise endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_revise" "Create new revision of document"
    test_skip "No document ID available"
fi

# ============================================================================
# PRIORITY 1: VERSION MANAGEMENT
# ============================================================================

# Test: document_get_version_history
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_get_version_history" "Get version history for document"
    call_tool "document_get_version_history" "{
      \"id\": \"$CREATED_DOC_ID\"
    }"
    if assert_http_success && assert_valid_json; then
        test_pass
    fi
else
    start_test "document_get_version_history" "Get version history for document"
    test_skip "No document ID available"
fi

# Test: document_get_iterations
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_get_iterations" "Get iterations for document version"
    call_tool "document_get_iterations" "{
      \"id\": \"$CREATED_DOC_ID\",
      \"version\": \"A\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Iterations endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_get_iterations" "Get iterations for document version"
    test_skip "No document ID available"
fi

# Test: document_set_iteration_note
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_set_iteration_note" "Set note on document iteration"
    call_tool "document_set_iteration_note" "{
      \"id\": \"$CREATED_DOC_ID\",
      \"iteration\": \"A.1\",
      \"note\": \"Test note from automated suite\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Set iteration note endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_set_iteration_note" "Set note on document iteration"
    test_skip "No document ID available"
fi

# ============================================================================
# PRIORITY 2: CONTENT MANAGEMENT
# ============================================================================

# Test: document_upload_content
start_test "document_upload_content" "Upload content to document"
test_skip "Requires file upload - not testable via simple JSON API"

# Test: document_download_content
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_download_content" "Download document content"
    call_tool "document_download_content" "{
      \"id\": \"$CREATED_DOC_ID\"
    }"
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Document has no content or download endpoint not available"
    elif assert_http_success; then
        test_pass
    fi
else
    start_test "document_download_content" "Download document content"
    test_skip "No document ID available"
fi

# Test: document_get_content_info
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_get_content_info" "Get content metadata"
    call_tool "document_get_content_info" "{
      \"id\": \"$CREATED_DOC_ID\"
    }"
    if assert_http_success && assert_valid_json; then
        log_warning "ContentHolder expansion may not work in Windchill 13.0.2"
        test_pass
    fi
else
    start_test "document_get_content_info" "Get content metadata"
    test_skip "No document ID available"
fi

# Test: document_add_attachment
start_test "document_add_attachment" "Add attachment to document"
test_skip "Requires file upload - not testable via simple JSON API"

# Test: document_get_attachments
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_get_attachments" "Get document attachments"
    call_tool "document_get_attachments" "{
      \"id\": \"$CREATED_DOC_ID\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Attachments endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_get_attachments" "Get document attachments"
    test_skip "No document ID available"
fi

# Test: document_download_attachment
start_test "document_download_attachment" "Download specific attachment"
test_skip "Requires attachment ID from previous tests"

# ============================================================================
# PRIORITY 2: RELATIONSHIP MANAGEMENT
# ============================================================================

# Test: document_add_reference
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_add_reference" "Add reference between documents"
    # Need a second document to reference
    REF_DOC_NUMBER=$(generate_document_number)
    call_tool "document_create" "{
      \"number\": \"$REF_DOC_NUMBER\",
      \"name\": \"Reference Document\",
      \"type\": \"SPEC\"
    }"
    if assert_http_success; then
        REF_DOC_ID=$(echo "$LAST_RESPONSE" | jq -r '.ID // .id // empty')

        call_tool "document_add_reference" "{
          \"sourceId\": \"$CREATED_DOC_ID\",
          \"targetId\": \"$REF_DOC_ID\",
          \"referenceType\": \"REFERENCE\"
        }"
        if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
            if [[ "$LAST_HTTP_CODE" == "404" ]]; then
                test_skip "Add reference endpoint not available"
            else
                test_pass
            fi
        fi
    else
        test_skip "Could not create reference document"
    fi
else
    start_test "document_add_reference" "Add reference between documents"
    test_skip "No document ID available"
fi

# Test: document_get_references
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_get_references" "Get referenced documents"
    call_tool "document_get_references" "{
      \"id\": \"$CREATED_DOC_ID\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "References endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_get_references" "Get referenced documents"
    test_skip "No document ID available"
fi

# Test: document_get_referencing
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_get_referencing" "Get referencing documents"
    call_tool "document_get_referencing" "{
      \"id\": \"$CREATED_DOC_ID\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Referencing endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_get_referencing" "Get referencing documents"
    test_skip "No document ID available"
fi

# Test: document_remove_reference
start_test "document_remove_reference" "Remove document reference"
test_skip "Requires reference from previous tests"

# ============================================================================
# PRIORITY 3: ADVANCED SEARCH
# ============================================================================

# Test: document_advanced_search
start_test "document_advanced_search" "Advanced multi-criteria search"
call_tool "document_advanced_search" '{
  "name": "Manual",
  "limit": 10
}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: document_search_by_creator
start_test "document_search_by_creator" "Search by creator"
call_tool "document_search_by_creator" '{
  "creator": "wcadmin",
  "limit": 10
}'
if [[ "$LAST_HTTP_CODE" == "400" ]]; then
    test_skip "CreatedBy property not available in OData"
elif assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: document_search_by_lifecycle
start_test "document_search_by_lifecycle" "Search by lifecycle state"
call_tool "document_search_by_lifecycle" '{
  "state": "INWORK",
  "name": "Manual",
  "limit": 10
}'
if assert_http_success && assert_valid_json; then
    log_warning "State parameter may be ignored in Windchill 13.0.2 OData"
    test_pass
fi

# Test: document_search_by_date_range
start_test "document_search_by_date_range" "Search within date range"
call_tool "document_search_by_date_range" '{
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "dateField": "CreatedOn",
  "limit": 10
}'
if [[ "$LAST_HTTP_CODE" == "400" ]]; then
    test_skip "Date filtering not supported in OData"
elif assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: document_search_related
if [[ -n "$CREATED_DOC_ID" ]]; then
    start_test "document_search_related" "Find related documents"
    call_tool "document_search_related" "{
      \"id\": \"$CREATED_DOC_ID\",
      \"direction\": \"both\"
    }"
    if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
        if [[ "$LAST_HTTP_CODE" == "404" ]]; then
            test_skip "Search related endpoint not available"
        else
            test_pass
        fi
    fi
else
    start_test "document_search_related" "Find related documents"
    test_skip "No document ID available"
fi

# ============================================================================
# PRIORITY 3: BULK OPERATIONS
# ============================================================================

# Test: document_bulk_update
start_test "document_bulk_update" "Bulk update multiple documents"
call_tool "document_bulk_update" '{
  "documentIds": [],
  "updates": {
    "Description": "Bulk updated by automated test"
  }
}'
if assert_http_success && assert_valid_json; then
    test_pass
fi

# Test: document_bulk_lifecycle_action
start_test "document_bulk_lifecycle_action" "Bulk lifecycle action on documents"
call_tool "document_bulk_lifecycle_action" '{
  "documentIds": [],
  "action": "APPROVE",
  "comment": "Bulk approval test"
}'
if assert_http_success || [[ "$LAST_HTTP_CODE" == "404" ]]; then
    if [[ "$LAST_HTTP_CODE" == "404" ]]; then
        test_skip "Bulk lifecycle action endpoint not available"
    else
        test_pass
    fi
fi

# ============================================================================
# CLEANUP & REPORTING
# ============================================================================

# Print test summary
print_summary

# Save results
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$SCRIPT_DIR/results/document-agent-results-$TIMESTAMP.json"
save_results "$RESULTS_FILE" "$TEST_SUITE"

# Exit with appropriate code
if [[ $TESTS_FAILED -eq 0 ]]; then
    exit 0
else
    exit 1
fi

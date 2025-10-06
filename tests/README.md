# Windchill MCP Server - Test Suite

Comprehensive test suite for the Windchill MCP Server, testing all agent tools against Development PLM server.

## Overview

This test suite validates all tools exposed by the Windchill MCP server agents:

**Core Domain Agents:**
- **Part Agent** (24 tools) - Parts, BOM management, lifecycle
- **Document Agent** (25 tools) - Documents, content, references
- **Change Agent** (16 tools) - Change requests, affected objects
- **Workflow Agent** (~12 tools) - Workflow tasks, approvals
- **Project Agent** (~10 tools) - Project management
- **DataAdmin Agent** (13 tools) - Containers, contexts, option pools
- **ServerManager Agent** (5 tools) - Multi-server management

**Tier 1 Agents (High Priority):**
- **PrincipalMgmt Agent** (16 tools) - Users, groups, roles, teams
- **ProdPlatformMgmt Agent** (12 tools) - Options & Variants
- **NavCriteria Agent** (8 tools) - BOM navigation and filtering
- **PartListMgmt Agent** (10 tools) - Parts lists and favorites

**Tier 2 Agents (Module-Specific):**
- **Manufacturing Agent** (12 tools) - Manufacturing data (requires MPMLink)
- **Quality Agent** (10 tools) - Quality management (requires QMS)

**Tier 3 Agents (Specialized):**
- **Visualization Agent** (3 tools) - Creo View services
- **Effectivity Agent** (2 tools) - Date/unit effectivity
- **CADDocument Agent** (2 tools) - CAD-specific operations
- **Classification Agent** (2 tools) - Taxonomy management
- **SavedSearch Agent** (3 tools) - Saved search management
- **ServiceInfo Agent** (2 tools) - Service documentation
- **PTC Agent** (2 tools) - Common utility entities

**Total:** 20 agents, ~189 tools

## Directory Structure

```
tests/
├── README.md                              # This file
├── NEW_AGENTS_TESTING_GUIDE.md           # Guide for new agents (Tier 1-3)
├── utils/
│   └── test-helpers.sh                   # Shared test utilities and helpers
└── dev-server/                           # Development server tests
    ├── config.json                       # Server configuration
    ├── run-all-tests.sh                  # Master test runner (all 14 suites)
    │
    ├── 01-part-agent-tests.sh            # Core agents
    ├── 02-document-agent-tests.sh
    ├── 03-change-agent-tests.sh
    ├── 04-workflow-agent-tests.sh
    ├── 05-project-agent-tests.sh
    ├── 06-dataadmin-agent-tests.sh
    ├── 07-servermanager-agent-tests.sh
    │
    ├── 08-principalmgmt-agent-tests.sh   # Tier 1 agents
    ├── 09-prodplatformmgmt-agent-tests.sh
    ├── 10-navcriteria-agent-tests.sh
    ├── 11-partlistmgmt-agent-tests.sh
    │
    ├── 12-manufacturing-agent-tests.sh   # Tier 2 agents
    ├── 13-quality-agent-tests.sh
    │
    ├── 14-tier3-agents-tests.sh          # Tier 3 agents (7 agents in 1 script)
    │
    └── results/                          # Test results (JSON)
        └── *.json
```

## Prerequisites

### 1. Install Dependencies

```bash
# macOS
brew install curl jq

# Ubuntu/Debian
sudo apt-get install curl jq

# Fedora/RHEL
sudo dnf install curl jq
```

### 2. Start MCP Server

The tests require the Windchill MCP server to be running:

```bash
cd /Users/cars10/GIT/KTB3/windchill-mcp-server
npm run dev:server
```

The server should be accessible at `http://localhost:3000`.

### 3. Configure Windchill Server

Ensure the Development PLM server (Server ID: 2) is configured in `.env`:

```bash
WINDCHILL_URL_2=http://plm.windchill.com/Windchill
WINDCHILL_USER_2=wcadmin
WINDCHILL_PASSWORD_2=wcadmin
WINDCHILL_NAME_2=Development PLM
WINDCHILL_ACTIVE_SERVER=2
```

## Running Tests

### Run All Test Suites

```bash
cd tests/dev-server
./run-all-tests.sh
```

This will:
1. Check prerequisites (MCP server, dependencies)
2. Verify server connectivity
3. Switch to Development PLM server (Server ID: 2)
4. Run all 5 agent test suites sequentially
5. Generate comprehensive test report
6. Save results to JSON files

### Run Individual Test Suites

```bash
cd tests/dev-server

# Test specific agents
./01-part-agent-tests.sh
./02-document-agent-tests.sh
./03-change-agent-tests.sh
./04-workflow-agent-tests.sh
./05-project-agent-tests.sh
```

## Understanding Test Results

### Console Output

Tests produce color-coded output:
- 🟢 **GREEN [PASS]** - Test passed successfully
- 🔴 **RED [FAIL]** - Test failed with errors
- 🟡 **YELLOW [SKIP]** - Test skipped (expected behavior)
- 🔵 **BLUE [INFO]** - Informational messages

### JSON Results

Each test suite generates a JSON results file in `dev-server/results/`:

```json
{
  "testSuite": "Part Agent - Development Server",
  "timestamp": "2025-10-06T12:34:56Z",
  "summary": {
    "total": 24,
    "passed": 18,
    "failed": 2,
    "skipped": 4
  },
  "tests": [
    {
      "name": "part_search",
      "status": "PASS",
      "duration": 2,
      "description": "Search for parts with wildcard"
    }
  ]
}
```

### Master Test Run

The master test runner creates a combined results file:

```json
{
  "runId": "test-run-20251006-123456",
  "timestamp": "2025-10-06T12:34:56Z",
  "summary": {
    "totalSuites": 5,
    "passed": 4,
    "failed": 1
  },
  "suites": [...]
}
```

## Test Categories

### Priority 1: Core Operations
Essential CRUD operations that should work in most Windchill environments:
- Create, Read, Update, Delete
- Search, Get
- Basic lifecycle operations (checkout, checkin, revise)

### Priority 2: Relationships & Structure
Advanced operations for managing object relationships:
- BOM management (add/remove components)
- References and links
- Affected objects
- Team membership

### Priority 3: Advanced Features
Complex operations that may have limited support:
- Advanced multi-criteria searches
- Bulk operations
- Date range filtering
- State and attribute filtering

## Known Limitations

### Windchill 13.0.2 OData Constraints

Some features are not supported or have limited functionality:

1. **Lifecycle State Filtering**
   - OData API doesn't expose `State` property on most objects
   - Tests will skip or ignore state filters

2. **Date Filtering**
   - `CreatedOn`, `ModifiedOn` properties may not be available
   - Date range searches may fail with 400 errors

3. **Custom Attributes**
   - `$expand` parameter doesn't work for custom attributes
   - Only standard OData properties are returned

4. **File Operations**
   - Upload/download tests are skipped (require multipart/form-data)
   - Content management has limited testing

## Customizing Tests

### Configuration

Edit `dev-server/config.json` to customize:

```json
{
  "server": {
    "mcpServerUrl": "http://localhost:3000",
    "serverId": 2,
    "timeout": 30
  },
  "testSettings": {
    "createTestObjects": false,
    "cleanupAfterTests": true,
    "skipDestructiveTests": false
  }
}
```

### Environment Variables

Override settings via environment variables:

```bash
# Use different MCP server URL
export MCP_SERVER_URL=http://localhost:3001

# Use different Windchill server ID
export SERVER_ID=1

# Custom timeout
export TIMEOUT=60

# Run tests
./run-all-tests.sh
```

## Troubleshooting

### MCP Server Not Running

```
[ERROR] MCP server is not running at http://localhost:3000
```

**Solution:** Start the server with `npm run dev:server`

### Wrong Windchill Server

```
[WARN] Active server is not Development PLM (ID: 1)
```

**Solution:** The test runner will automatically switch to Server ID 2. If this fails, manually switch:

```bash
curl -X POST http://localhost:3000/api/servers/switch \
  -H "Content-Type: application/json" \
  -d '{"serverId": 2}'
```

### Test Object Creation Failures

Some tests create objects (parts, documents, changes). If creation fails:

1. Check Windchill server connectivity
2. Verify user permissions (wcadmin should have full access)
3. Check if auto-numbering is configured correctly
4. Review detailed error messages in test output

### All Tests Skipped

If most tests are skipped, the Windchill server may not have any existing data. Some tests require:
- Existing parts, documents, or changes to query
- Valid object IDs for get/update operations

## Contributing

### Adding New Tests

1. Follow the existing test script pattern
2. Use helper functions from `test-helpers.sh`
3. Handle expected failures gracefully (404, 400 errors)
4. Document known limitations in comments

### Test Script Template

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/test-helpers.sh"

TEST_SUITE="My Agent - Development Server"
init_test_environment

start_test "tool_name" "Test description"
call_tool "agent_tool_name" '{"param": "value"}'
assert_http_success && assert_valid_json && test_pass || true

print_summary
save_results "$SCRIPT_DIR/results/my-agent-results-$(date +%Y%m%d-%H%M%S).json" "$TEST_SUITE"
[[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1
```

## Support

For issues or questions:
1. Check test output for detailed error messages
2. Review Windchill MCP server logs in `logs/`
3. Verify Windchill server accessibility
4. Check that all required tools are available

## License

This test suite is part of the Windchill MCP Server project.

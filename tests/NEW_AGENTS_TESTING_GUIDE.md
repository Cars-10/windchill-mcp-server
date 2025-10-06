# New Agents Testing Guide

This guide covers testing for the 13 new Windchill REST Services agents added to the MCP server.

## Overview

**Total New Agents:** 13
**Total New Test Scripts:** 7 (some scripts test multiple related agents)
**Estimated Test Coverage:** ~80 tests across all new agents

## Test Scripts

### Tier 1 Agents (High Priority - Common Use Cases)

#### 08-principalmgmt-agent-tests.sh
Tests **PrincipalMgmtAgent** - User, group, role, and team management

**Tools Tested (16):**
- User management: list_users, get_user, search_users, get_user_groups, get_user_teams
- Group management: list_groups, get_group, search_groups, get_group_members
- Team management: list_teams, get_team, search_teams, get_team_members
- Role management: list_roles, get_user_roles (EXPERIMENTAL)

**Prerequisites:** None - uses standard PrincipalMgmt domain

**Run individually:**
```bash
cd tests/dev-server
./08-principalmgmt-agent-tests.sh
```

---

#### 09-prodplatformmgmt-agent-tests.sh
Tests **ProdPlatformMgmtAgent** - Options & Variants configuration

**Tools Tested (12):**
- Option management: list_options, get_option, search_options, get_option_choices
- Option set management: list_option_sets, get_option_set, search_option_sets, get_option_set_assignments
- Choice management: list_choices, get_choice, search_choices

**Prerequisites:**
- Windchill Product Platform Management (Options & Variants) module
- Products/libraries with configured option pools

**Run individually:**
```bash
cd tests/dev-server
./09-prodplatformmgmt-agent-tests.sh
```

---

#### 10-navcriteria-agent-tests.sh
Tests **NavCriteriaAgent** - BOM navigation and filtering

**Tools Tested (8):**
- Navigation criteria: list_nav_criteria, get_nav_criteria, search_nav_criteria
- Filter configuration: get_filter_expression, list_filter_types
- Application: get_criteria_by_view, get_applied_criteria, get_default_criteria

**Prerequisites:** None - uses standard NavCriteria domain

**Run individually:**
```bash
cd tests/dev-server
./10-navcriteria-agent-tests.sh
```

---

#### 11-partlistmgmt-agent-tests.sh
Tests **PartListMgmtAgent** - Parts lists and favorites

**Tools Tested (10):**
- Part list management: list_part_lists, get_part_list, search_part_lists, get_part_list_items
- List operations: add_part_to_list, remove_part_from_list, create_part_list, delete_part_list, update_part_list
- Sharing: get_shared_lists

**Prerequisites:** None - uses standard PartListMgmt domain

**Expected Behavior:**
- Read operations (list, get, search) should work
- Write operations (create, update, delete) may be EXPERIMENTAL/unsupported in OData

**Run individually:**
```bash
cd tests/dev-server
./11-partlistmgmt-agent-tests.sh
```

---

### Tier 2 Agents (Module-Specific)

#### 12-manufacturing-agent-tests.sh
Tests **ManufacturingAgent** - Manufacturing data (Factory/MfgProcMgmt)

**Tools Tested (12):**
- Manufacturing parts: list_mfg_parts, get_mfg_part, search_mfg_parts
- Process plans: list_process_plans, get_process_plan, get_plan_operations
- Operations: list_operations, get_operation, get_operation_resources, get_work_instructions

**Prerequisites:**
- **Windchill MPMLink** (Manufacturing Process Management) module required
- Manufacturing parts and process plans configured in system

**Expected Behavior:**
- Tests will skip if MPMLink module is not installed
- 404 responses are expected without the module

**Run individually:**
```bash
cd tests/dev-server
./12-manufacturing-agent-tests.sh
```

---

#### 13-quality-agent-tests.sh
Tests **QualityAgent** - Quality management

**Tools Tested (10):**
- Quality inspections: list_inspections, get_inspection, search_inspections
- Nonconformance reports: list_nonconformances, get_nonconformance, search_nonconformances
- Corrective actions: list_corrective_actions, get_corrective_action

**Prerequisites:**
- **Windchill Quality Management Solutions (QMS)** module required
- Quality inspections and NCRs configured in system

**Expected Behavior:**
- Tests will skip if QMS module is not installed
- 404 responses are expected without the module

**Run individually:**
```bash
cd tests/dev-server
./13-quality-agent-tests.sh
```

---

### Tier 3 Agents (Specialized Features)

#### 14-tier3-agents-tests.sh
Tests **7 specialized agents** in a single comprehensive script

**Agents Covered:**

1. **VisualizationAgent** (3 tools)
   - list_visualizations, get_visualization, get_thumbnail
   - Requires: Creo View/Windchill Visualization Services

2. **EffectivityMgmtAgent** (2 tools)
   - list_effectivities, get_effectivity
   - Manages date/unit effectivity ranges

3. **CADDocumentMgmtAgent** (2 tools)
   - list_cad_documents, get_cad_document
   - CAD-specific document operations

4. **ClfStructureAgent** (2 tools)
   - list_classification_nodes, get_classification_node
   - Classification/taxonomy management

5. **SavedSearchAgent** (3 tools)
   - list_saved_searches, get_saved_search, execute_saved_search
   - Saved search management and execution

6. **ServiceInfoMgmtAgent** (2 tools)
   - list_service_documents, get_service_document
   - Service information/technical publications

7. **PTCAgent** (2 tools)
   - list_entities, get_entity
   - PTC common utility entities

**Prerequisites:** Varies by agent (see individual agent requirements above)

**Run individually:**
```bash
cd tests/dev-server
./14-tier3-agents-tests.sh
```

---

## Running All New Agent Tests

### Run All New Agents Only
```bash
cd tests/dev-server

# Run Tier 1 agents
./08-principalmgmt-agent-tests.sh
./09-prodplatformmgmt-agent-tests.sh
./10-navcriteria-agent-tests.sh
./11-partlistmgmt-agent-tests.sh

# Run Tier 2 agents
./12-manufacturing-agent-tests.sh
./13-quality-agent-tests.sh

# Run Tier 3 agents
./14-tier3-agents-tests.sh
```

### Run Complete Test Suite (All Agents)
```bash
cd tests/dev-server
./run-all-tests.sh
```

This will run all 14 test suites (7 original + 7 new) and generate a comprehensive report.

---

## Test Results

Test results are saved to `tests/dev-server/results/` with timestamps:

```
results/
├── principalmgmt-agent-results-20250106-123045.json
├── prodplatformmgmt-agent-results-20250106-123145.json
├── navcriteria-agent-results-20250106-123245.json
├── partlistmgmt-agent-results-20250106-123345.json
├── manufacturing-agent-results-20250106-123445.json
├── quality-agent-results-20250106-123545.json
├── tier3-agents-results-20250106-123645.json
└── complete-test-run-20250106-123700.json
```

---

## Expected Test Outcomes

### Tests Expected to PASS
- **PrincipalMgmtAgent:** Most user/group listing and retrieval operations
- **NavCriteriaAgent:** Navigation criteria listing (if configured)
- **PartListMgmtAgent:** Part list reading operations

### Tests Expected to SKIP
- **ProdPlatformMgmtAgent:** If Options & Variants module not installed (404)
- **ManufacturingAgent:** If MPMLink module not installed (404)
- **QualityAgent:** If QMS module not installed (404)
- **VisualizationAgent:** If Creo View not installed (404)
- **ServiceInfoMgmtAgent:** If Service Information Manager not installed (404)

### Tests Marked EXPERIMENTAL
- Role management operations (may not be available in standard OData)
- Write operations (POST/PUT/DELETE) in PartListMgmt
- Variant expression validation in ProdPlatformMgmt
- Execute saved search operations

---

## Troubleshooting

### All Tests Return 404
**Issue:** Domain endpoints not available
**Solution:**
- Verify Windchill REST Services is properly configured
- Check if required modules are installed
- Confirm OData endpoints are accessible at `/servlet/odata/`

### Tests Timeout
**Issue:** Windchill server not responding
**Solution:**
- Check MCP server is running: `npm run dev:server`
- Verify network connectivity to Windchill server
- Check server credentials in `.env` file

### Permission Errors
**Issue:** User lacks permissions to access data
**Solution:**
- Verify user has read access to relevant data
- Check user group memberships
- Confirm ACL policies in Windchill

---

## Contributing

When adding new tests:

1. Follow the existing test script pattern (see `06-dataadmin-agent-tests.sh`)
2. Use test helper functions from `../utils/test-helpers.sh`
3. Mark experimental/uncertain tools with appropriate skip conditions
4. Document prerequisites in comments
5. Add new script to `run-all-tests.sh` TEST_SUITES array

---

## Summary Statistics

| Tier | Agents | Test Scripts | Tools | Expected Tests |
|------|--------|--------------|-------|----------------|
| Tier 1 | 4 | 4 | 46 | ~50 |
| Tier 2 | 2 | 2 | 22 | ~25 |
| Tier 3 | 7 | 1 | 16 | ~20 |
| **Total** | **13** | **7** | **84** | **~95** |

---

## Version Compatibility

**Tested Against:** Windchill 13.0.2.x
**OData Version:** OData v4
**API:** Windchill REST Services (WRS)

**Note:** Some endpoints may vary by Windchill version and installed modules. Tests include appropriate skip logic for unavailable features.

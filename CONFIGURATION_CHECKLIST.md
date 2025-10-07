# Windchill MCP Server - Configuration Checklist

This document provides a comprehensive checklist for configuring and deploying the complete Windchill MCP Server system with all 20 agents and Angular UI.

---

## 1. Environment Configuration

### Required Environment Variables (`docker/.env`)

#### Multi-Server Configuration (Recommended)
```bash
# Server 1 (Production)
WINDCHILL_URL_1=http://plm-prod.company.com/Windchill
WINDCHILL_USER_1=wcadmin
WINDCHILL_PASSWORD_1=<secure_password>
WINDCHILL_NAME_1=Production PLM

# Server 2 (Development)
WINDCHILL_URL_2=http://plm-dev.company.com/Windchill
WINDCHILL_USER_2=wcadmin
WINDCHILL_PASSWORD_2=<secure_password>
WINDCHILL_NAME_2=Development PLM

# Server 3 (Test)
WINDCHILL_URL_3=http://plm-test.company.com/Windchill
WINDCHILL_USER_3=wcadmin
WINDCHILL_PASSWORD_3=<secure_password>
WINDCHILL_NAME_3=Test PLM

# Default active server
WINDCHILL_ACTIVE_SERVER=1
```

#### MCP Server Configuration
```bash
MCP_SERVER_NAME=windchill-mcp
MCP_SERVER_VERSION=1.0.0
MCP_SERVER_PORT=3000
LOG_LEVEL=info
```

#### Legacy Single-Server (Backward Compatible)
```bash
WINDCHILL_URL=http://plm.company.com/Windchill
WINDCHILL_USER=wcadmin
WINDCHILL_PASSWORD=<secure_password>
```

**Checklist:**
- [ ] Copy `docker/.env.example` to `docker/.env`
- [ ] Configure at least one Windchill server with valid URL/credentials
- [ ] Set appropriate `WINDCHILL_ACTIVE_SERVER` (1, 2, or 3)
- [ ] Choose appropriate `LOG_LEVEL` (debug, info, warn, error)
- [ ] Verify MCP_SERVER_PORT (3000) is not in use
- [ ] Secure `.env` file permissions (chmod 600)
- [ ] Add `.env` to `.gitignore` (already done)

---

## 2. Windchill Server Requirements

### Minimum Version Requirements
- [ ] **Windchill 13.0.2.x** or higher
- [ ] **OData REST Services** enabled and configured
- [ ] **REST Services Servlet** accessible at `/Windchill/servlet/odata`

### Core Domain Requirements (Always Available)
These domains should work in any Windchill 13.x installation:
- [ ] **Product Management** (`/ProdMgmt/Parts`)
- [ ] **Document Management** (`/DocMgmt/Documents`)
- [ ] **Change Management** (`/ChangeMgmt/ChangeRequests`)
- [ ] **Workflow Management** (`/WorkflowMgmt/WorkItems`)
- [ ] **Project Management** (`/ProjMgmt/Projects`)
- [ ] **Data Administration** (`/DataAdmin/Containers`)
- [ ] **Principal Management** (`/PrincipalMgmt`)

### Tier 1 Optional Modules
- [ ] **Product Platform Management** (Options & Variants)
  - Agent: `prodplatformmgmt` (12 tools)
  - Endpoints: `/ProdPlatformMgmt/Options`, `/ProdPlatformMgmt/OptionSets`
  - Required for configurable products

- [ ] **Navigation Criteria** (BOM Filtering)
  - Agent: `navcriteria` (8 tools)
  - Endpoint: `/NavCriteria`
  - Required for advanced BOM views

- [ ] **Parts Lists Management**
  - Agent: `partlistmgmt` (10 tools)
  - Endpoint: `/PartListMgmt/PartLists`
  - Required for user-created parts lists

### Tier 2 Module-Specific Requirements
- [ ] **MPMLink (Manufacturing)** module installed
  - Agent: `manufacturing` (12 tools)
  - Endpoints: `/Factory`, `/MfgProcMgmt`
  - Required for manufacturing process management
  - **Will return 404 if not installed**

- [ ] **Windchill QMS (Quality)** module installed
  - Agent: `quality` (10 tools)
  - Endpoint: `/Quality`
  - Required for inspections and NCRs
  - **Will return 404 if not installed**

### Tier 3 Specialized Features
- [ ] **Creo View** (Visualization) module installed
  - Agent: `visualization` (3 tools)
  - Endpoint: `/Visualization`

- [ ] **Effectivity Management** configured
  - Agent: `effectivitymgmt` (2 tools)
  - Endpoint: `/EffectivityMgmt`

- [ ] **Creo Integration** (CAD Documents)
  - Agent: `caddocumentmgmt` (2 tools)
  - Endpoint: `/CADDocumentMgmt`

- [ ] **Classification** configured
  - Agent: `clfstructure` (2 tools)
  - Endpoint: `/ClfStructure`

- [ ] **Service Information Manager** module installed
  - Agent: `serviceinfomgmt` (2 tools)
  - Endpoint: `/ServiceInfoMgmt`

**Note:** Tier 3 agents will return 404 errors if their respective modules are not installed. This is expected behavior.

---

## 3. Network Configuration

### Firewall & Network Access
- [ ] MCP Server can reach Windchill server(s) on HTTP/HTTPS port
- [ ] Windchill URL(s) are accessible from Docker container network
- [ ] Corporate firewall allows outbound connections to Windchill servers
- [ ] DNS resolution works for Windchill hostnames

### Port Configuration
- [ ] **MCP Server**: Port 3000 (configurable via `MCP_SERVER_PORT`)
- [ ] **Angular UI**: Port 4200 (development) or 8080 (Docker production)
- [ ] **Windchill**: Typically port 80 (HTTP) or 443 (HTTPS)

### SSL/TLS Configuration
If using HTTPS Windchill servers:
- [ ] Valid SSL certificates installed on Windchill servers
- [ ] Self-signed certificates added to Node.js trust store if needed
- [ ] Certificate validation enabled (or explicitly disabled for testing)

### CORS Configuration
The MCP server includes comprehensive CORS support for Angular UI:
- [ ] CORS enabled for Angular UI origin (`http://localhost:4200`)
- [ ] Preflight OPTIONS requests handled correctly
- [ ] Credentials allowed for authentication

---

## 4. Authentication & Authorization

### Windchill User Accounts
- [ ] Create dedicated service account(s) for MCP server
- [ ] Grant appropriate permissions to service accounts:
  - [ ] **Read access** to Parts, Documents, Changes (minimum)
  - [ ] **Write access** if creating/updating objects (optional)
  - [ ] **Admin access** for Principal Management (if needed)
  - [ ] **Container access** for all contexts (Products, Libraries, Projects)

### Recommended Permission Setup
```
User: mcp_service_user
Roles:
  - Organization Administrator (for Principal Management)
  - Context Team Member (for all containers)
  - Change Administrator (for Change Management)
  - Project Member (for Project Management)
```

### Access Control Lists (ACLs)
- [ ] Verify service account can access target containers
- [ ] Test read access to parts/documents in each context
- [ ] Test write access if create/update operations needed
- [ ] Verify role-based access for workflow/change operations

### Credential Management
- [ ] Store passwords securely (environment variables only)
- [ ] Use different credentials for Production/Dev/Test
- [ ] Rotate passwords regularly
- [ ] Never commit `.env` file to version control
- [ ] Consider using secrets management (Vault, AWS Secrets Manager, etc.)

---

## 5. Module Dependencies Matrix

| Agent | Module Requirement | Endpoint | Expected Behavior if Missing |
|-------|-------------------|----------|------------------------------|
| **part** | Core | `/ProdMgmt/Parts` | Should always work |
| **document** | Core | `/DocMgmt/Documents` | Should always work |
| **change** | Core | `/ChangeMgmt/ChangeRequests` | Should always work |
| **workflow** | Core | `/WorkflowMgmt/WorkItems` | Should always work |
| **project** | Core | `/ProjMgmt/Projects` | Should always work |
| **dataadmin** | Core | `/DataAdmin/Containers` | Should always work |
| **servermanager** | Core | N/A (local config) | Should always work |
| **principalmgmt** | Core | `/PrincipalMgmt` | Should always work |
| **prodplatformmgmt** | Product Platform Mgmt | `/ProdPlatformMgmt` | 404 if module not installed |
| **navcriteria** | Navigation Criteria | `/NavCriteria` | 404 if not configured |
| **partlistmgmt** | Parts Lists | `/PartListMgmt` | 404 if not configured |
| **manufacturing** | MPMLink | `/Factory`, `/MfgProcMgmt` | 404 if MPMLink not installed |
| **quality** | Windchill QMS | `/Quality` | 404 if QMS not installed |
| **visualization** | Creo View | `/Visualization` | 404 if Creo View not installed |
| **effectivitymgmt** | Effectivity | `/EffectivityMgmt` | 404 if not configured |
| **caddocumentmgmt** | Creo Integration | `/CADDocumentMgmt` | 404 if not configured |
| **clfstructure** | Classification | `/ClfStructure` | 404 if not configured |
| **savedsearch** | Saved Searches | `/SavedSearch` | 404 if not configured |
| **serviceinfomgmt** | Service Info Manager | `/ServiceInfoMgmt` | 404 if module not installed |
| **ptc** | PTC Extensions | `/PTC` | 404 if not configured |

**Testing Strategy:**
- [ ] Run `tests/dev-server/run-all-tests.sh` to verify all available modules
- [ ] Review test output for expected 404 errors (missing modules)
- [ ] Document which modules are available in each environment

---

## 6. Testing Configuration

### Test Server Setup
- [ ] Create dedicated test Windchill server (recommended)
- [ ] Populate test data:
  - [ ] At least 5 test parts with different states
  - [ ] At least 5 test documents with content
  - [ ] At least 2 test change requests
  - [ ] At least 1 test project
  - [ ] Test containers (Products, Libraries)
  - [ ] Test users and groups

### Running Tests
```bash
# Make all test scripts executable
chmod +x tests/dev-server/*.sh

# Run all tests (20 agents, ~189 tools)
cd tests/dev-server
./run-all-tests.sh

# Run specific agent tests
./08-principalmgmt-agent-tests.sh
./12-manufacturing-agent-tests.sh
```

### Expected Test Results
- [ ] Core domain agents (7): **All tests should pass**
- [ ] Tier 1 agents (4): **Should pass if modules installed**
- [ ] Tier 2 agents (2): **404 errors acceptable if modules not installed**
- [ ] Tier 3 agents (7): **404 errors acceptable if modules not installed**

### Test Environment Variables
```bash
# Set in docker/.env for testing
WINDCHILL_ACTIVE_SERVER=2  # Use dev/test server
LOG_LEVEL=debug             # Detailed logging during tests
```

---

## 7. Angular UI Configuration

### Development Setup
```bash
# Install Angular dependencies
npm run ui:install

# Start dev server (requires MCP server running on port 3000)
npm run dev:ui
```

### Proxy Configuration (`angular-ui/proxy.conf.json`)
```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

**Checklist:**
- [ ] MCP server running on port 3000 before starting Angular UI
- [ ] Proxy configuration points to correct MCP server URL
- [ ] Browser can access `http://localhost:4200`
- [ ] CORS errors resolved (should be none with proper proxy)

### Production Build
```bash
# Build Angular UI for production
npm run ui:build

# Output: angular-ui/dist/angular-ui/browser/
```

### Production Deployment (Docker)
```bash
# Build production image with Angular UI
npm run docker:build

# Start full system (MCP server + Angular UI)
npm run docker:up

# Verify:
# - MCP server: http://localhost:3000
# - Angular UI: http://localhost:8080 (mapped from 4200)
```

**Checklist:**
- [ ] Production build completes without errors
- [ ] Static files generated in `angular-ui/dist/`
- [ ] Docker multi-stage build includes Angular assets
- [ ] Nginx serves Angular UI on port 8080
- [ ] Angular UI can connect to MCP server API

### Angular UI Features to Verify
- [ ] Tool list loads and displays all ~189 tools
- [ ] Search/filter works for tool names and descriptions
- [ ] Agent grouping/filtering works (20 agents)
- [ ] Server selection dropdown shows all configured servers
- [ ] Server switching works and reconnects
- [ ] Tool execution forms generate correctly from JSON schemas
- [ ] JSON parsing works for array/object parameters
- [ ] Results display properly (formatted JSON)
- [ ] Error messages display clearly
- [ ] Filter preferences persist (localStorage)

---

## 8. Docker Configuration

### Dockerfile Requirements
- [ ] Multi-stage build configured:
  - **Stage 1**: Node.js base image
  - **Stage 2**: Angular UI build
  - **Stage 3**: Production runtime with MCP server + UI
- [ ] Environment variables passed to container
- [ ] Volumes mounted for persistent data
- [ ] Health checks configured

### Docker Compose Setup (`docker-compose.yml`)
```yaml
version: '3.8'
services:
  windchill-mcp:
    build: .
    ports:
      - "3000:3000"  # MCP server
      - "8080:4200"  # Angular UI (mapped)
    env_file:
      - docker/.env
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Checklist:**
- [ ] Docker installed and running
- [ ] Docker Compose installed (v3.8+)
- [ ] `docker/.env` file configured
- [ ] Build completes successfully: `npm run docker:build`
- [ ] Container starts: `npm run docker:up`
- [ ] Health check passes: `docker ps` shows "healthy"
- [ ] Logs volume mounted: `./logs/` directory created
- [ ] Both ports accessible (3000, 8080)

### Production Deployment Commands
```bash
# Pre-deployment verification
npm run verify:docker

# Build and deploy
npm run deploy:all

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

---

## 9. Monitoring & Logging

### Log Configuration
```bash
# In docker/.env
LOG_LEVEL=info  # Options: debug, info, warn, error
```

### Log Files (with Daily Rotation)
- **Application logs**: `logs/application-YYYY-MM-DD.log`
- **Error logs**: `logs/error-YYYY-MM-DD.log`
- **API logs**: `logs/api-YYYY-MM-DD.log`

**Checklist:**
- [ ] Log directory created: `./logs/`
- [ ] Log rotation configured (14 days retention)
- [ ] Log level appropriate for environment (info for prod, debug for dev)
- [ ] Sensitive data (passwords, tokens) not logged
- [ ] Request IDs tracked for debugging

### Health Check Endpoints
- [ ] **MCP Server Health**: `http://localhost:3000/health`
  - Returns: `{"status": "ok", "version": "1.0.0"}`
- [ ] **Angular UI**: `http://localhost:8080`
  - Should load UI without errors

### Monitoring Checklist
- [ ] Set up log aggregation (ELK stack, Splunk, etc.)
- [ ] Configure alerts for error log entries
- [ ] Monitor health check endpoint (Nagios, Prometheus, etc.)
- [ ] Track API response times
- [ ] Monitor Docker container resource usage

---

## 10. Security Considerations

### Credential Storage
- [ ] **Never** commit `.env` file to version control
- [ ] Use environment variables only (no hardcoded credentials)
- [ ] Rotate passwords regularly (quarterly recommended)
- [ ] Use different credentials per environment (prod/dev/test)
- [ ] Consider secrets management system (Vault, AWS Secrets Manager)

### HTTPS/TLS
- [ ] Use HTTPS for Windchill connections in production
- [ ] Validate SSL certificates (disable only for testing)
- [ ] Use TLS 1.2+ (disable older protocols)

### Network Security
- [ ] Deploy MCP server in secure network zone
- [ ] Restrict access to MCP server port (3000)
- [ ] Use reverse proxy (Nginx, Apache) for Angular UI
- [ ] Enable HTTPS for Angular UI in production
- [ ] Configure firewall rules (whitelist only necessary traffic)

### CORS Security
Current CORS allows `http://localhost:4200` for development:
- [ ] Update CORS origins for production domains
- [ ] Restrict CORS to specific domains (no wildcards in production)
- [ ] Review allowed headers and methods

### Code Security
- [ ] Keep dependencies updated: `npm audit`
- [ ] Review npm audit report and fix vulnerabilities
- [ ] Use specific dependency versions (no `^` or `~` in production)
- [ ] Enable Node.js security best practices

---

## 11. Performance Optimization

### API Configuration
- [ ] Set appropriate request timeouts (default: 30s)
- [ ] Configure connection pooling for high-volume usage
- [ ] Implement caching for frequently accessed data (if needed)

### Angular UI Optimization
- [ ] Enable production mode for Angular build
- [ ] Configure gzip compression in Nginx
- [ ] Implement lazy loading for large tool lists
- [ ] Optimize bundle size (check with `npm run ui:build -- --stats-json`)

---

## 12. Backup & Disaster Recovery

### Configuration Backup
- [ ] Back up `docker/.env` file securely (encrypted)
- [ ] Document all custom configuration changes
- [ ] Store backup copies of SSL certificates
- [ ] Version control all code (except `.env`)

### Log Backup
- [ ] Archive old logs before rotation deletes them
- [ ] Export logs to centralized system
- [ ] Retain logs per compliance requirements

---

## 13. Documentation

### Internal Documentation
- [ ] Document custom Windchill configurations
- [ ] Document network topology and access paths
- [ ] Document service account permissions and roles
- [ ] Document module availability per environment

### Operational Runbooks
- [ ] Server startup/shutdown procedures
- [ ] Troubleshooting guide for common errors
- [ ] Escalation procedures for critical issues
- [ ] Contact information for Windchill admins

---

## 14. Pre-Deployment Verification Checklist

### Environment Verification
- [ ] All environment variables configured in `docker/.env`
- [ ] Windchill server(s) accessible from MCP server network
- [ ] Service account credentials valid and tested
- [ ] Required Windchill modules installed and enabled

### Build Verification
- [ ] TypeScript compilation successful: `npm run build`
- [ ] Angular UI build successful: `npm run ui:build`
- [ ] Docker image builds successfully: `npm run docker:build`
- [ ] No errors in build logs

### Testing Verification
- [ ] Test scripts executable: `chmod +x tests/dev-server/*.sh`
- [ ] All core agent tests pass (7 agents)
- [ ] Module-specific tests pass or return expected 404s
- [ ] Angular UI loads and connects to MCP server

### Security Verification
- [ ] `.env` file not in version control
- [ ] Passwords strong and unique
- [ ] SSL certificates valid (if using HTTPS)
- [ ] CORS configuration appropriate for environment
- [ ] No sensitive data in logs

### Documentation Verification
- [ ] README.md updated with deployment instructions
- [ ] CLAUDE.md updated with all 20 agents
- [ ] This checklist completed and reviewed
- [ ] Runbooks created for operations team

---

## 15. Post-Deployment Verification

### Functional Testing
- [ ] MCP server responds: `curl http://localhost:3000/health`
- [ ] Angular UI loads: Open `http://localhost:8080`
- [ ] Tool list populates (should show ~189 tools)
- [ ] Server switching works (if multi-server configured)
- [ ] Execute sample tool from UI (e.g., `part_search`)
- [ ] Verify results display correctly

### Integration Testing
- [ ] Test each core agent (part, document, change, workflow, project)
- [ ] Test server switching between environments
- [ ] Test error handling (invalid parameters, network errors)
- [ ] Test timeout handling (long-running operations)

### Performance Testing
- [ ] Measure tool execution response times
- [ ] Test concurrent tool executions (load testing)
- [ ] Monitor memory usage under load
- [ ] Verify log rotation works correctly

---

## Quick Start Checklist

**For rapid deployment, complete these minimum steps:**

1. **Environment Setup**
   - [ ] Copy `docker/.env.example` to `docker/.env`
   - [ ] Configure at least one Windchill server with valid credentials

2. **Build & Deploy**
   - [ ] Run `npm install` (install dependencies)
   - [ ] Run `npm run build` (compile TypeScript)
   - [ ] Run `npm run docker:build` (build Docker image)
   - [ ] Run `npm run docker:up` (start services)

3. **Verify**
   - [ ] Access Angular UI: `http://localhost:8080`
   - [ ] Verify tool list loads (~189 tools)
   - [ ] Execute a simple tool (e.g., `dataadmin_list_products`)

4. **Test** (Optional but Recommended)
   - [ ] Run `tests/dev-server/run-all-tests.sh`
   - [ ] Review test output for errors
   - [ ] Document which modules are available

---

## Summary Statistics

| Category | Count | Notes |
|----------|-------|-------|
| **Total Agents** | 20 | 7 core + 4 Tier 1 + 2 Tier 2 + 7 Tier 3 |
| **Total Tools** | ~189 | Varies by available modules |
| **Required Modules** | 7 | Core domains always available |
| **Optional Modules** | 13 | May return 404 if not installed |
| **Environment Variables** | 10+ | Depends on # of servers |
| **Test Scripts** | 14 | Covers all agents |
| **Test Cases** | ~95 | Varies by module availability |
| **Expected Coverage** | ~80% | Core + Tier 1 should work |

---

## Support & Troubleshooting

### Common Issues

**Issue: 404 errors for Tier 2/3 agents**
- **Cause**: Optional modules not installed
- **Solution**: Document available modules per environment, disable unused agents

**Issue: 401 Unauthorized errors**
- **Cause**: Invalid credentials or insufficient permissions
- **Solution**: Verify service account credentials, check ACLs

**Issue: CORS errors in Angular UI**
- **Cause**: MCP server CORS config doesn't match UI origin
- **Solution**: Update CORS configuration in `src/index.ts`

**Issue: Tools not appearing in Angular UI**
- **Cause**: MCP server not running or unreachable
- **Solution**: Verify MCP server health endpoint, check network connectivity

**Issue: Timeout errors**
- **Cause**: Windchill server slow or unreachable
- **Solution**: Increase timeout in `src/services/windchill-api.ts`, verify network path

### Getting Help
- Review logs in `./logs/` directory
- Check test script output in `tests/dev-server/`
- Consult `CLAUDE.md` for architecture details
- Review Windchill REST Services documentation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-XX | Initial checklist covering all 20 agents |

---

**End of Configuration Checklist**

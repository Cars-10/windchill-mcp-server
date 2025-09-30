# Deployment Guide

## Overview

The Windchill MCP Server supports multiple deployment scenarios from development environments to production systems. This guide covers Docker-based deployments, configuration management, monitoring, and troubleshooting.

## Deployment Options

### 1. Local Development Deployment

**Quick Start (Recommended for Testing)**
```bash
# Clone and setup
git clone <repository-url>
cd windchill-mcp-server
cp docker/.env.example docker/.env
# Edit .env with your Windchill credentials

# Deploy with auto-setup
chmod +x docker/setup-wizard.sh
./docker/setup-wizard.sh
```

**Manual Development Setup**
```bash
# Install dependencies
npm install

# Configure environment
cp docker/.env.example docker/.env
# Edit docker/.env

# Start development server
npm run dev
# Server runs on localhost with hot reload
```

### 2. Docker Development Deployment

**Development with Containers**
```bash
# Development with hot reload
npm run docker:dev
# or
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up --build

# Access applications:
# - MCP Server API: http://localhost:3000
# - Angular UI: http://localhost:4200
```

### 3. Production Docker Deployment

**Single Command Deployment**
```bash
# Complete production deployment
npm run deploy:all
# or
docker-compose -f docker/docker-compose.yml up -d

# Verify deployment
curl http://localhost:3000/health
curl http://localhost:4200
```

**Step-by-Step Production Deployment**
```bash
# 1. Build production images
npm run docker:build

# 2. Start services
npm run docker:up

# 3. Monitor startup
npm run docker:logs

# 4. Verify health
./docker/verify-docker.sh
```

## Configuration

### Environment Variables

Create `docker/.env` from the template:

```env
# ============================
# WINDCHILL CONFIGURATION
# ============================
WINDCHILL_URL=http://your-windchill-server.company.com/Windchill
WINDCHILL_USER=mcp_service_user
WINDCHILL_PASSWORD=secure_password_here

# ============================
# MCP SERVER CONFIGURATION
# ============================
MCP_SERVER_NAME=windchill-mcp
MCP_SERVER_VERSION=1.0.0
MCP_SERVER_PORT=3000

# ============================
# LOGGING CONFIGURATION
# ============================
LOG_LEVEL=info                    # debug, info, warn, error
NODE_ENV=production               # production, development

# ============================
# PERFORMANCE TUNING (Optional)
# ============================
REQUEST_TIMEOUT=30000             # API request timeout (ms)
MAX_CONNECTIONS=10                # Max concurrent connections
RETRY_ATTEMPTS=3                  # API retry attempts
```

### Required Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WINDCHILL_URL` | ✓ | Base Windchill URL | `http://plm.company.com/Windchill` |
| `WINDCHILL_USER` | ✓ | Service account username | `mcp_service` |
| `WINDCHILL_PASSWORD` | ✓ | Service account password | `secure_password` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_SERVER_NAME` | `windchill-mcp` | MCP server identifier |
| `MCP_SERVER_VERSION` | `1.0.0` | Server version |
| `MCP_SERVER_PORT` | `3000` | HTTP port for health checks |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `NODE_ENV` | `development` | Runtime environment |

## Docker Architecture

### Container Structure

```
Docker Network: windchill-network
├── windchill-mcp-server (Port 3000)
│   ├── MCP Server (StdIO + HTTP)
│   ├── Health Check Endpoint
│   ├── JSON-RPC 2.0 API
│   └── Log Files (./logs volume)
└── windchill-mcp-ui (Port 4200 → 8080)
    ├── Angular Application
    ├── Nginx Reverse Proxy
    └── API Proxy to MCP Server
```

### Docker Compose Services

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  windchill-mcp-server:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ../logs:/app/logs
    healthcheck:
      test: ["CMD", "node", "-e", "/* health check script */"]
      interval: 30s
      timeout: 10s
      retries: 3

  windchill-mcp-ui:
    build:
      context: ..
      dockerfile: docker/Dockerfile.ui
    ports:
      - "4200:8080"
    depends_on:
      - windchill-mcp-server
```

## Production Deployment

### Prerequisites

**System Requirements:**
- Docker Engine 24.0+
- Docker Compose 2.0+
- 2GB RAM minimum (4GB recommended)
- 10GB disk space
- Network access to Windchill server

**Network Requirements:**
- Outbound HTTPS/HTTP to Windchill server
- Inbound access to ports 3000 and 4200
- DNS resolution for Windchill hostname

**Windchill Requirements:**
- Windchill 13.0.2.x or higher
- OData services enabled
- Service account with appropriate permissions
- REST API endpoints accessible

### Deployment Steps

#### 1. Server Preparation

```bash
# Create application directory
sudo mkdir -p /opt/windchill-mcp-server
cd /opt/windchill-mcp-server

# Clone repository
git clone <repository-url> .

# Set permissions
sudo chown -R $(whoami):$(whoami) .
chmod +x docker/*.sh
```

#### 2. Configuration

```bash
# Create environment configuration
cp docker/.env.example docker/.env

# Edit configuration (use secure editor)
nano docker/.env

# Validate configuration
./docker/verify-docker.sh
```

#### 3. Deployment

```bash
# Deploy complete stack
npm run deploy:all

# Alternative: Step-by-step deployment
docker-compose -f docker/docker-compose.yml build
docker-compose -f docker/docker-compose.yml up -d

# Verify deployment
curl -f http://localhost:3000/health
curl -f http://localhost:4200
```

#### 4. Post-Deployment Verification

```bash
# Check container status
docker-compose ps

# Verify logs
docker-compose logs windchill-mcp-server | tail -20

# Test MCP functionality
curl -X POST http://localhost:3000/api \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test",
    "method": "tools/list",
    "params": {}
  }'

# Test UI accessibility
curl -I http://localhost:4200
```

### Security Configuration

#### Container Security

```yaml
# docker-compose.yml security enhancements
services:
  windchill-mcp-server:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
    user: nodejs
    cap_drop:
      - ALL
```

#### Network Security

```yaml
networks:
  windchill-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "false"
      com.docker.network.bridge.enable_ip_masquerade: "true"
```

#### Environment Security

```bash
# Secure .env file permissions
chmod 600 docker/.env

# Use Docker secrets (advanced)
echo "secure_password" | docker secret create windchill_password -

# Environment variable encryption
docker-compose --env-file docker/.env.encrypted up -d
```

## Monitoring and Logging

### Health Checks

**Built-in Health Endpoints:**
```bash
# Server health
curl http://localhost:3000/health
# Returns: {"status":"healthy","service":"windchill-mcp",...}

# Server information
curl http://localhost:3000/
# Returns: {"name":"Windchill MCP Server","version":"1.0.0",...}

# Tools list
curl http://localhost:3000/tools
# Returns: {"tools":[...]}
```

**Docker Health Checks:**
```bash
# Check container health status
docker-compose ps
# Shows health status: healthy, unhealthy, starting

# View health check logs
docker inspect windchill-mcp-server | jq '.[0].State.Health'
```

### Log Management

**Log Files Structure:**
```
logs/
├── windchill-mcp-2024-01-15.log      # Application logs
├── windchill-mcp-error-2024-01-15.log # Error logs only
├── windchill-api-2024-01-15.log       # API request logs
├── exceptions-2024-01-15.log          # Unhandled exceptions
└── rejections-2024-01-15.log          # Unhandled promise rejections
```

**Log Rotation Configuration:**
- Daily rotation at midnight
- Gzip compression for archived logs
- Configurable retention periods:
  - Application logs: 14 days
  - Error logs: 30 days
  - API logs: 7 days
- Maximum file size: 20MB per file

**Log Monitoring Commands:**
```bash
# Monitor real-time logs
docker-compose logs -f windchill-mcp-server

# View specific log types
tail -f logs/windchill-mcp-$(date +%Y-%m-%d).log
tail -f logs/windchill-api-$(date +%Y-%m-%d).log
tail -f logs/windchill-mcp-error-$(date +%Y-%m-%d).log

# Search logs for specific events
grep "ERROR" logs/windchill-mcp-$(date +%Y-%m-%d).log
grep "document_create" logs/windchill-api-$(date +%Y-%m-%d).log

# Log analysis
zcat logs/windchill-mcp-2024-01-14.log.gz | grep "POST"
```

### Monitoring Integration

**Prometheus Metrics (Future Enhancement):**
```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

**Log Aggregation (ELK Stack):**
```yaml
# docker-compose.logging.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0

  kibana:
    image: docker.elastic.co/kibana/kibana:8.0.0
    ports:
      - "5601:5601"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.0.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
```

## Backup and Recovery

### Backup Strategy

**Configuration Backup:**
```bash
# Backup configuration files
tar -czf backup-$(date +%Y%m%d).tar.gz docker/.env docker/docker-compose.yml

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Full application backup
tar -czf full-backup-$(date +%Y%m%d).tar.gz \
  docker/.env \
  docker/docker-compose.yml \
  logs/ \
  --exclude=node_modules \
  --exclude=dist
```

**Automated Backup Script:**
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups/windchill-mcp"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup configuration
docker-compose config > "$BACKUP_DIR/compose-config-$DATE.yml"

# Backup environment
cp docker/.env "$BACKUP_DIR/env-$DATE.backup"

# Backup logs
tar -czf "$BACKUP_DIR/logs-$DATE.tar.gz" logs/

# Clean old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.backup" -mtime +30 -delete
```

### Recovery Procedures

**Configuration Recovery:**
```bash
# Restore from backup
cd /opt/windchill-mcp-server
tar -xzf backup-20240115.tar.gz

# Verify configuration
./docker/verify-docker.sh

# Restart services
docker-compose down
docker-compose up -d
```

**Disaster Recovery:**
```bash
# Complete system recovery
# 1. Restore application files
cd /opt/windchill-mcp-server
tar -xzf full-backup-20240115.tar.gz

# 2. Rebuild containers
docker-compose build --no-cache

# 3. Start services
docker-compose up -d

# 4. Verify functionality
curl http://localhost:3000/health
```

## Scaling and Performance

### Horizontal Scaling

**Docker Swarm Deployment:**
```yaml
# docker-stack.yml
version: '3.8'

services:
  windchill-mcp-server:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

**Kubernetes Deployment:**
```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: windchill-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: windchill-mcp-server
  template:
    metadata:
      labels:
        app: windchill-mcp-server
    spec:
      containers:
      - name: mcp-server
        image: windchill-mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: WINDCHILL_URL
          valueFrom:
            secretKeyRef:
              name: windchill-credentials
              key: url
```

### Performance Tuning

**Container Resources:**
```yaml
# docker-compose.yml
services:
  windchill-mcp-server:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      - NODE_OPTIONS=--max-old-space-size=768
```

**Connection Pooling:**
```env
# .env performance tuning
REQUEST_TIMEOUT=30000
MAX_CONNECTIONS=20
RETRY_ATTEMPTS=3
KEEP_ALIVE_TIMEOUT=5000
```

## Troubleshooting

### Common Deployment Issues

**1. Container Won't Start**
```bash
# Check logs
docker-compose logs windchill-mcp-server

# Common issues:
# - Missing environment variables
# - Invalid Windchill URL
# - Port conflicts
# - Permission issues

# Solutions:
docker-compose down
docker-compose up -d --force-recreate
```

**2. Health Check Failures**
```bash
# Manual health check
curl -v http://localhost:3000/health

# Check container status
docker-compose ps

# Restart unhealthy containers
docker-compose restart windchill-mcp-server
```

**3. Windchill Connection Issues**
```bash
# Test connectivity from container
docker exec windchill-mcp-server ping your-windchill-server

# Test API endpoint
docker exec windchill-mcp-server curl -I http://your-windchill-server/Windchill/servlet/odata

# Check credentials
docker exec windchill-mcp-server env | grep WINDCHILL
```

**4. Angular UI Issues**
```bash
# Check UI container logs
docker-compose logs windchill-mcp-ui

# Test UI directly
curl -I http://localhost:4200

# Common issues:
# - API proxy configuration
# - Build failures
# - Nginx configuration errors
```

### Performance Issues

**High Memory Usage:**
```bash
# Monitor container resources
docker stats windchill-mcp-server

# Check for memory leaks
docker exec windchill-mcp-server cat /proc/meminfo

# Restart if necessary
docker-compose restart windchill-mcp-server
```

**Slow Response Times:**
```bash
# Check API logs for slow requests
grep "duration.*ms" logs/windchill-api-$(date +%Y-%m-%d).log | grep -E "([5-9][0-9]{3}|[1-9][0-9]{4})ms"

# Monitor Windchill server performance
# Check network latency
docker exec windchill-mcp-server ping -c 5 your-windchill-server
```

### Log Analysis

**Error Pattern Analysis:**
```bash
# Find common errors
grep "ERROR" logs/windchill-mcp-error-$(date +%Y-%m-%d).log | \
  cut -d']' -f2- | sort | uniq -c | sort -nr

# Authentication failures
grep "401\|Unauthorized" logs/windchill-api-$(date +%Y-%m-%d).log

# Timeout issues
grep "timeout\|ETIMEDOUT" logs/windchill-mcp-$(date +%Y-%m-%d).log

# Tool execution failures
grep "Tool execution failed" logs/windchill-mcp-$(date +%Y-%m-%d).log
```

## Security Hardening

### Production Security Checklist

- [ ] Use non-root containers
- [ ] Implement resource limits
- [ ] Enable read-only root filesystem
- [ ] Drop unnecessary capabilities
- [ ] Use secrets for sensitive data
- [ ] Enable container logging
- [ ] Configure network isolation
- [ ] Regular security updates
- [ ] Monitor security logs
- [ ] Backup encryption

### Network Security

```bash
# Firewall rules (iptables example)
# Allow only necessary ports
iptables -A INPUT -p tcp --dport 3000 -s trusted-network/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 4200 -s trusted-network/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -s admin-network/24 -j ACCEPT
iptables -A INPUT -j DROP

# SSL/TLS termination (nginx example)
server {
    listen 443 ssl;
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:4200;
    }

    location /api {
        proxy_pass http://localhost:3000;
    }
}
```

This deployment guide provides comprehensive instructions for deploying the Windchill MCP Server in various environments with proper monitoring, security, and maintenance procedures.
#!/bin/bash

# Windchill MCP UI Deployment Script
# This script builds and deploys the Angular UI for the Windchill MCP Server

set -e

echo "🚀 Deploying Windchill MCP Angular UI..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available"
    exit 1
fi

print_status "Building Angular UI Docker image..."

# Build the Angular UI image
if docker compose build windchill-mcp-ui; then
    print_success "Angular UI image built successfully"
else
    echo "❌ Failed to build Angular UI image"
    exit 1
fi

print_status "Starting Angular UI container..."

# Start the UI container
if docker compose up -d windchill-mcp-ui; then
    print_success "Angular UI container started successfully"
else
    echo "❌ Failed to start Angular UI container"
    exit 1
fi

print_status "Waiting for services to be ready..."

# Wait for the UI to be accessible
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if curl -f http://localhost:4200/health &>/dev/null; then
        print_success "Angular UI is accessible at http://localhost:4200"
        break
    fi

    sleep 2
    elapsed=$((elapsed + 2))

    if [ $elapsed -eq $timeout ]; then
        print_warning "Timeout waiting for UI to be accessible"
        print_status "The UI may still be starting up. Please check http://localhost:4200"
    fi
done

print_status "Checking MCP Server connectivity..."

# Check if the MCP server is accessible
if curl -f http://localhost:3000/health &>/dev/null; then
    print_success "MCP Server is accessible at http://localhost:3000"
else
    print_warning "MCP Server may not be running. Please ensure it's started first."
fi

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📱 Angular Web Interface: http://localhost:4200"
echo "🔌 MCP Server API:        http://localhost:3000/api/"
echo "ℹ️  Server Info:           http://localhost:3000"
echo ""
echo "📖 For more information, see README.md"
echo ""

# Show container status
print_status "Container Status:"
docker compose ps
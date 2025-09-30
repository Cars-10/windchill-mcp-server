#!/bin/bash

# Docker build script for Windchill MCP Server
set -e

echo "🐳 Building Windchill MCP Server Docker image..."

# Change to project root directory
cd "$(dirname "$0")/.."

# Build the Docker image
docker build -f docker/Dockerfile -t windchill-mcp-server:latest .

echo "✅ Docker image built successfully!"
echo "📋 Image: windchill-mcp-server:latest"

# Show image size
echo "📊 Image size:"
docker images windchill-mcp-server:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

echo ""
echo "🚀 To run the container:"
echo "   ./docker/docker-run.sh"
echo ""
echo "🔧 To run with docker-compose:"
echo "   cd docker && docker-compose up -d"
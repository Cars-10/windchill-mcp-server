#!/bin/bash

# Docker run script for Windchill MCP Server
set -e

# Change to docker directory
cd "$(dirname "$0")"

echo "🐳 Starting Windchill MCP Server with Docker Compose..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📋 Please copy .env.example to .env and configure your Windchill settings:"
    echo "   cp .env.example .env"
    echo "   # Edit .env with your Windchill server details"
    exit 1
fi

# Build and start the containers
docker compose up --build -d

echo "✅ Windchill MCP Server started!"
echo ""
echo "📋 Service Status:"
docker compose ps

echo ""
echo "🌐 Available endpoints:"
echo "   Health Check: http://localhost:3000/health"
echo "   Server Info:  http://localhost:3000/"
echo "   Tools List:   http://localhost:3000/tools"

echo ""
echo "📊 To view logs:"
echo "   docker compose logs -f"

echo ""
echo "🛑 To stop the server:"
echo "   docker compose down"
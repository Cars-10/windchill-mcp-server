#!/bin/bash

# Docker development script for Windchill MCP Server
set -e

# Change to docker directory
cd "$(dirname "$0")"

echo "🔧 Starting Windchill MCP Server in development mode..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📋 Please copy .env.example to .env and configure your Windchill settings:"
    echo "   cp .env.example .env"
    echo "   # Edit .env with your Windchill server details"
    exit 1
fi

# Create development docker-compose override if it doesn't exist
if [ ! -f docker-compose.dev.yml ]; then
    cat > docker-compose.dev.yml << 'EOF'
version: '3.8'

services:
  windchill-mcp-server:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dev
    volumes:
      - ../src:/app/src
      - ../package.json:/app/package.json
      - ../tsconfig.json:/app/tsconfig.json
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    command: ["npm", "run", "dev"]
EOF
fi

# Create development Dockerfile if it doesn't exist
if [ ! -f Dockerfile.dev ]; then
    cat > Dockerfile.dev << 'EOF'
# Development Dockerfile for Windchill MCP Server
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Start the application in development mode
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]
EOF
fi

# Start development containers
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

echo "🔧 Development server stopped."
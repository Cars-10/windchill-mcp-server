#!/bin/bash

# Docker Verification Script
# This script checks if Docker and Docker Compose are available and working

set -e

echo "🐳 Verifying Docker Environment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Docker availability
print_status "Checking Docker availability..."
if command -v docker &> /dev/null; then
    print_success "Docker is installed"

    # Check Docker version
    DOCKER_VERSION=$(docker --version)
    print_status "Docker version: $DOCKER_VERSION"
else
    print_error "Docker is not installed or not in PATH"
    echo "Please install Docker from https://docker.com/get-started"
    exit 1
fi

# Check Docker Compose availability
print_status "Checking Docker Compose availability..."
if command -v docker-compose &> /dev/null; then
    print_success "Docker Compose (standalone) is available"

    # Check Docker Compose version
    DOCKER_COMPOSE_VERSION=$(docker-compose --version)
    print_status "Docker Compose version: $DOCKER_COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    print_success "Docker Compose (plugin) is available"

    # Check Docker Compose version
    DOCKER_COMPOSE_VERSION=$(docker compose version)
    print_status "Docker Compose version: $DOCKER_COMPOSE_VERSION"
else
    print_error "Docker Compose is not available"
    echo "Please install Docker Compose from https://docker.com/get-started"
    exit 1
fi

# Check if Docker daemon is running
print_status "Checking Docker daemon status..."
if docker info &> /dev/null; then
    print_success "Docker daemon is running"
else
    print_error "Docker daemon is not running"
    echo "Please start Docker Desktop or run 'sudo systemctl start docker'"
    exit 1
fi

# Check required files exist
print_status "Checking required Docker files..."
required_files=(
    "docker/Dockerfile"
    "docker/Dockerfile.ui"
    "docker/Dockerfile.dev"
    "docker/docker-compose.yml"
    "docker/docker-compose.dev.yml"
    "docker/nginx.conf"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "Found $file"
    else
        print_error "Missing $file"
        exit 1
    fi
done

# Check if Angular UI files exist
print_status "Checking Angular UI files..."
angular_files=(
    "angular-ui/package.json"
    "angular-ui/src/main.ts"
    "angular-ui/src/app/app.component.ts"
)

for file in "${angular_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "Found $file"
    else
        print_error "Missing $file"
        exit 1
    fi
done

# Test Docker build (dry run)
print_status "Testing Docker build configuration..."
if docker compose -f docker/docker-compose.yml build --dry-run &> /dev/null; then
    print_success "Docker build configuration is valid"
else
    print_warning "Docker build configuration may have issues"
    print_status "Run 'docker compose -f docker/docker-compose.yml build' to test manually"
fi

echo ""
print_success "Docker environment verification completed!"
echo ""
echo "🚀 Ready to deploy! You can now run:"
echo "   • npm run deploy:all    # Deploy complete system"
echo "   • npm run deploy:ui     # Deploy UI only"
echo "   • npm run docker:dev    # Development mode"
echo ""
echo "📱 Access the application at:"
echo "   • Angular UI: http://localhost:4200"
echo "   • MCP API:    http://localhost:3000/api/"
echo ""
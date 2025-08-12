#!/bin/bash

# Akshay's Framework Setup Script for Linux/macOS
# This script sets up the complete framework environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_header() {
    echo -e "${GREEN}🚀 $1${NC}"
}

# Parse command line arguments
SKIP_DOCKER=false
SKIP_BUILD=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_header "Setting up Akshay's Framework..."

# Check if running as root (for Docker setup)
if [[ $EUID -eq 0 ]]; then
    print_warning "Running as root. This is not recommended for security reasons."
fi

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm: $NPM_VERSION"
else
    print_error "npm not found"
    exit 1
fi

# Check Docker (if not skipped)
if [ "$SKIP_DOCKER" = false ]; then
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker: $DOCKER_VERSION"
        
        # Check if Docker daemon is running
        if ! docker info &> /dev/null; then
            print_error "Docker daemon is not running. Please start Docker."
            exit 1
        fi
    else
        print_error "Docker not found. Please install Docker from https://docs.docker.com/get-docker/"
        print_warning "Or run with --skip-docker flag to skip Docker setup"
        exit 1
    fi
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    print_success "Git: $GIT_VERSION"
else
    print_error "Git not found. Please install Git from https://git-scm.com/"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cp .env.example .env
    print_success ".env file created. Please review and update configuration."
else
    print_success ".env file already exists"
fi

# Create storage directories
print_status "Creating storage directories..."
DIRECTORIES=(
    "storage"
    "storage/artifacts"
    "storage/logs"
    "storage/database"
    "storage/reports"
)

for dir in "${DIRECTORIES[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_success "Created: $dir"
    else
        print_success "Exists: $dir"
    fi
done

# Install dependencies
print_status "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

# Generate Prisma client
print_status "Setting up database..."
npx prisma generate

if [ $? -ne 0 ]; then
    print_error "Failed to generate Prisma client"
    exit 1
fi

# Build packages (if not skipped)
if [ "$SKIP_BUILD" = false ]; then
    print_status "Building packages..."
    npm run build

    if [ $? -ne 0 ]; then
        print_error "Failed to build packages"
        exit 1
    fi
fi

# Docker setup (if not skipped)
if [ "$SKIP_DOCKER" = false ]; then
    print_status "Setting up Docker..."
    
    # Build Docker images
    print_status "Building Docker images..."
    docker-compose build

    if [ $? -ne 0 ]; then
        print_error "Failed to build Docker images"
        exit 1
    fi
fi

# Run database migrations
print_status "Running database migrations..."
npx prisma migrate dev --name init

if [ $? -ne 0 ]; then
    print_error "Failed to run database migrations"
    exit 1
fi

print_success "Setup completed successfully!"
echo ""
print_warning "Next steps:"
echo "1. Review and update .env file with your configuration"
echo "2. Start the framework: docker-compose up -d"
echo "3. Access the UI: http://localhost:3000"
echo "4. Access the API: http://localhost:3001"
echo ""
print_warning "For development:"
echo "- Run 'npm run dev' to start development servers"
echo "- Run 'npm run db:studio' to open Prisma Studio"
#!/bin/bash

# =============================================================================
# AKSHAY'S FRAMEWORK - LINUX/MACOS SETUP SCRIPT  
# =============================================================================
# Bash script to set up Akshay's Framework on Linux/macOS
# Optimized for development environments and CI/CD

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Default options
DEV_MODE=false
CLEAN_MODE=false
BUILD_MODE=false
SHOW_HELP=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_header() {
    echo ""
    echo -e "${BLUE}=============================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}=============================================================${NC}"
    echo ""
}

log_step() {
    echo -e "${GREEN}➤ $1${NC}"
}

log_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Help function
show_help() {
    log_header "Akshay's Framework Setup Script"
    
    cat << EOF
DESCRIPTION:
  Sets up Akshay's Framework for bug bounty reconnaissance and vulnerability testing.
  Compatible with Linux and macOS environments.

USAGE:
  ./scripts/setup.sh [OPTIONS]

OPTIONS:
  -d, --dev       Include development tools (Redis Commander, Prisma Studio)
  -c, --clean     Clean existing containers and volumes before setup
  -b, --build     Force rebuild of Docker images
  -h, --help      Show this help message

EXAMPLES:
  ./scripts/setup.sh                    # Basic setup
  ./scripts/setup.sh --dev              # Setup with dev tools
  ./scripts/setup.sh --clean --build    # Clean rebuild

SERVICES:
  API Server:        http://localhost:3001
  Web Dashboard:     http://localhost:3000  (Phase 2)
  Redis Commander:   http://localhost:8081  (Dev mode)
  Prisma Studio:     http://localhost:5555  (Dev mode)

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dev)
                DEV_MODE=true
                shift
                ;;
            -c|--clean)
                CLEAN_MODE=true
                shift
                ;;
            -b|--build)
                BUILD_MODE=true
                shift
                ;;
            -h|--help)
                SHOW_HELP=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check Docker
    log_step "Checking Docker..."
    if command -v docker &> /dev/null; then
        docker_version=$(docker --version)
        log_success "Docker found: $docker_version"
    else
        log_error "Docker is not installed"
        log_info "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check Docker Compose
    log_step "Checking Docker Compose..."
    if docker compose version &> /dev/null; then
        compose_version=$(docker compose version)
        log_success "Docker Compose found: $compose_version"
    else
        log_error "Docker Compose is not available"
        log_info "Please install Docker Compose or update Docker to latest version"
        exit 1
    fi
    
    # Check if Docker daemon is running
    log_step "Checking Docker daemon..."
    if docker info &> /dev/null; then
        log_success "Docker daemon is running"
    else
        log_error "Docker daemon is not running"
        log_info "Please start Docker daemon"
        exit 1
    fi
    
    # Check available memory (Linux only)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_step "Checking system resources..."
        if command -v free &> /dev/null; then
            memory_gb=$(free -g | awk '/^Mem:/{print $2}')
            if [[ $memory_gb -lt 8 ]]; then
                log_warning "Only ${memory_gb}GB RAM detected. Recommended: 8GB+"
                log_info "Framework will run but performance may be limited"
            else
                log_success "Memory check passed: ${memory_gb}GB RAM available"
            fi
        fi
    fi
    
    # Check disk space
    log_step "Checking disk space..."
    if command -v df &> /dev/null; then
        free_space_gb=$(df . | awk 'NR==2{printf "%.1f", $4/1024/1024}')
        if (( $(echo "$free_space_gb < 10" | bc -l) )); then
            log_warning "Only ${free_space_gb}GB free disk space. Recommended: 20GB+"
        else
            log_success "Disk space check passed: ${free_space_gb}GB free"
        fi
    fi
    
    log_success "Prerequisites check completed"
}

# Initialize environment
initialize_environment() {
    log_header "Initializing Environment"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Create necessary directories
    log_step "Creating directory structure..."
    directories=(
        "storage"
        "storage/artifacts"
        "storage/reports" 
        "storage/temp"
        "logs"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    # Create .env file if it doesn't exist
    log_step "Setting up environment configuration..."
    if [[ ! -f ".env" ]]; then
        cp ".env.example" ".env"
        log_success "Created .env file from template"
        log_warning "Please review and update .env file with your specific configuration"
    else
        log_info ".env file already exists"
    fi
    
    log_success "Environment initialization completed"
}

# Cleanup existing installation
start_cleanup() {
    log_header "Cleaning Up Existing Installation"
    
    log_step "Stopping existing containers..."
    docker compose down --remove-orphans 2>/dev/null || true
    
    if [[ "$CLEAN_MODE" == "true" ]]; then
        log_step "Removing existing volumes..."
        docker compose down --volumes 2>/dev/null || true
        
        log_step "Removing unused Docker resources..."
        docker system prune -f 2>/dev/null || true
        
        log_success "Cleanup completed"
    fi
}

# Build services
build_services() {
    log_header "Building Services"
    
    build_args=""
    
    if [[ "$BUILD_MODE" == "true" ]]; then
        build_args="--build --no-cache"
        log_step "Force rebuilding all images..."
    else
        build_args="--build"
        log_step "Building images (using cache if available)..."
    fi
    
    # Build main services
    if docker compose build $build_args; then
        log_success "Service build completed"
    else
        log_error "Build failed"
        exit 1
    fi
}

# Initialize database
initialize_database() {
    log_header "Setting Up Database"
    
    log_step "Running database setup..."
    if docker compose --profile setup run --rm database-setup; then
        log_success "Database initialization completed"
    else
        log_error "Database setup failed"
        exit 1
    fi
}

# Start services
start_services() {
    log_header "Starting Services"
    
    profiles=""
    
    if [[ "$DEV_MODE" == "true" ]]; then
        profiles="--profile dev"
        log_step "Starting services with development tools..."
    else
        log_step "Starting core services..."
    fi
    
    if docker compose up -d $profiles; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

# Wait for services to be ready
wait_for_services() {
    log_header "Waiting for Services to be Ready"
    
    log_step "Waiting for API server..."
    max_attempts=30
    attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        sleep 2
        ((attempt++))
        
        if curl -f -s http://localhost:3001/health &> /dev/null; then
            log_success "API server is ready"
            break
        else
            echo -n "."
        fi
        
        if [[ $attempt -ge $max_attempts ]]; then
            echo ""
            log_error "API server failed to start within timeout period"
            log_info "Check logs with: docker compose logs api"
            exit 1
        fi
    done
    
    if [[ $attempt -lt $max_attempts ]]; then
        echo ""
    fi
}

# Show service status
show_service_status() {
    log_header "Service Status"
    
    log_step "Checking service health..."
    docker compose ps
    
    echo ""
    log_header "Available Endpoints"
    
    echo -e "${BLUE}🌐 Web Dashboard:     http://localhost:3000 (Coming in Phase 2)${NC}"
    echo -e "${GREEN}🔧 API Server:        http://localhost:3001${NC}"
    echo -e "${GREEN}📊 Health Check:      http://localhost:3001/health${NC}"
    echo -e "${GREEN}📈 System Stats:      http://localhost:3001/api/system/stats${NC}"
    echo -e "${GREEN}🎯 Phases Status:     http://localhost:3001/api/system/phases${NC}"
    
    if [[ "$DEV_MODE" == "true" ]]; then
        echo ""
        echo -e "${YELLOW}Development Tools:${NC}"
        echo -e "${YELLOW}🔴 Redis Commander:   http://localhost:8081${NC}"
        echo -e "${YELLOW}🗄️  Prisma Studio:     http://localhost:5555${NC}"
    fi
    
    echo ""
    log_header "Quick Start Commands"
    
    echo "Create a target:"
    echo -e "${CYAN}  curl -X POST http://localhost:3001/api/targets \\${NC}"
    echo -e "${CYAN}    -H \"Content-Type: application/json\" \\${NC}"
    echo -e "${CYAN}    -d '{\"domain\":\"example.com\",\"priority\":\"HIGH\"}'${NC}"
    
    echo ""
    echo "Get all targets:"
    echo -e "${CYAN}  curl http://localhost:3001/api/targets${NC}"
    
    echo ""
    echo "View logs:"
    echo -e "${CYAN}  docker compose logs -f api${NC}"
    
    echo ""
    echo "Stop services:"
    echo -e "${CYAN}  docker compose down${NC}"
}

# Show next steps
show_next_steps() {
    log_header "Next Steps"
    
    echo -e "${GREEN}🎯 Phase 1: Initial Assessment - COMPLETED${NC}"
    echo "   ✓ Target creation and management"
    echo "   ✓ Scope configuration"
    echo "   ✓ Domain validation"
    echo ""
    
    echo -e "${YELLOW}🔍 Phase 2: Reconnaissance - COMING NEXT${NC}"
    echo "   • Subfinder integration"
    echo "   • DNS resolution (dnsx)"
    echo "   • Live host detection (HTTPx)"
    echo "   • Screenshot capture (Aquatone)"
    echo ""
    
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo "   • README.md - Project overview"
    echo "   • .env.example - Configuration options"
    echo "   • API endpoints: http://localhost:3001/api"
    echo ""
    
    echo -e "${MAGENTA}🛠️ Management:${NC}"
    echo "   • View logs: docker compose logs -f"
    echo "   • Restart: docker compose restart"
    echo "   • Update: git pull && ./scripts/setup.sh --build"
}

# Main execution function
main() {
    # Show help if requested
    if [[ "$SHOW_HELP" == "true" ]]; then
        show_help
        return 0
    fi
    
    log_header "🚀 Akshay's Framework Setup"
    echo -e "${BLUE}Bug Bounty Reconnaissance & Vulnerability Testing Platform${NC}"
    echo -e "${BLUE}Compatible with Linux and macOS${NC}"
    echo ""
    
    # Run setup steps
    check_prerequisites
    initialize_environment
    start_cleanup
    build_services
    initialize_database
    start_services
    wait_for_services
    show_service_status
    show_next_steps
    
    log_header "🎉 Setup Complete!"
    log_success "Akshay's Framework is now running and ready for Phase 1: Initial Assessment"
    log_info "Check the endpoints above to start creating targets and configuring scopes"
}

# Parse arguments and run main function
parse_args "$@"
main
# =============================================================================
# AKSHAY'S FRAMEWORK - WINDOWS SETUP SCRIPT
# =============================================================================
# PowerShell script to set up Akshay's Framework on Windows 11 with Docker Desktop
# Optimized for Intel Core i5 12th Gen, 16GB DDR4, 512GB SSD setup

param(
    [switch]$Dev,      # Include development tools
    [switch]$Clean,    # Clean existing containers and volumes
    [switch]$Build,    # Force rebuild of images
    [switch]$Help      # Show help
)

# Script configuration
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors for output
$Colors = @{
    Red     = "Red"
    Green   = "Green"
    Yellow  = "Yellow"
    Blue    = "Blue"
    Magenta = "Magenta"
    Cyan    = "Cyan"
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    param([string]$Title)
    
    Write-Host ""
    Write-ColorOutput "=============================================================" $Colors.Blue
    Write-ColorOutput " $Title" $Colors.Blue
    Write-ColorOutput "=============================================================" $Colors.Blue
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "➤ $Message" $Colors.Green
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "ℹ $Message" $Colors.Cyan
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "⚠ $Message" $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "✗ $Message" $Colors.Red
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "✓ $Message" $Colors.Green
}

function Show-Help {
    Write-Header "Akshay's Framework Setup Script"
    
    Write-Host "DESCRIPTION:"
    Write-Host "  Sets up Akshay's Framework for bug bounty reconnaissance and vulnerability testing."
    Write-Host "  Optimized for Windows 11 with Docker Desktop, Intel Core i5 12th Gen, 16GB DDR4."
    Write-Host ""
    
    Write-Host "USAGE:"
    Write-Host "  .\scripts\setup.ps1 [-Dev] [-Clean] [-Build] [-Help]"
    Write-Host ""
    
    Write-Host "PARAMETERS:"
    Write-Host "  -Dev     Include development tools (Redis Commander, Prisma Studio)"
    Write-Host "  -Clean   Clean existing containers and volumes before setup"
    Write-Host "  -Build   Force rebuild of Docker images"
    Write-Host "  -Help    Show this help message"
    Write-Host ""
    
    Write-Host "EXAMPLES:"
    Write-Host "  .\scripts\setup.ps1                    # Basic setup"
    Write-Host "  .\scripts\setup.ps1 -Dev               # Setup with dev tools"
    Write-Host "  .\scripts\setup.ps1 -Clean -Build      # Clean rebuild"
    Write-Host ""
    
    Write-Host "SERVICES:"
    Write-Host "  API Server:        http://localhost:3001"
    Write-Host "  Web Dashboard:     http://localhost:3000  (Phase 2)"
    Write-Host "  Redis Commander:   http://localhost:8081  (Dev mode)"
    Write-Host "  Prisma Studio:     http://localhost:5555  (Dev mode)"
    Write-Host ""
}

function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    # Check Docker Desktop
    Write-Step "Checking Docker Desktop..."
    try {
        $dockerVersion = docker --version
        Write-Success "Docker found: $dockerVersion"
    }
    catch {
        Write-Error "Docker Desktop is not installed or not running"
        Write-Info "Please install Docker Desktop for Windows and ensure it's running"
        Write-Info "Download: https://www.docker.com/products/docker-desktop/"
        exit 1
    }
    
    # Check Docker Compose
    Write-Step "Checking Docker Compose..."
    try {
        $composeVersion = docker compose version
        Write-Success "Docker Compose found: $composeVersion"
    }
    catch {
        Write-Error "Docker Compose is not available"
        Write-Info "Please update Docker Desktop to the latest version"
        exit 1
    }
    
    # Check available memory
    Write-Step "Checking system resources..."
    $memory = Get-CimInstance -ClassName Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
    $totalMemoryGB = [math]::Round($memory.Sum / 1GB, 2)
    
    if ($totalMemoryGB -lt 8) {
        Write-Warning "Only ${totalMemoryGB}GB RAM detected. Recommended: 16GB+"
        Write-Info "Framework will run but performance may be limited"
    }
    else {
        Write-Success "Memory check passed: ${totalMemoryGB}GB RAM available"
    }
    
    # Check disk space
    Write-Step "Checking disk space..."
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
    
    if ($freeSpaceGB -lt 10) {
        Write-Warning "Only ${freeSpaceGB}GB free disk space. Recommended: 20GB+"
    }
    else {
        Write-Success "Disk space check passed: ${freeSpaceGB}GB free"
    }
    
    Write-Success "Prerequisites check completed"
}

function Initialize-Environment {
    Write-Header "Initializing Environment"
    
    # Create necessary directories
    Write-Step "Creating directory structure..."
    $directories = @(
        "storage",
        "storage\artifacts", 
        "storage\reports",
        "storage\temp",
        "logs"
    )
    
    foreach ($dir in $directories) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Info "Created directory: $dir"
        }
    }
    
    # Create .env file if it doesn't exist
    Write-Step "Setting up environment configuration..."
    if (!(Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Success "Created .env file from template"
        Write-Warning "Please review and update .env file with your specific configuration"
    }
    else {
        Write-Info ".env file already exists"
    }
    
    Write-Success "Environment initialization completed"
}

function Start-Cleanup {
    Write-Header "Cleaning Up Existing Installation"
    
    Write-Step "Stopping existing containers..."
    docker compose down --remove-orphans 2>$null
    
    if ($Clean) {
        Write-Step "Removing existing volumes..."
        docker compose down --volumes 2>$null
        
        Write-Step "Removing unused Docker resources..."
        docker system prune -f 2>$null
        
        Write-Success "Cleanup completed"
    }
}

function Build-Services {
    Write-Header "Building Services"
    
    $buildArgs = @()
    
    if ($Build) {
        $buildArgs += "--build", "--no-cache"
        Write-Step "Force rebuilding all images..."
    }
    else {
        $buildArgs += "--build"
        Write-Step "Building images (using cache if available)..."
    }
    
    # Build main services
    try {
        & docker compose build $buildArgs
        Write-Success "Service build completed"
    }
    catch {
        Write-Error "Build failed: $_"
        exit 1
    }
}

function Initialize-Database {
    Write-Header "Setting Up Database"
    
    Write-Step "Running database setup..."
    try {
        docker compose --profile setup run --rm database-setup
        Write-Success "Database initialization completed"
    }
    catch {
        Write-Error "Database setup failed: $_"
        exit 1
    }
}

function Start-Services {
    Write-Header "Starting Services"
    
    $profiles = @()
    
    if ($Dev) {
        $profiles += "--profile", "dev"
        Write-Step "Starting services with development tools..."
    }
    else {
        Write-Step "Starting core services..."
    }
    
    try {
        & docker compose up -d $profiles
        Write-Success "Services started successfully"
    }
    catch {
        Write-Error "Failed to start services: $_"
        exit 1
    }
}

function Wait-ForServices {
    Write-Header "Waiting for Services to be Ready"
    
    Write-Step "Waiting for API server..."
    $maxAttempts = 30
    $attempt = 0
    
    do {
        Start-Sleep -Seconds 2
        $attempt++
        
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "API server is ready"
                break
            }
        }
        catch {
            Write-Host "." -NoNewline
        }
        
        if ($attempt -ge $maxAttempts) {
            Write-Error "API server failed to start within timeout period"
            Write-Info "Check logs with: docker compose logs api"
            exit 1
        }
    } while ($true)
}

function Show-ServiceStatus {
    Write-Header "Service Status"
    
    Write-Step "Checking service health..."
    docker compose ps
    
    Write-Host ""
    Write-Header "Available Endpoints"
    
    Write-ColorOutput "🌐 Web Dashboard:     http://localhost:3000 (Coming in Phase 2)" $Colors.Blue
    Write-ColorOutput "🔧 API Server:        http://localhost:3001" $Colors.Green
    Write-ColorOutput "📊 Health Check:      http://localhost:3001/health" $Colors.Green
    Write-ColorOutput "📈 System Stats:      http://localhost:3001/api/system/stats" $Colors.Green
    Write-ColorOutput "🎯 Phases Status:     http://localhost:3001/api/system/phases" $Colors.Green
    
    if ($Dev) {
        Write-Host ""
        Write-ColorOutput "Development Tools:" $Colors.Yellow
        Write-ColorOutput "🔴 Redis Commander:   http://localhost:8081" $Colors.Yellow
        Write-ColorOutput "🗄️  Prisma Studio:     http://localhost:5555" $Colors.Yellow
    }
    
    Write-Host ""
    Write-Header "Quick Start Commands"
    
    Write-Host "Create a target:"
    Write-ColorOutput '  curl -X POST http://localhost:3001/api/targets \' $Colors.Cyan
    Write-ColorOutput '    -H "Content-Type: application/json" \' $Colors.Cyan
    Write-ColorOutput '    -d {"domain":"example.com","priority":"HIGH"}' $Colors.Cyan
    
    Write-Host ""
    Write-Host "Get all targets:"
    Write-ColorOutput "  curl http://localhost:3001/api/targets" $Colors.Cyan
    
    Write-Host ""
    Write-Host "View logs:"
    Write-ColorOutput "  docker compose logs -f api" $Colors.Cyan
    
    Write-Host ""
    Write-Host "Stop services:"
    Write-ColorOutput "  docker compose down" $Colors.Cyan
}

function Show-NextSteps {
    Write-Header "Next Steps"
    
    Write-ColorOutput "🎯 Phase 1: Initial Assessment - COMPLETED" $Colors.Green
    Write-Host "   ✓ Target creation and management"
    Write-Host "   ✓ Scope configuration"
    Write-Host "   ✓ Domain validation"
    Write-Host ""
    
    Write-ColorOutput "🔍 Phase 2: Reconnaissance - COMING NEXT" $Colors.Yellow
    Write-Host "   • Subfinder integration"
    Write-Host "   • DNS resolution (dnsx)"
    Write-Host "   • Live host detection (HTTPx)"
    Write-Host "   • Screenshot capture (Aquatone)"
    Write-Host ""
    
    Write-ColorOutput "📚 Documentation:" $Colors.Blue
    Write-Host "   • README.md - Project overview"
    Write-Host "   • .env.example - Configuration options"
    Write-Host "   • API endpoints: http://localhost:3001/api"
    Write-Host ""
    
    Write-ColorOutput "🛠️ Management:" $Colors.Magenta
    Write-Host "   • View logs: docker compose logs -f"
    Write-Host "   • Restart: docker compose restart"
    Write-Host "   • Update: git pull && .\scripts\setup.ps1 -Build"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

function Main {
    # Show help if requested
    if ($Help) {
        Show-Help
        return
    }
    
    Write-Header "🚀 Akshay's Framework Setup"
    Write-ColorOutput "Bug Bounty Reconnaissance & Vulnerability Testing Platform" $Colors.Blue
    Write-ColorOutput "Optimized for Windows 11 + Docker Desktop" $Colors.Blue
    Write-Host ""
    
    try {
        # Run setup steps
        Test-Prerequisites
        Initialize-Environment
        Start-Cleanup
        Build-Services
        Initialize-Database
        Start-Services
        Wait-ForServices
        Show-ServiceStatus
        Show-NextSteps
        
        Write-Header "🎉 Setup Complete!"
        Write-Success "Akshay's Framework is now running and ready for Phase 1: Initial Assessment"
        Write-Info "Check the endpoints above to start creating targets and configuring scopes"
        
    }
    catch {
        Write-Error "Setup failed: $_"
        Write-Info "Check the error messages above and try again"
        Write-Info "For support, check the logs: docker compose logs"
        exit 1
    }
}

# Run main function
Main
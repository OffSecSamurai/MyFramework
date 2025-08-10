# Akshay's Framework Setup Script for Windows
# This script sets up the complete framework environment

param(
    [switch]$SkipDocker,
    [switch]$SkipBuild,
    [switch]$Force
)

Write-Host "🚀 Setting up Akshay's Framework..." -ForegroundColor Green

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "⚠️  This script should be run as Administrator for Docker setup" -ForegroundColor Yellow
}

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Blue

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 20+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found" -ForegroundColor Red
    exit 1
}

# Check Docker (if not skipped)
if (-not $SkipDocker) {
    try {
        $dockerVersion = docker --version
        Write-Host "✅ Docker: $dockerVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
        Write-Host "   Or run with -SkipDocker flag to skip Docker setup" -ForegroundColor Yellow
        exit 1
    }
}

# Check Git
try {
    $gitVersion = git --version
    Write-Host "✅ Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git not found. Please install Git from https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Blue
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env file created. Please review and update configuration." -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Create storage directories
Write-Host "📁 Creating storage directories..." -ForegroundColor Blue
$directories = @(
    "storage",
    "storage/artifacts",
    "storage/logs", 
    "storage/database",
    "storage/reports"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✅ Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "✅ Exists: $dir" -ForegroundColor Green
    }
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Generate Prisma client
Write-Host "🗄️  Setting up database..." -ForegroundColor Blue
npx prisma generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

# Build packages (if not skipped)
if (-not $SkipBuild) {
    Write-Host "🔨 Building packages..." -ForegroundColor Blue
    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build packages" -ForegroundColor Red
        exit 1
    }
}

# Docker setup (if not skipped)
if (-not $SkipDocker) {
    Write-Host "🐳 Setting up Docker..." -ForegroundColor Blue
    
    # Check if Docker is running
    try {
        docker info | Out-Null
        Write-Host "✅ Docker is running" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker is not running. Please start Docker Desktop" -ForegroundColor Red
        exit 1
    }

    # Build Docker images
    Write-Host "🔨 Building Docker images..." -ForegroundColor Blue
    docker-compose build

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build Docker images" -ForegroundColor Red
        exit 1
    }
}

# Run database migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Blue
npx prisma migrate dev --name init

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to run database migrations" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review and update .env file with your configuration" -ForegroundColor White
Write-Host "2. Start the framework: docker-compose up -d" -ForegroundColor White
Write-Host "3. Access the UI: http://localhost:3000" -ForegroundColor White
Write-Host "4. Access the API: http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "For development:" -ForegroundColor Yellow
Write-Host "- Run 'npm run dev' to start development servers" -ForegroundColor White
Write-Host "- Run 'npm run db:studio' to open Prisma Studio" -ForegroundColor White
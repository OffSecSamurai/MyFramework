# Akshay's Framework Build Script for Windows
# This script builds the complete framework and creates a distribution package

param(
    [switch]$SkipTests,
    [switch]$SkipDocker,
    [string]$Version = "1.0.0"
)

Write-Host "🔨 Building Akshay's Framework v$Version..." -ForegroundColor Green

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "⚠️  This script should be run as Administrator for Docker build" -ForegroundColor Yellow
}

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Blue
if (Test-Path "dist") {
    Remove-Item "dist" -Recurse -Force
}
if (Test-Path "akshays-framework.zip") {
    Remove-Item "akshays-framework.zip" -Force
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Run tests (if not skipped)
if (-not $SkipTests) {
    Write-Host "🧪 Running tests..." -ForegroundColor Blue
    npm test

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tests failed" -ForegroundColor Red
        exit 1
    }
}

# Generate Prisma client
Write-Host "🗄️  Generating Prisma client..." -ForegroundColor Blue
npx prisma generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

# Build all packages
Write-Host "🔨 Building packages..." -ForegroundColor Blue
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build packages" -ForegroundColor Red
    exit 1
}

# Build Docker images (if not skipped)
if (-not $SkipDocker) {
    Write-Host "🐳 Building Docker images..." -ForegroundColor Blue
    
    # Check if Docker is running
    try {
        docker info | Out-Null
        Write-Host "✅ Docker is running" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker is not running. Please start Docker Desktop" -ForegroundColor Red
        exit 1
    }

    # Build Docker images
    docker-compose build

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build Docker images" -ForegroundColor Red
        exit 1
    }
}

# Create distribution directory
Write-Host "📁 Creating distribution package..." -ForegroundColor Blue
$distDir = "dist"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# Copy necessary files
$filesToCopy = @(
    "package.json",
    "package-lock.json",
    "docker-compose.yml",
    ".env.example",
    "README.md",
    "LICENSE"
)

$dirsToCopy = @(
    "packages",
    "prisma",
    "scripts",
    "storage"
)

foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item $file $distDir
        Write-Host "✅ Copied: $file" -ForegroundColor Green
    }
}

foreach ($dir in $dirsToCopy) {
    if (Test-Path $dir) {
        Copy-Item $dir $distDir -Recurse
        Write-Host "✅ Copied: $dir" -ForegroundColor Green
    }
}

# Create startup script
$startupScript = @"
@echo off
echo Starting Akshay's Framework...
echo.
echo 1. Starting Docker services...
docker-compose up -d
echo.
echo 2. Waiting for services to be ready...
timeout /t 10 /nobreak >nul
echo.
echo 3. Running database migrations...
npx prisma migrate deploy
echo.
echo 4. Framework is ready!
echo.
echo Access the UI: http://localhost:3000
echo Access the API: http://localhost:3001
echo.
echo Press any key to stop the framework...
pause >nul
echo.
echo Stopping services...
docker-compose down
echo Framework stopped.
"@

$startupScript | Out-File -FilePath "$distDir\start.bat" -Encoding ASCII

# Create stop script
$stopScript = @"
@echo off
echo Stopping Akshay's Framework...
docker-compose down
echo Framework stopped.
"@

$stopScript | Out-File -FilePath "$distDir\stop.bat" -Encoding ASCII

# Create version file
$versionInfo = @{
    version = $Version
    buildDate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    nodeVersion = (node --version)
    npmVersion = (npm --version)
}

$versionInfo | ConvertTo-Json | Out-File -FilePath "$distDir\version.json" -Encoding UTF8

# Create ZIP file
Write-Host "📦 Creating ZIP package..." -ForegroundColor Blue
$zipPath = "akshays-framework-v$Version.zip"

# Use PowerShell's Compress-Archive if available (PowerShell 5.0+)
if ($PSVersionTable.PSVersion.Major -ge 5) {
    Compress-Archive -Path "$distDir\*" -DestinationPath $zipPath -Force
} else {
    # Fallback to 7-Zip if available
    if (Get-Command "7z" -ErrorAction SilentlyContinue) {
        7z a -tzip $zipPath "$distDir\*"
    } else {
        Write-Host "⚠️  PowerShell 5.0+ or 7-Zip required to create ZIP file" -ForegroundColor Yellow
        Write-Host "   Distribution files are available in the 'dist' directory" -ForegroundColor Yellow
    }
}

if (Test-Path $zipPath) {
    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-Host "✅ Created: $zipPath ($zipSize MB)" -ForegroundColor Green
}

# Clean up dist directory
Remove-Item $distDir -Recurse -Force

Write-Host "🎉 Build completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Distribution package: $zipPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "To install:" -ForegroundColor Yellow
Write-Host "1. Extract the ZIP file" -ForegroundColor White
Write-Host "2. Run 'start.bat' to start the framework" -ForegroundColor White
Write-Host "3. Access the UI: http://localhost:3000" -ForegroundColor White
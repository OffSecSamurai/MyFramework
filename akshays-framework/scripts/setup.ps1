Param(
  [string]$ZipName = "akshays-framework.zip"
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/..\").Path
Set-Location $root

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

Write-Host "Installing dependencies..."
npm ci

Write-Host "Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma | Out-Host

Write-Host "Building Docker images and starting services..."
docker compose up -d --build | Out-Host

if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
  Write-Host "Creating archive $ZipName..."
  $exclude = @('node_modules','dist','.git','.vscode','storage','*.zip')
  $files = Get-ChildItem -Recurse | Where-Object { $exclude -notcontains $_.Name }
  Compress-Archive -Path * -DestinationPath $ZipName -Force
}

Write-Host "Done. Web: http://localhost:${env:WEB_PORT} API: http://localhost:${env:API_PORT}"
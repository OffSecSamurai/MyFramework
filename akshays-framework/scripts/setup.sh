#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma
npx prisma db push --schema=./prisma/schema.prisma

echo "Building Docker images and starting services..."
docker compose up -d --build

# Zip the project for distribution
ZIP_NAME=akshays-framework.zip
if command -v zip >/dev/null 2>&1; then
  echo "Creating $ZIP_NAME..."
  zip -r "$ZIP_NAME" . -x "**/node_modules/*" "**/dist/*" ".git/*" ".vscode/*" "storage/*" "*.zip"
else
  echo "zip not found, skipping archive creation"
fi

echo "Done. Web: http://localhost:${WEB_PORT:-3000} API: http://localhost:${API_PORT:-4000}"
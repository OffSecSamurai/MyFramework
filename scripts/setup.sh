#!/usr/bin/env bash
set -euo pipefail

echo "[+] Installing dependencies with pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  curl -fsSL https://get.pnpm.io/install.sh | sh -
fi
pnpm install

# Generate Prisma client
echo "[+] Generating Prisma client"
pnpm --filter @afw/api exec prisma generate

# Build all packages
pnpm run build

echo "[+] Done. Use 'docker compose up -d --build' to start framework"
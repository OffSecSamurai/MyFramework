#!/usr/bin/env bash
set -euo pipefail

echo "[+] Installing dependencies with pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[+] pnpm not found, installing globally via npm"
  curl -fsSL https://get.pnpm.io/install.sh | SHELL="$(which bash)" sh -
  export PATH="$HOME/.local/share/pnpm:$PATH"
fi

# ensure pnpm available in PATH for this script (global install path)
export PATH="$PATH:$(npm root -g)/../bin"

# create env file if missing
if [ ! -f .env ]; then
  echo "[+] Creating .env from example"
  cp .env.example .env
fi

pnpm install

# Generate Prisma client
echo "[+] Generating Prisma client"
pnpm --filter @afw/api exec prisma generate

# Build all packages
pnpm run build

echo "[+] Done. Use 'docker compose up -d --build' to start framework"
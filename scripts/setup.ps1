param()

Write-Host "[+] Installing dependencies with pnpm"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  iwr https://get.pnpm.io/install.ps1 -UseBasicParsing | iex
}

pnpm install

Write-Host "[+] Generating Prisma client"
pnpm --filter @afw/api exec prisma generate

Write-Host "[+] Building packages"
pnpm run build

Write-Host "[+] Done. Run: docker compose up -d --build"
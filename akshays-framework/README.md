### Akshay's Framework

A modular, Dockerized bug bounty automation framework implementing a phased workflow with real-time UI.

- UI: React 18 + Vite + Tailwind (black/green)
- Backend: Node.js 20 + Express + Socket.IO
- Queue: BullMQ + Redis
- DB: SQLite via Prisma
- Workers: Tool orchestration with Go-based binaries in container, artifacts in `storage/<target>/<timestamp>/`

### Quick Start

1) Copy env

```bash
cp .env.example .env
```

2) Build and run

```bash
bash scripts/setup.sh
# or on Windows PowerShell
./scripts/setup.ps1
```

3) Open web

- Web: http://localhost:3000
- API: http://localhost:4000

### Example CLI Run

```bash
# Inside worker image/container or with docker compose running
node packages/worker/dist/cli.js run full --target juice-shop.herokuapp.com --threads 50 --out storage/juice-shop.herokuapp.com
```

### Phased Workflow

- Initial Assessment (target/scope)
- Stage 1: Passive Reconnaissance (subdomain discovery + resolution)
- Stage 2: Active Reconnaissance (HTTPx, tech, screenshots)
- Stage 3: Spidering & Endpoint Discovery
- Stage 4: Fuzzing & Content Discovery
- Stage 5: Automated Vulnerability Scanning
- Stage 6: Exploitation & Documentation

The UI advances one stage at a time and requests confirmation before the next stage. The worker defaults to Stage 1; subsequent stages are triggered by API/UI controls (to be expanded).

### Storage

Artifacts are stored under `storage/<target>/<timestamp>/`.

### Hardware/Performance

Default thread cap is 50. Adjust via `MAX_THREADS` in `.env`.

### .env

See `.env.example` for configuration. Set `NATIVE_SSH_*` to prefer Kali VM binaries when available (planned expansion).

### License

For authorized security testing and bug bounty engagements only.
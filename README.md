# Akshay’s Framework

Custom reconnaissance & vulnerability testing suite.

## Quick Start

```bash
# clone
git clone <repo-url> akshays-framework && cd akshays-framework

# copy environment variables
cp .env.example .env

# build & start
docker compose up -d --build

# API available at http://localhost:4000
# Web UI at http://localhost:3000 (placeholder)
```

## Structure

```
.
├── docker-compose.yml
├── .env.example
├── prisma/
│   └── schema.prisma
└── packages/
    ├── api/        # Express + Socket.IO API
    ├── worker/     # BullMQ jobs, tool orchestration
    └── web/        # React 18 + Vite + Tailwind UI (WIP)
```

## Phase Workflow

1. Passive Reconnaissance (Subfinder → dnsx → httpx)
2. Active Recon ... (coming)

## Example Run

```bash
# Add target
curl -X POST http://localhost:4000/targets \
  -H "Content-Type: application/json" \
  -d '{"name":"juice-shop","root":"juice-shop.herokuapp.com"}'

# Trigger full run
curl -X POST http://localhost:4000/runs/full \
  -H "Content-Type: application/json" \
  -d '{"targetId":"<target-id>","threads":50}'
```

Monitor progress via WebSocket events and UI once available.
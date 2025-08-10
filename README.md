# Akshay's Framework

A custom reconnaissance and vulnerability testing tool inspired by frameworks like Ars0n. Designed for bug bounty workflows with automated tool chaining and intelligent orchestration.

## 🎯 Overview

Akshay's Framework implements a phased workflow for comprehensive security testing:

1. **Initial Assessment** - Target/scope configuration
2. **Reconnaissance** - Information gathering (Subfinder, dnsx, HTTPx)
3. **Vulnerability Discovery** - Bug hunting (Nuclei, Dirsearch, Gf-Patterns)
4. **Exploitation** - Proof of Concept development
5. **Documentation** - Automated reporting

## 🚀 Features

### Execution Modes
- **Full Mode**: Run complete tool chain automatically
- **Custom Mode**: Select specific tools in any order
- **Single-Tool Mode**: Run individual tools with auto-dependencies

### Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS (Black/Green theme)
- **Backend**: Node.js 20 + Express + BullMQ + Redis
- **Database**: SQLite with Prisma ORM
- **Orchestration**: Docker containers for tool isolation
- **Real-time**: Socket.IO WebSockets for live updates

### Hardware Optimization
- Thread limiting (max 50 for Intel Core i5 12th Gen)
- Memory management for 16GB DDR4 RAM
- SSD-optimized artifact storage
- GPU acceleration where applicable

## 🛠 Installation

### Quick Install (Recommended)
```powershell
# Windows PowerShell
.\scripts\setup.ps1
```

```bash
# Linux/macOS
./scripts/setup.sh
```

### Manual Installation
```bash
# Clone and extract
unzip akshays-framework.zip
cd akshays-framework

# Start services
docker compose up -d

# Access dashboard
open http://localhost:3000
```

## 📋 System Requirements

### Host System
- **OS**: Windows 11 with Docker Desktop
- **Hardware**: Intel Core i5 12th Gen, 16GB DDR4, 512GB SSD
- **Display**: 144Hz (optimized UI refresh rates)

### Virtual Machines
- **Kali VM**: Full pentest toolkit (OWASP ZAP + Chrome)
- **Windows VM**: Burp Suite Pro + Firefox

## 🎮 Usage Examples

### Full Mode Scan
```bash
node dist/index.js run full --target example.com --threads 50 --out storage/example.com
```

### Custom Tool Chain
```bash
node dist/index.js run custom --target example.com --tools subfinder,nuclei,httpx
```

### Single Tool with Dependencies
```bash
node dist/index.js run single --tool aquatone --target example.com
```

## 🌐 Web Dashboard

Navigate to `http://localhost:3000` for the interactive dashboard:

- **Target Management**: Grid view with hover effects
- **Execution Monitoring**: Real-time progress with status LEDs
- **Artifact Browser**: Organized file explorer
- **Vulnerability Reports**: Nuclei/Gf pattern results
- **Live Logs**: Streaming tool outputs

## 🔧 Configuration

### Environment Variables
```bash
cp .env.example .env
# Edit .env with your settings
```

### Tool Locations
- **Native Detection**: Automatically detects Kali VM tools
- **Docker Fallback**: Uses containerized versions
- **Proxy Integration**: Routes through Burp Suite Pro

## 📁 Project Structure

```
akshays-framework/
├── packages/
│   ├── api/           # Node.js backend
│   ├── web/           # React frontend  
│   └── worker/        # Tool orchestration
├── prisma/            # Database schema
├── storage/           # Scan artifacts
├── scripts/           # Setup scripts
└── docker-compose.yml # Service orchestration
```

## 🚦 Status Indicators

- **Grey**: Queued
- **Blue**: Running
- **Green**: Completed
- **Red**: Failed

## 🔗 Integration Support

- **Docker Desktop**: Host service management
- **Kali VM**: Native tool mounting with `--native` flag
- **Burp Suite**: Proxy routing for request inspection
- **OWASP ZAP**: Automated security scanning

## 📊 Performance Optimization

- **Thread Capping**: Maximum 50 concurrent threads
- **Memory Management**: Chunked processing for large datasets
- **Artifact Streaming**: Real-time file generation
- **Queue Persistence**: Resume interrupted scans

## 🎯 Methodology Integration

Follows systematic reconnaissance methodology:
- **Stage 1**: Passive reconnaissance (broadening the net)
- **Stage 2**: Active reconnaissance (mapping live surface)
- **Stage 3**: Spidering & endpoint discovery
- **Stage 4**: Active fuzzing & content discovery
- **Stage 5**: Automated vulnerability scanning
- **Stage 6**: Manual analysis & logic testing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔒 Security

For security issues, please email: security@akshaysframework.com

---

**Built for efficient bug bounty workflows with love ❤️**
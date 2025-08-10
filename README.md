# Akshay's Framework

A comprehensive reconnaissance and vulnerability testing framework inspired by Ars0n, designed for bug bounty workflows and penetration testing.

## 🚀 Features

- **Multiple Execution Modes**: Full, Custom, and Single-Tool modes
- **Phased Workflow**: Initial Assessment → Reconnaissance → Vulnerability Discovery → Exploitation → Documentation
- **Real-time Monitoring**: Live progress tracking with WebSocket updates
- **Docker Integration**: Isolated tool execution with native fallback
- **Modern UI**: React 18 + Vite + Tailwind CSS with dark theme
- **Persistent Storage**: SQLite with Prisma ORM for targets and executions
- **Queue Management**: BullMQ + Redis for scalable job processing

## 🏗️ Architecture

```
akshays-framework/
├── packages/
│   ├── api/          # Node.js + Express backend
│   ├── web/          # React 18 + Vite frontend
│   └── worker/       # Docker worker containers
├── prisma/           # Database schema
├── storage/          # Artifacts and reports
├── scripts/          # Setup and build scripts
└── docker-compose.yml
```

## 🛠️ Installation

### Quick Start (Windows)
```powershell
# Clone and setup
git clone <repository>
cd akshays-framework
.\scripts\setup.ps1

# Start the framework
docker-compose up -d

# Access the UI
http://localhost:3000
```

### Manual Setup
```bash
# Install dependencies
npm install

# Build containers
docker-compose build

# Start services
docker-compose up -d

# Run database migrations
npx prisma migrate dev
```

## 🎯 Usage

### Execution Modes

1. **Full Mode**: Complete reconnaissance chain
   ```bash
   node dist/index.js run full --target example.com --threads 50
   ```

2. **Custom Mode**: Select specific tools
   ```bash
   node dist/index.js run custom --target example.com --tools "subfinder,nuclei"
   ```

3. **Single Tool**: Run one tool with dependencies
   ```bash
   node dist/index.js run tool --target example.com --tool aquatone
   ```

### Tool Chain

**Stage 1: Passive Reconnaissance**
- Subfinder (subdomain enumeration)
- Assetfinder (additional subdomains)
- Findomain (fast subdomain discovery)
- Chaos (cloud asset discovery)
- Amass (comprehensive enumeration)

**Stage 2: Active Reconnaissance**
- DNSx (DNS resolution and live hosts)
- HTTPx (web server discovery and tech fingerprinting)
- Aquatone (visual reconnaissance)
- Gowitness (screenshot capture)

**Stage 3: Spidering & Endpoint Discovery**
- Gau (Wayback Machine URLs)
- Waybackurls (historical URLs)
- Katana (web crawling)
- Arjun (parameter discovery)
- ParamSpider (parameter extraction)

**Stage 4: Active Fuzzing**
- Gobuster (directory brute-forcing)
- FFUF (advanced fuzzing)
- Nuclei (vulnerability scanning)

**Stage 5: Vulnerability Scanning**
- Nuclei (comprehensive scanning)
- Nikto (web server analysis)
- CMSmap (CMS vulnerability detection)

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL="file:./dev.db"

# Redis
REDIS_URL="redis://localhost:6379"

# API Configuration
API_PORT=3001
API_HOST=0.0.0.0

# Worker Configuration
WORKER_THREADS=50
WORKER_TIMEOUT=300000

# Tool Paths (for native mode)
SUBFINDER_PATH="/usr/local/bin/subfinder"
NUCLEI_PATH="/usr/local/bin/nuclei"
# ... other tools
```

### Docker Configuration
The framework uses Docker for tool isolation:

- **API Service**: Node.js backend with Express
- **Web Service**: React frontend with Vite
- **Worker Service**: Tool execution containers
- **Redis Service**: Job queue management

## 📊 Monitoring & Reports

### Real-time Dashboard
- Live execution status with color-coded indicators
- Progress bars for each tool
- WebSocket updates for instant feedback

### Artifact Storage
```
storage/
├── example.com/
│   ├── 2024-01-15_10-30-00/
│   │   ├── subfinder_output.txt
│   │   ├── nuclei_report.json
│   │   ├── aquatone_report/
│   │   └── screenshots/
│   └── latest/
```

### Report Generation
- HTML reports with vulnerability summaries
- JSON exports for integration
- CSV data for analysis

## 🔒 Security Considerations

- All tools run in isolated Docker containers
- No sensitive data stored in plain text
- Configurable timeout limits
- Rate limiting for external APIs
- Secure artifact storage

## 🐛 Troubleshooting

### Common Issues

1. **Docker not running**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. **Database connection issues**
   ```bash
   npx prisma migrate reset
   npx prisma generate
   ```

3. **Tool execution failures**
   - Check Docker container logs
   - Verify tool paths in configuration
   - Ensure sufficient system resources

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f api
docker-compose logs -f worker
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by Ars0n framework
- Built with modern web technologies
- Designed for bug bounty hunters and security researchers

---

**Note**: This framework is for authorized security testing only. Always ensure you have proper authorization before testing any target.
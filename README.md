# Akshay's Framework 🚀

A comprehensive reconnaissance and vulnerability testing framework for bug bounty hunters and security researchers.

## 🎯 Features

- **Complete Reconnaissance Workflow**: From subdomain discovery to vulnerability scanning
- **Smart Data Processing**: Automatic cleaning, deduplication, and enrichment
- **Real-Time Monitoring**: Live progress tracking and status updates
- **Advanced UI**: Modern, responsive interface with comprehensive data display
- **Production Ready**: Scalable, reliable, and optimized for your hardware

## 🛠️ Quick Start

### Prerequisites

- **Docker & Docker Compose**
- **Node.js 20+**
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd akshays-framework
   ```

2. **Run the installation script**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

3. **Access the framework**
   - Web Interface: http://localhost:3000
   - API Endpoint: http://localhost:3001

### Manual Installation

If you prefer manual installation:

```bash
# Install dependencies
npm run install:all

# Setup database
npm run setup:db

# Build packages
npm run build

# Build Docker images
docker-compose build

# Start services
docker-compose up -d
```

## 🏗️ Architecture

### Services

- **API** (Port 3001): Backend API with Express.js
- **Web** (Port 3000): React frontend served by Nginx
- **Worker** (Port 3002): Background job processing
- **Redis** (Port 6379): Job queue and caching
- **Tools**: Container with all security tools

### Data Flow

```
1. Tool Execution → Raw Output
2. Data Extraction → Parsed Data
3. Data Cleaning → Normalized Data
4. Deduplication → Unique Data
5. Validation → Verified Data
6. Enrichment → Enhanced Data
7. Storage → Database + Files
8. UI Display → Real-Time Updates
```

## 🎮 Usage

### 1. Create a Target

Add a new target for reconnaissance:

```bash
curl -X POST http://localhost:3001/api/targets \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "name": "Example Target",
    "description": "Test target for reconnaissance"
  }'
```

### 2. Start Execution

Choose from three execution modes:

- **Full Mode**: Complete reconnaissance workflow
- **Custom Mode**: Select specific tools
- **Single Tool**: Run one tool with dependencies

### 3. Monitor Progress

Watch real-time progress in the web interface:
- Live execution status
- Tool completion tracking
- Data processing statistics
- Real-time results

### 4. View Results

Access comprehensive results:
- **Overview**: Summary statistics
- **Subdomains**: Discovered subdomains
- **Live Hosts**: Active hosts
- **Live URLs**: Working URLs
- **Vulnerabilities**: Security findings
- **Artifacts**: Generated files

## 🛡️ Security Tools

### Subdomain Enumeration
- **Subfinder**: Fast subdomain discovery
- **Assetfinder**: Domain and subdomain discovery
- **Findomain**: Cross-platform subdomain enumerator
- **Chaos**: Cloud asset discovery
- **Amass**: In-depth attack surface mapping

### DNS Resolution
- **DNSx**: Multi-purpose DNS toolkit

### Web Discovery
- **HTTPx**: HTTP toolkit for probing
- **Aquatone**: Visual reconnaissance

### Content Discovery
- **Gau**: Fetch known URLs
- **Waybackurls**: Wayback Machine URLs
- **Katana**: Next-generation crawling
- **Arjun**: HTTP parameter discovery
- **Gobuster**: Directory/file busting
- **FFUF**: Fast web fuzzer

### Vulnerability Scanning
- **Nuclei**: Fast vulnerability scanner
- **Nikto**: Web server scanner

## 📊 Data Processing

### Automatic Processing
- **Deduplication**: Remove duplicate entries
- **Cleaning**: Normalize and validate data
- **Enrichment**: Add metadata and risk scores
- **Categorization**: Classify by type and severity

### Processing Statistics
Each step tracks:
- Raw count (original data)
- Cleaned count (after validation)
- Deduplicated count (after deduplication)
- Final count (processed data)

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database
DATABASE_URL=file:./storage/database.sqlite

# Redis
REDIS_URL=redis://localhost:6379

# API
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Worker
WORKER_CONCURRENCY=5
EXECUTION_MODE=docker

# Storage
STORAGE_PATH=./storage

# Logging
LOG_LEVEL=info
```

### Docker Configuration

The framework uses Docker Compose for orchestration:

```yaml
services:
  api:      # Backend API
  web:      # Frontend
  worker:   # Background processing
  redis:    # Job queue
  tools:    # Security tools
```

## 📈 Performance

### Hardware Optimization
- **CPU**: Optimized for Intel Core i5 12th Gen
- **RAM**: Efficient for 16GB DDR4
- **Storage**: Optimized for 512GB SSD
- **Threading**: Capped at 50 threads

### Scalability
- **Worker Scaling**: Multiple worker instances
- **Queue Management**: Redis-based job queues
- **Resource Limits**: Docker container limits
- **Caching**: Redis caching layer

## 🐛 Troubleshooting

### Common Issues

1. **Docker not running**
   ```bash
   sudo systemctl start docker
   ```

2. **Port conflicts**
   ```bash
   # Check what's using the ports
   netstat -tulpn | grep :3000
   netstat -tulpn | grep :3001
   ```

3. **Database issues**
   ```bash
   # Reset database
   npm run db:reset
   ```

4. **Build failures**
   ```bash
   # Clean and rebuild
   docker-compose down
   docker system prune -f
   docker-compose build --no-cache
   ```

### Logs

View service logs:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f web
```

## 🚀 Production Deployment

### Requirements
- **Docker & Docker Compose**
- **4GB+ RAM**
- **20GB+ Storage**
- **Linux/Windows/macOS**

### Deployment Steps

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd akshays-framework
   ./install.sh
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Verify deployment**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3000/health
   ```

## 📝 API Documentation

### Endpoints

- `GET /health` - Health check
- `GET /api/targets` - List targets
- `POST /api/targets` - Create target
- `GET /api/executions` - List executions
- `POST /api/executions` - Start execution
- `GET /api/vulnerabilities` - List vulnerabilities
- `GET /api/artifacts` - List artifacts

### WebSocket Events

- `execution-update` - Execution status updates
- `task-update` - Task completion updates
- `progress-update` - Progress percentage updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **ProjectDiscovery** for amazing security tools
- **OWASP** for security guidelines
- **Bug bounty community** for inspiration

---

**Akshay's Framework** - Making reconnaissance and vulnerability testing accessible and efficient! 🎯
# 🔍 Akshay's Framework - Quick Start Guide

## One-Command Installation for Kali Linux

```bash
# Download all files and run the installer
curl -sSL https://github.com/your-repo/akshay-framework/archive/main.zip -o framework.zip
unzip framework.zip
cd akshay-framework-main
chmod +x install.sh
./install.sh
```

## What Happens During Installation

✅ **System Updates** - Updates Kali Linux packages  
✅ **Node.js 20.x** - Installs latest Node.js and npm  
✅ **24+ Security Tools** - Installs all reconnaissance tools  
✅ **PostgreSQL Database** - Sets up local database  
✅ **Framework Setup** - Configures the web application  
✅ **Desktop Launcher** - Creates easy-access shortcuts  

## Quick Access After Installation

```bash
# Start the framework
akshay-framework

# Or use the desktop launcher
# Double-click "Akshay's Framework" on desktop

# Or manual start
cd ~/akshay-framework && ./start-framework.sh
```

## Access the Web Interface

Open browser: **http://localhost:3000**

## Basic Usage Workflow

1. **Create Target** → Add domain (e.g., example.com)
2. **Select Tools** → Choose reconnaissance tools  
3. **Run Scan** → Execute and monitor progress
4. **View Results** → Analyze vulnerabilities and files
5. **Export Reports** → Download findings

## Installed Security Tools

### Stage 1: Subdomain Discovery
- subfinder, assetfinder, findomain, amass, chaos

### Stage 2: Active Reconnaissance
- nmap, httpx, naabu, aquatone (screenshots)

### Stage 3: Web Discovery  
- gau, waybackurls, katana, gobuster, dirb

### Stage 4: Vulnerability Scanning
- nuclei, sqlmap, nikto, whatweb, wafw00f

## File Locations

- **Framework:** `~/akshay-framework/`
- **Results:** `/tmp/akshay-framework-workspace/`
- **Database:** PostgreSQL local instance
- **Logs:** Application console output

## Troubleshooting

```bash
# Check if tools are installed
subfinder -version
httpx -version
nuclei -version

# Restart database if needed
sudo systemctl restart postgresql

# Check if port 3000 is free
sudo netstat -tulpn | grep :3000

# Restart framework
cd ~/akshay-framework
./start-framework.sh
```

## Advanced Configuration

```bash
# Add API keys for enhanced functionality
nano ~/.env

# Setup auto-start service
sudo systemctl enable akshay-framework

# Create automated backups  
crontab -e
# Add: 0 2 * * * ~/akshay-framework/backup-framework.sh
```

## API Keys (Optional but Recommended)

Add these to `~/.env` for enhanced capabilities:

```env
SHODAN_API_KEY=your_shodan_key
VIRUSTOTAL_API_KEY=your_virustotal_key  
CHAOS_API_KEY=your_chaos_key
SECURITYTRAILS_API_KEY=your_securitytrails_key
```

---

**Ready to hunt bugs! 🐛** Access the interface at http://localhost:3000
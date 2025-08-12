# Akshay's Framework - Kali Linux Installation Guide

## 🔍 Professional Bug Bounty Reconnaissance Platform

Akshay's Framework is a comprehensive bug bounty reconnaissance platform designed specifically for security researchers and penetration testers. This installer will set up the entire framework on Kali Linux with all necessary security tools.

## 🚀 Quick Installation

### Quick Fix for Common Issues (Recommended)

If you're experiencing Python package or installation issues:

```bash
# Navigate to the framework directory first
cd /path/to/AkshayFramework

# Run the quick fix script
chmod +x QUICK-FIX.sh
./QUICK-FIX.sh
```

### Full Installation

```bash
# Download and run the installer
curl -sSL https://raw.githubusercontent.com/your-repo/akshay-framework/main/install.sh | bash

# Or if you have the files locally:
chmod +x install.sh
./install.sh
```

### Manual Installation (If automated fails)

```bash
# 1. Install system dependencies
sudo apt update && sudo apt install -y nodejs npm pipx python3-venv

# 2. Install Python tools using pipx
pipx install arjun dirsearch
sudo apt install -y sublist3r sqlmap

# 3. Install Node.js dependencies
npm install

# 4. Start the framework
npm run dev
```

### Manual Installation

1. **Clone or download the framework:**
   ```bash
   git clone https://github.com/your-repo/akshay-framework.git
   cd akshay-framework
   ```

2. **Run the installer:**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

3. **Start the framework:**
   ```bash
   ./start-framework.sh
   ```

## 🛠️ What Gets Installed

### Security Tools (24+ Tools)
- **Subdomain Discovery:** subfinder, assetfinder, findomain, amass, chaos
- **Port Scanning:** nmap, naabu, masscan
- **Web Analysis:** httpx, nuclei, aquatone
- **URL Discovery:** gau, waybackurls, katana, hakrawler
- **Vulnerability Scanning:** nuclei, sqlmap, xsser
- **Directory Enumeration:** gobuster, dirb, dirsearch, ffuf
- **Web Application:** nikto, whatweb, wafw00f
- **Additional:** theharvester, dnsrecon, fierce

### System Dependencies
- Node.js 20.x with npm
- PostgreSQL database
- Go programming language
- Python 3 with pip
- Chromium browser (for screenshots)

### Framework Features
- Real-time reconnaissance monitoring
- Professional vulnerability dashboard
- File management and downloads
- Multi-stage tool execution
- WebSocket-based progress tracking
- Dark-themed security-focused UI

## 🎯 Usage

### Starting the Framework

```bash
# Method 1: Use the desktop launcher (if GUI available)
Double-click "Akshay's Framework" on desktop

# Method 2: Use the command alias
akshay-framework

# Method 3: Manual start
cd ~/akshay-framework
./start-framework.sh
```

### Accessing the Interface

Open your browser and navigate to:
```
http://localhost:3000
```

### Basic Workflow

1. **Create Target:** Add domain or URL list
2. **Select Tools:** Choose reconnaissance tools by stage
3. **Run Scan:** Execute tools and monitor progress
4. **Analyze Results:** Review vulnerabilities and files
5. **Export Reports:** Download findings and evidence

## 📋 Tool Stages

### Stage 1: Initial Reconnaissance
- Subdomain discovery (subfinder, assetfinder, amass)
- DNS enumeration (fierce, dnsrecon)
- Information gathering (theharvester)

### Stage 2: Active Reconnaissance  
- Port scanning (nmap, naabu)
- HTTP probing (httpx)
- Service detection
- Screenshot capture (aquatone)

### Stage 3: Web Application Discovery
- URL discovery (gau, waybackurls, katana)
- Directory enumeration (gobuster, dirb)
- Parameter discovery (arjun)

### Stage 4: Vulnerability Assessment
- Nuclei template scanning
- SQL injection testing (sqlmap)
- XSS detection
- Web application scanning (nikto)

## ⚙️ Configuration

### Environment Variables

Edit `~/.env` to configure:

```bash
# Database Configuration
DATABASE_URL="postgresql://localhost:5432/akshay_framework"
PGHOST=localhost
PGPORT=5432
PGUSER=akshay_user
PGPASSWORD=akshay_password
PGDATABASE=akshay_framework

# Application Configuration
NODE_ENV=production
PORT=3000

# API Keys (Optional)
SHODAN_API_KEY=your_shodan_key_here
VIRUSTOTAL_API_KEY=your_virustotal_key_here
CHAOS_API_KEY=your_chaos_key_here
```

### Custom Tool Configuration

Tools can be configured in the web interface or by modifying the tool definitions in the database.

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   sudo netstat -tulpn | grep :3000
   sudo kill -9 <PID>
   ```

2. **Database connection issues:**
   ```bash
   sudo systemctl restart postgresql
   npm run db:push
   ```

3. **Missing tools:**
   ```bash
   # Reinstall Go tools
   go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
   
   # Update PATH
   export PATH=$PATH:$HOME/go/bin:$HOME/.local/bin
   source ~/.bashrc
   ```

4. **Permission issues:**
   ```bash
   sudo chown -R $USER:$USER ~/akshay-framework
   chmod +x ~/akshay-framework/start-framework.sh
   ```

### Logs and Debugging

```bash
# Check application logs
cd ~/akshay-framework
npm run dev

# Check database status
sudo systemctl status postgresql

# Test tool installation
subfinder -version
httpx -version
nuclei -version
```

## 🛡️ Security Considerations

### Responsible Use
- Only test on authorized targets
- Respect rate limits and robots.txt
- Follow responsible disclosure practices
- Comply with local laws and regulations

### Data Protection
- Results are stored locally in PostgreSQL
- No data is sent to external servers
- Secure your API keys in environment variables
- Regular database backups recommended

## 📚 Advanced Usage

### Custom Tool Integration

1. Add tool definitions in the database
2. Configure command templates
3. Set input/output file mappings
4. Define result parsing rules

### API Integration

The framework provides REST APIs for:
- Target management
- Tool execution
- Result retrieval
- File downloads

### Automation

```bash
# Automated scans via API
curl -X POST http://localhost:3000/api/targets \
  -H "Content-Type: application/json" \
  -d '{"target": "example.com", "type": "domain"}'

curl -X POST http://localhost:3000/api/executions \
  -H "Content-Type: application/json" \
  -d '{"targetId": "1", "toolIds": ["subfinder", "httpx"]}'
```

## 🔄 Updates

### Framework Updates

```bash
cd ~/akshay-framework
git pull origin main
npm install
npm run db:push
```

### Tool Updates

```bash
# Update Go tools
go get -u all

# Update system packages
sudo apt update && sudo apt upgrade

# Update Python packages
pip3 install --upgrade --user arjun paramspider
```

## 📞 Support

### Getting Help

1. Check the troubleshooting section above
2. Review application logs for errors
3. Ensure all tools are properly installed
4. Verify database connectivity

### Community

- Join our Discord server
- Follow updates on Twitter
- Contribute on GitHub
- Share feedback and feature requests

## 📄 License

This framework is released under the MIT License. See LICENSE file for details.

## ⚠️ Disclaimer

This tool is for educational and authorized security testing purposes only. Users are responsible for complying with applicable laws and obtaining proper authorization before testing any systems.

---

**Happy Bug Hunting! 🐛🔍**
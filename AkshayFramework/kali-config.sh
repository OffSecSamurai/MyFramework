#!/bin/bash

# Kali Linux Specific Configuration for Akshay's Framework
# This script optimizes the framework for Kali Linux environment

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[CONFIG]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configure Kali-specific tool paths
configure_tool_paths() {
    log_info "Configuring Kali Linux tool paths..."
    
    # Create tool configuration file
    cat > tool-paths.json << 'EOF'
{
  "subfinder": "/usr/bin/subfinder",
  "assetfinder": "$HOME/go/bin/assetfinder",
  "findomain": "/usr/bin/findomain",
  "amass": "/usr/bin/amass",
  "httpx": "$HOME/go/bin/httpx",
  "nmap": "/usr/bin/nmap",
  "nuclei": "$HOME/go/bin/nuclei",
  "sqlmap": "/usr/bin/sqlmap",
  "gobuster": "/usr/bin/gobuster",
  "dirb": "/usr/bin/dirb",
  "nikto": "/usr/bin/nikto",
  "whatweb": "/usr/bin/whatweb",
  "wafw00f": "/usr/bin/wafw00f",
  "theharvester": "/usr/bin/theharvester",
  "dnsrecon": "/usr/bin/dnsrecon",
  "fierce": "/usr/bin/fierce",
  "masscan": "/usr/bin/masscan",
  "gau": "$HOME/go/bin/gau",
  "waybackurls": "$HOME/go/bin/waybackurls",
  "katana": "$HOME/go/bin/katana",
  "aquatone": "$HOME/go/bin/aquatone",
  "naabu": "$HOME/go/bin/naabu",
  "chaos": "$HOME/go/bin/chaos",
  "hakrawler": "$HOME/go/bin/hakrawler",
  "arjun": "$HOME/.local/bin/arjun",
  "paramspider": "$HOME/.local/bin/paramspider",
  "chromium": "/usr/bin/chromium"
}
EOF
    
    log_success "Tool paths configured"
}

# Setup systemd service for auto-start
setup_systemd_service() {
    log_info "Setting up systemd service..."
    
    cat > akshay-framework.service << EOF
[Unit]
Description=Akshay's Framework - Bug Bounty Reconnaissance Platform
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/akshay-framework
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run production
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Install the service
    sudo cp akshay-framework.service /etc/systemd/system/
    sudo systemctl daemon-reload
    
    log_success "Systemd service created"
    log_warning "To enable auto-start: sudo systemctl enable akshay-framework"
}

# Configure firewall rules
configure_firewall() {
    log_info "Configuring firewall rules..."
    
    # Allow port 3000 for the web interface
    sudo ufw allow 3000/tcp comment "Akshay Framework Web Interface"
    
    # Allow PostgreSQL port (local only)
    sudo ufw allow from 127.0.0.1 to any port 5432
    
    log_success "Firewall configured"
}

# Setup API key management
setup_api_keys() {
    log_info "Setting up API key management..."
    
    # Create API keys template
    cat > api-keys-template.sh << 'EOF'
#!/bin/bash

# Akshay's Framework API Keys Configuration
# Copy this file to api-keys.sh and add your actual API keys

# Uncomment and add your API keys below:

# Shodan API Key (for enhanced subdomain discovery)
# export SHODAN_API_KEY="your_shodan_api_key_here"

# VirusTotal API Key (for domain reputation checks)
# export VIRUSTOTAL_API_KEY="your_virustotal_api_key_here"

# Chaos API Key (for ProjectDiscovery Chaos dataset)
# export CHAOS_API_KEY="your_chaos_api_key_here"

# SecurityTrails API Key (for historical DNS data)
# export SECURITYTRAILS_API_KEY="your_securitytrails_api_key_here"

# Censys API Keys (for certificate transparency)
# export CENSYS_API_ID="your_censys_api_id_here"
# export CENSYS_API_SECRET="your_censys_api_secret_here"

# GitHub Token (for enhanced tool downloads)
# export GITHUB_TOKEN="your_github_token_here"

# Source this file in your ~/.bashrc:
# echo "source ~/akshay-framework/api-keys.sh" >> ~/.bashrc

echo "API keys loaded for Akshay's Framework"
EOF
    
    chmod +x api-keys-template.sh
    
    log_success "API key template created"
    log_warning "Copy api-keys-template.sh to api-keys.sh and add your keys"
}

# Optimize PostgreSQL for reconnaissance workloads
optimize_postgresql() {
    log_info "Optimizing PostgreSQL configuration..."
    
    # Create PostgreSQL optimization script
    cat > optimize-postgres.sql << 'EOF'
-- Optimize PostgreSQL for Akshay's Framework

-- Increase work memory for complex queries
ALTER SYSTEM SET work_mem = '256MB';

-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '512MB';

-- Optimize for write-heavy workloads
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- Increase connection limits
ALTER SYSTEM SET max_connections = 200;

-- Optimize for SSD storage
ALTER SYSTEM SET random_page_cost = 1.1;

-- Enable query performance tracking
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;

-- Reload configuration
SELECT pg_reload_conf();
EOF
    
    # Apply optimizations
    sudo -u postgres psql -f optimize-postgres.sql
    
    log_success "PostgreSQL optimized"
}

# Create backup script
create_backup_script() {
    log_info "Creating backup script..."
    
    cat > backup-framework.sh << 'EOF'
#!/bin/bash

# Akshay's Framework Backup Script

BACKUP_DIR="$HOME/akshay-framework-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="akshay-framework-backup-$DATE.tar.gz"

echo "Creating backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Stop the framework if running
if pgrep -f "akshay-framework" > /dev/null; then
    echo "Stopping framework..."
    pkill -f "akshay-framework"
    RESTART_NEEDED=true
fi

# Backup database
echo "Backing up database..."
pg_dump akshay_framework > "$BACKUP_DIR/database-$DATE.sql"

# Backup application files and results
echo "Backing up application files..."
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    --exclude="node_modules" \
    --exclude=".git" \
    --exclude="*.log" \
    ~/akshay-framework \
    /tmp/akshay-framework-workspace

echo "Backup completed: $BACKUP_DIR/$BACKUP_FILE"

# Restart framework if it was running
if [ "$RESTART_NEEDED" = true ]; then
    echo "Restarting framework..."
    cd ~/akshay-framework && ./start-framework.sh &
fi

# Clean old backups (keep last 7 days)
find "$BACKUP_DIR" -name "akshay-framework-backup-*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "database-*.sql" -mtime +7 -delete

echo "Backup process completed"
EOF
    
    chmod +x backup-framework.sh
    
    log_success "Backup script created"
}

# Setup log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."
    
    cat > akshay-framework.logrotate << 'EOF'
/var/log/akshay-framework/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    create 644 root root
}
EOF
    
    sudo cp akshay-framework.logrotate /etc/logrotate.d/akshay-framework
    sudo mkdir -p /var/log/akshay-framework
    sudo chown $USER:$USER /var/log/akshay-framework
    
    log_success "Log rotation configured"
}

# Main configuration function
main() {
    echo "🔧 Configuring Akshay's Framework for Kali Linux..."
    
    configure_tool_paths
    setup_systemd_service
    configure_firewall
    setup_api_keys
    optimize_postgresql
    create_backup_script
    setup_log_rotation
    
    echo ""
    echo "✅ Kali Linux configuration completed!"
    echo ""
    echo "📋 Post-installation steps:"
    echo "1. Add your API keys: cp api-keys-template.sh api-keys.sh && nano api-keys.sh"
    echo "2. Enable auto-start: sudo systemctl enable akshay-framework"
    echo "3. Setup backups: crontab -e (add: 0 2 * * * ~/akshay-framework/backup-framework.sh)"
    echo "4. Source API keys: echo 'source ~/akshay-framework/api-keys.sh' >> ~/.bashrc"
    echo ""
}

# Run main function
main "$@"
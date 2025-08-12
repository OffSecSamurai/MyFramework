#!/bin/bash

# Akshay's Framework - Kali Linux Installer
# Professional Bug Bounty Reconnaissance Platform
# Author: Akshay's Framework Team

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Art Banner
print_banner() {
    echo -e "${PURPLE}"
    cat << 'EOF'
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║              🔍 AKSHAY'S FRAMEWORK 🔍                    ║
    ║                                                           ║
    ║          Professional Bug Bounty Platform                ║
    ║             Kali Linux Auto-Installer                    ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root. Please run as a regular user."
        exit 1
    fi
}

# Check if running on Kali Linux
check_kali() {
    if ! grep -q "kali" /etc/os-release 2>/dev/null; then
        log_warning "This installer is optimized for Kali Linux. Continuing anyway..."
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "Kali Linux detected"
    fi
}

# Update system packages
update_system() {
    log_step "Updating system packages..."
    sudo apt update -y
    sudo apt upgrade -y
    log_success "System updated"
}

# Install Node.js and npm
install_nodejs() {
    log_step "Installing Node.js and npm..."
    
    # Install Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    
    log_success "Node.js $node_version installed"
    log_success "npm $npm_version installed"
}

# Install security tools
install_security_tools() {
    log_step "Installing security reconnaissance tools..."
    
    # Update package list
    sudo apt update
    
    # Install tools available via apt
    tools=(
        "subfinder"
        "assetfinder" 
        "findomain"
        "amass"
        "httpx-toolkit"
        "nmap"
        "nuclei"
        "sqlmap"
        "dirb"
        "gobuster"
        "wfuzz"
        "nikto"
        "masscan"
        "theharvester"
        "dnsrecon"
        "fierce"
        "wafw00f"
        "whatweb"
        "curl"
        "wget"
        "git"
        "chromium"
        "chromium-driver"
    )
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_info "Installing $tool..."
            sudo apt install -y "$tool" || log_warning "Failed to install $tool via apt"
        else
            log_success "$tool already installed"
        fi
    done
    
    # Install Go tools
    log_step "Installing Go-based tools..."
    
    # Install Go if not present
    if ! command -v go &> /dev/null; then
        log_info "Installing Go..."
        sudo apt install -y golang-go
    fi
    
    # Set Go environment
    export GOPATH=$HOME/go
    export PATH=$PATH:$GOPATH/bin
    echo 'export GOPATH=$HOME/go' >> ~/.bashrc
    echo 'export PATH=$PATH:$GOPATH/bin' >> ~/.bashrc
    
    # Install Go tools
    go_tools=(
        "github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest"
        "github.com/tomnomnom/assetfinder@latest"
        "github.com/projectdiscovery/httpx/cmd/httpx@latest"
        "github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest"
        "github.com/tomnomnom/gau/v2/cmd/gau@latest"
        "github.com/tomnomnom/waybackurls@latest"
        "github.com/projectdiscovery/katana/cmd/katana@latest"
        "github.com/projectdiscovery/naabu/v2/cmd/naabu@latest"
        "github.com/lc/gau@latest"
        "github.com/ffuf/ffuf@latest"
        "github.com/OJ/gobuster/v3@latest"
        "github.com/projectdiscovery/chaos-client/cmd/chaos@latest"
        "github.com/hakluke/hakrawler@latest"
        "github.com/michenriksen/aquatone@latest"
    )
    
    for tool in "${go_tools[@]}"; do
        tool_name=$(basename "${tool%@*}")
        if ! command -v "$tool_name" &> /dev/null; then
            log_info "Installing $tool_name..."
            go install "$tool" || log_warning "Failed to install $tool"
        else
            log_success "$tool_name already installed"
        fi
    done
    
    log_success "Security tools installation completed"
}

# Install Python dependencies
install_python_deps() {
    log_step "Installing Python dependencies..."
    
    # Install pipx for better Python package management
    sudo apt install -y python3-pip pipx python3-venv
    
    # Initialize pipx
    pipx ensurepath || true
    
    # Install Python tools using pipx (safer for externally managed environments)
    python_tools=(
        "arjun"
        "dirsearch"
        "xsser"
    )
    
    for tool in "${python_tools[@]}"; do
        log_info "Installing $tool using pipx..."
        pipx install "$tool" || log_warning "Failed to install $tool with pipx"
    done
    
    # Install Kali-packaged Python tools via apt
    kali_python_tools=(
        "sublist3r"
        "sqlmap"
        "paramspider"
    )
    
    for tool in "${kali_python_tools[@]}"; do
        log_info "Installing $tool from Kali repositories..."
        sudo apt install -y "$tool" || log_warning "Failed to install $tool via apt"
    done
    
    # Create virtual environment for additional tools if needed
    if [ ! -d "$HOME/.akshay-venv" ]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv "$HOME/.akshay-venv"
        source "$HOME/.akshay-venv/bin/activate"
        pip install --upgrade pip
        # Install any additional tools that need venv
        deactivate
    fi
    
    log_success "Python dependencies installed"
}

# Create application directory
create_app_directory() {
    log_step "Creating application directory..."
    
    # Check if we're already in the framework directory
    if [ -f "package.json" ] && [ -f "install.sh" ]; then
        log_info "Already in framework directory, using current location"
        APP_DIR="$(pwd)"
        return 0
    fi
    
    APP_DIR="$HOME/akshay-framework"
    
    if [ -d "$APP_DIR" ]; then
        log_warning "Directory $APP_DIR already exists"
        read -p "Do you want to remove it and reinstall? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$APP_DIR"
        else
            log_error "Installation cancelled"
            exit 1
        fi
    fi
    
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    
    log_success "Application directory created at $APP_DIR"
}

# Copy application files
copy_application_files() {
    log_step "Copying application files..."
    
    # Copy all files from current directory to app directory
    cp -r "$(dirname "$0")"/* ./ 2>/dev/null || true
    
    # Ensure we have all necessary files
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please ensure all application files are present."
        exit 1
    fi
    
    log_success "Application files copied"
}

# Install Node.js dependencies
install_node_deps() {
    log_step "Installing Node.js dependencies..."
    
    # Install dependencies
    npm install
    
    log_success "Node.js dependencies installed"
}

# Configure environment
configure_environment() {
    log_step "Configuring environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        cat > .env << 'EOF'
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

# Security Tools Configuration
WORKSPACE_DIR=/tmp/akshay-framework-workspace

# API Keys (Optional - Add your keys here)
# SHODAN_API_KEY=your_shodan_key_here
# VIRUSTOTAL_API_KEY=your_virustotal_key_here
# CHAOS_API_KEY=your_chaos_key_here
EOF
        log_success "Environment configuration created"
    else
        log_info "Environment configuration already exists"
    fi
}

# Setup PostgreSQL database
setup_database() {
    log_step "Setting up PostgreSQL database..."
    
    # Install PostgreSQL
    sudo apt install -y postgresql postgresql-contrib
    
    # Start PostgreSQL service
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql << EOF
CREATE DATABASE akshay_framework;
CREATE USER akshay_user WITH ENCRYPTED PASSWORD 'akshay_password';
GRANT ALL PRIVILEGES ON DATABASE akshay_framework TO akshay_user;
ALTER USER akshay_user CREATEDB;
\q
EOF
    
    # Run database migrations
    npm run db:push
    
    log_success "Database setup completed"
}

# Create workspace directory
create_workspace() {
    log_step "Creating workspace directory..."
    
    WORKSPACE_DIR="/tmp/akshay-framework-workspace"
    mkdir -p "$WORKSPACE_DIR"
    chmod 755 "$WORKSPACE_DIR"
    
    log_success "Workspace directory created at $WORKSPACE_DIR"
}

# Create startup script
create_startup_script() {
    log_step "Creating startup script..."
    
    cat > start-framework.sh << 'EOF'
#!/bin/bash

# Akshay's Framework Startup Script

APP_DIR="$HOME/akshay-framework"
PORT=3000

echo "🔍 Starting Akshay's Framework..."
echo "📁 Application Directory: $APP_DIR"
echo "🌐 Server will be available at: http://localhost:$PORT"
echo ""

cd "$APP_DIR"

# Check if Node.js dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Start the application
echo "Starting the server..."
npm run dev

EOF
    
    chmod +x start-framework.sh
    
    log_success "Startup script created"
}

# Create desktop launcher
create_desktop_launcher() {
    log_step "Creating desktop launcher..."
    
    DESKTOP_DIR="$HOME/Desktop"
    if [ -d "$DESKTOP_DIR" ]; then
        cat > "$DESKTOP_DIR/Akshay-Framework.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Akshay's Framework
Comment=Professional Bug Bounty Reconnaissance Platform
Exec=gnome-terminal -- bash -c 'cd $HOME/akshay-framework && ./start-framework.sh; exec bash'
Icon=applications-security
Terminal=false
Categories=Security;Network;
EOF
        
        chmod +x "$DESKTOP_DIR/Akshay-Framework.desktop"
        log_success "Desktop launcher created"
    fi
}

# Final setup and instructions
final_setup() {
    log_step "Completing final setup..."
    
    # Make sure all tools are in PATH
    echo 'export PATH=$PATH:$HOME/go/bin:$HOME/.local/bin' >> ~/.bashrc
    
    # Create quick access commands
    echo "alias akshay-framework='cd $HOME/akshay-framework && ./start-framework.sh'" >> ~/.bashrc
    echo "alias framework-start='cd $HOME/akshay-framework && ./start-framework.sh'" >> ~/.bashrc
    
    log_success "Final setup completed"
}

# Print completion message
print_completion() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║            🎉 INSTALLATION COMPLETED! 🎉                  ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║              Akshay's Framework is ready!                 ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📍 Installation Location:${NC} $HOME/akshay-framework"
    echo -e "${CYAN}🌐 Access URL:${NC} http://localhost:3000"
    echo ""
    echo -e "${YELLOW}🚀 To start the framework:${NC}"
    echo -e "   Method 1: Double-click the desktop launcher"
    echo -e "   Method 2: Run command: ${GREEN}akshay-framework${NC}"
    echo -e "   Method 3: cd $HOME/akshay-framework && ./start-framework.sh"
    echo ""
    echo -e "${YELLOW}📋 Quick Commands:${NC}"
    echo -e "   ${GREEN}akshay-framework${NC}     - Start the framework"
    echo -e "   ${GREEN}framework-start${NC}      - Alternative start command"
    echo ""
    echo -e "${YELLOW}📚 Features Available:${NC}"
    echo -e "   ✅ 24+ Security Tools Integrated"
    echo -e "   ✅ Real-time Reconnaissance Monitoring"
    echo -e "   ✅ Vulnerability Analysis Dashboard"
    echo -e "   ✅ Professional Reporting System"
    echo -e "   ✅ File Management & Downloads"
    echo ""
    echo -e "${BLUE}💡 Pro Tip:${NC} Source your bashrc to use the new commands:"
    echo -e "   ${GREEN}source ~/.bashrc${NC}"
    echo ""
    echo -e "${RED}⚠️  Important:${NC} Add your API keys to ~/.env for enhanced functionality"
    echo ""
}

# Main installation function
main() {
    print_banner
    
    log_info "Starting Akshay's Framework installation..."
    
    check_root
    check_kali
    update_system
    install_nodejs
    install_security_tools
    install_python_deps
    create_app_directory
    copy_application_files
    install_node_deps
    configure_environment
    setup_database
    create_workspace
    create_startup_script
    create_desktop_launcher
    final_setup
    
    print_completion
    
    log_success "Installation completed successfully!"
    
    # Ask if user wants to start the framework now
    echo ""
    read -p "Would you like to start Akshay's Framework now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Starting Akshay's Framework..."
        ./start-framework.sh
    fi
}

# Run main function
main "$@"
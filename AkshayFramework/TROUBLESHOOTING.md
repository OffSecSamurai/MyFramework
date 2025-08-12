# Akshay's Framework - Troubleshooting Guide

## 🔧 Common Installation Issues

### 1. Python Package Installation Errors (Externally Managed Environment)

**Error Message:**
```
error: externally-managed-environment
× This environment is externally managed
```

**Solution:**
```bash
# Method 1: Use pipx (Recommended)
sudo apt update
sudo apt install -y pipx python3-venv
pipx install arjun
pipx install dirsearch

# Method 2: Use Kali package repositories
sudo apt install -y sublist3r sqlmap

# Method 3: Create virtual environment for specific tools
python3 -m venv ~/.akshay-tools
source ~/.akshay-tools/bin/activate
pip install arjun paramspider dirsearch
deactivate

# Add to PATH if needed
echo 'export PATH=$PATH:~/.local/bin' >> ~/.bashrc
source ~/.bashrc
```

### 2. Missing package.json Error

**Error Message:**
```
[ERROR] package.json not found. Please ensure all application files are present.
```

**Solution:**
```bash
# Make sure you're running the installer FROM the framework directory
cd /path/to/AkshayFramework
ls -la  # Should see package.json, install.sh, etc.
chmod +x install.sh
./install.sh

# If files are missing, re-download the complete framework
```

### 3. Port Already in Use

**Error Message:**
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5000
```

**Solution:**
```bash
# Kill existing processes on port 5000
sudo lsof -ti:5000 | xargs kill -9

# Or use a different port
export PORT=3001
npm run dev
```

### 4. Node.js Installation Issues

**Error Message:**
```
node: command not found
```

**Solution:**
```bash
# Update Node.js repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 5. Tool Command Not Found

**Error Message:**
```
subfinder: command not found
```

**Solution:**
```bash
# Add Go tools to PATH
echo 'export GOPATH=$HOME/go' >> ~/.bashrc
echo 'export PATH=$PATH:$GOPATH/bin' >> ~/.bashrc
source ~/.bashrc

# Install missing Go tools manually
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/tomnomnom/assetfinder@latest
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
```

## 🚀 Manual Installation Steps

If the automated installer fails, follow these manual steps:

### 1. Install System Dependencies
```bash
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib
sudo apt install -y python3 python3-pip python3-venv pipx
sudo apt install -y golang-go git curl wget
```

### 2. Install Security Tools
```bash
# Kali repository tools
sudo apt install -y subfinder assetfinder findomain amass
sudo apt install -y httpx-toolkit nmap nuclei sqlmap
sudo apt install -y dirb gobuster wfuzz nikto masscan
sudo apt install -y theharvester dnsrecon fierce wafw00f whatweb

# Go-based tools
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest
go install github.com/tomnomnom/gau/v2/cmd/gau@latest
```

### 3. Install Python Tools
```bash
# Using pipx (safer for newer Kali)
pipx install arjun
pipx install dirsearch

# Using apt for Kali packages
sudo apt install -y sublist3r sqlmap

# Using virtual environment
python3 -m venv ~/.akshay-tools
source ~/.akshay-tools/bin/activate
pip install paramspider xsser
deactivate
```

### 4. Setup Application
```bash
# Navigate to framework directory
cd /path/to/AkshayFramework

# Install Node.js dependencies
npm install

# Setup database (if using PostgreSQL)
sudo -u postgres createdb akshay_framework

# Start the application
npm run dev
```

### 5. Access the Application
```bash
# The framework will be available at:
http://localhost:5000

# Or if you changed the port:
http://localhost:3001
```

## 🔍 Verification Commands

Check if everything is installed correctly:

```bash
# Check Node.js
node --version && npm --version

# Check security tools
which subfinder && subfinder -version
which nuclei && nuclei -version
which httpx && httpx -version

# Check Python tools
which arjun
pipx list

# Check Go environment
echo $GOPATH
echo $PATH | grep go

# Check application files
ls -la package.json server/ client/
```

## 📞 Getting Help

If you're still experiencing issues:

1. **Check the logs:** Look for detailed error messages in the terminal
2. **Verify prerequisites:** Ensure Kali Linux is up to date
3. **Check permissions:** Make sure you have sudo access
4. **Network issues:** Verify internet connection for package downloads
5. **Disk space:** Ensure sufficient disk space (>2GB recommended)

## 🔄 Complete Reinstallation

If all else fails, try a complete reinstallation:

```bash
# Remove existing installation
rm -rf ~/akshay-framework ~/.akshay-tools

# Clean npm cache
npm cache clean --force

# Re-download framework
git clone <repository-url>
cd akshay-framework

# Run installer again
chmod +x install.sh
./install.sh
```
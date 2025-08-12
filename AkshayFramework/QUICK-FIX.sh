#!/bin/bash

# Quick fix for Kali Linux installation issues
# Run this in the AkshayFramework directory

echo "🔧 AKSHAY'S FRAMEWORK - QUICK FIX"
echo "================================="

# Fix Python tools using proper methods
echo "Installing Python tools using pipx..."
sudo apt install -y pipx python3-venv
pipx ensurepath

# Install Python tools that work with pipx
pipx install arjun || echo "arjun install failed"
pipx install dirsearch || echo "dirsearch install failed"

# Install Kali-packaged tools
echo "Installing Kali repository tools..."
sudo apt install -y sublist3r sqlmap || echo "Some Kali tools failed"

# Add pipx tools to PATH
export PATH="$PATH:$HOME/.local/bin"
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc

# Install Node.js dependencies in current directory
echo "Installing Node.js dependencies..."
if [ -f "package.json" ]; then
    npm install
    echo "✅ Node.js dependencies installed"
else
    echo "❌ package.json not found - ensure you're in the framework directory"
    exit 1
fi

# Create workspace directory
mkdir -p workspace
chmod 755 workspace

# Make demo tools executable
chmod +x demo-tools.sh

echo "🚀 Starting the framework..."
echo "The application will be available at: http://localhost:5000"
echo ""
echo "If port 5000 is busy, kill existing processes:"
echo "sudo lsof -ti:5000 | xargs kill -9"
echo ""

# Start the application
npm run dev
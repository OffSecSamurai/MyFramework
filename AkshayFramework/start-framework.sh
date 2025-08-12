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


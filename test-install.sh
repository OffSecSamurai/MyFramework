#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Testing Akshay's Framework Installation...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 20+ first.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version 20+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js check passed${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created${NC}"
fi

# Create storage directories
echo -e "${YELLOW}📁 Creating storage directories...${NC}"
mkdir -p storage/artifacts storage/logs storage/reports storage/database

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm run install:all

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Setup database
echo -e "${YELLOW}🗄️ Setting up database...${NC}"
npm run setup:db

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to setup database${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database setup complete${NC}"

# Build packages
echo -e "${YELLOW}🔨 Building packages...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build packages${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Packages built successfully${NC}"

echo -e "${GREEN}🎉 Akshay's Framework test installation completed!${NC}"
echo -e "${BLUE}📋 To run with Docker: docker-compose up -d${NC}"
echo -e "${BLUE}📋 To run without Docker: npm run dev${NC}"
echo -e "${YELLOW}📋 Note: Docker is required for full functionality${NC}"
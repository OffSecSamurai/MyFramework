#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Installing Akshay's Framework...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

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

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

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

# Build Docker images
echo -e "${YELLOW}🐳 Building Docker images...${NC}"
docker-compose build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build Docker images${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker images built successfully${NC}"

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start services${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Services started successfully${NC}"

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ All services are running${NC}"
else
    echo -e "${RED}❌ Some services failed to start${NC}"
    docker-compose logs
    exit 1
fi

echo -e "${GREEN}🎉 Akshay's Framework installed successfully!${NC}"
echo -e "${BLUE}📱 Access the web interface at: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 API endpoint: http://localhost:3001${NC}"
echo -e "${YELLOW}📋 To stop the framework: docker-compose down${NC}"
echo -e "${YELLOW}📋 To view logs: docker-compose logs -f${NC}"
# Use Node.js 20 Alpine as base
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    docker \
    curl \
    wget \
    git \
    python3 \
    py3-pip \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create storage directories
RUN mkdir -p /app/storage/artifacts /app/storage/logs /app/storage/reports /app/tools

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Add user to docker group
RUN addgroup nodejs docker

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the worker
CMD ["node", "dist/index.js"]
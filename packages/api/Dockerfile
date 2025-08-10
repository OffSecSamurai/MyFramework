# =============================================================================
# AKSHAY'S FRAMEWORK - API SERVICE DOCKERFILE
# =============================================================================

# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine AS base

# Install required system packages
RUN apk add --no-cache \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY ../../package*.json ../../
COPY ../../prisma ./prisma/

# Install dependencies (including dev dependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# =============================================================================
# PRODUCTION STAGE
# =============================================================================

FROM node:20-alpine AS production

# Install required system packages for production
RUN apk add --no-cache \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S akshay && \
    adduser -S akshay -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../../package*.json ../../

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=base /app/prisma ./prisma

# Create necessary directories
RUN mkdir -p /app/storage/artifacts /app/storage/reports /app/storage/temp /app/logs /app/db

# Change ownership to non-root user
RUN chown -R akshay:akshay /app

# Switch to non-root user
USER akshay

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV API_PORT=3001
ENV API_HOST=0.0.0.0

# Start the application
CMD ["node", "dist/index.js"]
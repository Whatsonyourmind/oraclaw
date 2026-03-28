# ORACLE API Multi-Stage Dockerfile
# Story inf-4: Production-ready containerization
#
# Multi-stage build for optimized production image
# - Stage 1: Build with dev dependencies
# - Stage 2: Production runtime only

# ============================================================================
# Stage 1: Builder
# ============================================================================
FROM node:22-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ curl

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY turbo.json ./

# Copy all workspace package files so lockfile stays in sync
COPY apps/api/package*.json ./apps/api/
COPY apps/mobile/package*.json ./apps/mobile/
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/client-sdk/package*.json ./packages/client-sdk/
COPY packages/mcp-server/package*.json ./packages/mcp-server/

# Install all dependencies (including dev)
RUN npm ci --legacy-peer-deps

# Copy source files
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build the application
RUN npm run build --workspace=apps/api

# Prune dev dependencies
RUN npm prune --production --legacy-peer-deps

# ============================================================================
# Stage 2: Production Runner
# ============================================================================
FROM node:22-alpine AS runner

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 oracle

# Install runtime dependencies
RUN apk add --no-cache curl tini

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=oracle:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=oracle:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=oracle:nodejs /app/apps/api/package.json ./package.json

# Copy configuration files
COPY --from=builder --chown=oracle:nodejs /app/apps/api/.env.example ./.env.example

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Switch to non-root user
USER oracle

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]

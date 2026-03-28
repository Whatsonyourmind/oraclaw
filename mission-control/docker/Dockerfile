# =============================================================================
# ORACLE v2.0 API Dockerfile
# Multi-stage build for production optimization
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

# Install build dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy all workspace package files so lockfile stays in sync
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/mobile/package*.json ./apps/mobile/
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/client-sdk/package*.json ./packages/client-sdk/
COPY packages/mcp-server/package*.json ./packages/mcp-server/

# Install dependencies (npm install over npm ci for npm 10/11 lockfile compat)
RUN npm install --include=dev

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build --workspace=@mission-control/api

# Prune dev dependencies
RUN npm prune --production --workspace=@mission-control/api

# -----------------------------------------------------------------------------
# Stage 3: Production Runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

# Install production dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Security: Create non-root user
RUN addgroup --system --gid 1001 oracle \
    && adduser --system --uid 1001 oracle

WORKDIR /app

# Copy production files
COPY --from=builder --chown=oracle:oracle /app/apps/api/dist ./dist
COPY --from=builder --chown=oracle:oracle /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=oracle:oracle /app/apps/api/package.json ./

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs \
    && chown -R oracle:oracle /app

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info

# Expose API port
EXPOSE 3001

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Switch to non-root user
USER oracle

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

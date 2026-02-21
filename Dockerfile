# ===========================================
# Stage 1: Base (production dependencies)
# ===========================================
FROM oven/bun:1-alpine AS base

WORKDIR /app

# Install production dependencies only
COPY package.json ./
COPY bun.lockb* ./
RUN bun install --production

# ===========================================
# Stage 2: Development
# ===========================================
FROM oven/bun:1-alpine AS development

WORKDIR /app

# Install all dependencies (including dev)
COPY package.json ./
COPY bun.lockb* ./
RUN bun install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start dev server with hot reload
CMD ["bun", "run", "dev"]

# ===========================================
# Stage 3: Builder
# ===========================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install all dependencies
COPY package.json ./
COPY bun.lockb* ./
RUN bun install

# Copy source code
COPY . .

# Build the application
RUN bun run build

# ===========================================
# Stage 4: Production
# ===========================================
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy production dependencies from base
COPY --from=base /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S honocommerce && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G honocommerce -g honocommerce honocommerce && \
    chown -R honocommerce:honocommerce /app

USER honocommerce

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start production server
CMD ["bun", "run", "start"]

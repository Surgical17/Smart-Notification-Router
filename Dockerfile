# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create initial database with schema (this creates a template db)
# Set DATABASE_URL for build time only - use absolute path
ENV DATABASE_URL="file:/app/prisma/template.db"
RUN npx prisma db push --accept-data-loss && \
    echo "=== Verifying template.db was created ===" && \
    ls -la /app/prisma/ && \
    test -f /app/prisma/template.db || (echo "ERROR: template.db not found!" && exit 1)

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install Python and Apprise for notification support
RUN apk add --no-cache python3 py3-pip
RUN pip3 install apprise --break-system-packages

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema (just the schema file, not the whole directory)
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma

# Copy the pre-built database as a template to /app (NOT /app/prisma which gets overwritten by volume mount)
COPY --from=builder /app/prisma/template.db ./template.db

# Copy Prisma generated client and CLI (CLI needed for runtime schema migrations)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

# Copy utility scripts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy startup script
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Set permissions (template.db is now at /app/template.db, prisma dir will be created at runtime)
RUN chown -R nextjs:nodejs /app/prisma && chown nextjs:nodejs /app/template.db

# Set user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start with entrypoint script
CMD ["sh", "./docker-entrypoint.sh"]

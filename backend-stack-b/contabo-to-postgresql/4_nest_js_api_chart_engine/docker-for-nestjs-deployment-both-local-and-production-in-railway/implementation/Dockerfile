# Dockerfile - For PRODUCTION DEPLOYMENT (Railway, AWS, etc.)
# Multi-stage build for optimized production image
# Smaller image size, faster deployment

#-----------------------------------------------------------------------------
# Stage 1: Build Stage
#-----------------------------------------------------------------------------
FROM node:18-alpine AS builder

# Install system dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (production + dev for building)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Prune dev dependencies (keep only production)
RUN npm prune --production

#-----------------------------------------------------------------------------
# Stage 2: Production Stage
#-----------------------------------------------------------------------------
FROM node:18-alpine AS runner

# Install system dependencies
RUN apk add --no-cache openssl libc6-compat dumb-init

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/main.js"]

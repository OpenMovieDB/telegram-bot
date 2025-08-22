FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install app dependencies with legacy peer deps to avoid conflicts
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build the application
RUN npm run build

FROM node:20-alpine

# Install runtime dependencies and network tools
RUN apk add --no-cache tini curl

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production --legacy-peer-deps

# Copy built application
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Health check to ensure the app is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
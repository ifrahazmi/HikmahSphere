# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies (including devDependencies for build)
RUN npm ci && \
    cd backend && npm ci && \
    cd ../frontend && npm ci

# Build stage for backend
FROM base AS backend-build
WORKDIR /app/backend
COPY backend/ .
RUN npm run build

# Backend production stage
FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/package.json ./
EXPOSE 5000
CMD ["node", "dist/index.js"]

# Build stage for frontend
FROM base AS frontend-build
WORKDIR /app/frontend
COPY frontend/ .
RUN npm run build

# Frontend production stage
FROM node:20-alpine AS frontend
RUN npm install -g serve
WORKDIR /app
COPY --from=frontend-build /app/frontend/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]

# Production stage
FROM node:20-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S hikmahsphere -u 1001

# Set working directory
WORKDIR /app

# Copy built backend
COPY --from=backend-build --chown=hikmahsphere:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-build --chown=hikmahsphere:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build --chown=hikmahsphere:nodejs /app/backend/package.json ./backend/

# Copy built frontend
COPY --from=frontend-build --chown=hikmahsphere:nodejs /app/frontend/build ./frontend/build

# Install serve for static files
RUN npm install -g serve

# Create logs directory
RUN mkdir -p /app/logs && chown hikmahsphere:nodejs /app/logs

# Switch to app user
USER hikmahsphere

# Expose ports
EXPOSE 5000 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start command
CMD ["sh", "-c", "cd backend && node dist/index.js & serve -s ../frontend/build -l 3000"]

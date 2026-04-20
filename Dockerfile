# Multi-stage build: works on Raspberry Pi (linux/arm64) and amd64.
# Build for Pi from any machine:
#   docker buildx build --platform linux/arm64 -t myvocab:latest --load .

# --- Frontend (Vite) ---
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Backend (TypeScript) ---
FROM node:20-bookworm-slim AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# --- Runtime ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/app/data/myvocab.db

COPY --from=backend-build /app/backend/package.json /app/backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
RUN mkdir -p /app/data

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "backend/dist/index.js"]

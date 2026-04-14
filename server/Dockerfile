# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy root package files (types.ts is a shared dependency of server code)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy sources needed for the server bundle
COPY tsconfig.json ./
COPY types.ts ./
COPY server/ ./server/

# Compile server TypeScript to JavaScript
RUN npx tsc -p server/tsconfig.json --outDir server/dist


# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# Playwright system dependencies (Chromium)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/server/dist ./server/dist

EXPOSE 8080

# Credentials are injected at runtime via Cloud Run Secret Manager (not baked in)
ENV PORT=8080

CMD ["node", "server/dist/server/server.js"]

FROM node:20-slim

# Install Chromium (for Puppeteer) and FFmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-noto \
    fonts-freefont-ttf \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data /app/output/carousels /app/output/reels /app/config

# Railway sets PORT dynamically
EXPOSE ${PORT:-3001}

# Use tsx (same as local dev) to avoid tsc strict errors
CMD ["npx", "tsx", "src/server.ts"]

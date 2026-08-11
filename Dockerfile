# Build stage
FROM node:24-bullseye-slim

# Install system dependencies minimales pour Playwright + FFmpeg
# (transcodage à la volée des torrents) + supervisor (multi-process)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    fonts-liberation \
    libnss3 \
    lsb-release \
    supervisor \
    xdg-utils \
    wget && \
    rm -rf /var/lib/apt/lists/*

# TorrServer — serveur de streaming torrent P2P (port 8090)
RUN mkdir -p /opt/torrserver && \
    wget -q "https://github.com/YouROK/TorrServer/releases/latest/download/TorrServer-linux-amd64" -O /opt/torrserver/TorrServer && \
    chmod +x /opt/torrserver/TorrServer

# Prowlarr — gestionnaire d'indexeurs de torrents (port 9696)
ARG PROWLARR_VERSION=2.5.2.5491
RUN mkdir -p /opt/prowlarr && \
    wget -q "https://github.com/Prowlarr/Prowlarr/releases/download/v${PROWLARR_VERSION}/Prowlarr.master.${PROWLARR_VERSION}.linux-core-x64.tar.gz" -O /tmp/prowlarr.tar.gz && \
    tar -xzf /tmp/prowlarr.tar.gz -C /opt/prowlarr && \
    rm /tmp/prowlarr.tar.gz

# Set working directory
WORKDIR /app

# Copy package files for the backend
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd backend && npm install

# Copy source code
COPY . .

# Set working directory to backend
WORKDIR /app/backend

# Compile TypeScript → dist (le dist commité est partiel, il faut rebuild)
RUN npm run build

# Install Playwright browsers et leurs dépendances système
RUN npx playwright install chromium && \
    npx playwright install-deps chromium

# Données persistantes (disque persistant Render monté sur /data)
RUN mkdir -p /data/torrserver /data/prowlarr

# Supervisor : backend + TorrServer + Prowlarr dans un seul conteneur
COPY backend/supervisord.conf /etc/supervisor/conf.d/chillers.conf

# Expose ports (4000 = API, 9696 = UI Prowlarr, 8090 = TorrServer)
EXPOSE 4000 9696 8090

# Start command
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/chillers.conf", "-n"]

# Utiliser l'image officielle Playwright correspondant à la version 1.61.1
FROM mcr.microsoft.com/playwright:v1.61.1-noble

# Installer supervisor, ffmpeg, .NET Runtime pour Prowlarr et utilitaires nécessaires
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    supervisor \
    wget \
    ca-certificates \
    aspnetcore-runtime-8.0 && \
    rm -rf /var/lib/apt/lists/*

# TorrServer
RUN mkdir -p /opt/torrserver && \
    wget -q "https://github.com/YouROK/TorrServer/releases/latest/download/TorrServer-linux-amd64" -O /opt/torrserver/TorrServer && \
    chmod +x /opt/torrserver/TorrServer

# Prowlarr
ARG PROWLARR_VERSION=2.5.2.5491
RUN mkdir -p /opt/prowlarr && \
    wget -q "https://github.com/Prowlarr/Prowlarr/releases/download/v${PROWLARR_VERSION}/Prowlarr.master.${PROWLARR_VERSION}.linux-core-x64.tar.gz" -O /tmp/prowlarr.tar.gz && \
    tar -xzf /tmp/prowlarr.tar.gz -C /opt/prowlarr && \
    rm /tmp/prowlarr.tar.gz

WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY . .
WORKDIR /app/backend
RUN npm run build

# Config supervisord
COPY backend/supervisord.conf /etc/supervisor/conf.d/chillers.conf

EXPOSE 4000 9696 8090
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/chillers.conf", "-n"]

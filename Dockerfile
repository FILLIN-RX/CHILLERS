FROM node:24-trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    chromium \
    xvfb \
    supervisor \
    libnss3 \
    libnspr4 \
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
    libasound2t64 && \
    rm -rf /var/lib/apt/lists/*

# FlareSolverr (sidecar) : contourne les challenges Cloudflare de liveball.
# Python 3.13 a retiré le module `cgi` (requis par bottle) -> legacy-cgi.
RUN python3 -m venv /opt/flaresolverr && \
    /opt/flaresolverr/bin/pip install --no-cache-dir --pre "flaresolverr>=3.3.21rc0" legacy-cgi && \
    rm -rf /root/.cache/pip

WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY . .
WORKDIR /app/backend
RUN npm run build

COPY docker/supervisord.conf /etc/supervisor/conf.d/chillers.conf

EXPOSE 4000
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/chillers.conf"]
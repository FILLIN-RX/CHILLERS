# Build stage
FROM node:24-bullseye-slim

# Install system dependencies minimales pour Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget && \
    rm -rf /var/lib/apt/lists/*

# Configurer le dossier d'installation de Playwright pour qu'il soit persistant et connu
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

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

# Install Playwright browsers et leurs dépendances système
RUN npx playwright install chromium && \
    npx playwright install-deps chromium

# Expose port
EXPOSE 4000

# Start command
CMD ["npm", "start"]

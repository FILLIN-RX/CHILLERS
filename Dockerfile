FROM node:24-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY . .
WORKDIR /app/backend
RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]
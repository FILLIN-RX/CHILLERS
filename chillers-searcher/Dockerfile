# Stage 1: Build
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Compile static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/chillers-searcher ./cmd/server

# Stage 2: Ultra-lightweight runtime container
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/
COPY --from=builder /app/chillers-searcher .

EXPOSE 8090

ENV PORT=8090
ENV BACKEND_URL=http://localhost:4000
ENV SEARCH_TIMEOUT_SECONDS=30

ENTRYPOINT ["./chillers-searcher"]

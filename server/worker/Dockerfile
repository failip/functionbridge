FROM node:25-alpine3.22 AS builder

WORKDIR /app

# Install compression tools
RUN apk add --no-cache brotli zstd gzip

# Copy project files and install dependencies
COPY . .
RUN npm install
RUN npm run build

# Prepare Nginx directory structure and compress
WORKDIR /app/dist
RUN mkdir -p worker && \
  mv worker.html worker/ && \
  cd worker && \
  gzip -9 -k worker.html && \
  brotli -Z -k worker.html && \
  zstd -19 -k worker.html

# Serving Stage
FROM ghcr.io/macbre/nginx-http3:latest

# Overwrite default nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compressed files
COPY --from=builder /app/dist/worker /usr/share/nginx/html/worker
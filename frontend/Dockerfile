# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f frontend/Dockerfile .
FROM --platform=$BUILDPLATFORM node:22.22.2-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY smart-contracts/package.json smart-contracts/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend frontend
COPY shared shared
COPY backend/src/main/resources/pack-manifest-v2.schema.json backend/src/main/resources/pack-manifest-v2.schema.json
RUN npm run build:strict --workspace=frontend

FROM nginx:1.28.0-alpine@sha256:30f1c0d78e0ad60901648be663a710bdadf19e4c10ac6782c235200619158284
RUN apk add --no-cache curl && addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && chown appuser:appgroup /var/run/nginx.pid
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=appuser:appgroup /app/frontend/dist /usr/share/nginx/html
COPY --chmod=755 frontend/docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
USER appuser
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -fsS http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]

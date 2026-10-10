# syntax=docker/dockerfile:1
# Contexto de build: raíz del repositorio (necesita ./shared para las pruebas).

# ---------- Etapa 1: pruebas y build de Vite ----------
FROM node:22-alpine AS build
ARG SKIP_TESTS=false
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY shared /src/shared
COPY frontend ./
RUN if [ "$SKIP_TESTS" != "true" ]; then npm test; fi && npm run build

# ---------- Etapa 2: nginx sin privilegios ----------
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

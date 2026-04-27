# syntax=docker/dockerfile:1.7

# ─── Build stage ────────────────────────────────────────────────────────────
# Alinhado ao mínimo estável usado no monorepo (Vite 7 exige ≥20.19 na linha 20)
FROM node:20.19-alpine AS builder
WORKDIR /app

# Cache de deps: copia manifestos primeiro
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
 && npm prune --omit=dev

# ─── Runtime stage ──────────────────────────────────────────────────────────
FROM node:20.19-alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/condosync/condosync" \
      org.opencontainers.image.title="condosync-api" \
      org.opencontainers.image.description="API NestJS do CondoSync" \
      org.opencontainers.image.licenses="UNLICENSED"

# tini = init system para reaper de zumbis e SIGTERM correto
# curl = usado pelo HEALTHCHECK do Docker
RUN apk add --no-cache tini curl

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Copia artefatos compilados, deps de produção, migrations e entrypoint
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --chown=node:node entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=5 \
  CMD curl -fsS "http://localhost:${PORT:-3000}/api/v1/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]

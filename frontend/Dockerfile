# ── Build stage ───────────────────────────────────────────────────────────────
# Mínimo exigido pelo Vite 7 (evita `node:20-alpine` antigo < 20.19 em cache local)
FROM node:20.19-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Variáveis injetadas em build-time pelo docker compose (args)
ARG VITE_API_BASE_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM=main
ARG VITE_KEYCLOAK_CLIENT_ID=main-frontend

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

RUN npm run build

# ── Runtime stage (nginx) ──────────────────────────────────────────────────────
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Remove config padrão
RUN rm /etc/nginx/conf.d/default.conf

# Config nginx para SPA (todas as rotas retornam index.html)
COPY --from=builder /app/dist .
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

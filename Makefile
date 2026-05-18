# CondoSync — atalhos de dev e deploy
#
# Roda do diretório raiz. `make` (sem argumento) imprime esta ajuda.
# Tudo aqui é açúcar sintático em cima de docker compose / scripts existentes;
# nada novo acontece via Makefile — só fica mais fácil de lembrar.

.DEFAULT_GOAL := help
.PHONY: help \
        up up-deps up-api up-msg up-full down nuke ps logs \
        api-shell api-logs frontend-logs msg-logs \
        migrate migrate-revert smoke-asaas \
        deploy deploy-api deploy-frontend deploy-msg deploy-pull \
        tsc test \
        admin-install admin-dev admin-build admin-typecheck

# ── DEV ────────────────────────────────────────────────────────────────────

help: ## Lista comandos disponíveis
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Sobe TUDO (deps + api + message-server) — equivalente a `docker compose up -d`
	docker compose up -d --build

up-deps: ## Só dependências (postgres, redis, keycloak, minio)
	docker compose up -d postgres redis keycloak-db keycloak minio minio-init

up-api: ## Rebuild + restart só da API
	docker compose up -d --build --no-deps api

up-msg: ## Rebuild + restart só do message-server
	docker compose up -d --build --no-deps message-server

up-full: up ## Alias de `up`

down: ## Derruba tudo (volumes preservados)
	docker compose down

nuke: ## ⚠ Derruba tudo e APAGA volumes (postgres/keycloak/minio). Sem volta.
	@read -p "Apagar TODOS os volumes? [y/N] " c && [ "$$c" = "y" ] || (echo aborted; exit 1)
	docker compose down -v

ps: ## Status dos containers
	docker compose ps

logs: ## Tail dos logs de todos serviços (Ctrl+C sai)
	docker compose logs -f --tail=200

# ── shells / logs por serviço ──────────────────────────────────────────────

api-shell: ## Shell dentro do container da API
	docker compose exec api sh

api-logs: ## Tail dos logs só da API
	docker compose logs -f --tail=200 api

frontend-logs: ## Tail dos logs do nginx (frontend é estático)
	docker compose logs -f --tail=200 nginx 2>/dev/null || echo "frontend roda no host em dev (npm run dev em frontend/)"

msg-logs: ## Tail dos logs do message-server
	docker compose logs -f --tail=200 message-server

# ── banco / smoke tests ────────────────────────────────────────────────────

migrate: ## Roda migrations pendentes
	docker compose exec api npm run typeorm:run

migrate-revert: ## Reverte última migration
	docker compose exec api npm run typeorm:revert

smoke-asaas: ## Smoke test da integração Asaas (sandbox)
	bash backend/scripts/asaas-smoke-test.sh

# ── qualidade (sem CI ainda) ───────────────────────────────────────────────

tsc: ## Type-check em todos os pacotes
	cd backend && npx tsc --noEmit
	cd frontend && npx tsc --noEmit
	cd condosync-app && npx tsc --noEmit
	cd admin && npx tsc --noEmit

# ── ADMIN (back-office) ────────────────────────────────────────────────────

admin-install: ## Instala deps do back-office (rodar 1 vez antes do dev)
	cd admin && npm install

admin-dev: ## Sobe back-office em http://localhost:5174
	cd admin && npm run dev

admin-build: ## Build de produção do back-office
	cd admin && npm run build

admin-typecheck: ## Type-check só do back-office
	cd admin && npx tsc --noEmit

test: ## Testes do backend
	cd backend && npm test

# ── DEPLOY (na VPS) ────────────────────────────────────────────────────────

deploy: ## Deploy completo em prod (git pull + rebuild api+frontend+msg)
	bash infra/scripts/deploy.sh

deploy-api: ## Atualiza só a API em prod
	bash infra/scripts/deploy-api.sh

deploy-frontend: ## Atualiza só o frontend em prod
	bash infra/scripts/deploy-frontend.sh

deploy-msg: ## Atualiza só o message-server em prod
	bash infra/scripts/deploy-message-server.sh

deploy-pull: ## Só `git pull` na VPS (sem rebuild)
	git pull --ff-only

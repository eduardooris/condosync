# CondoSync — Infraestrutura (VPS + Docker Compose)

Este diretório contém os artefatos para operar o CondoSync em produção com deploy
independente por serviço.

**Guia passo a passo (arquivos, ordem de subida, IP-only e DNS+TLS):** [`DEPLOY_VPS.md`](./DEPLOY_VPS.md).

## Arquitetura

```mermaid
flowchart LR
  user[Browser PWA] -->|HTTPS| nginx[NginxEdge]
  nginx -->|/| fe[Frontend SPA]
  nginx -->|/api/v1/*| api[NestJS api]
  nginx -->|/realms/*| kc[Keycloak]
  api --> pg[(Postgres)]
  api --> rd[(Redis)]
  api --> msg[MessageServer]
  msg -->|Webhook HMAC| api
  kc --> kcdb[(Keycloak DB)]
```

A infraestrutura é separada em:

- `edge`: `nginx`, `frontend`, `certbot`
- `core`: `api`, `postgres`, `redis`, `keycloak`, `keycloak-db`
- `messaging`: `api`, `message-server`

## Compose files

| Arquivo | Papel |
| --- | --- |
| `docker-compose.prod.yml` | Base estável (edge + core + messaging) |
| `docker-compose.api.yml` | Serviço `api` + variáveis de ambiente |
| `docker-compose.build.yml` | Build **local** de api/frontend/message-server (sem registry) |
| `docker-compose.ghcr.yml` | Puxa as imagens do **GHCR** (usado pelo CI/CD). Substitui o `build.yml` |

Dois modos de obter as imagens (escolha um por deploy):

- **CI/CD via GHCR** (`prod + api + ghcr`): GitHub Actions builda e publica;
  os `scripts/deploy-*.sh` puxam a imagem com healthcheck + rollback.
- **Build local** (`prod + api + build`): `vps-up.sh` / `vps-rebuild.sh`
  compilam na própria VPS. Útil sem CI ou para emergência.

> Os mesmos 3 compose files atendem **DNS+TLS** e **IP-only**. O que muda
> entre os dois modos são apenas variáveis no `.env.prod` (ver
> `.env.prod.ip-only.example`).

## Layout

```text
infra/
├── docker-compose.prod.yml
├── docker-compose.api.yml
├── DEPLOY_VPS.md
├── nginx/
├── keycloak/
└── scripts/
    ├── setup-ec2.sh
    ├── init-ssl.sh
    ├── deploy-api.sh
    ├── deploy-frontend.sh
    └── deploy-message-server.sh
```

## Modo IP-only (teste sem DNS na EC2)

> IP-only é controlado só pelo `.env.prod` (`NGINX_CONF_FILE=nginx.ip-only.conf`
> etc.) — funciona tanto no build local (`scripts/vps-up.sh`) quanto no CI/CD via
> GHCR, sem override de compose. Resumo em [`DEPLOY_IP.md`](./DEPLOY_IP.md).

Use enquanto não há domínio comprado. O acesso é HTTP puro pelo IP da máquina
(`http://<IP-EC2>` para o app e `http://<IP-EC2>/auth` para o Keycloak).

Limitações:

- Sem TLS — Let's Encrypt não emite certificado para IP. Não rode `init-ssl.sh`.
- Frontend baked com IP via build-args (rebuild necessário ao migrar pro DNS).
- Liberar no Security Group da EC2: `22` (SSH) e `80` (HTTP).

```bash
cp infra/.env.prod.ip-only.example infra/.env.prod
nano infra/.env.prod   # ajuste senhas; o IP já está pré-preenchido (18.228.119.6)

./scripts/vps-up.sh
```

O `.env.prod.ip-only.example` define `NGINX_CONF_FILE=nginx.ip-only.conf`,
`KC_PROXY=none`, `KEYCLOAK_BASE_URL` com `/auth` e as URLs públicas baseadas
em IP. O compose lê esses valores no boot — nenhum override `-f` é necessário.

Migração para DNS (depois de comprar):

1. Apontar `A record` do `APP_DOMAIN` e `AUTH_DOMAIN` para o IP da EC2.
2. Substituir `.env.prod` por uma cópia do `.env.prod.example` (DNS+TLS) com
   senhas e domínios reais.
3. Reabrir `443` no Security Group.
4. `./scripts/vps-up.sh` (mesmo comando — só o `.env.prod` mudou).
5. `bash infra/scripts/init-ssl.sh` para emitir certificados.
6. Descomentar blocos HTTPS em `nginx/nginx.conf`.
7. Rebuild do frontend: `./scripts/vps-rebuild.sh frontend`.

## Variáveis de ambiente

Produção usa **apenas** `infra/.env.prod` (modelo em `.env.prod.example`).  
Passe sempre `--env-file .env.prod`. Não precisa de `.env` na raiz nem `backend/.env` na VPS.

## Primeira subida

```bash
cp infra/.env.prod.example infra/.env.prod
nano infra/.env.prod

cd ~/condosync
git pull
./scripts/vps-up.sh

# Opcional TLS inicial
cd infra && ./scripts/init-ssl.sh
```

## CI/CD via GitHub Actions (GHCR)

Workflows em `.github/workflows/`:

| Workflow | Dispara em | O que faz |
| --- | --- | --- |
| `ci.yml` | PR / push | Lint + test + build por serviço (gates de qualidade) |
| `backend-release.yml` | push main em `backend/**` / tag `backend-v*` | Build + push GHCR → SSH `deploy-api.sh` |
| `frontend-release.yml` | push main em `frontend/**` | Build + push GHCR → SSH `deploy-frontend.sh` |
| `message-server-release.yml` | push main em `message-server-main/**` | Build + push GHCR → SSH `deploy-message-server.sh` |
| `security-secrets-scan.yml` | PR / push | Gitleaks |

**Secrets** (Settings → Secrets and variables → Actions → *Secrets*):
`EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` e `GHCR_TOKEN` (PAT `read:packages` — só
se o pacote GHCR for privado).

**Variables** (mesma tela → *Variables*): `DEPLOY_PATH` (caminho do repo na
VPS, default `/opt/condosync`), `VITE_API_BASE_URL`, `VITE_KEYCLOAK_URL`.
`EXTRA_COMPOSE_FILE` é um gancho opcional para um override de compose adicional
(não é necessário para IP-only, que é controlado pelo `.env.prod`).

Na VPS, `infra/.env.prod` precisa de `GHCR_OWNER` (owner do GHCR, minúsculo).

## Atualizar um serviço na mão (após `git pull`)

Build local:

```bash
./scripts/vps-rebuild.sh api          # ou frontend / message-server
```

Pull do GHCR (mesmo caminho do CI):

```bash
GHCR_OWNER=condosync IMAGE_TAG=<sha> bash infra/scripts/deploy-api.sh
```

## Backups rápidos

```bash
docker exec condosync-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > backup-app-$(date +%F).sql.gz

docker exec condosync-keycloak-db pg_dump -U keycloak keycloak \
  | gzip > backup-keycloak-$(date +%F).sql.gz
```

## Observabilidade rápida

```bash
docker compose \
  -f infra/docker-compose.prod.yml \
  -f infra/docker-compose.api.yml \
  -f infra/docker-compose.build.yml \
  --env-file infra/.env.prod ps
docker logs -n 100 -f condosync-api
docker logs -n 100 -f condosync-message-server
docker inspect --format '{{.State.Health.Status}}' condosync-api
curl -fsS https://<APP_DOMAIN>/api/v1/health/ready | jq
```

# Deploy CondoSync na EC2 (modo IP-only, sem DNS)

> Guia único do zero. Siga na ordem. IP de teste: `18.228.119.6`.

## 0. O que esse modo faz

- HTTP puro na porta `80`. Sem TLS (Let's Encrypt não emite cert pra IP).
- App em `http://18.228.119.6/`, Keycloak em `http://18.228.119.6/auth/`.
- Deploy: `git pull` na EC2 + `./scripts/vps-up.sh` (build local, sem GHCR).

Quando comprar o DNS, há uma seção "Migrar pra DNS" no fim deste doc.

---

## 1. Push do código (opcional)

Se usar GitHub só como repositório:

```bash
git remote add origin git@github.com:<SEU_USER>/condosync.git
git push -u origin main
```

Na EC2 você faz `git pull` antes de cada deploy. Não há workflow de CI para imagens.

---

## 2. No console AWS

### 2.1. Verificar Security Group da instância `18.228.119.6`

Inbound rules — **abrir**:

| Tipo | Porta | Origem |
| --- | --- | --- |
| SSH | 22 | Seu IP residencial (recomendado) ou `0.0.0.0/0` |
| HTTP | 80 | `0.0.0.0/0` |

`443` só depois quando comprar o domínio.

### 2.2. Tamanho da instância

Mínimo recomendado pra rodar tudo (postgres + redis + keycloak + 2 postgres + nginx + frontend + api + message-server): **t3.medium** (4 GiB RAM). t3.small (2 GiB) sobe mas o Keycloak come quase tudo.

---

## 3. Primeira subida na EC2

### 3.1. SSH com a chave .pem que a AWS te deu

```bash
ssh -i ~/.ssh/condosync-aws.pem ubuntu@18.228.119.6
```

### 3.2. Setup base do sistema

Como ainda não dá pra clonar (precisa do Docker pra rodar tudo, mas o setup-ec2.sh **só instala Docker**), o jeito mais simples é baixar o script direto:

```bash
sudo curl -fsSL \
  https://raw.githubusercontent.com/<SEU_USER>/condosync/main/infra/scripts/setup-ec2.sh \
  -o /tmp/setup-ec2.sh
sudo bash /tmp/setup-ec2.sh
# faz logout+login pra aplicar permissão Docker no usuário ubuntu
exit
```

> Se o repo for **privado**, baixa o script com `gh` autenticado ou copia o conteúdo manualmente. Outra opção: clone primeiro em `/tmp/condosync` com HTTPS+PAT, roda o script, depois faz o clone definitivo.

Reentra:
```bash
ssh -i ~/.ssh/condosync-aws.pem ubuntu@18.228.119.6
```

### 3.3. Clonar o repo em `/opt/condosync`

```bash
sudo mkdir -p /opt/condosync
sudo chown ubuntu:ubuntu /opt/condosync
git clone https://github.com/<SEU_USER>/condosync.git /opt/condosync
```

> Se for **privado**, gera uma deploy key na EC2 e cola a pública em GitHub → Repo → Settings → Deploy keys:
> ```bash
> ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
> cat ~/.ssh/id_ed25519.pub
> ```
> Aí clona com SSH: `git clone git@github.com:<SEU_USER>/condosync.git /opt/condosync`.

### 3.4. Criar e preencher `.env.prod`

```bash
cd /opt/condosync/infra
cp .env.prod.ip-only.example .env.prod
nano .env.prod
```

**Trocar TODOS os valores `troque_*`** por senhas fortes. Sugestão pra gerar rápido:
```bash
openssl rand -hex 24
```

Atenção:
- `APP_DOMAIN` e `AUTH_DOMAIN` ficam como `18.228.119.6` (já estão).
- `APP_PUBLIC_URL=http://18.228.119.6` (já está).
- `S3_*` — se ainda não tem bucket configurado, deixa por último; o backend pode subir sem isso, mas qualquer feature que envolva upload vai quebrar.
- `MESSAGE_SERVER_API_KEY` e `MESSAGE_SERVER_WEBHOOK_SECRET` precisam ser não-vazios.

### 3.5. Subir a stack (build local)

```bash
cd /opt/condosync
git pull   # se já clonou antes
./scripts/vps-up.sh -f docker-compose.ip-only.yml
```

Ou manualmente:

```bash
cd /opt/condosync/infra
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.build.yml \
  -f docker-compose.ip-only.yml \
  --env-file .env.prod up -d --build
```

> O frontend usa `APP_PUBLIC_URL` e `AUTH_DOMAIN` do `.env.prod` nos build-args.

### 3.6. Verificar saúde

```bash
docker compose ps
docker logs --tail 50 condosync-api
docker logs --tail 50 condosync-keycloak
curl -fsS http://localhost/api/v1/health/ready
curl -fsS http://localhost/auth/realms/main/.well-known/openid-configuration | head -5
```

Do seu navegador:
- `http://18.228.119.6` → frontend
- `http://18.228.119.6/auth` → console admin do Keycloak (login com `KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD`)
- `http://18.228.119.6/api/v1/health/ready` → `{ "status": "ok", ... }`
- `http://18.228.119.6/api/docs` → Swagger

### 3.7. Configurar admin do Keycloak (uma vez)

1. Login no console em `/auth/admin`
2. Realm `main` → Clients → `condo-backend-admin` → Credentials → **Regenerate** secret
3. Cole o secret novo em `.env.prod` → `KEYCLOAK_ADMIN_CLIENT_SECRET`
4. Restart só da API:
   ```bash
   cd /opt/condosync && ./scripts/vps-rebuild.sh api
   # (com ip-only: export EXTRA_COMPOSE_FILE=docker-compose.ip-only.yml nos scripts deploy-*)
   ```

### 3.7.1. Desativar exigência de SSL no realm (IP-only HTTP)

O realm `main` é importado com `sslRequired=EXTERNAL` (padrão Keycloak), que
**bloqueia chamadas HTTP** ao Admin API de fora do localhost. Em IP-only sem
TLS, isso quebra `/auth/register` e qualquer fluxo que use o admin client.

```bash
docker exec -i condosync-keycloak-db psql -U keycloak -d keycloak -c \
  "UPDATE realm SET ssl_required='NONE' WHERE name='main';"
docker restart condosync-keycloak
```

Quando migrar pra DNS, reverta: `UPDATE realm SET ssl_required='EXTERNAL' WHERE name='main';`.

### 3.8. Criar primeiro usuário admin

Realm `main` → Users → Add user → preenche → aba Credentials → Set password. Esse vira o primeiro login do app.

---

## 4. Atualizar depois de mudanças no código

Na EC2:

```bash
cd /opt/condosync
git pull
./scripts/vps-up.sh -f docker-compose.ip-only.yml   # IP-only
# ou só um serviço:
./scripts/vps-rebuild.sh api
```

---

## 5. Troubleshooting

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| Frontend abre mas chama API errada | build-args do frontend desatualizados | Conferir `APP_PUBLIC_URL` / `AUTH_DOMAIN` no `.env.prod`; `./scripts/vps-rebuild.sh frontend` |
| Login dá `Invalid token` ou `iss mismatch` | `KEYCLOAK_ISSUER` ≠ URL real do Keycloak | Conferir `APP_PUBLIC_URL` no `.env.prod`; restart da api |
| `502 Bad Gateway` em `/auth` | Keycloak não subiu ou demora (start lento) | `docker logs condosync-keycloak`; aguardar 60s na primeira boot |
| `403 CORS` no browser | `CORS_ORIGINS` ≠ origem do frontend | Override do ip-only seta `CORS_ORIGINS=$APP_PUBLIC_URL`; conferir |
| `denied` ao subir compose | compose antigo puxava `ghcr.io/...` | Usar `docker-compose.build.yml` + `--build` (ver `vps-up.sh`) |
| API reinicia em loop | Migration falhou ou Postgres ainda subindo | `docker logs condosync-api` — geralmente espera Postgres |

---

## 6. Migrar pra DNS (depois de comprar)

1. Aponta `A record` do `app.dominio.com.br` e `auth.dominio.com.br` pro IP da EC2.
2. SG: abrir porta `443`.
3. Edita `infra/.env.prod` na EC2:
   - `APP_DOMAIN=app.dominio.com.br`
   - `AUTH_DOMAIN=auth.dominio.com.br`
   - `APP_PUBLIC_URL=https://app.dominio.com.br`
4. Na EC2:
   ```bash
   cd /opt/condosync
   git pull
   bash infra/scripts/init-ssl.sh
   # editar nginx/nginx.conf e descomentar blocos HTTPS
   ./scripts/vps-up.sh
   ```

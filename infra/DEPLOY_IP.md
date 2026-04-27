# Deploy CondoSync na EC2 (modo IP-only, sem DNS)

> Guia único do zero. Siga na ordem. IP de teste: `18.228.119.6`.

## 0. O que esse modo faz

- HTTP puro na porta `80`. Sem TLS (Let's Encrypt não emite cert pra IP).
- App em `http://18.228.119.6/`, Keycloak em `http://18.228.119.6/auth/`.
- CI/CD: push em `main` → build no GHCR → SSH na EC2 → deploy isolado por serviço.

Quando comprar o DNS, há uma seção "Migrar pra DNS" no fim deste doc.

---

## 1. Na sua máquina local

### 1.1. Gerar par de chaves SSH para o GitHub Actions usar

```bash
ssh-keygen -t ed25519 -f ~/.ssh/condosync-deploy -C "condosync-gha" -N ""
```

Vão sair dois arquivos:
- `~/.ssh/condosync-deploy`     ← **privada** (vai pro GitHub Secrets)
- `~/.ssh/condosync-deploy.pub` ← **pública** (vai pra EC2)

### 1.2. Gerar um Personal Access Token (PAT) pro GHCR

GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new (classic).

Escopos: `read:packages` e `write:packages`. Anota o token.

### 1.3. Push do código pro GitHub

```bash
cd ~/Desktop/condosync
git init                          # se ainda não inicializou
git remote add origin git@github.com:<SEU_USER>/condosync.git
git add -A && git commit -m "deploy: setup IP-only"
git push -u origin main
```

> Se o repo for **privado**, anota — vamos precisar configurar deploy key na EC2 pra clonar.

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

## 3. No GitHub (Settings → Secrets and variables → Actions)

### 3.1. Aba **Secrets** → New repository secret

| Nome | Valor |
| --- | --- |
| `EC2_HOST` | `18.228.119.6` |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | conteúdo de `~/.ssh/condosync-deploy` (a privada inteira, com `-----BEGIN ...-----`) |
| `GHCR_USER` | seu username GitHub (em minúsculas) |
| `GHCR_TOKEN` | o PAT classic do passo 1.2 |

### 3.2. Aba **Variables** → New repository variable

| Nome | Valor |
| --- | --- |
| `VITE_API_BASE_URL` | `http://18.228.119.6` |
| `VITE_KEYCLOAK_URL` | `http://18.228.119.6/auth` |
| `VITE_KEYCLOAK_REALM` | `main` |
| `VITE_KEYCLOAK_CLIENT_ID` | `main-frontend` |
| `EXTRA_COMPOSE_FILE` | `docker-compose.ip-only.yml` |

> ⚠️ `VITE_API_BASE_URL` é só a **origem** (sem `/api/v1`). O cliente axios já anexa o sufixo (ver [axios.ts:14](frontend/src/shared/lib/axios.ts:14)).

### 3.3. Disparar os 3 workflows pra publicar as imagens no GHCR

O job `deploy` desses workflows **vai falhar nessa primeira execução** (a EC2 ainda não está pronta) — tudo bem, é esperado. O importante é o job `build-and-push` ter ficado verde.

```bash
# da sua máquina, força um push vazio só pra rodar
git commit --allow-empty -m "ci: kick first build"
git push
```

Aguarde os 3 workflows terminarem o build (Actions → veja `backend-release`, `frontend-release`, `message-server-release`).

### 3.4. Tornar o package público (recomendado pra simplificar)

Após o primeiro push, vão aparecer 3 packages em `https://github.com/<SEU_USER>?tab=packages`:
- `condosync-api`
- `condosync-frontend`
- `condosync-message-server`

Em cada um: **Package settings → Change visibility → Public**.

Se mantiver privado, está OK também — a EC2 vai logar com seu PAT. Só não esqueça de atualizar o PAT antes de expirar.

---

## 4. Primeira subida na EC2 (manual — só uma vez)

### 4.1. SSH com a chave .pem que a AWS te deu

```bash
ssh -i ~/.ssh/condosync-aws.pem ubuntu@18.228.119.6
```

### 4.2. Adicionar a chave pública do GHA na EC2

Cola o conteúdo de `~/.ssh/condosync-deploy.pub` (da sua máquina) em:

```bash
echo "ssh-ed25519 AAAA... condosync-gha" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Sem isso o GitHub Actions não consegue logar.

### 4.3. Setup base do sistema

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

### 4.4. Clonar o repo em `/opt/condosync`

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

### 4.5. Criar e preencher `.env.prod`

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

### 4.6. Login no GHCR

```bash
echo "<SEU_GHCR_TOKEN>" | docker login ghcr.io -u <SEU_USER> --password-stdin
```

### 4.7. Subir a stack (3 arquivos compose juntos)

```bash
cd /opt/condosync/infra
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.ip-only.yml \
  --env-file .env.prod up -d
```

> 3 arquivos! `prod.yml` (base) + `api.yml` (define o serviço `api`) + `ip-only.yml` (overrides pra IP). Isso só vale pra primeira subida; depois os deploys isolados via GitHub Actions vão usar a combinação correta automaticamente.

### 4.8. Verificar saúde

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

### 4.9. Configurar admin do Keycloak (uma vez)

1. Login no console em `/auth/admin`
2. Realm `main` → Clients → `condo-backend-admin` → Credentials → **Regenerate** secret
3. Cole o secret novo em `.env.prod` → `KEYCLOAK_ADMIN_CLIENT_SECRET`
4. Restart só da API:
   ```bash
   docker compose -f docker-compose.prod.yml -f docker-compose.api.yml -f docker-compose.ip-only.yml \
     --env-file .env.prod up -d --no-deps api
   ```

### 4.9.5. Desativar exigência de SSL no realm (IP-only HTTP)

O realm `main` é importado com `sslRequired=EXTERNAL` (padrão Keycloak), que
**bloqueia chamadas HTTP** ao Admin API de fora do localhost. Em IP-only sem
TLS, isso quebra `/auth/register` e qualquer fluxo que use o admin client.

```bash
docker exec -i condosync-keycloak-db psql -U keycloak -d keycloak -c \
  "UPDATE realm SET ssl_required='NONE' WHERE name='main';"
docker restart condosync-keycloak
```

Quando migrar pra DNS, reverta: `UPDATE realm SET ssl_required='EXTERNAL' WHERE name='main';`.

### 4.10. Criar primeiro usuário admin

Realm `main` → Users → Add user → preenche → aba Credentials → Set password. Esse vira o primeiro login do app.

---

## 5. Deploy contínuo via GitHub Actions

Tudo configurado nos passos 1-4? A partir de agora:

```bash
# qualquer mudança em backend/, frontend/, ou message-server-main/
git add -A && git commit -m "feat: ..."
git push origin main
```

O workflow correspondente vai:
1. Buildar a imagem
2. Publicar no GHCR
3. SSH na EC2
4. Rodar `deploy-api.sh` (ou frontend / message-server) com `EXTRA_COMPOSE_FILE=docker-compose.ip-only.yml` → pull + up + healthcheck + rollback se falhar

Acompanha em **Actions** no GitHub. Logs do deploy aparecem no step "Disparar deploy-*.sh".

---

## 6. Troubleshooting

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| Frontend abre mas chama API errada | `VITE_API_BASE_URL` não foi setada antes do build | Confirmar no GitHub → Vars; rodar workflow `frontend-release` de novo |
| Login dá `Invalid token` ou `iss mismatch` | `KEYCLOAK_ISSUER` ≠ URL real do Keycloak | Conferir `APP_PUBLIC_URL` no `.env.prod`; restart da api |
| `502 Bad Gateway` em `/auth` | Keycloak não subiu ou demora (start lento) | `docker logs condosync-keycloak`; aguardar 60s na primeira boot |
| `403 CORS` no browser | `CORS_ORIGINS` ≠ origem do frontend | Override do ip-only seta `CORS_ORIGINS=$APP_PUBLIC_URL`; conferir |
| GHA falha no SSH | Chave pública não está em `authorized_keys` | Repetir 4.2 |
| GHA falha no `docker pull` | EC2 não tá logada no GHCR ou PAT expirou | Repetir 4.6 |
| API reinicia em loop | Migration falhou ou Postgres ainda subindo | `docker logs condosync-api` — geralmente espera Postgres |

---

## 7. Migrar pra DNS (depois de comprar)

1. Aponta `A record` do `app.dominio.com.br` e `auth.dominio.com.br` pro IP da EC2.
2. SG: abrir porta `443`.
3. Edita `infra/.env.prod` na EC2:
   - `APP_DOMAIN=app.dominio.com.br`
   - `AUTH_DOMAIN=auth.dominio.com.br`
   - `APP_PUBLIC_URL=https://app.dominio.com.br`
4. GitHub → Variables:
   - `VITE_API_BASE_URL=https://app.dominio.com.br`
   - `VITE_KEYCLOAK_URL=https://auth.dominio.com.br`
   - **Apaga** a var `EXTRA_COMPOSE_FILE`
5. Na EC2:
   ```bash
   cd /opt/condosync/infra
   bash scripts/init-ssl.sh
   # editar nginx/nginx.conf e descomentar blocos HTTPS
   docker compose -f docker-compose.prod.yml -f docker-compose.api.yml \
     --env-file .env.prod up -d
   ```
6. Push qualquer mudança → workflow rebuild do frontend com domínio HTTPS.

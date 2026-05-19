# CondoSync — Checklist Operacional de Produção

## Pré-deploy

- [ ] `git pull --ff-only` na VPS e revisão rápida do diff (migrations, env novas).
- [ ] `infra/.env.prod` validado (sem placeholders `troque_*`).
- [ ] Backup do Postgres (app) e do Postgres do Keycloak executado recentemente.
- [ ] Scan de segredos / revisão local antes do push (workflow Gitleaks no repositório).

## Pós-deploy imediato

- [ ] `docker compose ... ps` sem serviço em `unhealthy` (use os três `-f` + `--env-file infra/.env.prod`; ver [DEPLOY_VPS.md](./DEPLOY_VPS.md)).
- [ ] `GET /api/v1/health/ready` retorna `200`.
- [ ] Login funciona (token + refresh).
- [ ] Uma rota crítica do domínio responde (ex.: dashboard/cobranças).
- [ ] Webhook do message-server chega ao backend (quando aplicável).

## Rollback

O fluxo vigente é **build na VPS** a partir do Git — não há registry de tags por release.

- [ ] `git checkout <commit_ou_tag_anterior>` (ou `git revert` do merge problemático).
- [ ] Rebuild dos serviços afetados, por exemplo:
  - API: `./scripts/vps-rebuild.sh api` ou `bash infra/scripts/deploy-api.sh`
  - Frontend: `./scripts/vps-rebuild.sh frontend`
  - Message-server: `./scripts/vps-rebuild.sh message-server`
  - Stack completo sem sobrescrever o checkout: `SKIP_GIT_PULL=1 bash infra/scripts/deploy.sh`
- [ ] Confirmar saúde via `health/ready`.
- [ ] Registrar incidente e causa raiz.

## Rotina semanal

- [ ] Teste de restauração de backup em ambiente isolado.
- [ ] Revisar uso de disco/CPU/memória.
- [ ] Revisar filas com erro e jobs com retry recorrente.
- [ ] Rotacionar segredos críticos quando necessário.

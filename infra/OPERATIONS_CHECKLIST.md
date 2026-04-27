# CondoSync — Checklist Operacional de Produção

## Pré-deploy

- [ ] Tag imutável gerada para `api`, `frontend` ou `message-server`.
- [ ] Pipeline verde (build + scan de segredos + testes mínimos).
- [ ] `.env.prod` validado (sem placeholders).
- [ ] Backup do Postgres e Keycloak executado no dia.

## Pós-deploy imediato

- [ ] `docker compose ... ps` sem serviço em `unhealthy`.
- [ ] `GET /api/v1/health/ready` retorna `200`.
- [ ] Login funciona (token + refresh).
- [ ] Uma rota crítica de domínio responde (ex.: dashboard/cobranças).
- [ ] Webhook do message-server chega ao backend (quando aplicável).

## Rollback

- [ ] Executar script de deploy com tag anterior (`IMAGE_TAG`, `FRONTEND_TAG` ou `MESSAGE_SERVER_TAG`).
- [ ] Confirmar saúde via `health/ready`.
- [ ] Registrar incidente e causa raiz.

## Rotina semanal

- [ ] Teste de restauração de backup em ambiente isolado.
- [ ] Revisar uso de disco/CPU/memória.
- [ ] Revisar filas com erro e jobs com retry recorrente.
- [ ] Rotacionar segredos críticos quando necessário.

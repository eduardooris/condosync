# Especificacao Funcional - Multas/Advertencias e Manutencao Preventiva (P2)

## 1) Objetivo

Definir a especificacao funcional dos modulos:

1. **Multas e advertencias** (disciplina condominial com rastreabilidade).
2. **Manutencao preventiva** (agenda recorrente e execucao com historico).

O foco e viabilizar implementacao incremental no CondoSync com baixo risco, reaproveitando modulos ja existentes (`occurrences`, `documents`, `expenses`, `notifications`) e seguindo as diretrizes de `AGENTS.md`.

---

## 2) Principios de produto

- **Rastreabilidade completa:** toda acao relevante precisa ficar auditavel (quem abriu, quem revisou, quando, qual motivo).
- **Fluxo simples para sindico pequeno:** poucos passos, estados claros e textos em PT-BR.
- **Multitenancy obrigatoria:** tudo escopado por `condominium_id`.
- **Integração por composicao:** evitar duplicar funcionalidades ja cobertas por ocorrencias/documentos/notificacoes.
- **Evolucao por MVP:** iniciar com o minimo que gera valor operacional e juridico.

---

## 3) Modulo 1 - Multas e Advertencias

## 3.1 Problema de negocio

Hoje o CondoSync registra ocorrencias, mas nao possui trilha formal de:

- advertencia;
- reincidencia;
- conversao para multa;
- acompanhamento de recurso/decisao.

Sem isso, o sindico perde padrao, historico e previsibilidade.

## 3.2 Escopo funcional (MVP)

- Abrir **advertencia** vinculada a unidade.
- Registrar **evidencias** (link com documentos/arquivos).
- Converter advertencia em **multa**.
- Registrar status administrativo (emitida, em recurso, mantida, cancelada).
- Exibir timeline por unidade.
- Notificar moradores da unidade em eventos criticos.

## 3.3 Entidades e campos (proposta)

### A) `compliance_cases` (processo administrativo)
- `id` (uuid)
- `condominium_id` (uuid)
- `unit_id` (uuid)
- `opened_by_user_id` (uuid)
- `origin_occurrence_id` (uuid nullable)
- `type` (`WARNING` | `FINE`)
- `category` (varchar, ex.: barulho, uso indevido, obras)
- `description` (text)
- `status` (`OPEN` | `AWAITING_RESPONSE` | `UNDER_REVIEW` | `DECIDED` | `CANCELED`)
- `decision` (`NONE` | `MAINTAINED` | `REVERTED`)
- `decided_by_user_id` (uuid nullable)
- `decided_at` (timestamptz nullable)
- `created_at`, `updated_at`

### B) `compliance_case_events` (timeline)
- `id`, `case_id`
- `event_type` (`CREATED`, `CONVERTED_TO_FINE`, `STATUS_CHANGED`, `DECISION`, `COMMENT`)
- `payload` (jsonb)
- `created_by_user_id`
- `created_at`

### C) `compliance_fines`
- `id`, `case_id`
- `amount` (decimal 12,2)
- `due_date` (date)
- `reason` (text)
- `charge_id` (uuid nullable, quando integrar com `charges`)
- `created_at`, `updated_at`

## 3.4 Fluxos principais

### Fluxo A - Abrir advertencia
1. Admin/Subadmin abre caso para uma unidade.
2. Define categoria e descricao.
3. Opcionalmente referencia `occurrence` existente.
4. Sistema cria evento `CREATED`.
5. Sistema notifica moradores com acesso ativo da unidade.

### Fluxo B - Converter para multa
1. Admin/Subadmin abre caso existente `WARNING`.
2. Aciona "Converter para multa".
3. Informa valor, vencimento e justificativa.
4. Sistema cria `compliance_fines` + evento `CONVERTED_TO_FINE`.
5. Caso passa para tipo `FINE`.
6. (Fase seguinte) opcionalmente gerar `charge` automaticamente.

### Fluxo C - Decisao administrativa
1. Caso entra em `UNDER_REVIEW`.
2. Admin decide `MAINTAINED` ou `REVERTED`.
3. Sistema grava `decision`, `decided_by`, `decided_at`.
4. Sistema cria evento `DECISION` e notifica unidade.

## 3.5 Regras de negocio

- Apenas `ADMIN` e `SUB_ADMIN` criam/alteram casos.
- `RESIDENT` tem apenas visualizacao dos casos da propria unidade (quando houver tela de consulta).
- Nao permitir conversao para multa sem justificativa.
- Nao permitir decisao em caso `CANCELED`.
- Valor de multa deve ser `> 0`.
- Uma multa cancelada deve manter historico (nao excluir fisicamente).

## 3.6 APIs propostas (backend)

Base: `/condominiums/:condominiumId/compliance`

- `POST /cases` - criar advertencia/caso
- `GET /cases` - listar com filtros (`unitId`, `status`, `type`)
- `GET /cases/:id` - detalhe + timeline
- `POST /cases/:id/convert-to-fine` - converter para multa
- `PATCH /cases/:id/status` - atualizar status administrativo
- `POST /cases/:id/decision` - decisao final
- `POST /cases/:id/events` - comentario interno

## 3.7 UI proposta (frontend)

- Nova pagina: `domains/compliance/pages/CompliancePage.tsx`
- Tabs: `Em aberto`, `Em analise`, `Decididos`.
- Card por caso com:
  - unidade, categoria, tipo, status, data;
  - botao de abrir detalhe;
  - acoes contextualizadas (converter, decidir, cancelar).
- Modal "Converter em multa" com validacao de valor/data.

## 3.8 Criterios de aceite

- Sindico consegue registrar advertencia em ate 2 minutos.
- Todo caso possui timeline minima de eventos.
- Conversao em multa gera registro financeiro administrativo.
- Erros e textos de orientacao em PT-BR.

---

## 4) Modulo 2 - Manutencao Preventiva

## 4.1 Problema de negocio

Condominios pequenos operam manutencao de forma reativa. Falta:

- calendario recorrente;
- checklist por tarefa;
- historico de execucao e pendencias;
- rastreio de fornecedor responsavel.

## 4.2 Escopo funcional (MVP)

- Cadastro de plano de manutencao por item/area.
- Recorrencia basica (mensal, bimestral, trimestral, semestral, anual).
- Geracao de ordem de manutencao (`maintenance_tasks`).
- Execucao com status e checklist.
- Registro do fornecedor responsavel.
- Vinculo opcional com despesa (`expenses`) e documento comprovante.

## 4.3 Entidades e campos (proposta)

### A) `maintenance_plans`
- `id`, `condominium_id`
- `name` (ex.: "Bomba d'agua - inspecao")
- `location` (ex.: casa de maquinas)
- `frequency` (`MONTHLY` | `BIMONTHLY` | `QUARTERLY` | `SEMIANNUAL` | `ANNUAL`)
- `start_date`
- `active` (bool)
- `estimated_cost` (decimal nullable)
- `notes` (text nullable)
- `created_at`, `updated_at`

### B) `maintenance_tasks`
- `id`, `plan_id`, `condominium_id`
- `scheduled_date`
- `status` (`PENDING` | `IN_PROGRESS` | `DONE` | `OVERDUE` | `CANCELED`)
- `supplier_name` (varchar nullable)
- `supplier_contact` (varchar nullable)
- `execution_notes` (text nullable)
- `finished_at` (timestamptz nullable)
- `expense_id` (uuid nullable)
- `document_id` (uuid nullable)
- `created_at`, `updated_at`

### C) `maintenance_task_checklist_items`
- `id`, `task_id`
- `label`
- `done` (bool)
- `done_at` (timestamptz nullable)

## 4.4 Fluxos principais

### Fluxo A - Criar plano preventivo
1. Admin/Subadmin cria plano com frequencia.
2. Sistema calcula proxima data prevista.
3. Scheduler gera tarefas no horizonte configurado (ex.: proximos 60 dias).

### Fluxo B - Executar tarefa
1. Responsavel abre tarefa `PENDING`.
2. Marca `IN_PROGRESS`.
3. Atualiza checklist.
4. Conclui em `DONE` com observacao e fornecedor.
5. Opcionalmente vincula despesa/documento.

### Fluxo C - Atraso automatico
1. Job diario verifica tarefas vencidas.
2. Tarefas `PENDING` com data passada viram `OVERDUE`.
3. Sistema notifica administracao.

## 4.5 Regras de negocio

- Apenas `ADMIN`/`SUB_ADMIN` criam planos e alteram tarefas.
- Tarefa `DONE` nao volta para `PENDING` (somente `IN_PROGRESS` -> `DONE`).
- Nao permitir concluir tarefa sem ao menos um checklist marcado quando checklist existir.
- Registro de fornecedor e livre no MVP (sem cadastro mestre obrigatorio).
- Ao desativar plano (`active=false`), nao gerar novas tarefas, mas manter historico.

## 4.6 APIs propostas (backend)

Base: `/condominiums/:condominiumId/maintenance`

- `POST /plans`
- `GET /plans`
- `PATCH /plans/:id`
- `POST /tasks/generate` (manual/forcado)
- `GET /tasks` (filtros por status, periodo)
- `PATCH /tasks/:id/status`
- `PATCH /tasks/:id/checklist/:itemId`
- `PATCH /tasks/:id/link-expense`
- `PATCH /tasks/:id/link-document`

## 4.7 UI proposta (frontend)

- Nova pagina: `domains/maintenance/pages/MaintenancePage.tsx`
- Blocos:
  - **Planos ativos**
  - **Tarefas da semana**
  - **Atrasadas**
- Acoes rapidas:
  - "Criar plano"
  - "Iniciar tarefa"
  - "Concluir tarefa"
  - "Vincular despesa"

## 4.8 Criterios de aceite

- Sindico consegue cadastrar plano recorrente sem suporte tecnico.
- Sistema evidencia claramente tarefas atrasadas.
- Cada tarefa concluida fica com trilha minima: data, responsavel, observacao.

---

## 5) Integracoes e reaproveitamento no CondoSync

- **Ocorrencias -> Multas:** permitir origem de caso a partir de `occurrences`.
- **Documentos:** anexos e comprovantes de manutencao.
- **Despesas:** vincular custo real de manutencao.
- **Notificacoes in-app:** avisos de decisao de caso e tarefas vencidas.
- **WhatsApp (fase posterior):** lembretes de manutencao e comunicados de decisao.

---

## 6) Prioridade tecnica sugerida (execucao)

### Fase 1 (rapida, alto impacto)
- Estrutura de dados + CRUD de casos (advertencia/multa).
- Estrutura de dados + CRUD de planos/tarefas preventivas.
- Listagens operacionais basicas no frontend.

### Fase 2 (operacao assistida)
- Timeline detalhada e filtros avancados.
- Scheduler para tarefas recorrentes/atrasos.
- Notificacoes in-app.

### Fase 3 (integracao financeira e automacoes)
- Conversao opcional de multa em `charge`.
- Vinculo direto tarefa <-> despesa/documento.
- Relatorios de recorrencia (inadimplencia disciplinar e manutencao).

---

## 7) Riscos e mitigacoes

- **Risco juridico de fluxo incompleto de multa**
  - Mitigar com trilha de eventos obrigatoria e campos de justificativa.
- **Complexidade excessiva para sindico pequeno**
  - Mitigar com MVP enxuto e defaults inteligentes.
- **Baixa adesao**
  - Mitigar com UI orientada por tarefa e status claros.

---

## 8) KPIs recomendados

### Multas/advertencias
- Tempo medio entre abertura e decisao.
- Percentual de casos com evidencias anexadas.
- Quantidade de reincidencias por unidade.

### Manutencao preventiva
- Percentual de tarefas concluidas no prazo.
- Quantidade de tarefas `OVERDUE` por mes.
- Tempo medio de conclusao por tipo de plano.

---

## 9) Definicao de pronto (DoD) para implementacao

- Regras de autorizacao por perfil aplicadas em backend.
- DTOs + validacoes + mensagens de erro em PT-BR.
- Lint/type-check/build passando nos arquivos alterados.
- Eventos principais auditaveis por timeline.
- Frontend com estados vazios e feedback de acao (toast/sucesso/erro).

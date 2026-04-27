**CondoSync**

Guia Técnico — Backend

Documento 2 de 3  ·  v1.0

Eduardo Oris  ·  NestJS + TypeORM + Postgres + Keycloak + S3

# 1. Stack & Decisões Técnicas

| Tecnologia | Versão | Responsabilidade |
| --- | --- | --- |
| NestJS | ^10.x | Framework principal — MVC + Modules + DI |
| TypeORM | ^0.3.x | ORM — abstração do banco via Repository Pattern |
| PostgreSQL | 16.x | Banco de dados (TypeORM) |
| Keycloak | 25.x | Auth (JWT RS256) |
| AWS SDK v3 (S3) | ^3.x | Storage S3-compatible (AWS S3 / MinIO / R2) |
| Bull + Redis | ^5.x | Filas para WhatsApp, cobranças automáticas |
| class-validator / class-transformer | Latest | Validação de DTOs |
| @nestjs/config | Latest | Variáveis de ambiente com validação Zod |
| Jest | Latest | Testes unitários e de integração |
| Swagger (@nestjs/swagger) | Latest | Documentação automática da API |

# 2. Arquitetura — MVC + Adapter Pattern

O backend segue arquitetura MVC dentro do NestJS, com Adapter Pattern para isolar todas as integrações externas. Trocar o banco, o provedor de WhatsApp ou o storage não deve tocar em nenhuma regra de negócio.

## 2.1 Estrutura de Pastas

```
src/
  modules/
    auth/
    users/
    condominiums/
    units/
    residents/
    charges/
    expenses/
    polls/
    occurrences/
    bulletin/
    documents/
    dashboard/
  adapters/                    # Todas as integrações externas
    whatsapp/
      whatsapp.adapter.ts      # Interface IWhatsAppAdapter
      evolution-api.adapter.ts # Implementação Evolution API
      zapi.adapter.ts          # Implementação Z-API (alternativa)
    storage/
      storage.adapter.ts       # Interface IStorageAdapter
      s3-storage.adapter.ts    # AWS S3 / MinIO / R2 (S3-compatible)
    auth/
      auth.adapter.ts          # Interface IAuthAdapter
      keycloak-auth.adapter.ts
    payment/                   # V2
      payment.adapter.ts       # Interface IPaymentAdapter
      asaas.adapter.ts
  common/
    decorators/
    guards/                    # AuthGuard, RolesGuard
    filters/                   # ExceptionFilter global
    interceptors/
    pipes/
  config/
    database.config.ts
    app.config.ts
  queues/                      # Bull workers
    charges.processor.ts
    whatsapp.processor.ts
  main.ts
  app.module.ts
```

## 2.2 Anatomia de um Módulo NestJS

Cada módulo segue a mesma estrutura interna para garantir separação de responsabilidades:

```
modules/charges/
  charges.module.ts            # Declara providers, imports, exports
  charges.controller.ts        # Recebe HTTP, valida com DTO, chama service
  charges.service.ts           # Regras de negócio, usa repository
  charges.repository.ts        # Acesso ao banco via TypeORM
  dto/
    create-charge.dto.ts
    update-charge.dto.ts
    charge-response.dto.ts
  entities/
    charge.entity.ts           # @Entity() TypeORM
  charges.service.spec.ts      # Testes unitários
```

## 2.3 Exemplo — Interface de Adapter

```
// adapters/whatsapp/whatsapp.adapter.ts
export interface IWhatsAppAdapter {
  sendMessage(to: string, message: string): Promise<void>;
  sendDocument(to: string, fileUrl: string, caption?: string): Promise<void>;
}

// adapters/whatsapp/evolution-api.adapter.ts
import { Injectable } from '@nestjs/common';
import { IWhatsAppAdapter } from './whatsapp.adapter';

@Injectable()
export class EvolutionApiAdapter implements IWhatsAppAdapter {
  async sendMessage(to: string, message: string): Promise<void> {
    // implementação específica da Evolution API
  }
  async sendDocument(to: string, fileUrl: string, caption?: string): Promise<void> {
    // implementação específica da Evolution API
  }
}

// Para trocar de provedor: alterar apenas o provide no módulo
// { provide: 'WHATSAPP_ADAPTER', useClass: ZApiAdapter }
```

# 3. Banco de Dados — Entidades & Relacionamentos

```
Princípio de Portabilidade
O banco é abstraído via TypeORM Repository Pattern. Trocar o provedor (PostgreSQL gerenciado, RDS, Cloud SQL etc.) significa apenas alterar `DATABASE_URL` — nenhuma regra de negócio é acoplada a um provedor específico.
```

## 3.1 Entidades e Relacionamentos

| Entidade | Tabela | Relacionamentos Principais |
| --- | --- | --- |
| User | users | N:N condominiums (via user_condominiums) |
| Condominium | condominiums | 1:N units, N:N users |
| UserCondominium | user_condominiums | user_id + condominium_id + role |
| Unit | units | N:1 condominium, 1:N residents, 1:N charges |
| Resident | residents | N:1 unit, flag is_financial_responsible |
| Charge | charges | N:1 unit, status, due_date, paid_at |
| Expense | expenses | N:1 condominium, category, storage_key |
| Poll | polls | N:1 condominium, 1:N poll_options, 1:N poll_votes |
| PollVote | poll_votes | N:1 poll, N:1 unit (UNIQUE) |
| Occurrence | occurrences | N:1 unit, status, is_anonymous |
| BulletinPost | bulletin_posts | N:1 condominium, priority, expires_at |
| Document | documents | N:1 condominium, storage_key, category |

## 3.2 Exemplo de Entity com TypeORM

```
// entities/unit.entity.ts
@Entity('units')
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Condominium, (c) => c.units, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column()
  block: string;

  @Column()
  number: string;

  @Column({ type: 'enum', enum: UnitType, default: UnitType.APARTMENT })
  type: UnitType;

  @Column({ type: 'enum', enum: UnitStatus, default: UnitStatus.VACANT })
  status: UnitStatus;

  @OneToMany(() => Resident, (r) => r.unit)
  residents: Resident[];

  @OneToMany(() => Charge, (c) => c.unit)
  charges: Charge[];

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
```

## 3.3 Multi-tenant — Isolamento por Condomínio

```
Regra Crítica de Segurança
Todo endpoint que acessa dados de um condomínio DEVE filtrar por condominium_id
O condominium_id deve ser extraído do JWT ou validado contra os condomínios do usuário
Nunca confiar no condominium_id vindo do body sem validar se o usuário pertence a ele
Criar um guard CondominiumMemberGuard para validar automaticamente via decorator
```

# 4. Módulos — Responsabilidades e Endpoints

## 4.1 Auth Module

- Integra com Keycloak via IAuthAdapter

- Valida JWT em todo request via AuthGuard global

- Extrai user_id e popula @CurrentUser() decorator

- Endpoints: POST /auth/login, POST /auth/logout, GET /auth/me

## 4.2 Condominiums Module

- CRUD completo com soft delete (archived_at)

- Endpoints: POST, GET, PATCH, DELETE /condominiums

- GET /condominiums/mine — lista condomínios do usuário autenticado

- POST /condominiums/:id/members — adiciona síndico/subsíndico

- Validação: não arquiva condomínio com saldo pendente ou unidades ativas

## 4.3 Units Module

- CRUD com filtro obrigatório por condominium_id

- Endpoints: POST, GET, PATCH /condominiums/:condId/units

- POST /condominiums/:condId/units/import — importação em lote via CSV

- GET /condominiums/:condId/units/:id/residents — lista moradores da unidade

## 4.4 Residents Module

- Cadastro de moradores com validação de WhatsApp e CPF

- Lógica de troca de responsável financeiro com log de histórico

- Endpoints: POST, GET, PATCH /units/:unitId/residents

- PATCH /units/:unitId/residents/:id/set-responsible — define responsável

## 4.5 Charges Module (Arrecadação)

- Geração manual e automática via Bull Queue (cron configurável)

- Status flow: pending → paid \| overdue \| exempt

- Após 5 dias do vencimento sem pagamento: job muda status e envia WhatsApp

- Endpoints: POST, GET, PATCH /condominiums/:condId/charges

- POST /condominiums/:condId/charges/generate — geração manual do mês

- PATCH /charges/:id/mark-paid — registra pagamento manualmente

- PATCH /charges/:id/exempt — isenta com justificativa obrigatória

## 4.6 Expenses Module (Despesas)

- Lançamento de despesas com upload de comprovante via IStorageAdapter

- Endpoints: POST, GET, PATCH, DELETE /condominiums/:condId/expenses

- GET /condominiums/:condId/expenses/summary — resumo por categoria e período

## 4.7 Polls Module (Enquetes)

- Criação pelo síndico com opções, quórum mínimo e data de encerramento

- POST /polls/:id/vote — validar se já votou (UNIQUE poll_id + unit_id)

- Resultado bloqueado até encerramento — campo locked_until ou status

- Endpoints: POST, GET, PATCH /condominiums/:condId/polls

- POST /polls/:id/close — encerramento manual pelo síndico

## 4.8 Occurrences Module

- Criação por qualquer morador autenticado

- Avanço de status somente por síndico/subsíndico

- Notificação ao autor a cada mudança de status via Bull Queue

- Endpoints: POST, GET, PATCH /condominiums/:condId/occurrences

- PATCH /occurrences/:id/status — avança status (guard: ADMIN role)

## 4.9 Documents Module

- Upload via IStorageAdapter com geração de URL assinada temporária

- Visibilidade configurável: ALL \| ADMIN_ONLY

- Endpoints: POST, GET, DELETE /condominiums/:condId/documents

- GET /documents/:id/url — retorna URL assinada com expiração

## 4.10 Dashboard Module

- Endpoint de leitura agregada — sem escrita

- GET /condominiums/:condId/dashboard — saldo, inadimplência, últimas despesas

- GET /condominiums/:condId/dashboard/chart — receitas x despesas por mês

# 5. Filas com Bull + Redis

```
Por que filas?
Envio de WhatsApp não pode travar a resposta HTTP ao cliente
Geração mensal de cobranças é um processo pesado e agendado
Notificações de ocorrências devem ser assíncronas e resilientes
Bull garante retry automático em caso de falha no envio
```

## 5.1 Processors

| Queue | Trigger | Responsabilidade |
| --- | --- | --- |
| charges-generation | Cron (dia configurável/mês) | Gera cobranças para todas unidades ocupadas |
| overdue-check | Cron diário 00:00 | Verifica cobranças vencidas e atualiza status |
| whatsapp-send | On-demand (service call) | Envia mensagem via IWhatsAppAdapter |
| occurrence-notify | On status change | Notifica autor da ocorrência sobre mudança |
| bulletin-notify | On urgent post | Envia WhatsApp para responsáveis em recados urgentes |

# 6. Autenticação & Autorização

## 6.1 Guards

```
// AuthGuard — global, valida JWT Keycloak em todo request
// RolesGuard — verifica role do usuário no condomínio
// CondominiumMemberGuard — valida que o usuário pertence ao condomínio

// Uso nos controllers:
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
@Patch(':id/status')
async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
  return this.occurrencesService.updateStatus(id, dto);
}
```

## 6.2 Roles por Módulo

| Ação | ADMIN (Síndico) | SUB_ADMIN | RESPONSIBLE | RESIDENT |
| --- | --- | --- | --- | --- |
| Criar condomínio/unidade | Sim | Nao | Nao | Nao |
| Gerenciar moradores | Sim | Sim | Nao | Nao |
| Gerar/editar cobranças | Sim | Sim | Nao | Nao |
| Registrar despesas | Sim | Sim | Nao | Nao |
| Criar enquete | Sim | Nao | Nao | Nao |
| Votar em enquete | Nao | Nao | Sim | Nao |
| Abrir ocorrência | Sim | Sim | Sim | Sim |
| Avançar status ocorrência | Sim | Sim | Nao | Nao |
| Ver extrato financeiro | Sim | Sim | Sim | Sim |
| Upload de documentos | Sim | Sim | Nao | Nao |

# 7. Integrações Externas — Adapter Pattern

## 7.1 WhatsApp — IWhatsAppAdapter

```
Recomendação: Evolution API
Open source e self-hosted — zero custo para o MVP
Eduardo já possui familiaridade com o projeto (contribuidor)
Compatible com WhatsApp Web — sem aprovação Meta necessária
Fallback: Z-API (SaaS brasileiro, plano gratuito) se não quiser manter infra
```

```
// Trocar de Evolution API para Z-API:
// Só alterar no providers do WhatsAppModule:
{ provide: WHATSAPP_ADAPTER, useClass: ZApiAdapter }
// O ChargesService nunca sabe qual provedor está sendo usado
```

## 7.2 Storage — IStorageAdapter

- Dev: MinIO local (S3-compatible, roda no docker-compose)

- Produção: AWS S3 ou Cloudflare R2 — apenas trocar `S3_ENDPOINT`/credenciais

- URLs de acesso sempre geradas como assinadas com expiração (presigned URL)

- Nunca salvar URL diretamente — salvar storage_key e gerar URL sob demanda

## 7.3 Auth — IAuthAdapter

- MVP: Keycloak (JWT com RS256, realm `main`)

- Migração futura para Auth0/Cognito = somente o adapter muda

- O AuthGuard extrai o user_id do JWT e popula o contexto do request

## 7.4 Pagamentos — IPaymentAdapter (V2)

- Asaas ou Efí (Gerencianet) para geração de boletos e PIX

- Interface definida desde o início para facilitar integração futura

- Não bloqueia o MVP — cobranças do MVP são controladas manualmente

# 8. Variáveis de Ambiente

```
# Banco
DATABASE_URL=postgresql://user:pass@host:5432/condosync

# Keycloak (Auth)
AUTH_PROVIDER=keycloak
KEYCLOAK_ISSUER=https://auth.condosync.com.br/realms/main
KEYCLOAK_INTERNAL_URL=http://keycloak:8080/realms/main
KEYCLOAK_CLIENT_ID=main-frontend

# Redis (Bull)
REDIS_URL=redis://localhost:6379

# WhatsApp (Evolution API)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=xxx
EVOLUTION_INSTANCE=condosync

# Storage S3-compatible (AWS S3 / MinIO / R2)
STORAGE_PROVIDER=s3
STORAGE_BUCKET=condosync-files
S3_REGION=us-east-1
S3_ENDPOINT=                  # vazio = AWS S3 nativo; preencha p/ MinIO/R2
S3_PUBLIC_ENDPOINT=
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false     # true para MinIO/R2

# App
PORT=3000
NODE_ENV=production
```

# 9. Estratégia de Testes

| Tipo | Ferramenta | Cobertura Esperada |
| --- | --- | --- |
| Unitário (Service) | Jest + mocks de repository | Todas as regras de negócio críticas |
| Unitário (Adapter) | Jest + mocks de HTTP client | Todos os adapters externos |
| Integração (E2E) | Jest + Supertest + DB test | Fluxos completos por módulo |
| Cobertura mínima | Jest --coverage | 80% nas classes de service |

# 10. Roadmap de Implementação

| Sprint | Entregáveis |
| --- | --- |
| Sprint 1 | Setup NestJS, TypeORM, Postgres, Keycloak, Auth Module, Adapters skeleton |
| Sprint 2 | Condominiums, Units, Residents modules + testes |
| Sprint 3 | Charges module + Bull Queue + Evolution API adapter |
| Sprint 4 | Expenses, Documents modules + Storage adapter |
| Sprint 5 | Polls, Occurrences, Bulletin modules |
| Sprint 6 | Dashboard endpoint, Swagger docs, testes E2E |
| V2 | Payment adapter (Asaas), relatórios PDF, webhooks |

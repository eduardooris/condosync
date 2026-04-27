# Backend (NestJS) — Guia para Agentes de IA

> **Fonte de verdade do código real do backend CondoSync.** Este documento é normativo: qualquer divergência entre ele e a documentação `02_backend_guia_tecnico.md` (que descreve o projeto pré-implementação), o `AGENTS.md` ganha.
>
> Antes de tocar qualquer linha, leia também o `AGENTS.md` raiz do monorepo: [`../AGENTS.md`](../AGENTS.md).

## Índice

1. [Stack real](#1-stack-real)
2. [Arquitetura](#2-arquitetura)
3. [Estrutura de pastas](#3-estrutura-de-pastas)
4. [Anatomia de um módulo](#4-anatomia-de-um-módulo)
5. [Convenções de nomenclatura](#5-convenções-de-nomenclatura)
6. [Validação, DTOs e respostas HTTP](#6-validação-dtos-e-respostas-http)
7. [Autenticação, guards e multi-tenant](#7-autenticação-guards-e-multi-tenant)
8. [Persistência (TypeORM + Postgres)](#8-persistência-typeorm--postgres)
9. [Migrations](#9-migrations)
10. [Filas (Bull) e processadores](#10-filas-bull-e-processadores)
11. [Adapters externos](#11-adapters-externos)
12. [Configuração / variáveis de ambiente](#12-configuração--variáveis-de-ambiente)
13. [Logging e observabilidade](#13-logging-e-observabilidade)
14. [Testes](#14-testes)
15. [Lint, build, Docker](#15-lint-build-docker)
16. [Como adicionar uma feature nova (checklist)](#16-como-adicionar-uma-feature-nova-checklist)
17. [Anti-padrões — recusar em code review](#17-anti-padrões--recusar-em-code-review)

---

## 1. Stack real

| Camada | Tecnologia | Versão | Observação |
| --- | --- | --- | --- |
| Framework | NestJS | ^10 | MVC + DI nativos |
| Linguagem | TypeScript | ^5 | `strict: true` no tsconfig |
| ORM | TypeORM | ^0.3 | Repository pattern + migrations |
| DB | PostgreSQL | 16 | Schema único, dialect `postgres` |
| Auth | Keycloak (JWT RS256) | 25 | Realm `main` |
| Filas | Bull + Redis | ^4 / ^7 | `@nestjs/bull` |
| Cron | `@nestjs/schedule` | latest | Scheduler in-process |
| Storage | AWS SDK v3 (S3 / MinIO) | ^3 | URLs assinadas, nunca direto |
| Logging | `nestjs-pino` | latest | JSON em prod, pretty em dev |
| Validação | `class-validator` + `class-transformer` | latest | Em DTOs |
| Env | `@nestjs/config` + `zod` | ^3 | `validateEnv` em `config/env.schema.ts` |
| Docs | `@nestjs/swagger` | latest | Swagger UI em `/api/docs` |
| HTTP segurança | `helmet`, `compression`, `@nestjs/throttler` | latest | Configurados em `main.ts` |
| Testes | Jest | ^29 | `*.spec.ts` ao lado do código |

> **Regra:** novas dependências exigem justificativa. Prefira o que já existe no `package.json`. Não introduza Lodash, Moment, ou bibliotecas de utility-belt.

## 2. Arquitetura

**MVC + Adapter Pattern** dentro do NestJS:

- **Module** = unidade de feature (declara providers, controllers, exports).
- **Controller** = camada HTTP. Recebe DTO, valida via pipe, delega ao service. **Nunca** acessa repositório direto.
- **Service** = regras de negócio. Pode usar repositórios e adapters. **Não conhece HTTP** (sem `@Req`/`@Res`).
- **Repository** = wrapper opcional sobre `Repository<Entity>` do TypeORM. Concentra queries reutilizáveis.
- **Adapter** = isola integração externa atrás de uma interface. Trocar provider = trocar `useClass`.

### Regras de import (cumpridas pelos módulos atuais)
1. `modules/*` pode importar de `common/`, `database/`, `adapters/`, `core/`, `config/`.
2. `adapters/*` **não** importa nada de `modules/*`. Adapters são genéricos.
3. `database/entities/*` **não** importa de `modules/*` (entidades são compartilhadas).
4. `common/*` é compartilhado por todos — **não** importa de `modules/*` nem `adapters/*`.

## 3. Estrutura de pastas

```
backend/src/
├── main.ts                      # Bootstrap: ValidationPipe, CORS, Swagger, Helmet
├── app.module.ts                # Imports: Config, Logger, TypeORM, Bull, Throttler, módulos
├── health.controller.ts         # GET /health (Docker healthcheck)
│
├── config/
│   └── env.schema.ts            # Zod schema + `validateEnv` + tipo `Env`
│
├── core/
│   └── core.module.ts           # Globals + APP_GUARD/APP_FILTER providers
│
├── common/
│   ├── decorators/              # @CurrentUser, @Roles, @Public, @CondominiumMembership, etc.
│   ├── dto/                     # ErrorResponseDto, paginação genérica
│   ├── enums/                   # UserRole, ChargeStatus, UnitStatus, etc.
│   ├── filters/                 # AllExceptionsFilter (envelope + TypeORM → HTTP)
│   ├── guards/                  # JwtAuthGuard, RolesGuard, CondominiumMemberGuard
│   ├── interfaces/              # RequestUser, ...
│   ├── middleware/              # request-id.middleware (gera/propaga x-request-id)
│   └── utils/                   # br-documents (CPF/CNPJ/whatsapp), jwt-verify, ...
│
├── database/
│   ├── data-source.ts           # DataSource para CLI do TypeORM
│   ├── entities/                # @Entity() — uma classe por tabela
│   └── migrations/              # 1xxx-NomeDescritivo.ts — forward-only em prod
│
├── adapters/
│   ├── adapters.module.ts       # @Global() — providers compartilhados
│   ├── auth/                    # KeycloakAuthAdapter (IAuthAdapter)
│   ├── storage/                 # S3StorageAdapter (IStorageAdapter)
│   ├── whatsapp/                # MessageServerAdapter (IWhatsAppAdapter)
│   └── payment/                 # (V2) IPaymentAdapter
│
├── modules/                     # Uma pasta por bounded context
│   ├── auth/
│   ├── users/
│   ├── condominiums/
│   ├── invitations/
│   ├── units/
│   ├── residents/
│   ├── charges/
│   ├── expenses/
│   ├── documents/
│   ├── polls/
│   ├── occurrences/
│   ├── bulletin/
│   ├── dashboard/
│   ├── notifications/
│   └── integrations/            # webhooks de message-server, etc.
│
└── queues/
    ├── queue-names.ts           # Constantes QUEUE_*
    ├── queues.module.ts         # BullModule.registerQueue + processors globais
    ├── messages/                # Templates de WhatsApp por tipo de evento
    └── whatsapp.processor.ts    # @Processor(QUEUE_WHATSAPP_SEND)
```

## 4. Anatomia de um módulo

Use `modules/charges/` como referência canônica:

```
modules/charges/
├── charges.module.ts            # Declara controllers, providers, exports
├── charges.controller.ts        # CondominiumChargesController + CondominiumMyChargesController
├── charge-actions.controller.ts # PATCH /charges/:id/{mark-paid,exempt,cancel}
├── charges.service.ts           # Regras de negócio (geração, transição de status)
├── charges.repository.ts        # Queries TypeORM reutilizáveis
├── charges.scheduler.ts         # @Cron — geração mensal e overdue check
├── charge-status.machine.ts     # FSM pura — não acessa I/O
├── charges.service.spec.ts      # Jest — service com repositório mockado
├── dto/
│   ├── create-charge.dto.ts
│   ├── update-charge.dto.ts
│   ├── cancel-charge.dto.ts
│   ├── exempt-charge.dto.ts
│   ├── mark-paid.dto.ts
│   ├── generate-month.dto.ts
│   └── charge-response.dto.ts
└── processors/
    ├── charges-generation.processor.ts
    ├── overdue-check.processor.ts
    └── balance-check.processor.ts
```

Ao criar um módulo novo, **siga essa mesma estrutura**. Se um arquivo não fizer sentido, omita; não invente novos formatos.

### Module file
```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Charge, Unit, Condominium, UserCondominium, Resident]),
    DashboardModule,
  ],
  controllers: [
    CondominiumChargesController,
    CondominiumMyChargesController,
    ChargeActionsController,
  ],
  providers: [
    ChargesRepository,
    ChargesService,
    ChargesSchedulerService,
    ChargesGenerationProcessor,
    OverdueCheckProcessor,
    BalanceCheckProcessor,
  ],
  exports: [ChargesService, ChargesRepository],
})
export class ChargesModule {}
```

### Controller
- Sempre `@ApiTags('<dominio>')` + `@ApiBearerAuth('bearer')` no topo da classe (visíveis no Swagger).
- Use `@ApiOperation`, `@ApiOkResponse`, `@ApiCreatedResponse`, `@ApiBadRequestResponse`, `@ApiNotFoundResponse` em **todos** os endpoints.
- Path com `condominiumId` quando aplicável: `@Controller('condominiums/:condominiumId/charges')`.
- Sempre `@Param('id', ParseUUIDPipe)`.
- **Nunca** retorne objetos sem tipo Swagger associado (cliente front depende disso).

### Service
- Recebe repositórios via DI (`@InjectRepository(Entity)`).
- Lança apenas `*Exception` do `@nestjs/common` (`BadRequestException`, `NotFoundException`, `ForbiddenException`, `ConflictException`).
- Para transição de status, use uma FSM pura (vide `charge-status.machine.ts`) — sem I/O dentro dela.
- Helpers privados (`private`) para datas no fuso `America/Sao_Paulo`, formatação de moeda, etc.
- Métodos públicos seguem o verbo da ação: `create`, `update`, `cancel`, `markPaid`, `runScheduledGenerationForToday`.

## 5. Convenções de nomenclatura

| Item | Convenção | Exemplo |
| --- | --- | --- |
| Pasta de módulo | `kebab-case` plural inglês | `modules/charges/` |
| Arquivo | `kebab-case.<tipo>.ts` | `cancel-charge.dto.ts` |
| Classe | `PascalCase` + sufixo do tipo | `ChargesService`, `CancelChargeDto` |
| Provider customizado | `SCREAMING_SNAKE_CASE` | `WHATSAPP_ADAPTER` |
| Variável | `camelCase` | `chargeId` |
| Constante de queue | `SCREAMING_SNAKE_CASE` em `queue-names.ts` | `QUEUE_WHATSAPP_SEND` |
| Enum | `PascalCase` + valores `SCREAMING_SNAKE_CASE` | `ChargeStatus.CANCELED` |
| Migration | `<timestamp>-<NomeDescritivo>.ts` | `1716000000000-ChargeCancellationAndDuplicates.ts` |
| Endpoint | `kebab-case` em ação | `PATCH /charges/:id/mark-paid` |

## 6. Validação, DTOs e respostas HTTP

### DTO de input
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelChargeDto {
  @ApiPropertyOptional({
    description: 'Motivo do cancelamento (será exibido no histórico).',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```
- Uma anotação `@Api*` por campo (apareceria no Swagger).
- Sempre o decorator de validação (`@IsString`, `@IsUUID`, `@IsOptional`, `@MaxLength`, etc.).
- DTOs **nunca** importam entities.

### DTO de resposta
- Tipos primitivos com `@ApiProperty({ example: ... })`.
- Campos opcionais com `@ApiPropertyOptional({ nullable: true })`.
- Use o mesmo formato dos campos da entity (datas como `Date`, decimais como `string`).

### Envelope de erro
Tudo passa por `AllExceptionsFilter`. **Não** cuspa erro cru:
- `BadRequestException('mensagem em pt-BR')` para validação manual.
- `NotFoundException('Cobrança não encontrada.')`.
- `ConflictException('...')` para duplicidade de regra (não confunda com unique violation do banco — esse o filtro já mapeia para 409).
- `ForbiddenException` quando o usuário não tem permissão.
- `BadGatewayException` somente em adapters quando uma chamada externa falha.

Pipe global em `main.ts` (não duplique):
- `whitelist: true` — silenciosamente remove campos extras.
- `forbidNonWhitelisted: true` — falha 400 quando vem campo não declarado no DTO.
- `transform: true` + `enableImplicitConversion: true` — coerce `string` → `number`/`boolean` quando o DTO declara o tipo.

## 7. Autenticação, guards e multi-tenant

### Auth global
- `JwtAuthGuard` é registrado como `APP_GUARD` no `CoreModule` — **todo** endpoint exige JWT por padrão.
- Para endpoint público use `@Public()` (decorator em `common/decorators/public.decorator.ts`).
- O guard popula `req.user` (tipo `RequestUser`). Acesse com `@CurrentUser() user: RequestUser`.

### Multi-tenant — REGRA INEGOCIÁVEL
Todo endpoint que acessa dados de um condomínio:
1. Recebe `condominiumId` na URL: `/condominiums/:condominiumId/...`.
2. Aplica `CondominiumMemberGuard` (valida que `req.user` pertence ao condomínio).
3. Se for ação privilegiada, aplica `RolesGuard` + `@Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)`.
4. **Nunca** confie em `condominiumId` vindo do `body` sem revalidar o membership.

Exemplo:
```ts
@Controller('condominiums/:condominiumId/charges')
@UseGuards(CondominiumMemberGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
export class CondominiumChargesController { ... }
```

### Roles vigentes
| Role | Significado |
| --- | --- |
| `ADMIN` | Síndico — controle total do condomínio |
| `SUB_ADMIN` | Subsíndico — quase tudo, exceto criar enquete e arquivar condo |
| `RESPONSIBLE` | Morador responsável financeiro pela unidade |
| `RESIDENT` | Morador comum |

## 8. Persistência (TypeORM + Postgres)

### Entity
```ts
@Entity('charges')
export class Charge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'unit_id' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ type: 'enum', enum: ChargeStatus, default: ChargeStatus.PENDING })
  status: ChargeStatus;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```
- Coluna do banco em `snake_case` via `name:`. Propriedade TS em `camelCase`.
- Nullable explícito (`nullable: true`) e tipo TS `T | null`.
- `onDelete: 'RESTRICT'` por padrão. Use `'CASCADE'` apenas quando justificado.
- Para enums Postgres: `@Column({ type: 'enum', enum: MyEnum })`.

### Repository wrapper
- Crie um `*.repository.ts` quando o módulo tiver mais de 2-3 queries customizadas.
- Métodos retornam `Promise<Entity | null>` ou `Promise<Entity[]>`.
- Use `createQueryBuilder` para joins com `addSelect`/`leftJoinAndSelect`.

### Não confunda!
- `synchronize: true` está LIGADO em dev (`NODE_ENV !== 'production'`). Em prod usa migrations (`migrationsRun: true`).
- **Toda** mudança de schema vira migration. `synchronize` em dev é só conveniência — não justifique pular migration.

## 9. Migrations

Localização: `src/database/migrations/<timestamp>-<NomeDescritivo>.ts`. Exemplo recente:

```ts
export class ChargeCancellationAndDuplicates1716000000000 implements MigrationInterface {
  // Postgres não permite ALTER TYPE ... ADD VALUE em transação.
  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "charges_status_enum" ADD VALUE IF NOT EXISTS 'CANCELED'
    `);
    await queryRunner.query(`
      ALTER TABLE "charges"
      ADD COLUMN IF NOT EXISTS "canceled_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "cancel_reason" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> { ... }
}
```

Regras:
- **Sempre `IF NOT EXISTS` / `IF EXISTS`** — migration deve ser idempotente.
- Se usar `ALTER TYPE ADD VALUE`, declare `public transaction = false as const` (já configuramos `migrationsTransactionMode: 'each'`).
- Sempre escreva o `down()` correspondente. Em prod nunca rola, mas é exigência.
- O timestamp é o ISO compactado: `Date.now()` no momento da criação.
- Não use `query-builder` do TypeORM dentro da migration — apenas SQL bruto. Mais fácil de revisar.

## 10. Filas (Bull) e processadores

### Constantes
Toda queue tem nome em `queues/queue-names.ts`:
```ts
export const QUEUE_WHATSAPP_SEND = 'whatsapp:send';
export const QUEUE_CHARGES_GENERATION = 'charges:generation';
export const QUEUE_OVERDUE_CHECK = 'charges:overdue-check';
```

### Enfileirando
Service injeta `@InjectQueue(QUEUE_WHATSAPP_SEND) private readonly queue: Queue` e chama:
```ts
await this.whatsappQueue.add(
  'charge-created',
  { chargeId },
  { jobId: `charge:${chargeId}:created` },  // jobId determinístico = idempotência
);
```
- **Sempre** use `jobId` determinístico para evitar processar duas vezes o mesmo evento.
- Nome do job (`'charge-created'`) é o discriminador dentro do processor — em PT use o termo do domínio.

### Processor
```ts
@Processor(QUEUE_WHATSAPP_SEND)
export class WhatsappProcessor {
  @Process('charge-created')
  async onChargeCreated(job: Job<{ chargeId: string }>) {
    // 1. carregar agregados completos (com relations)
    // 2. resolver responsável financeiro + telefone
    // 3. renderizar template em queues/messages/
    // 4. delegar ao adapter de WhatsApp
  }
}
```
- Templates de mensagem ficam em `queues/messages/` — funções puras `render*Message(input)` retornando string.
- Logue o `requestId` quando o job vier de uma request (passe pelo data do job).
- Não jogue exception genérica do processor — o Bull já faz retry com backoff configurado.

## 11. Adapters externos

### Interface + implementação
```ts
// adapters/whatsapp/whatsapp.adapter.ts
export interface IWhatsAppAdapter {
  sendMessage(to: string, message: string): Promise<void>;
}
export const WHATSAPP_ADAPTER = Symbol('WHATSAPP_ADAPTER');

// adapters/whatsapp/message-server.adapter.ts
@Injectable()
export class MessageServerAdapter implements IWhatsAppAdapter { ... }

// adapters/adapters.module.ts
{ provide: WHATSAPP_ADAPTER, useClass: MessageServerAdapter }
```
- Sempre 1 interface + N implementações concretas.
- Token de injeção com `Symbol(...)` exportado pelo arquivo da interface.
- Service consome com `@Inject(WHATSAPP_ADAPTER)`.

### Padrão de chamada HTTP em adapter
- Use `fetch` nativo (Node 20+). Não adicione `axios` ao backend.
- **AbortController** com timeout configurável:
  ```ts
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), this.timeoutMs());
  try {
    const res = await fetch(url, { signal: controller.signal, ... });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`adapter erro ${res.status}: ${text}`);
      throw new BadGatewayException(`Falha de comunicação (HTTP ${res.status}).`);
    }
    return res;
  } finally { clearTimeout(timer); }
  ```
- Erros do upstream **sempre** viram `BadGatewayException` na borda do adapter — nunca deixe vazar `TypeError: fetch failed` ou `AbortError` para o controller.
- Cache de identificadores (instance_id, etc.) em memória do provider (singleton). Vide `MessageServerAdapter.cachedInstanceId`.
- Quando upstream tem fluxo "criar OU já existe", tente o create primeiro e faça fallback no 409 — não consulte antes (race condition).

## 12. Configuração / variáveis de ambiente

`config/env.schema.ts` é **o único lugar** que define variáveis. A app só sobe se passar pela validação Zod. Nunca leia `process.env` em service/controller — use `ConfigService<Env, true>`.

Padrão para nova variável:
1. Adicione ao schema com tipo + default + descrição em comentário.
2. Atualize `.env.example`.
3. Se for crítica em prod, **não** defina default — força a configuração.

## 13. Logging e observabilidade

- `nestjs-pino` é o logger oficial. Em service/controller injete `Logger` de `@nestjs/common` ou use `@InjectPinoLogger`.
- Em adapter use `private readonly logger = new Logger(MessageServerAdapter.name)`.
- **Sempre** inclua o `context` (nome da classe) — Pino formata como `{context: "MessageServerAdapter"}`.
- Não logue PII (números de WhatsApp completos, tokens, senhas). O Pino redacta `Authorization`, `Cookie`, `x-api-key` automaticamente.
- Cada request ganha `x-request-id` (header propagado pelo middleware). Use-o para correlacionar logs.

## 14. Testes

- Arquivo: `*.spec.ts` ao lado do código testado.
- Foco: services (regras de negócio) e adapters (com `fetch` mockado).
- Use `Test.createTestingModule(...)` do Nest, com providers mockados via `useValue`.
- Padrão **Arrange-Act-Assert**, com mensagens em PT-BR nos `expect(...).toThrowError('Mensagem esperada')` quando aplicável.
- Cobertura mínima informal: 80% nas classes de `*.service.ts`. Não persiga 100%.
- Testes E2E (Supertest + DB de teste) ainda não estão estruturados — quando criar, ponha em `test/e2e/`.

## 15. Lint, build, Docker

```bash
# dentro de backend/
npm install
npm run lint            # eslint
npm run build           # nest build → dist/
npx tsc --noEmit        # type-check rápido sem emitir
npm test                # jest
```

Docker:
```bash
# da raiz do monorepo
docker compose build api
docker compose up -d api
docker logs condosync-api --tail=50 -f
```

`entrypoint.sh` aplica migrations automaticamente em prod. Em dev, `synchronize: true` cria/altera tabelas mas migrations também rodam — não duplique alterações.

## 16. Como adicionar uma feature nova (checklist)

Suponha que você precisa adicionar "lembrete de pagamento agendado" para cobranças.

1. **Domain & enum:** se há novo status, adicione em `common/enums/index.ts` e na FSM.
2. **Entity / migration:** novas colunas viram `@Column` na entity + migration `<timestamp>-<NomeDescritivo>.ts`.
3. **DTO:** crie `dto/schedule-reminder.dto.ts` com decorators `class-validator` e `@Api*`.
4. **Service:** método novo em `<modulo>.service.ts` com a regra. Lance exceptions tipadas.
5. **Controller:** novo handler com `@Patch(':id/schedule-reminder')`, `@ApiOperation`, `@ApiOkResponse`, `@Roles`.
6. **Repository:** se houver query reutilizável, adicione no `*.repository.ts`.
7. **Queue (se assíncrono):** novo nome em `queue-names.ts`, novo `@Process('reminder-scheduled')` em `whatsapp.processor.ts`, novo template em `queues/messages/`.
8. **Module:** registre tudo no `*.module.ts`.
9. **Tests:** crie/atualize `*.service.spec.ts`.
10. **Validate:** rode `npx tsc --noEmit && npm run lint && npm test`.
11. **Smoke test:** `docker compose build api && docker compose up -d api && docker logs condosync-api --tail=80`.

## 17. Anti-padrões — recusar em code review

- ❌ `console.log(...)` em código de produção. Use `Logger` ou Pino.
- ❌ `throw new Error('...')` cru fora de try/catch. Use `*Exception` do Nest.
- ❌ `process.env.X` fora de `config/env.schema.ts`.
- ❌ Acesso a `Repository<Entity>` direto do controller.
- ❌ `synchronize: true` mantido em prod.
- ❌ Endpoint que recebe `condominiumId` no body sem validar membership.
- ❌ Adicionar `axios` quando `fetch` resolve.
- ❌ Misturar regra de negócio com lógica HTTP no controller.
- ❌ Migration sem `IF NOT EXISTS` ou sem método `down`.
- ❌ Job sem `jobId` determinístico (causa duplicação em retries).
- ❌ Mensagens em inglês visíveis ao usuário (resposta HTTP, toast, e-mail).
- ❌ Importar entity dentro de DTO ou DTO dentro de entity.
- ❌ Nome de arquivo em `camelCase` ou `PascalCase` — sempre `kebab-case`.
- ❌ "Quick fix" sem migration quando schema mudou.

> Se em dúvida sobre um padrão, abra o módulo `charges/` — ele é a referência canônica e está sempre atualizado.

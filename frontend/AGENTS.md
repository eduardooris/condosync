# Frontend (React + Vite + PWA) — Guia para Agentes de IA

> **Fonte de verdade do código real do frontend CondoSync.** Substitui o `03_frontend_guia_tecnico.md` em caso de divergência.
>
> Antes de tocar qualquer linha, leia também: [`../AGENTS.md`](../AGENTS.md).

## Índice

1. [Stack real](#1-stack-real)
2. [Arquitetura — MVVM + DDD](#2-arquitetura--mvvm--ddd)
3. [Estrutura de pastas](#3-estrutura-de-pastas)
4. [Anatomia de um domínio](#4-anatomia-de-um-domínio)
5. [Convenções de nomenclatura](#5-convenções-de-nomenclatura)
6. [HTTP + autenticação](#6-http--autenticação)
7. [Estado global (Zustand) e server state (React Query)](#7-estado-global-zustand-e-server-state-react-query)
8. [Formulários (RHF + Zod)](#8-formulários-rhf--zod)
9. [Roteamento e proteção de rotas](#9-roteamento-e-proteção-de-rotas)
10. [Design system e componentes UI](#10-design-system-e-componentes-ui)
11. [Animações (Framer Motion)](#11-animações-framer-motion)
12. [PWA, build e Docker](#12-pwa-build-e-docker)
13. [Tipos compartilhados (OpenAPI + types/api.ts)](#13-tipos-compartilhados-openapi--typesapits)
14. [Como adicionar uma feature nova (checklist)](#14-como-adicionar-uma-feature-nova-checklist)
15. [Anti-padrões — recusar em code review](#15-anti-padrões--recusar-em-code-review)

---

## 1. Stack real

| Camada | Tecnologia | Versão | Observação |
| --- | --- | --- | --- |
| UI | React | ^19 | Functional components + hooks |
| Build | Vite | ^7 | Plugin PWA habilitado |
| Linguagem | TypeScript | ^5 | `strict: true` |
| Estilo | Tailwind CSS | ^3 | + `tailwind-merge`, `tailwindcss-animate`, `class-variance-authority` |
| Animação | `framer-motion` | ^12 | Page transitions, modais, stagger |
| HTTP | `axios` | ^1 | Instância única em `shared/lib/axios.ts` |
| Server state | `@tanstack/react-query` | ^5 | Query keys padronizadas |
| Estado global | `zustand` | ^5 | Auth + UI |
| Form | `react-hook-form` + `@hookform/resolvers` + `zod` | latest | Sempre com schema |
| Roteamento | `react-router-dom` | ^6 | `createBrowserRouter` + lazy |
| UI primitives | `@radix-ui/*` | latest | Dialog, DropdownMenu, Select, Tabs, Tooltip |
| Ícones | `lucide-react` | latest | Único pacote de ícones |
| Notificações | `react-hot-toast` | ^2 | Provider em `app/providers.tsx` |
| Gráficos | `recharts` | ^3 | Único de charting |
| E2E | Playwright | latest | Em `tests/` (config em `playwright.config.ts`) |

> **Regra:** não traga MUI, Ant Design, Chakra, styled-components, Redux ou Apollo. Se sentir vontade, abra issue.

## 2. Arquitetura — MVVM + DDD

- **Model** = `services/*.service.ts` — chama a API via `axios`. Sem React.
- **ViewModel** = `hooks/use<X>.ts` — combina React Query + Zustand + lógica derivada. Retorna estado e handlers.
- **View** = `pages/*.tsx` ou `components/*.tsx` — só renderiza. Sem `useQuery`/`useMutation` direto (vai pelo hook).
- **Domain** = pasta `domains/<bounded-context>/` agrupa Model + ViewModel + View + Schemas + Types daquele domínio.

Acoplamento permitido:
- `domains/*` pode importar de `shared/*`.
- `domains/A` **NÃO** importa de `domains/B`. Se precisar compartilhar, promova ao `shared/`.
- `shared/*` é genérico — não conhece nenhum domínio específico.
- `app/` (router, providers) importa de `domains/*` e `shared/*` livremente.

## 3. Estrutura de pastas

```
frontend/src/
├── main.tsx                    # ReactDOM.render — só monta App
├── App.tsx                     # Wrap providers + RouterProvider
├── index.css                   # Tailwind layers (@tailwind base/components/utilities) + tokens CSS
│
├── app/
│   ├── providers.tsx           # QueryClientProvider + Toaster
│   ├── router.tsx              # createBrowserRouter + lazy + ProtectedRoute
│   └── ProtectedRoute.tsx      # Verifica auth + role mínima
│
├── domains/
│   ├── auth/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── components/
│   │   └── schemas/
│   ├── charges/
│   │   ├── components/         # EditChargeDialog, GenerateChargesDialog
│   │   ├── hooks/              # useCharges
│   │   ├── pages/              # ChargesPage
│   │   └── services/           # charges.service.ts
│   ├── condominiums/
│   ├── dashboard/
│   ├── expenses/
│   ├── bulletin/
│   ├── documents/
│   ├── occurrences/
│   ├── polls/
│   ├── residents/
│   ├── units/
│   ├── invitations/
│   └── setup/
│
├── shared/
│   ├── components/
│   │   ├── ui/                 # Primitives: Button, Input, GlassCard, Dialog, Spinner, ...
│   │   └── layout/             # Sidebar, Header, ProtectedLayout, CommandPalette
│   ├── hooks/                  # Hooks utilitários globais (useCommandPaletteShortcut, ...)
│   ├── lib/
│   │   ├── axios.ts            # Instância única + interceptor de refresh
│   │   └── queryClient.ts      # QueryClient config (retry/staleTime)
│   ├── stores/
│   │   ├── auth.store.ts       # Zustand + persist
│   │   └── ui.store.ts         # Sidebar/theme
│   ├── types/                  # api.ts (manual) + openapi.generated.ts (gerado)
│   └── utils/
│
├── assets/
└── vite-env.d.ts
```

## 4. Anatomia de um domínio

Use `domains/charges/` como referência canônica:

```
domains/charges/
├── services/
│   └── charges.service.ts      # Pure HTTP — exporta objeto `chargesService`
├── hooks/
│   └── useCharges.ts           # ViewModel: useQuery + useMutation + invalidate
├── components/
│   ├── EditChargeDialog.tsx    # Dialog para editar valor/vencimento
│   └── GenerateChargesDialog.tsx
└── pages/
    └── ChargesPage.tsx         # View principal — usa useCharges()
```

### Service (Model)
```ts
// domains/charges/services/charges.service.ts
import { api } from '@/shared/lib/axios';
import type { Charge } from '@/shared/types/api';

export interface CreateChargeInput {
  unitId: string;
  billingMonth: string; // YYYY-MM
  amount?: string;      // string com 2 casas (decimal no banco)
  dueDate?: string;     // YYYY-MM-DD
}

export const chargesService = {
  list: (condId: string) =>
    api.get<Charge[], Charge[]>(`/condominiums/${condId}/charges`),

  createOne: (condId: string, payload: CreateChargeInput) =>
    api.post<Charge, Charge>(`/condominiums/${condId}/charges`, payload),

  markPaid: (id: string) =>
    api.patch<{ paidAt: string }, Charge>(`/charges/${id}/mark-paid`, {
      paidAt: new Date().toISOString(),
    }),

  cancel: (id: string, reason?: string) =>
    api.patch<{ reason?: string }, Charge>(`/charges/${id}/cancel`, { reason }),
};
```
- Service **exporta um objeto** (`chargesService`), não uma classe.
- Tipagem dupla no axios: `api.get<TBody, TReturn>` — o segundo parâmetro é o que **realmente** volta porque o interceptor de response devolve `response.data`.
- Sem `try/catch` aqui — deixe o erro propagar para o hook.

### ViewModel (hook)
```ts
// domains/charges/hooks/useCharges.ts
export function useCharges(condId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['charges', condId] });

  const query = useQuery({
    queryKey: ['charges', condId],
    queryFn: () => chargesService.list(condId!),
    enabled: Boolean(condId),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      chargesService.cancel(id, reason),
    onSuccess: invalidate,
  });

  return { ...query, cancelMutation };
}
```
- Query key: `['<dominio>', ...filtros]` — começa com o nome do domínio. Use o mesmo array para invalidar.
- `enabled: Boolean(condId)` quando o dado depende de algo que pode estar ausente.
- Mutations expostas como `<verbo>Mutation` (ex.: `payMutation`, `cancelMutation`). Não retorne `mutate` solto.

### View (page/component)
```ts
export function ChargesPage() {
  const condId = useAuthStore((s) => s.activeCondominium?.id);
  const { data: charges = [], isLoading, cancelMutation } = useCharges(condId);

  if (isLoading) return <Spinner size="lg" />;
  // ... só renderiza ...
}
```
- **Sem chamadas a `useQuery`/`useMutation` direto na view.** Sempre via hook.
- Use componentes de `shared/components/ui/` (`Button`, `Dialog`, `GlassCard`, `Spinner`, `EmptyState`, `PageHeader`).
- Erros de mutation: exibir com `toast.error(...)` (já configurado em `providers.tsx`).

## 5. Convenções de nomenclatura

| Item | Convenção | Exemplo |
| --- | --- | --- |
| Pasta de domínio | `kebab-case` | `domains/charges/` |
| Componente | `PascalCase.tsx` | `EditChargeDialog.tsx`, `ChargesPage.tsx` |
| Hook | `use<X>.ts` | `useCharges.ts` |
| Service | `<dominio>.service.ts` | `charges.service.ts` |
| Schema Zod | `<dominio>.schema.ts` | `createCharge.schema.ts` |
| Store Zustand | `<nome>.store.ts` | `auth.store.ts` |
| Tipo / interface | `PascalCase` | `Charge`, `CreateChargeInput` |
| Função utilitária | `camelCase` | `formatBRL` |
| Query key | `array começando com nome do domínio` | `['charges', condId]` |
| Importação | sempre alias `@/...` | `import { api } from '@/shared/lib/axios'` |

> Path alias `@/*` aponta para `src/*` (configurado em `tsconfig.app.json` e `vite.config.ts`). **Nunca** use `../../../` em imports.

## 6. HTTP + autenticação

`shared/lib/axios.ts` define a instância **única**:
- `baseURL = "<ORIGIN>/api/v1"` — services chamam paths relativos (`/condominiums/...`).
- Interceptor de **request** injeta `Authorization: Bearer <token>` do `useAuthStore`.
- Interceptor de **response**:
  - Sucesso → retorna `response.data` (o tipo de retorno fica direto no service via generic).
  - 401 → tenta `POST /auth/refresh` automaticamente (com fila para evitar refresh paralelo). Se falhar, faz `logout()`.
  - Outros erros → propaga `error` (o hook trata).

**Não crie outras instâncias do axios.** Toda chamada passa pela `api`.

Para tratar erro no hook:
```ts
try {
  await cancelMutation.mutateAsync({ id, reason });
  toast.success('Cobrança cancelada.');
} catch (err) {
  const message = err instanceof AxiosError && err.response?.data?.message;
  toast.error(typeof message === 'string' ? message : 'Falha ao cancelar.');
}
```
O backend devolve `{ statusCode, error, message, ... }` — extraia `message` (que pode ser `string` ou `string[]`).

## 7. Estado global (Zustand) e server state (React Query)

### Quando usar cada um
- **Zustand** = estado **client** (UI, auth, sidebar, tema, condomínio ativo). Persiste localmente.
- **React Query** = estado **server** (qualquer coisa que vem da API). Cache, invalidate, refetch.
- **Nunca duplique**: não copie a lista de cobranças do React Query para um Zustand "para facilitar". Sempre leia do cache.

### `useAuthStore` (referência)
- `user`, `token`, `refreshToken`, `role`, `activeCondominium`, `pendingMemberships`.
- `setAuth(payload)` chamado no login.
- `setActiveCondominium(condo)` chamado quando o usuário escolhe condomínio.
- `logout()` limpa tudo (e `localStorage` via `persist`).
- Persistido em `localStorage` com chave `condosync-auth`.

### `useUIStore`
- `sidebarOpen`, `theme` (`dark`/`light`).
- Sem persistência por padrão.

### React Query — config (`shared/lib/queryClient.ts`)
- `retry: 1`, `staleTime: 60_000`, `refetchOnWindowFocus: false`.
- Não mude isso casualmente — afeta o app inteiro.

## 8. Formulários (RHF + Zod)

```ts
// domains/charges/schemas/createCharge.schema.ts
export const createChargeSchema = z.object({
  unitId: z.string().uuid(),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.string().regex(/^\d+\.\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CreateChargeForm = z.infer<typeof createChargeSchema>;

// no componente:
const form = useForm<CreateChargeForm>({
  resolver: zodResolver(createChargeSchema),
  defaultValues: { ... },
});
```
- Use `<FormField>`, `<Input>`, `<Label>`, `<FieldError>`, `<Textarea>`, `<Select>`, `<NativeSelect>` de `shared/components/ui/`. Não estilize input cru.
- Mensagens de erro do Zod **em PT-BR** (use `.regex(..., 'mensagem')` ou customize via `.refine`).
- `onSubmit = form.handleSubmit(async (data) => mutation.mutateAsync(data))`.

## 9. Roteamento e proteção de rotas

`app/router.tsx` cria o router com:
- **Lazy loading** de toda página: `lazy(() => import('@/domains/x/pages/XPage').then(m => ({ default: m.XPage })))`.
- Wrapper `withSuspense(<Page />)` que injeta `Suspense fallback={<Spinner size="lg" />}`.
- Rotas públicas: `/login`, `/register`, `/forgot-password`, `/invite/:token`.
- Rotas protegidas dentro de `<ProtectedRoute minRole="RESIDENT" />` que usa `<ProtectedLayout />` (sidebar + header).
- Sub-rota com role mínimo maior aninha outro `<ProtectedRoute minRole="ADMIN" />`.

Adicionar rota nova:
1. Crie a página em `domains/<x>/pages/`.
2. Importe lazy no `router.tsx`.
3. Inclua na árvore com `withSuspense(...)` e role correto.
4. Atualize a `Sidebar.tsx` (em `shared/components/layout/`) com o link.

## 10. Design system e componentes UI

### Tema (Tailwind)
Definido em `tailwind.config.ts` + tokens CSS em `index.css` (camadas `@layer base`). Cores principais:
- `brand.{50..900}` — escala de azul.
- `glass.{DEFAULT,border,hover}` — superfície glassmorphism (`bg-white/5`, `border-white/10`, `backdrop-blur-md`).
- `status.{pending,paid,overdue,exempt,canceled}` — usadas em badges.
- Background base do app: `bg-brand-900` (quase preto azul).

### Primitives obrigatórios (`shared/components/ui/`)
- `Button` — variantes via `class-variance-authority` (`primary`, `ghost`, `outline`, `danger`).
- `GlassCard` — wrapper com bordas sutis + blur. **Use** sempre que renderizar um cartão.
- `Dialog` — wrapper sobre `@radix-ui/react-dialog`.
- `PageHeader` — título da página + ações no topo.
- `EmptyState` — quando lista vazia.
- `KpiCard` — métricas no dashboard.
- `Spinner`, `Badge`, `Input`, `Textarea`, `Select`, `NativeSelect`, `FormField`, `FieldError`, `Label`.

**Não recrie** estes componentes. Se faltar variante, edite o componente existente.

## 11. Animações (Framer Motion)

Filosofia: animações reforçam fluxo, não distraem.

- **Page transitions** ficam no `<ProtectedLayout />` ou via `<AnimatePresence>` em torno do `<Outlet />`.
- **Cards em lista** usam `stagger` (variants compartilhadas — se faltar, crie em `shared/lib/motion-variants.ts`).
- **Modais** entram com `spring scale` + `fade overlay`.
- **Status badges** usam `layout` para animar mudança.

```ts
const cardItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } },
};
```

Não exagere: nada de "animação por animação". Duração padrão 0.2-0.3s.

## 12. PWA, build e Docker

```bash
cd frontend/
npm install
npm run dev               # Vite dev server na porta 5173
npm run build             # tsc -b && vite build → dist/
npm run lint              # eslint
npm run preview           # serve o build localmente
npm run test:e2e          # Playwright
```

PWA: configurado via `vite-plugin-pwa` (verifique `vite.config.ts`). Manifest, ícones e service worker são gerados no build.

Docker (multi-stage com nginx):
```bash
# da raiz do monorepo
docker compose build frontend
docker compose up -d frontend
```
O `nginx.conf` faz reverse proxy de `/api/v1/*` para o `condosync-api`.

## 13. Tipos compartilhados (OpenAPI + types/api.ts)

- `shared/types/openapi.generated.ts` é **gerado automaticamente** rodando:
  ```bash
  npm run openapi:sync   # baixa de http://localhost:3000/api/openapi.json e gera tipos
  ```
- `shared/types/api.ts` declara os tipos canônicos usados pelo app (geralmente reexportando os do OpenAPI ou wrappers convenientes).
- Quando o backend mudar o contrato:
  1. Suba o backend localmente.
  2. Rode `npm run openapi:sync`.
  3. Verifique diffs em `openapi.json` e `openapi.generated.ts`.
  4. Atualize `api.ts` se houver tipo canônico afetado.

> Nunca redeclare tipos manualmente que já existam no OpenAPI. Confie no schema do backend.

## 14. Como adicionar uma feature nova (checklist)

Suponha "permitir cancelar cobrança no front":

1. **Tipo:** confirme que `Charge` em `shared/types/api.ts` tem o status `CANCELED` e os campos `canceledAt`/`cancelReason` (rode `npm run openapi:sync` se faltar).
2. **Service:** adicione `cancel(id, reason?)` em `domains/charges/services/charges.service.ts`.
3. **Hook:** adicione `cancelMutation` em `useCharges` com `onSuccess: invalidate`.
4. **UI:**
   - Adicione `<Dialog>` `CancelChargeDialog.tsx` em `domains/charges/components/`.
   - Adicione botão "Cancelar" na `ChargesPage` (visível só para `ADMIN`/`SUB_ADMIN`).
   - Use `<Badge variant="canceled">` para o novo status.
5. **Schema (se houver form):** `cancelCharge.schema.ts` com `z.object({ reason: z.string().max(500).optional() })`.
6. **Toast:** sucesso → `toast.success('Cobrança cancelada.')`, erro → extrair `message` do AxiosError.
7. **Validate:** `npm run lint && npm run build`.
8. **E2E (opcional):** adicione spec em `tests/`.

## 15. Anti-padrões — recusar em code review

- ❌ Chamar `axios.create({ ... })` em outro lugar — só existe `shared/lib/axios.ts`.
- ❌ `useQuery`/`useMutation` direto na page (deve estar no hook).
- ❌ `useEffect` para buscar dados — use React Query.
- ❌ Imports relativos longos (`../../../`). Use `@/...`.
- ❌ Importar de outro `domains/X` quando você está em `domains/Y`. Promova para `shared/`.
- ❌ Estilizar com inline styles — só `className` Tailwind. Exceção: tokens de cor de toast em `providers.tsx`.
- ❌ Adicionar libs (Lodash, Moment, Date-fns parcial). Use stdlib do JS / `Intl.NumberFormat` / `Intl.DateTimeFormat`.
- ❌ Texto de UI em inglês. Tudo em PT-BR. Comentários e nomes de variáveis em inglês.
- ❌ Componente sem tipagem de props (`function Card(props)`). Sempre interface tipada.
- ❌ Estado de servidor duplicado em Zustand.
- ❌ Pular `enabled:` em `useQuery` quando depende de variável opcional → causa fetch com `undefined`.
- ❌ Editar `openapi.generated.ts` manualmente.
- ❌ Alterar query key sem atualizar todos os `invalidateQueries` correspondentes.
- ❌ Adicionar uma página sem entrada na sidebar.

> Se em dúvida sobre estrutura, abra `domains/charges/` — é a referência canônica e está sempre atualizado.

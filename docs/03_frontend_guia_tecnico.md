**CondoSync**

Guia Técnico — Frontend

Documento 3 de 3  ·  v1.0

Eduardo Oris  ·  React + Vite + PWA

# 1. Stack & Decisões Técnicas

| Tecnologia | Versão | Responsabilidade |
| --- | --- | --- |
| React | ^18.x | UI layer — componentes e renderização |
| Vite | ^5.x | Build tool + dev server + PWA plugin |
| TypeScript | ^5.x | Tipagem estática em todo o projeto |
| Tailwind CSS | ^3.x | Utility-first styling + design tokens |
| Motion (Framer) | ^11.x | Animações declarativas e transições |
| Zustand | ^4.x | Estado global leve (auth, sidebar, tema) |
| React Query (TanStack) | ^5.x | Server state, cache, loading, error |
| React Hook Form | ^7.x | Controle de formulários performático |
| Zod | ^3.x | Validação de schemas + inferência de tipos |
| React Router DOM | ^6.x | Roteamento SPA com lazy loading |
| vite-plugin-pwa | Latest | Service Worker, offline, manifest |
| Axios | ^1.x | HTTP client com interceptors |

# 2. Arquitetura MVVM + DDD

A arquitetura segue MVVM com separação clara de camadas. A View renderiza, o ViewModel (hook customizado) gerencia estado e lógica local, e o Model (service/adapter) cuida da comunicação com a API. DDD organiza os módulos por domínio de negócio.

## 2.1 Estrutura de Pastas

```
src/
  domains/                    # Módulos por domínio de negócio
    condominiums/
      components/             # Componentes de UI deste domínio
        CondominiumCard.tsx
        CondominiumForm.tsx
      hooks/                  # ViewModels (useCondominiums, useCondominiumForm)
        useCondominiums.ts
        useCondominiumForm.ts
      services/               # Chamadas de API (adapter de HTTP)
        condominiums.service.ts
      schemas/                # Zod schemas para validação
        condominium.schema.ts
      types/                  # Interfaces e tipos do domínio
        condominium.types.ts
      pages/                  # Páginas roteadas deste domínio
        CondominiumsPage.tsx
        CondominiumDetailPage.tsx
    charges/
    residents/
    polls/
    occurrences/
    dashboard/
    documents/
    bulletin/
  shared/                     # Compartilhado entre domínios
    components/               # UI components genéricos
      ui/                     # Primitives (Button, Input, Modal, Badge...)
      layout/                 # Sidebar, Header, PageContainer
    hooks/                    # Hooks utilitários globais
    stores/                   # Zustand stores globais
      auth.store.ts
      ui.store.ts             # sidebar open, theme
    lib/
      axios.ts                # Instância configurada com interceptors
      queryClient.ts          # TanStack Query config
    utils/
    types/
  app/
    App.tsx
    router.tsx                # Rotas com lazy + ProtectedRoute
    providers.tsx             # QueryClient, Router, Toaster
  assets/
  main.tsx
```

## 2.2 Fluxo MVVM por Componente

```
// MODEL — service adapter (não sabe nada de React)
// domains/charges/services/charges.service.ts
export const chargesService = {
  getByCondominium: (condId: string, params?: ChargeFilters) =>
    api.get<Charge[]>(`/condominiums/${condId}/charges`, { params }),
  markPaid: (id: string) => api.patch(`/charges/${id}/mark-paid`),
  exempt: (id: string, reason: string) => api.patch(`/charges/${id}/exempt`, { reason }),
};

// VIEWMODEL — hook (lógica, estado derivado, handlers)
// domains/charges/hooks/useCharges.ts
export function useCharges(condId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['charges', condId],
    queryFn: () => chargesService.getByCondominium(condId),
  });

  const overdueCount = data?.filter(c => c.status === 'overdue').length ?? 0;

  return { charges: data ?? [], isLoading, error, overdueCount };
}

// VIEW — componente (só renderiza, sem lógica de negócio)
// domains/charges/pages/ChargesPage.tsx
export function ChargesPage() {
  const { condId } = useParams();
  const { charges, isLoading, overdueCount } = useCharges(condId!);
  // só renderiza o que o hook retorna
}
```

## 2.3 Adapter de HTTP (Axios)

```
// shared/lib/axios.ts
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Injeta token automaticamente em todos os requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Trata erros globais (401 = logout, 403 = forbidden toast)
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(error);
  }
);
```

# 3. Design System — Identidade Visual

```
Diretrizes Visuais
Inspiração: Spotify — sidebar escura, conteúdo principal com glassmorphism
Paleta principal: tons de azul profissional (não ciano, não roxo)
Glassmorphism nos cards: backdrop-filter blur + border rgba
Animações com Motion: stagger nos cards, slide nas páginas, spring nos modais
Dark mode padrão com opção de light mode via Zustand + CSS variables
```

## 3.1 Tokens de Cor (Tailwind Config)

```
// tailwind.config.ts
colors: {
  brand: {
    50:  '#e8f0fc',
    100: '#c5d8f8',
    200: '#8db5f2',
    300: '#5591eb',
    400: '#2d6abf',   // primary
    500: '#1a4d9e',
    600: '#1a3a6a',   // dark
    700: '#142d54',
    800: '#0d1f3c',
    900: '#07102a',   // background base
  },
  glass: {
    DEFAULT: 'rgba(255,255,255,0.05)',
    border:  'rgba(255,255,255,0.1)',
    hover:   'rgba(255,255,255,0.08)',
  },
  status: {
    pending: '#f0b840',
    paid:    '#2ec886',
    overdue: '#f05050',
    exempt:  '#7a7a8a',
  }
}
```

## 3.2 Componente Glass Card

```
// shared/components/ui/GlassCard.tsx
export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-white/10',
        'bg-white/5 backdrop-blur-md',
        'shadow-lg shadow-brand-900/50',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
```

# 4. Roteamento & Páginas

| Rota | Página | Role Mínimo |
| --- | --- | --- |
| /login | LoginPage | Público |
| / | DashboardPage | RESIDENT |
| /charges | ChargesPage | RESIDENT |
| /expenses | ExpensesPage | RESIDENT |
| /bulletin | BulletinPage | RESIDENT |
| /documents | DocumentsPage | RESIDENT |
| /occurrences | OccurrencesPage | RESIDENT |
| /polls | PollsPage | RESIDENT |
| /condominiums | CondominiumsPage | ADMIN |
| /condominiums/:id | CondominiumDetailPage | ADMIN |
| /units | UnitsPage | ADMIN |
| /residents | ResidentsPage | ADMIN |
| /settings | SettingsPage | ADMIN |

## 4.1 Lazy Loading + Protected Routes

```
// app/router.tsx
const DashboardPage = lazy(() => import('../domains/dashboard/pages/DashboardPage'));
const ChargesPage   = lazy(() => import('../domains/charges/pages/ChargesPage'));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute minRole='RESIDENT' />,
    children: [
      { index: true, element: <Suspense fallback={<Spinner />}><DashboardPage /></Suspense> },
      { path: 'charges', element: <Suspense fallback={<Spinner />}><ChargesPage /></Suspense> },
    ]
  },
]);
```

# 5. Estado Global — Zustand

## 5.1 Auth Store

```
// shared/stores/auth.store.ts
interface AuthStore {
  user: User | null;
  token: string | null;
  activeCondominium: Condominium | null;
  role: UserRole | null;
  setAuth: (user: User, token: string) => void;
  setActiveCondominium: (condo: Condominium, role: UserRole) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(persist(
  (set) => ({
    user: null, token: null, activeCondominium: null, role: null,
    setAuth: (user, token) => set({ user, token }),
    setActiveCondominium: (condo, role) => set({ activeCondominium: condo, role }),
    logout: () => set({ user: null, token: null, activeCondominium: null, role: null }),
  }),
  { name: 'condosync-auth' }
));
```

## 5.2 UI Store

```
// shared/stores/ui.store.ts
export const useUIStore = create<UIStore>()((set) => ({
  sidebarOpen: true,
  theme: 'dark',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
```

# 6. Formulários — React Hook Form + Zod

```
// domains/residents/schemas/resident.schema.ts
export const createResidentSchema = z.object({
  name:                  z.string().min(2),
  cpf:                   z.string().regex(/^\d{11}$/),
  whatsapp:              z.string().regex(/^55\d{10,11}$/),
  email:                 z.string().email().optional(),
  is_financial_responsible: z.boolean().default(false),
});
export type CreateResidentInput = z.infer<typeof createResidentSchema>;

// domains/residents/hooks/useResidentForm.ts
export function useResidentForm(unitId: string) {
  const form = useForm<CreateResidentInput>({
    resolver: zodResolver(createResidentSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateResidentInput) => residentsService.create(unitId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['residents', unitId] }); },
  });

  return { form, onSubmit: form.handleSubmit(mutation.mutate), isPending: mutation.isPending };
}
```

# 7. Animações com Motion

```
Filosofia de Animação
Animações devem reforçar o fluxo, não distrair
Page transitions: slide horizontal entre rotas
Cards: stagger de entrada (delay incremental por índice)
Modais: spring scale + fade do overlay
Status badges: layout animation para mudanças de estado
Sidebar: spring com drag gesture no mobile
```

## 7.1 Variantes Compartilhadas

```
// shared/lib/motion-variants.ts
export const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -20 },
};

export const cardStagger = {
  animate: { transition: { staggerChildren: 0.06 } }
};

export const cardItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } }
};

export const modalVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit:    { opacity: 0, scale: 0.95 },
};
```

# 8. PWA — Progressive Web App

```
Por que PWA?
Público-alvo usa dispositivos variados — iPhone, Android, desktop
Instalável na home screen sem passar pela App Store
Funcionalidade offline para mural e extrato já carregados
Notificações push para cobranças e comunicados urgentes (futuro)
```

## 8.1 Configuração vite-plugin-pwa

```
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'CondoSync',
    short_name: 'CondoSync',
    theme_color: '#07102a',
    background_color: '#07102a',
    display: 'standalone',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [{
      urlPattern: /^https:\/\/.*\/api\/.*/,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-cache', expiration: { maxAgeSeconds: 300 } }
    }]
  }
})
```

# 9. Layout Principal — Inspiração Spotify

A interface segue o padrão de CRM moderno com sidebar fixa escura, área de conteúdo principal com fundo levemente mais claro e cards com glassmorphism.

```
// Layout geral
<div class='flex h-screen bg-brand-900 overflow-hidden'>
  <Sidebar />               {/* Fixo, 240px, dark */}
  <main class='flex-1 flex flex-col overflow-hidden'>
    <Header />              {/* Top bar com nome do condo + avatar */}
    <div class='flex-1 overflow-y-auto p-6'>
      <AnimatePresence mode='wait'>
        <Outlet />          {/* Conteúdo da rota atual com page transition */}
      </AnimatePresence>
    </div>
  </main>
</div>
```

## 9.1 Sidebar — Estrutura de Navegação

| Seção | Itens |
| --- | --- |
| Principal | Dashboard, Financeiro (Cobranças + Despesas) |
| Comunicação | Mural de Recados, Ocorrências, Enquetes |
| Gestão (Admin) | Condomínios, Unidades, Moradores, Documentos |
| Conta | Configurações, Trocar Condomínio, Sair |

# 10. Componentes por Domínio — Guia

## Dashboard

- KPI Cards: saldo atual, total de unidades, inadimplentes (%), recados ativos

- Gráfico de barras: Recharts ou Chart.js — receitas × despesas por mês

- Feed de últimas atividades: cobranças pagas, despesas lançadas, ocorrências abertas

## Cobranças (Charges)

- Tabela com filtros: status, mês/ano, bloco

- Linha da cobrança: unidade, responsável, valor, vencimento, status badge

- Actions inline: Marcar Pago, Isentar (abre modal com campo de justificativa)

- Botão Gerar Cobranças do Mês (somente ADMIN)

## Enquetes (Polls)

- Card de enquete com opções, barra de progresso de participação

- Voto via radio button — confirmar com modal de aviso (ação irrevogável)

- Resultado bloqueado com cadeado visual até encerramento

- Após encerrar: gráfico de pizza com resultado final

## Ocorrências

- Lista com filtro por status — kanban visual ou tabela (configurável)

- Card de ocorrência com avatar, título, data, status badge animado

- Modal de detalhe com timeline de mudanças de status

- Formulário de abertura com drag-and-drop para anexos

# 11. Roadmap de Implementação

| Sprint | Entregáveis Frontend |
| --- | --- |
| Sprint 1 | Setup Vite + PWA + Tailwind + Motion + stores Zustand + roteamento |
| Sprint 2 | Layout (Sidebar + Header) + Design System (Button, Input, Modal, Badge) |
| Sprint 3 | Auth flow (login, token, ProtectedRoute) + seleção de condomínio |
| Sprint 4 | Dashboard + módulos Cobranças e Despesas (consumindo API real) |
| Sprint 5 | Mural, Documentos, Ocorrências |
| Sprint 6 | Enquetes + animações finais + PWA manifest + testes E2E (Playwright) |
| V2 | Modo offline aprimorado, notificações push, tema light, app React Native |

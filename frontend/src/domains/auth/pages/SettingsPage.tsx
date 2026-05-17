import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  Bell,
  Building2,
  ChevronRight,
  ClipboardList,
  Download,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  Palette,
  Shield,
  ShieldAlert,
  Sun,
  User as UserIcon,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { EditProfileDialog } from '@/domains/auth/components/EditProfileDialog';
import { authService } from '@/domains/auth/services/auth.service';
import { residentsService } from '@/domains/residents/services/residents.service';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useUIStore, type UITheme } from '@/shared/stores/ui.store';
import { queryKeys } from '@/shared/lib/queryKeys';
import { canAccessCondominiumAdminRoutes } from '@/shared/utils/roles';
import { cn } from '@/shared/utils/cn';
const CONDO_CONFIG_SECTIONS: {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  highlight?: boolean;
}[] = [
  { id: 'general', label: 'Geral', description: 'Identidade, CNPJ e endereço.', icon: Building2 },
  { id: 'financial', label: 'Financeiro', description: 'Taxa, geração e vencimento.', icon: Wallet },
  { id: 'communication', label: 'Comunicação', description: 'WhatsApp e notificações.', icon: MessageCircle },
  { id: 'polls', label: 'Enquetes', description: 'Anonimato e quórum.', icon: BarChart2 },
  { id: 'occurrences', label: 'Ocorrências', description: 'Regras de abertura e SLA.', icon: ClipboardList },
  {
    id: 'team',
    label: 'Equipe e convites',
    description: 'Convide subsíndicos e gere o link de cadastro de moradores.',
    icon: UserPlus,
    highlight: true,
  },
  { id: 'advanced', label: 'Avançado', description: 'Ações sensíveis e dados do condomínio.', icon: ShieldAlert },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  SUB_ADMIN: 'Síndico',
  RESPONSIBLE: 'Responsável financeiro',
  RESIDENT: 'Morador',
};

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const condominium = useAuthStore((s) => s.activeCondominium);
  const logout = useAuthStore((s) => s.logout);
  const openPwaInstallHelp = useUIStore((s) => s.openPwaInstallHelp);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const shouldUseUnitProfile =
    (role === 'RESIDENT' || role === 'RESPONSIBLE') && Boolean(condominium?.id);
  const canManageCondo = canAccessCondominiumAdminRoutes(role);

  const { data: profile } = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: authService.me,
    staleTime: 30_000,
  });
  const { data: residentProfile } = useQuery({
    queryKey: queryKeys.residents.myProfile(condominium?.id),
    queryFn: () => residentsService.myProfile(condominium!.id),
    enabled: shouldUseUnitProfile,
    staleTime: 30_000,
    retry: false,
  });

  const shownName = shouldUseUnitProfile
    ? residentProfile?.fullName ?? 'Morador'
    : user?.name;
    
  const shownWhatsapp = shouldUseUnitProfile
    ? residentProfile?.phoneWhatsapp ?? null
    : profile?.phoneWhatsapp ?? null;
  const whatsappOrigin = residentProfile?.phoneWhatsapp
    ? 'cadastro de morador da unidade'
    : 'conta';
  const name = shownName;
  const initials = useMemo(() => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  return (
    <div className="ds-page mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerencie sua conta, preferências e o condomínio ativo."
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 ds-md:grid-cols-3">
        {/* Profile */}
        <GlassCard variant="elevated" className="ds-md:col-span-2">
          <header className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-ds-2xl bg-gradient-to-br from-brand-300 to-brand-600 text-ds-md font-bold text-ds-on-primary shadow-md shadow-brand-500/30">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ds-lg font-semibold text-ds-body">
                {shownName ?? 'Visitante'}
              </p>
              <p className="truncate text-ds-sm text-ds-dim">{user?.email ?? '—'}</p>
              {shownWhatsapp ? (
                <p className="mt-1 flex items-center gap-1.5 truncate text-ds-xs text-ds-subtle">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span className="truncate">
                    WhatsApp ({whatsappOrigin}): {shownWhatsapp}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-ds-xs text-ds-warning">
                  Sem WhatsApp na conta — cadastre abaixo para receber o link ao usar Esqueci minha senha no login.
                </p>
              )}
              {role ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-ds-pill border border-brand-400/30 bg-brand-400/10 px-2 py-0.5 text-ds-xs font-semibold text-brand-800 dark:text-brand-300">
                  <Shield className="h-3 w-3" aria-hidden />
                  {ROLE_LABEL[role] ?? role}
                </span>
              ) : null}
            </div>
          </header>

          <div className="mt-5 grid gap-2 ds-sm:grid-cols-2">
            <Button variant="secondary" type="button" onClick={() => setEditProfileOpen(true)}>
              <UserIcon className="h-4 w-4" aria-hidden />
              Editar perfil
            </Button>
            <Link to="/forgot-password">
              <Button variant="outline" fullWidth>
                <KeyRound className="h-4 w-4" aria-hidden />
                Alterar senha
              </Button>
            </Link>
          </div>
        </GlassCard>

        {/* Active condominium */}
        <GlassCard variant="default">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
            Condomínio ativo
          </p>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-xl bg-gradient-to-br from-brand-300/30 to-brand-500/10 ring-1 ring-brand-400/30">
              <Building2 className="h-4 w-4 text-brand-700 dark:text-brand-300" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-ds-md font-semibold text-ds-body">
                {condominium?.name ?? 'Nenhum selecionado'}
              </p>
              <p className="truncate text-ds-xs text-ds-subtle">
                {condominium?.id ? `ID ${condominium.id.slice(0, 8)}…` : 'Selecione um condomínio'}
              </p>
            </div>
          </div>
          {canManageCondo && (
            <Link to="/condominiums" className="mt-4 block">
              <Button variant="ghost" fullWidth>
                Trocar de condomínio
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          )}
        </GlassCard>
      </div>

      {/* Condominium settings hub (replaces former "Condomínio" sidebar tab) */}
      {canManageCondo && condominium?.id && (
        <GlassCard variant="default">
          <header className="mb-4 flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
              Condomínio
            </p>
            <h2 className="text-ds-lg font-semibold text-ds-body">Configurações de {condominium.name}</h2>
            <p className="text-ds-sm text-ds-dim">
              Ajustes que valem para todo o condomínio. Para gerar o link genérico de cadastro de moradores, abra <strong className="text-ds-body">Equipe e convites</strong>.
            </p>
          </header>
          <ul className="grid gap-2 ds-sm:grid-cols-2">
            {CONDO_CONFIG_SECTIONS.map(({ id, label, description, icon: Icon, highlight }) => (
              <li key={id}>
                <Link
                  to={`/condominiums/${condominium.id}?section=${id}`}
                  className={cn(
                    'group flex h-full items-start gap-3 rounded-ds-xl border px-3 py-3 transition',
                    highlight
                      ? 'border-brand-400/40 bg-brand-500/[0.06] hover:border-brand-400/70 hover:bg-brand-500/[0.10]'
                      : 'border-ds-stroke/60 bg-white/[0.02] hover:border-brand-400/40 hover:bg-white/[0.05]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-lg ring-1',
                      highlight
                        ? 'bg-brand-500/15 text-brand-700 ring-brand-400/40 dark:text-brand-300'
                        : 'bg-ds-surface text-ds-dim ring-ds-stroke dark:bg-white/[0.04]',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-ds-sm font-semibold text-ds-body">{label}</span>
                      {highlight ? (
                        <span className="rounded-ds-pill bg-brand-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-800 ring-1 ring-brand-400/30 dark:text-brand-200">
                          Convite
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-ds-xs leading-relaxed text-ds-dim">
                      {description}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ds-subtle transition group-hover:translate-x-0.5 group-hover:text-brand-700 dark:group-hover:text-brand-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <EditProfileDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        profile={profile}
        residentProfile={residentProfile}
        condominiumId={condominium?.id}
        useResidentProfileEndpoint={shouldUseUnitProfile}
      />

      <GlassCard variant="default">
        <header className="mb-4 flex flex-col gap-3 ds-sm:flex-row ds-sm:items-center ds-sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
              Aplicativo
            </p>
            <h2 className="mt-1 text-ds-lg font-semibold text-ds-body">Instalar na tela inicial</h2>
            <p className="mt-1 max-w-xl text-ds-sm text-ds-dim">
              Use o CondoSync como atalho no celular ou computador (PWA). Abre em tela cheia e fica mais rápido de abrir.
            </p>
          </div>
          <Button type="button" variant="secondary" className="shrink-0" onClick={() => openPwaInstallHelp()}>
            <Download className="h-4 w-4" aria-hidden />
            Como instalar
          </Button>
        </header>
      </GlassCard>

      {/* Preferences */}
      <GlassCard variant="default">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ds-dim dark:text-brand-300/70">
              Preferências
            </p>
            <h2 className="mt-1 text-ds-lg font-semibold text-ds-body">Personalização</h2>
          </div>
        </header>
        <ul className="divide-y divide-ds-stroke">
          <li className="flex flex-col gap-4 py-3.5 ds-sm:flex-row ds-sm:items-center ds-sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-lg bg-ds-surface ring-1 ring-ds-stroke dark:bg-white/[0.04]">
                <Palette className="h-4 w-4 text-ds-dim" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-ds-sm font-semibold text-ds-body">Aparência</p>
                <p className="text-ds-xs leading-relaxed text-ds-dim">
                  Escolha entre tema claro ou escuro. A preferência fica salva neste aparelho.
                </p>
              </div>
            </div>
            <ThemeSegmented value={theme} onChange={setTheme} />
          </li>
          <PreferenceRow
            icon={Bell}
            title="Notificações por e-mail"
            description="Receba resumos e alertas em seu e-mail."
            disabled
            value="Em breve"
          />
          <PreferenceRow
            icon={Mail}
            title="Idioma"
            description="A interface está em Português (Brasil)."
            disabled
            value="pt-BR"
          />
        </ul>
      </GlassCard>

      {/* Danger */}
      <GlassCard variant="default" className="border-ds-danger/20">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ds-danger/80">
              Sessão
            </p>
            <h2 className="mt-1 text-ds-lg font-semibold text-ds-body">Sair da conta</h2>
            <p className="mt-1 text-ds-sm text-ds-dim">
              Encerra sua sessão neste navegador. Você poderá entrar novamente quando quiser.
            </p>
          </div>
          <Button variant="danger" onClick={logout}>
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </Button>
        </header>
      </GlassCard>
    </div>
  );
}

function ThemeSegmented({ value, onChange }: { value: UITheme; onChange: (t: UITheme) => void }) {
  return (
    <div
      className="flex w-full shrink-0 gap-0.5 rounded-ds-lg border border-ds-stroke bg-ds-surface p-0.5 ds-sm:w-auto"
      role="group"
      aria-label="Tema da interface"
    >
      <button
        type="button"
        onClick={() => onChange('light')}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-ds-md px-3 py-2 text-ds-xs font-semibold transition ds-sm:flex-initial',
          value === 'light'
            ? 'bg-ds-elevated text-ds-body shadow-ds-sm'
            : 'text-ds-dim hover:bg-ds-elevated hover:text-ds-body dark:hover:bg-white/[0.04]',
        )}
      >
        <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Claro
      </button>
      <button
        type="button"
        onClick={() => onChange('dark')}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-ds-md px-3 py-2 text-ds-xs font-semibold transition ds-sm:flex-initial',
          value === 'dark'
            ? 'bg-ds-elevated text-ds-body shadow-ds-sm'
            : 'text-ds-dim hover:bg-ds-elevated hover:text-ds-body dark:hover:bg-white/[0.04]',
        )}
      >
        <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Escuro
      </button>
    </div>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  value,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  value: string;
  disabled?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-lg bg-ds-surface ring-1 ring-ds-stroke dark:bg-white/[0.04]">
          <Icon className="h-4 w-4 text-ds-dim" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-ds-sm font-semibold text-ds-body">{title}</p>
          <p className="text-ds-xs leading-relaxed text-ds-dim">{description}</p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-ds-pill border border-ds-stroke px-2.5 py-1 text-ds-xs font-medium ${disabled ? 'text-ds-subtle' : 'text-ds-body'}`}
      >
        {value}
      </span>
    </li>
  );
}

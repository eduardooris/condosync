import { useMemo } from 'react';
import { ArrowLeft, BarChart2, Building2, ClipboardList, MessageCircle, SearchX, Settings, ShieldAlert, Users, Wallet, type LucideIcon } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Spinner } from '@/shared/components/ui/Spinner';
import { useCondominiumDetail } from '@/domains/condominiums/hooks/useCondominiumDetail';
import { GeneralSection } from '@/domains/condominiums/components/sections/GeneralSection';
import { FinancialSection } from '@/domains/condominiums/components/sections/FinancialSection';
import {
  CommunicationSection,
  OccurrencesSection,
  PollsSection,
} from '@/domains/condominiums/components/sections/PreferencesSection';
import { TeamSection } from '@/domains/condominiums/components/sections/TeamSection';
import { AdvancedSection } from '@/domains/condominiums/components/sections/AdvancedSection';
import { cn } from '@/shared/utils/cn';

type SectionId = 'general' | 'financial' | 'communication' | 'polls' | 'occurrences' | 'team' | 'advanced';

const NAV: { id: SectionId; label: string; icon: LucideIcon; hint?: string }[] = [
  { id: 'general', label: 'Geral', icon: Building2, hint: 'Identidade e endereço' },
  { id: 'financial', label: 'Financeiro', icon: Wallet, hint: 'Taxa, geração e vencimento' },
  { id: 'communication', label: 'Comunicação', icon: MessageCircle, hint: 'WhatsApp e notificações' },
  { id: 'polls', label: 'Enquetes', icon: BarChart2, hint: 'Anonimato e quórum' },
  { id: 'occurrences', label: 'Ocorrências', icon: ClipboardList },
  { id: 'team', label: 'Equipe', icon: Users, hint: 'Síndicos e responsáveis' },
  { id: 'advanced', label: 'Avançado', icon: ShieldAlert },
];

const VALID_SECTIONS: SectionId[] = ['general', 'financial', 'communication', 'polls', 'occurrences', 'team', 'advanced'];

export function CondominiumDetailPage() {
  const params = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = useMemo(() => {
    const fromUrl = searchParams.get('section') as SectionId | null;
    return fromUrl && VALID_SECTIONS.includes(fromUrl) ? fromUrl : 'general';
  }, [searchParams]);

  function handleSectionChange(next: SectionId) {
    const params = new URLSearchParams(searchParams);
    if (next === 'general') params.delete('section');
    else params.set('section', next);
    setSearchParams(params, { replace: true });
  }

  const { data, isLoading, isError } = useCondominiumDetail(params.id);

  if (isLoading) return <Spinner />;

  if (isError || !data) {
    return (
      <EmptyState
        icon={SearchX}
        title="Condomínio não encontrado"
        description="Não foi possível carregar os dados deste ID. Ele pode ter sido removido ou você pode não ter permissão."
        suggestion="Volte à lista de condomínios e selecione novamente."
        action={{ to: '/condominiums', label: 'Voltar à lista' }}
      />
    );
  }

  return (
    <div className="ds-page mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/condominiums"
            className="mb-2 inline-flex items-center gap-1.5 text-ds-xs font-semibold text-ds-dim transition hover:text-ds-body"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Condomínios
          </Link>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-ds-body ds-md:text-3xl">
            <Settings className="h-5 w-5 text-brand-700 dark:text-brand-300" strokeWidth={2} aria-hidden />
            {data.name}
          </h1>
          <p className="mt-1 text-ds-sm text-ds-dim">CNPJ {data.cnpj}</p>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-6 ds-md:grid-cols-[220px_1fr]">
        {/* Internal nav */}
        <nav className="ds-md:sticky ds-md:top-2 ds-md:self-start" aria-label="Seções de configuração">
          <ul className="flex gap-1 overflow-x-auto pb-2 ds-md:flex-col ds-md:gap-0.5 ds-md:overflow-visible ds-md:pb-0">
            {NAV.map(({ id, label, icon: Icon, hint }) => {
              const active = section === id;
              return (
                <li key={id} className="shrink-0 ds-md:shrink">
                  <button
                    type="button"
                    onClick={() => handleSectionChange(id)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-ds-xl px-3 py-2.5 text-left transition',
                      active
                        ? 'bg-gradient-to-r from-brand-500/30 to-brand-600/15 text-brand-900 dark:from-brand-400/20 dark:to-brand-500/5 dark:text-white'
                        : 'text-ds-dim hover:bg-ds-surface hover:text-ds-body dark:hover:bg-white/[0.04]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition',
                        active
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-brand-700/50 group-hover:text-brand-700 dark:text-brand-400/50 dark:group-hover:text-brand-300',
                      )}
                      strokeWidth={active ? 2 : 1.75}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-ds-sm font-semibold">{label}</span>
                      {hint ? <span className="hidden text-[10px] text-ds-subtle ds-md:block">{hint}</span> : null}
                    </span>
                    {active ? (
                      <span className="hidden h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-300 ds-md:block" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Section content */}
        <div className="min-w-0" key={data.id}>
          {section === 'general' ? <GeneralSection condominium={data} /> : null}
          {section === 'financial' ? <FinancialSection condominium={data} /> : null}
          {section === 'communication' ? <CommunicationSection /> : null}
          {section === 'polls' ? <PollsSection /> : null}
          {section === 'occurrences' ? <OccurrencesSection /> : null}
          {section === 'team' ? <TeamSection condominiumId={data.id} /> : null}
          {section === 'advanced' ? <AdvancedSection condominium={data} /> : null}
        </div>
      </div>
    </div>
  );
}

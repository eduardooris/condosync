import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LineChart, TrendingUp } from 'lucide-react';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { GlassCard } from '@/shared/components/ui/GlassCard';
import type { DashboardChartRow } from '@/domains/dashboard/services/dashboard.service';

function parseRow(row: DashboardChartRow) {
  return {
    key: row.month,
    label: shortMonthLabel(row.month),
    receitas: Number(row.receitas),
    despesas: Number(row.despesas),
  };
}

function shortMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(d);
}

function formatBrl(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function DashboardRevenueChart({ data }: { data: DashboardChartRow[] | undefined }) {
  const uid = useId().replace(/:/g, '');
  const rows = useMemo(() => (data ?? []).map(parseRow), [data]);

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="border-b border-ds-stroke-subtle bg-ds-surface px-5 py-4 dark:bg-white/[0.02] ds-md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-ds-lg bg-gradient-to-br from-emerald-500 to-emerald-800 text-ds-on-primary shadow-ds-sm">
            <TrendingUp className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-ds-md font-semibold text-ds-body">Receitas × despesas (mensal)</h2>
            <p className="text-ds-xs text-ds-secondary">Evolução acumulada no condomínio — compare entradas e saídas.</p>
          </div>
        </div>
      </div>
      <div className="p-4 ds-md:p-6">
        {rows.length === 0 ? (
          <EmptyState
            className="border-none bg-transparent py-8 shadow-none"
            icon={LineChart}
            title="Ainda não há histórico mensal"
            description="O gráfico mostra a evolução de receitas e despesas por mês quando o condomínio registra movimentações financeiras."
            suggestion="Com o tempo, você verá tendências (sazonalidade, picos de despesa) e poderá comparar meses. Cadastre cobranças, despesas e confirme pagamentos para alimentar esta visão."
          />
        ) : (
          <div className="min-w-0 rounded-ds-xl bg-ds-surface p-2 shadow-ds-sm dark:bg-white/[0.02]">
            <div className="h-[min(320px,55vh)] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id={`${uid}-r`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2ec886" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#2ec886" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${uid}-d`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f05050" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f05050" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--ds-chart-grid)" strokeDasharray="4 8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--ds-color-text-secondary)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--ds-color-border-default)' }}
                />
                <YAxis
                  width={64}
                  tick={{ fill: 'var(--ds-color-text-secondary)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat('pt-BR', {
                      notation: 'compact',
                      compactDisplay: 'short',
                      style: 'currency',
                      currency: 'BRL',
                      maximumFractionDigits: 0,
                    }).format(Number(v))
                  }
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-ds-lg border border-ds-stroke/80 bg-ds-elevated/95 px-3 py-2.5 text-ds-xs shadow-ds-md backdrop-blur-md">
                        <p className="mb-1.5 border-b border-ds-stroke/50 pb-1.5 font-semibold text-ds-body">{String(label)}</p>
                        <ul className="space-y-1">
                          {payload.map((p) => (
                            <li key={p.name} className="flex justify-between gap-6 text-ds-dim">
                              <span>{p.name}</span>
                              <span className="font-semibold tabular-nums text-ds-body">
                                {formatBrl(Number(p.value))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={28} />
                <Area
                  type="monotone"
                  name="Receitas"
                  dataKey="receitas"
                  stroke="#2ec886"
                  strokeWidth={2}
                  fill={`url(#${uid}-r)`}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  name="Despesas"
                  dataKey="despesas"
                  stroke="#f05050"
                  strokeWidth={2}
                  fill={`url(#${uid}-d)`}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

import { GlassCard } from '@/shared/components/ui/GlassCard';

export function FeaturePage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <GlassCard>
      <h2 className="mb-2 text-ds-xl font-semibold text-ds-body">{title}</h2>
      <p className="text-ds-sm text-ds-dim">{description}</p>
    </GlassCard>
  );
}

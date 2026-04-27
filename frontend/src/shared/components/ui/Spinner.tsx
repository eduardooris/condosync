import { cn } from '@/shared/utils/cn';

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dimension = size === 'sm' ? 'h-4 w-4 border' : size === 'lg' ? 'h-10 w-10 border-2' : 'h-7 w-7 border-2';
  return (
    <div className={cn('flex items-center justify-center py-10', className)}>
      <div
        className={cn(
          'animate-spin rounded-ds-pill border-ds-stroke border-t-ds-action',
          dimension,
        )}
        role="status"
        aria-label="Carregando"
      />
    </div>
  );
}

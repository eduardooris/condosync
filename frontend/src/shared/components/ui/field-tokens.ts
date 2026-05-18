import { cn } from '@/shared/utils/cn';

/**
 * Field control base classes — used by Input, Textarea, Select, NativeSelect.
 * Visual: SEM borda em estado normal. Contraste vem do `bg` mais escuro que o
 * card que envolve o input. Foco usa apenas `ring`. Hover só escurece o bg.
 */
export function fieldControlClassName(options?: { invalid?: boolean; className?: string }) {
  const { invalid, className } = options ?? {};
  return cn(
    // h-11 = 44px → bate o tap target mínimo do iOS HIG, melhora alvo para idosos.
    // text-base (16px) em mobile evita o auto-zoom do Safari ao focar input;
    // sobe pra text-ds-sm (14px) no breakpoint ds-md+ onde o zoom não rola.
    'w-full h-11 rounded-ds-md border border-transparent px-3.5 text-base ds-md:text-ds-sm text-ds-body',
    'bg-[rgba(8,12,28,0.6)] backdrop-blur-sm',
    'placeholder:text-ds-subtle',
    'transition-[color,background-color,box-shadow,border-color] duration-200',
    'hover:bg-[rgba(8,12,28,0.78)]',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus',
    'disabled:cursor-not-allowed disabled:opacity-55',
    'file:mr-3 file:inline-flex file:cursor-pointer file:items-center file:rounded-ds-sm file:border-0 file:bg-ds-action file:px-3 file:py-1.5 file:text-ds-sm file:font-medium file:text-ds-on-primary',
    invalid && 'ring-1 ring-ds-danger/60 focus-visible:ring-ds-danger',
    className,
  );
}

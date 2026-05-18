/* eslint-disable react-refresh/only-export-components -- Radix re-exports e wrappers estilizados no mesmo módulo */
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

/**
 * DialogContent — responsivo:
 *
 *   • Mobile (<768px): bottom sheet ancorado embaixo, slide-up no abrir,
 *     puxador no topo, rounded só no topo, max-h 90dvh, respeita safe-area.
 *   • Tablet+: dialog centralizado tradicional com zoom-in.
 *
 * Mantém a mesma API (`hideClose`, `className`) — nenhum caller precisa
 * mudar. O Radix entrega acessibilidade (focus trap, ESC, click outside)
 * em ambos os layouts.
 */
export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // ── Mobile: bottom sheet ──
        'fixed inset-x-0 bottom-0 z-50 w-full',
        'rounded-t-[1.5rem] bg-[var(--ds-popover-bg)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-ds-elev',
        'max-h-[90dvh] overflow-y-auto overscroll-contain',
        'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300',
        'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200',
        // ── Tablet+: dialog centralizado tradicional ──
        'ds-md:inset-x-auto ds-md:bottom-auto ds-md:left-1/2 ds-md:top-1/2',
        'ds-md:w-[calc(100%-1.5rem)] ds-md:max-w-lg ds-md:-translate-x-1/2 ds-md:-translate-y-1/2',
        'ds-md:rounded-ds-xl ds-md:p-6 ds-md:pb-6',
        'ds-md:max-h-[min(85dvh,48rem)]',
        'ds-md:data-[state=open]:zoom-in-95 ds-md:data-[state=open]:slide-in-from-left-1/2 ds-md:data-[state=open]:slide-in-from-top-[48%] ds-md:data-[state=open]:fade-in-0',
        'ds-md:data-[state=closed]:zoom-out-95 ds-md:data-[state=closed]:fade-out-0 ds-md:data-[state=closed]:slide-out-to-bottom-0',
        'focus:outline-none',
        className,
      )}
      {...props}
    >
      {/* Grab handle — visível só em mobile (sheet feel) */}
      <div
        aria-hidden
        className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ds-stroke ds-md:hidden"
      />
      {children}
      {!hideClose ? (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-ds-md p-1.5 text-ds-dim transition hover:bg-ds-surface hover:text-ds-body focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 space-y-1.5', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <DialogPrimitive.Title asChild><h2 className={cn('text-ds-lg font-semibold text-ds-body', className)} {...props} /></DialogPrimitive.Title>;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <DialogPrimitive.Description asChild><p className={cn('text-ds-sm text-ds-dim', className)} {...props} /></DialogPrimitive.Description>;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex items-center justify-end gap-2', className)} {...props} />;
}

export function FormDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

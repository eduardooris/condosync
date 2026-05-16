import { Component, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { isChunkLoadError } from '@/shared/lib/lazyImport';

interface Props {
  children: ReactNode;
  /** Chamado ao clicar em “Tentar novamente” (ex.: `navigate('/', { replace: true })`). */
  onNavigateHome: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Captura erros de renderização na árvore filha e oferece recuperação com retorno à home.
 */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onNavigateHome();
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      const chunkError = isChunkLoadError(this.state.error?.message);

      return (
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-6 px-4 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-ds-2xl bg-ds-danger/15 ring-1 ring-ds-danger/30">
            <AlertTriangle className="h-7 w-7 text-ds-danger" aria-hidden />
          </div>
          <div className="max-w-md text-center">
            <h1 className="text-ds-lg font-bold text-ds-body">Algo saiu do esperado</h1>
            <p className="mt-2 text-pretty text-ds-sm leading-relaxed text-ds-dim">
              {chunkError
                ? 'Uma nova versão do app pode estar disponível. Recarregue a página para continuar.'
                : 'Ocorreu um erro ao mostrar esta tela. Você pode voltar ao início e tentar de novo.'}
            </p>
            {import.meta.env.DEV && this.state.error?.message ? (
              <p className="mt-3 break-all text-left font-mono text-[11px] text-ds-subtle">
                {this.state.error.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {chunkError ? (
              <Button type="button" variant="gradient" onClick={this.handleReload}>
                <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                Recarregar página
              </Button>
            ) : null}
            <Button type="button" variant={chunkError ? 'secondary' : 'gradient'} onClick={this.handleRetry}>
              <Home className="h-4 w-4 shrink-0" aria-hidden />
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

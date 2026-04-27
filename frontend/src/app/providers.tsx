import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '@/shared/lib/queryClient';

const toastBaseStyle: React.CSSProperties = {
  background: 'var(--ds-toast-bg)',
  color: 'var(--ds-color-text-primary)',
  border: '1px solid var(--ds-toast-border)',
  borderRadius: '0.875rem',
  padding: '12px 14px',
  fontSize: '14px',
  fontWeight: 500,
  maxWidth: 420,
  boxShadow:
    '0 18px 40px -16px rgba(0, 0, 0, 0.65), 0 4px 12px -4px rgba(0, 0, 0, 0.45)',
};

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: toastBaseStyle,
          success: {
            iconTheme: { primary: '#2ec886', secondary: 'var(--ds-toast-bg)' },
            style: {
              ...toastBaseStyle,
              borderLeft: '3px solid #2ec886',
            },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: '#f05050', secondary: 'var(--ds-toast-bg)' },
            style: {
              ...toastBaseStyle,
              borderLeft: '3px solid #f05050',
            },
          },
          loading: {
            iconTheme: { primary: '#5591eb', secondary: 'var(--ds-toast-bg)' },
          },
        }}
      />
    </QueryClientProvider>
  );
}

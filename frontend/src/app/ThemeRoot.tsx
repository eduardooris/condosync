import { useEffect } from 'react';
import { useUIStore } from '@/shared/stores/ui.store';

const THEME_COLOR: Record<string, string> = {
  dark: '#06091a',
  light: '#e8edf5',
};

/**
 * Sincroniza `data-theme` no `<html>` e `theme-color` para PWA / barra do sistema.
 */
export function ThemeRoot() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', THEME_COLOR[theme] ?? THEME_COLOR.dark);
    }
  }, [theme]);

  return null;
}

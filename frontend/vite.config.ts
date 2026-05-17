import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        id: '/',
        name: 'CondoSync — Gestão condominial',
        short_name: 'CondoSync',
        description: 'CondoSync — gestão condominial digital, transparente e simples.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/?source=pwa',
        scope: '/',
        theme_color: '#06091a',
        background_color: '#06091a',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        orientation: 'portrait',
        categories: ['productivity', 'business', 'utilities'],
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
  },
});

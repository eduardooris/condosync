import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Porta 5174 pra não conflitar com o frontend principal (5173).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5174,
    host: true,
  },
  preview: {
    port: 5174,
  },
});

import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/run_cool/' : '/',
  server: {
    port: 5173
  },
  preview: {
    port: 4173
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
}));

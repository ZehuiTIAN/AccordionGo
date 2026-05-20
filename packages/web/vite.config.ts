/**
 * packages/web/vite.config.ts
 *
 * Vite build config for the web package.
 * base is set to '/AccordionGo/' for GitHub Pages deployment under that repo name.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: '/AccordionGo/',
  plugins: [react()],
  resolve: {
    alias: {
      '@accordion/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});

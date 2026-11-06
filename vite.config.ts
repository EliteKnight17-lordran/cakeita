/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Static SPA (HashRouter) so it can be hosted free on Vercel, Netlify or GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Keep the 3D engine in its own chunk so the first screen loads fast on mobile data.
        manualChunks(id) {
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'react';
          if (/node_modules\/(three|three-stdlib|@react-three|troika|maath|camera-controls|zustand|its-fine|suspend-react)\//.test(id)) return 'three';
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|use-sync-external-store)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

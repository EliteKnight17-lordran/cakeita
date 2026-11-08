/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/** Lists every built file for the service worker, so the whole app works offline after one visit. */
function precacheList(): Plugin {
  return {
    name: 'cakeita-precache',
    apply: 'build',
    generateBundle(_opts, bundle) {
      // Firebase is only needed online (sign-in, cloud inbox), so it is not downloaded ahead.
      const files = Object.keys(bundle).filter((f) => f.startsWith('assets/') && !f.includes('/firebase-') && !f.endsWith('.map'));
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) });
    },
  };
}

// Static SPA (HashRouter) so it can be hosted free on Vercel, Netlify or GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), precacheList()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Keep the 3D engine in its own chunk so the first screen loads fast on mobile data.
        manualChunks(id) {
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'react';
          if (/node_modules\/(three|three-stdlib|@react-three|troika|maath|camera-controls|zustand|its-fine|suspend-react)\//.test(id)) return 'three';
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'firebase';
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

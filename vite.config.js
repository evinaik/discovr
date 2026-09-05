import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // Relative base: GitHub Pages serves this project from /discovr/, not the
  // domain root, and a relative base also keeps `vite preview` and file:// working.
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        // The pre-Vite site lived here; keep the URL alive so old links resolve.
        discovr: resolve(import.meta.dirname, 'discovr.html'),
      },
    },
  },
});

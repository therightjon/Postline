import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Override the dev proxy target when the API isn't on localhost
// (e.g. docker-compose, where the API runs as the `api` service).
const apiProxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:7071';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

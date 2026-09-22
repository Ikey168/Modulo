import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@features': resolve(__dirname, './src/features'),
      '@store': resolve(__dirname, './src/store'),
      '@modulo/core': resolve(__dirname, './src/core/index.ts'),
      'node-fetch': resolve(__dirname, './src/vendor/nodeFetchBrowser.ts'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Point at a deployed backend (e.g. the Oracle host) with
      // VITE_API_PROXY_TARGET=https://… npm run dev
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});

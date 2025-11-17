import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../core'),
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:1369',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:1369',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunk: All node_modules dependencies
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // Core chunk: Shared core utilities/state
          if (id.includes('/core/')) {
            return 'core';
          }
          // Theme chunk: Everything else (theme-specific components)
          return 'theme';
        },
      },
    },
  },
});

import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import packageJson from './package.json';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    sentryVitePlugin({
      org: 'walton-vikings',
      project: 'viking-event-mgmt',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: `vikings-eventmgmt-mobile@${packageJson.version}`,
        uploadLegacySourcemaps: false,
        setCommits: {
          auto: true,
        },
        deploy: {
          env: 'production',
        },
      },
      sourcemaps: {
        assets: ['./dist/**'],
        ignore: ['node_modules'],
        urlPrefix: '~/',
      },
      debug: process.env.SENTRY_DEBUG === 'true', // Enable debug output conditionally
    }),
  ],
  server: {
    port: 3001,
    host: true,
    open: true,
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem'),
    },
  },
  define: {
    // No need to define process.env since we're using import.meta.env
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Preserve function names in production for better error reporting
    minify: 'esbuild',
    target: 'esnext',
    keepNames: true,
    rollupOptions: {
      output: {
        // Preserve function names for better stack traces
        manualChunks: undefined,
        // Add more descriptive chunk names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});

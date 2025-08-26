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
    // Enable HTTPS by default, but allow HTTP for demo mode or when certs are missing
    https: (() => {
      try {
        // Check if demo mode is requested via environment variable
        if (process.env.VITE_DEMO_MODE === 'true' || process.env.HTTP_ONLY === 'true') {
          return false; // Use HTTP for demo mode
        }
        
        // Try to read certificates for HTTPS
        return {
          key: fs.readFileSync('./localhost-key.pem'),
          cert: fs.readFileSync('./localhost.pem'),
        };
      } catch (error) {
        console.warn('⚠️  HTTPS certificates not found, falling back to HTTP');
        console.warn('   To use HTTPS, ensure localhost-key.pem and localhost.pem exist');
        console.warn('   To force HTTP for demo mode, set VITE_DEMO_MODE=true or HTTP_ONLY=true');
        return false; // Fallback to HTTP if certificates don't exist
      }
    })(),
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
      input: {
        main: './index.html',
      },
      output: {
        // Preserve function names for better stack traces
        manualChunks: undefined,
        // Add more descriptive chunk names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Copy _redirects file to dist for client-side routing
    copyPublicDir: true,
  },
  publicDir: 'public',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});

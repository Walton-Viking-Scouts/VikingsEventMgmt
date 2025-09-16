import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { execSync } from 'child_process';
import packageJson from './package.json';

// Resolve version once for the whole config
function resolveVersion() {
  // 1) CI-provided env (should be set by GitHub Actions or Render)
  if (process.env.VITE_APP_VERSION) {
    console.log('Using CI-provided version:', process.env.VITE_APP_VERSION);
    return process.env.VITE_APP_VERSION.replace(/^v/, '');
  }

  if (process.env.NODE_ENV === 'production' || process.env.CI) {
    try {
      const ghRelease = execSync('gh release list --limit 1 --json tagName --jq ".[0].tagName"', { encoding: 'utf8', stdio: 'pipe' }).trim();
      if (ghRelease && ghRelease !== 'null') {
        console.log('Using GitHub release version:', ghRelease);
        return ghRelease.replace(/^v/, '');
      }
    } catch (e) {
      console.warn('GitHub release lookup failed in production:', e.message);
    }

    try {
      const tagsRaw = execSync('git tag --sort=-version:refname', { encoding: 'utf8', stdio: 'pipe' });
      const gitTag = tagsRaw.split(/\r?\n/).find(Boolean);
      if (gitTag) {
        console.log('Using Git tag version in production:', gitTag);
        return gitTag.replace(/^v/, '');
      }
    } catch (e) {
      console.warn('Git tag lookup failed in production:', e.message);
    }

    console.log('Production build: falling back to package.json version:', packageJson.version);
    return packageJson.version;
  }

  try {
    const ghRelease = execSync('gh release list --limit 1 --json tagName --jq ".[0].tagName"', { encoding: 'utf8', stdio: 'pipe' }).trim();
    if (ghRelease && ghRelease !== 'null') {
      console.log('Using GitHub release version:', ghRelease);
      return ghRelease.replace(/^v/, '');
    }
  } catch (e) {
    console.warn('GitHub release lookup failed in development:', e.message);
  }

  try {
    const tagsRaw = execSync('git tag --sort=-version:refname', { encoding: 'utf8', stdio: 'pipe' });
    const gitTag = tagsRaw.split(/\r?\n/).find(Boolean);
    if (gitTag) {
      console.log('Using Git tag version:', gitTag);
      return gitTag.replace(/^v/, '');
    }
  } catch (e) {
    console.warn('Git tag lookup failed:', e.message);
  }

  console.warn('Falling back to package.json version:', packageJson.version);
  return packageJson.version;
}
const resolvedVersion = resolveVersion();

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    sentryVitePlugin({
      org: 'walton-vikings',
      project: 'viking-event-mgmt',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.SENTRY_RELEASE || `vikings-eventmgmt-mobile@${resolvedVersion}`,
        uploadLegacySourcemaps: false,
        setCommits: {
          auto: true,
          ignoreMissing: true,
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
    // Inject single resolved version
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(resolvedVersion),
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
        // Split large chunks for better loading performance
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@heroicons/react', '@sentry/react'],
        },
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

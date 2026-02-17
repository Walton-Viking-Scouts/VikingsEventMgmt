# Technology Stack

**Analysis Date:** 2026-02-15

## Languages

**Primary:**
- JavaScript (ES2022) - React components, services, and utilities
- JSX - React component templates and rendering

**Secondary:**
- HTML5 - Application markup in `index.html`
- CSS3 - Styling via Tailwind CSS framework

## Runtime

**Environment:**
- Node.js >= 20.0.0 (required in `package.json`)
- Browser - Vite development server runs on `localhost:3001` with HTTPS support

**Package Manager:**
- npm >= 10.0.0 (required in `package.json`)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.1.0 - UI framework with hooks
- React Router DOM 6.30.1 - Client-side routing

**Mobile:**
- Capacitor 7.4.0 - Cross-platform native iOS/Android bridge
- @capacitor-community/sqlite 7.0.0 - Native SQLite database access
- @capacitor/network 7.0.1 - Network status detection

**Styling:**
- Tailwind CSS 4.1.11 - Utility-first CSS framework
- PostCSS 8.5.6 - CSS transformation and plugin processor
- Autoprefixer 10.4.21 - CSS vendor prefix injection
- @tailwindcss/postcss 4.1.11 - Tailwind PostCSS plugin

**Testing:**
- Vitest 3.2.4 - Unit test runner (Vue/React compatible, esbuild-based)
- @testing-library/react 16.3.0 - React component testing utilities
- @testing-library/dom 10.4.0 - DOM query and assertion utilities
- @testing-library/jest-dom 6.6.3 - Custom DOM matchers for assertions
- Cypress 14.5.0 - E2E testing framework with cloud recording support

**Build/Dev:**
- Vite 7.0.0 - Modern bundler and dev server
- @vitejs/plugin-react 4.5.2 - React Fast Refresh and JSX support
- esbuild - Production minification engine (via Vite)

**Code Quality:**
- ESLint 9.29.0 - JavaScript linting
- @eslint/js 9.29.0 - ESLint core JavaScript rules
- Prettier 3.6.2 - Code formatter
- JSDoc 4.0.4 - Documentation generator
- documentation 14.0.3 - API documentation tool

**Error Tracking:**
- @sentry/react 9.32.0 - Error monitoring and crash reporting
- @sentry/vite-plugin 3.5.0 - Sentry integration for Vite (source maps)

**UI Components:**
- @heroicons/react 2.2.0 - Icon library
- react-hot-toast 2.6.0 - Toast notification system
- framer-motion 12.23.12 - Animation library

**Utilities:**
- uuid 11.1.0 - UUID generation
- date-fns 4.1.0 - Date manipulation and formatting
- clsx 2.1.1 - Conditional className utility
- idb 8.0.3 - IndexedDB wrapper for local storage
- jsdom 26.1.0 - DOM implementation for testing

**Dev Utilities:**
- @testing-library/user-event 14.6.1 - User event simulation for tests
- fake-indexeddb 6.2.2 - Fake IndexedDB for testing
- jest-axe 10.0.0 - Accessibility testing
- start-server-and-test 2.0.12 - Server startup helper for E2E tests
- eslint-plugin-react 7.37.5 - React-specific ESLint rules
- eslint-plugin-react-hooks 5.2.0 - React Hooks ESLint rules
- eslint-plugin-react-refresh 0.4.20 - React Fast Refresh warnings
- eslint-plugin-cypress 5.1.0 - Cypress-specific ESLint rules
- eslint-plugin-import 2.32.0 - Import/export linting
- eslint-plugin-jsdoc 48.11.0 - JSDoc comment linting
- @types/react 19.1.8 - React TypeScript definitions
- @types/react-dom 19.1.6 - React DOM TypeScript definitions

## Key Dependencies

**Critical:**
- React 19.1.0 - Framework foundation for all UI rendering
- Capacitor 7.4.0 - Native platform bridge for iOS/Android deployment
- @capacitor-community/sqlite 7.0.0 - Required for offline-first data persistence via SQLite

**Infrastructure:**
- Vite 7.0.0 - Build tooling and development server
- @sentry/react 9.32.0 - Production error tracking and monitoring
- Tailwind CSS 4.1.11 - Styling system ensuring consistent design

## Configuration

**Environment:**
- `.env` file (not committed) - Contains `VITE_API_URL` and `VITE_SENTRY_DSN`
- `VITE_API_URL` - Backend API endpoint (required for basic functionality)
- `VITE_SENTRY_DSN` - Error tracking endpoint (optional, defaults to disabled)
- `SENTRY_AUTH_TOKEN` - Sentry release management (used in CI/CD for source maps)
- Demo mode detection via URL params: `?demo=true`, `?mode=demo`, or hostname `demo.*`

**Build:**
- `vite.config.js` - Vite bundler configuration with Sentry plugin integration
- `eslint.config.js` - ESLint rules for code quality and import boundaries
- `.prettierrc.json` - Code formatting rules (2 spaces, single quotes, 80-char line width)
- `cypress.config.js` - E2E testing configuration with Cypress Cloud integration
- `tailwind.config.js` - Tailwind CSS theme with Scout brand colors
- `postcss.config.js` - CSS processing pipeline with Tailwind and Autoprefixer

**Development Server:**
- Runs on `https://localhost:3001` with auto-open browser
- Falls back to HTTP if certificates (`localhost-key.pem`, `localhost.pem`) unavailable
- Hot module replacement enabled via React Fast Refresh
- CORS-enabled for development

**Source Maps:**
- Enabled in production build (`sourcemap: true` in Vite config)
- Injected and uploaded to Sentry during build process via `@sentry/vite-plugin`
- Prevents minified stack traces in error monitoring

## Platform Requirements

**Development:**
- Node.js 20+
- npm 10+
- macOS, Linux, or Windows with git
- HTTPS certificates for local dev (optional, falls back to HTTP)

**Production:**
- Deployment target: Render.com (currently configured)
- Capacitor iOS/Android native builds supported
- Browser support: All modern browsers (Vite targets ESNext)
- Minimum iOS: Version 13+ (Capacitor 7.x requirement)
- Minimum Android: API 23 (Android 6.0+)

## Release & Version Management

**Version System:**
- Current: 2.11.8
- Managed by GitHub Actions with automatic version bumping
- Format: Semantic versioning (MAJOR.MINOR.PATCH)

**Build & Deploy Pipeline:**
1. Vite builds application
2. Sentry source maps injected and uploaded
3. GitHub Actions creates release tag
4. Deployed to Render.com
5. Version sync: `npm version` with no git tag

---

*Stack analysis: 2026-02-15*

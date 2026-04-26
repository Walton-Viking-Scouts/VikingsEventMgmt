# Technology Stack

**Analysis Date:** 2026-04-26

## Languages

**Primary:**
- JavaScript (ES2022) - All application code in `src/`, written as ESM (`"type": "module"` in `package.json`)
- JSX - React components throughout `src/features/`, `src/shared/components/`, `src/layouts/`, `src/routes/`

**Secondary:**
- Swift - Native iOS shell at `ios/App/App/AppDelegate.swift`
- Ruby - CocoaPods `Podfile` at `ios/App/Podfile`
- HTML/CSS - `index.html` entry; Tailwind-driven styles in `src/index.css`

**Type System:**
- No TypeScript. Type checking is informal via JSDoc + `jsconfig.json` (`"strict": false`, `"allowJs": true`)
- Path aliases declared in `jsconfig.json` (`@/*`, `@/components/*`, `@/services/*`, `@/utils/*`, `@/hooks/*`, `@/contexts/*`, `@/assets/*`)

## Runtime

**Environment:**
- Node.js >= 20.0.0 (`package.json` `engines`, `.nvmrc` pinned to `20`)
- Browser: Modern evergreen browsers (Vite `target: 'esnext'`)
- Native iOS: iOS 14.0+ (`ios/App/Podfile` `platform :ios, '14.0'`)
- Web platform via Capacitor 7

**Package Manager:**
- npm >= 10.0.0
- Lockfile: `package-lock.json` present (committed)

## Frameworks

**Core:**
- React 19 (`react` ^19.1.0, `react-dom` ^19.1.0) - Functional components + hooks only
- React Router DOM 6 (`react-router-dom` ^6.30.1) - URL-based routing in `src/routes/AppRouter.jsx` (BrowserRouter, Routes, Route, Navigate, lazy-loaded feature pages)
- Capacitor 7 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`) - Native iOS wrapper
- Tailwind CSS 4 (`tailwindcss` ^4.1.11, `@tailwindcss/postcss` ^4.1.11) - Utility-first styling; config at `tailwind.config.js`
- Zod 4 (`zod` ^4.3.6) - Schema validation; used in `src/shared/services/storage/schemas/validation.js`

**Testing:**
- Vitest 3 (`vitest` ^3.2.4) - Unit test runner; config inline in `vite.config.js` (`environment: 'jsdom'`, `setupFiles: './src/test/setup.js'`)
- Cypress 14 (`cypress` ^14.5.0) - E2E tests; config at `cypress.config.js` (Cypress Cloud project ID `ehjysh`)
- React Testing Library 16 (`@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`)
- jsdom (`jsdom` ^26.1.0) - DOM environment for Vitest
- fake-indexeddb (`fake-indexeddb` ^6.2.2) - IndexedDB mock for tests
- jest-axe (`jest-axe` ^10.0.0) - Accessibility assertions
- start-server-and-test (`start-server-and-test` ^2.0.12) - Boots dev server before Cypress

**Build/Dev:**
- Vite 7 (`vite` ^7.0.0) - Dev server + bundler; config `vite.config.js`
- @vitejs/plugin-react (`@vitejs/plugin-react` ^4.5.2) - React Fast Refresh
- @sentry/vite-plugin (`@sentry/vite-plugin` ^3.5.0) - Source map upload (org `walton-vikings`, project `viking-event-mgmt`)
- esbuild minifier (`build.minify: 'esbuild'`, `keepNames: true` for clean stack traces)
- PostCSS 8 + Autoprefixer 10 - configured in `postcss.config.js`
- ESLint 9 flat config (`eslint.config.js`) with plugins: `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-cypress`, `eslint-plugin-import`, `eslint-plugin-jsdoc`
- Prettier 3 (`.prettierrc.json`) - 2-space indent, single quotes, trailing commas (`es5`), semi colons
- JSDoc 4 (`jsdoc.config.json`) + `documentation` 14 - API doc generation via `npm run docs:generate`

## Key Dependencies

**Critical:**
- `@sentry/react` ^9.32.0 - Error tracking, performance, session replay; init in `src/shared/services/utils/sentry.js`
- `@capacitor-community/sqlite` ^7.0.0 - Native SQLite persistence; consumed in `src/shared/services/storage/database.js`
- `@capacitor/network` ^7.0.1 - Native network status; consumed in `src/shared/services/network/NetworkStatusManager.js` and `src/shared/utils/networkUtils.js`
- `idb` ^8.0.3 - IndexedDB wrapper; consumed in `src/shared/services/storage/indexedDBService.js` (database name `vikings-eventmgmt` / `vikings-eventmgmt-demo`, version 8)
- `react-hot-toast` ^2.6.0 - Toast notifications; `<Toaster />` mounted in `src/App.jsx`
- `@heroicons/react` ^2.2.0 - Icon set (`/24/outline` subpath)

**Utility:**
- `date-fns` ^4.1.0 - Date helpers (`format`, `isAfter`, `differenceInYears`, `differenceInMonths`, `parseISO`, `isValid`); used in `src/shared/utils/sectionMovements/`
- `clsx` ^2.1.1 - Class name composition; used in `src/shared/utils/cn.js`
- `framer-motion` ^12.23.12 - Listed in `package.json` dependencies (no current import sites detected in `src/`)
- `uuid` ^11.1.0 - Listed in `package.json` dependencies (no current import sites detected in `src/`)
- `prop-types` (transitive / runtime use) - Used in components such as `src/shared/components/TokenCountdown.jsx`, `src/features/movements/components/SectionMovementTracker.jsx`

**Infrastructure:**
- `@sentry/cli` (invoked via `npx`) - Source map upload + release management in `package.json` `release:*` and `sentry:sourcemaps` scripts

## Configuration

**Environment:**
- `.env`, `.env.example`, `.env.test`, `.env.sentry-build-plugin` files present at repo root
- Loaded by Vite (`import.meta.env.VITE_*`); validation in `src/config/env.js` (validates `VITE_API_URL`; skips checks in demo mode)
- Demo mode detection (URL params, hostname prefix `demo.`, path `/demo`, or `VITE_DEMO_MODE=true`) in `src/config/demoMode.js`
- Required env vars: `VITE_API_URL`
- Optional env vars: `VITE_SENTRY_DSN`, `VITE_DEMO_MODE`, `VITE_USE_URL_ROUTING`, `VITE_APP_VERSION`, `HTTP_ONLY`
- Build/CI vars: `SENTRY_AUTH_TOKEN`, `SENTRY_DEBUG`, `SENTRY_RELEASE`, `RENDER_DEPLOY_HOOK`, `CYPRESS_RECORD_KEY`, `CYPRESS_PROJECT_ID`

**Build:**
- `vite.config.js` - Vite + React + Sentry plugin + custom version resolver (CI env -> `gh release list` -> git tag -> `package.json`)
- HTTPS dev server via `localhost-key.pem` and `localhost.pem` (port 3001); falls back to HTTP when certs missing or `VITE_DEMO_MODE=true`
- Output: `dist/` with manual chunks (`vendor`, `router`, `ui`); source maps enabled (`build.sourcemap: true`)
- `capacitor.config.json` - App ID `com.vikingscouts.vikingscoutsmanager`, name `Vikings Event Mgmt`, web dir `dist`
- `scripts/sync-version.js` - Pre-build version sync (invoked via `prebuild` script)

## Platform Requirements

**Development:**
- macOS (recommended for iOS builds), Linux, or Windows for web-only work
- Node.js 20+, npm 10+
- Xcode + CocoaPods for iOS native builds (`ios/App/Podfile.lock` present)
- HTTPS certificates (`localhost-key.pem`, `localhost.pem`) for default `npm run dev`
- Optional Dev Container at `.devcontainer/` (`mcr.microsoft.com/devcontainers/universal:3.0.3`)

**Production:**
- Web: Render.com (deployed via webhook `RENDER_DEPLOY_HOOK`; hostname `vikingeventmgmt.onrender.com`)
- iOS: Capacitor 7 with `App.xcworkspace` at `ios/App/App.xcworkspace`; CocoaPods-installed `Capacitor`, `CapacitorCordova`, `CapacitorCommunitySqlite`, `CapacitorNetwork`
- CI: GitHub Actions (`.github/workflows/ci.yml`, `.github/workflows/release.yml`) on Ubuntu and macOS runners

---

*Stack analysis: 2026-04-26*

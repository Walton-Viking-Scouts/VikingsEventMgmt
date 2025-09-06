# Vikings Event Management - Codebase Analysis

## Overview

This is a **mobile-first React application** for Scout event management with comprehensive offline capabilities. It's designed to work both as a responsive web app and as a native mobile app using Capacitor.

## Tech Stack

### Core Technologies
- **React 19** - Modern React with hooks-only functional components
- **Vite 7** - Fast build tool and development server
- **Capacitor** - Native mobile app wrapper for iOS/Android
- **TailwindCSS 4** - Utility-first CSS framework
- **React Router 7** - Client-side routing

### Database & Storage
- **SQLite** - Offline database for native mobile apps
- **localStorage** - Fallback storage for web browsers

### Observability & Monitoring
- **Sentry** - Error monitoring and performance tracking

### Testing & Quality
- **Vitest** - Unit testing framework
- **Cypress** - End-to-end testing with cloud integration
- **ESLint** - Code linting with React-specific rules
- **Prettier** - Code formatting

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── desktop/        # Desktop-specific components
│   ├── notifications/  # Toast notification system
│   └── ui/            # Base UI components
├── hooks/              # Custom React hooks
├── services/           # Business logic and API layer
├── utils/              # Utility functions
├── contexts/           # React context providers
├── layouts/            # Layout components
├── adapters/           # Service adapters
├── config/             # Configuration files
└── test/              # Test setup and utilities
```

## Key Architectural Patterns

### 1. **Offline-First Architecture**
The app is designed to work completely offline with intelligent data synchronization:

```javascript
// Platform-aware data access
const sections = await getUserRoles(token);
// Online: Fetch from server + cache locally
// Offline: Load from SQLite (native) or localStorage (web)
```

### 2. **Responsive Platform Detection**
Automatic platform detection drives UI behavior:

```javascript
import { isMobileLayout, isNativeMobile } from './utils/platform.js';

// Conditional rendering based on platform
const isMobile = isMobileLayout();
return isMobile ? <MobileView /> : <DesktopView />;
```

### 3. **Service Layer Pattern**
Business logic is separated into dedicated services:

- `services/api.js` - API communication with offline fallbacks
- `services/database.js` - SQLite/localStorage abstraction
- `services/auth.js` - Authentication and token management
- `services/sync.js` - Data synchronization logic

### 4. **Custom Hooks for State Management**
Complex state logic is encapsulated in custom hooks:

- `useAuth()` - Authentication state and token management
- `useAttendanceData()` - Event attendance data management
- `useNotificationPreferences()` - User notification settings

### 5. **Error Boundary Pattern**
Comprehensive error handling with nested error boundaries:

```javascript
<ErrorBoundary name="App">
  <ErrorBoundary name="Router">
    <ErrorBoundary name="ResponsiveLayout">
      {/* App content */}
    </ErrorBoundary>
  </ErrorBoundary>
</ErrorBoundary>
```

## Entry Points

### Main Entry Point
- `index.html` - HTML entry point
- `src/main.jsx` - React application bootstrap
- `src/App.jsx` - Main application component with routing

### Development Server
- **Port**: 3001 (HTTPS by default)
- **Command**: `npm run dev`
- **URL**: `https://localhost:3001`

## Critical Development Patterns

### 1. **Component Structure**
All components follow this pattern:
```javascript
// Props interface (if using TypeScript patterns)
// Functional component with hooks only
// Export default at bottom
// NO COMMENTS unless explicitly requested

function MyComponent({ prop1, prop2 }) {
  // Hook usage
  // Event handlers
  // Render logic
  return <div>...</div>;
}

export default MyComponent;
```

### 2. **Data Flow**
```
OSM API ↔ Backend Proxy ↔ Frontend ↔ Local Cache ↔ SQLite/localStorage
```

### 3. **Authentication Flow**
- OAuth2 with Online Scout Manager (OSM)
- Token stored in sessionStorage
- Automatic token validation and refresh
- Graceful degradation to cached data when offline

### 4. **Offline Strategy**
- **Network Detection**: Automatic online/offline state management
- **Smart Caching**: Different TTL strategies for static vs dynamic data
- **Sync on Reconnect**: Automatic data synchronization when back online
- **User Feedback**: Clear indicators of offline state and sync status

## Development Workflow

### Required Commands Before Committing
```bash
npm run lint            # Fix linting issues
npm run test:run        # Run all unit tests
npm run build           # Ensure build succeeds
npx cap sync           # Sync to native platforms (optional)
```

### Testing Strategy
- **Unit Tests**: Component logic and utilities (Vitest)
- **E2E Tests**: Complete user workflows (Cypress)
- **Cross-Browser**: Chrome, Firefox, Edge testing
- **Mobile Testing**: iOS/Android native app testing

### Release Process
- **GitHub Actions**: Automated CI/CD pipeline
- **Version Management**: Automatic version bumping based on PR titles
- **Sentry Integration**: Source map upload for error tracking
- **Deployment**: Render.com for web, App Store for mobile

## Key Configuration Files

- `vite.config.js` - Build configuration with Sentry integration
- `capacitor.config.json` - Native mobile app configuration
- `tailwind.config.js` - CSS framework configuration
- `eslint.config.js` - Code linting rules
- `.env.example` - Environment variables template

## Important Conventions

### 1. **No Comments Policy**
- Code should be self-documenting
- Only add comments when explicitly requested
- Focus on clear naming and structure

### 2. **Mobile-First Design**
- All features must work on mobile devices
- Touch-friendly interactions
- Responsive breakpoints: mobile (768px), tablet (1024px), desktop (1200px)

### 3. **Offline-First Development**
- All functionality must work without internet
- Graceful degradation when services unavailable
- Clear user feedback about connection status

### 4. **Error Resilience**
- Comprehensive error boundaries
- User-friendly error messages
- Automatic fallback to cached data

## Getting Started

1. **Clone and Install**:
   ```bash
   git clone https://github.com/Walton-Viking-Scouts/VikingsEventMgmt.git
   cd VikingsEventMgmt
   npm install
   ```

2. **Start Development**:
   ```bash
   npm run dev  # Starts HTTPS server on port 3001
   ```

3. **Run Tests**:
   ```bash
   npm run test:run && npm run lint && npm run build
   ```

4. **Mobile Development**:
   ```bash
   npm run build
   npx cap sync
   npx cap open ios  # Opens Xcode for iOS development
   ```

## Architecture Deep Dive

### Platform Detection System
The application uses a sophisticated platform detection system that automatically adapts the UI and functionality based on the runtime environment:

```javascript
// utils/platform.js
export const isMobileLayout = () => {
  return isNativeMobile() || isMobileScreen();
};

export const getPlatform = () => {
  if (isNativeMobile()) return 'native-mobile';
  if (isMobileScreen()) return 'mobile-web';
  return 'desktop';
};
```

### Database Abstraction Layer
The database service provides a unified interface that automatically chooses between SQLite (native) and localStorage (web):

```javascript
// services/database.js
class DatabaseService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  async saveData(key, data) {
    if (this.isNative) {
      // Use SQLite for native apps
      return await this.db.execute(query, params);
    } else {
      // Use localStorage for web
      localStorage.setItem(key, JSON.stringify(data));
    }
  }
}
```

### Authentication State Management
The `useAuth` hook manages complex authentication states including token expiration, offline mode, and cached data availability:

```javascript
// Authentication states:
// - 'authenticated' - Valid token, online
// - 'token_expired' - Expired token but has cached data
// - 'cached_only' - No token but has cached data
// - 'no_data' - No token and no cached data
```

### Responsive Layout System
The application uses a responsive layout system that adapts to different screen sizes and platforms:

- **Mobile Layout** (< 768px or native mobile): Single-column, touch-optimized
- **Desktop Layout** (≥ 768px): Multi-column with sidebar navigation
- **Tablet Layout** (768px - 1024px): Hybrid approach with collapsible elements

### Error Handling Strategy
Multi-layered error handling ensures the application remains functional even when individual components fail:

1. **Error Boundaries**: Catch React component errors
2. **Service Layer**: Handle API and database errors
3. **Network Resilience**: Graceful degradation when offline
4. **User Feedback**: Clear error messages and recovery options

### Data Synchronization
The sync service manages data consistency between local storage and remote APIs:

- **Automatic Sync**: Triggers when network connectivity is restored
- **Manual Sync**: User-initiated refresh functionality
- **Conflict Resolution**: Handles data conflicts between local and remote
- **Progress Indicators**: Real-time sync status feedback

This codebase represents a mature, production-ready application with sophisticated offline capabilities, comprehensive testing, and a well-structured architecture that scales from mobile web to native mobile apps.
# Vikings Event Management

A responsive React application for Scout event management with full offline capabilities. Supports both desktop camp preparation and mobile camp execution with SQLite offline storage.

## Features

### 🏕️ **Camp Preparation (Desktop)**
- **Full desktop interface** with sidebar navigation
- **Print functionality** for rosters and reports
- **Detailed event planning** views
- **Export capabilities** for camp data
- **Rich data tables** and analytics

### 📱 **Camp Execution (Mobile)**
- **Native iOS app** with Capacitor
- **SQLite offline storage** - unlimited data storage
- **Network detection** with auto-sync
- **Touch-optimized interface** for field use
- **Works completely offline** during camps

### 🔄 **Unified Platform**
- **Single React codebase** for both desktop and mobile
- **Responsive design** adapts to screen size and platform
- **Shared authentication** and API layer
- **Real-time sync** between web and mobile versions

## Getting Started

### Prerequisites

- Node.js 18+
- Xcode (for iOS development)
- CocoaPods (for iOS native dependencies)
- Access to Online Scout Manager with appropriate permissions

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Walton-Viking-Scouts/VikingsEventMgmt.git
cd VikingEventMgmt
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

### Mobile Development

4. Build for Capacitor:
```bash
npm run build
npx cap sync
```

5. Open in Xcode:
```bash
npx cap open ios
```

## Scripts

### Development
- `npm run dev` - Start development server on port 3001
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Testing

#### Unit Tests
- `npm test` - Run unit tests with Vitest
- `npm run test:ui` - Run unit tests with UI
- `npm run test:run` - Run unit tests once

#### E2E Tests (Local)
- `npm run cypress:open` - Open Cypress Test Runner
- `npm run cypress:run` - Run e2e tests headlessly
- `npm run test:e2e` - Run e2e tests with dev server
- `npm run test:e2e:open` - Start dev server and open Cypress

#### E2E Tests (Cypress Cloud)
- `npm run cypress:cloud` - Run tests and record to Cypress Cloud
- `npm run cypress:cloud:parallel` - Run tests in parallel on Cypress Cloud
- `npm run test:e2e:cloud` - Run full e2e suite with Cloud recording
- `npm run test:ci` - Full CI test suite (unit + e2e with recording)

#### Cross-Browser Testing
- `npm run cypress:run:chrome` - Run tests in Chrome
- `npm run cypress:run:firefox` - Run tests in Firefox
- `npm run cypress:run:edge` - Run tests in Edge
- `npm run test:all` - Run all tests (unit + e2e)

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix

### Mobile
- `npx cap sync` - Sync web assets with native projects
- `npx cap run ios` - Build and run on iOS
- `npx cap open ios` - Open iOS project in Xcode

## Architecture

### Technology Stack

- **React 19** - UI framework
- **Vite 7** - Build tool and dev server
- **Capacitor** - Native mobile app wrapper
- **SQLite** - Offline database storage
- **React Router** - Client-side routing
- **CSS3** - Responsive design
- **Vitest** - Testing framework

### Responsive Architecture

```
src/
├── components/              # Shared UI components
│   ├── Header.jsx
│   ├── LoginScreen.jsx
│   ├── LoadingScreen.jsx
│   ├── OfflineIndicator.jsx
│   ├── ResponsiveLayout.jsx
│   ├── SectionsList.jsx
│   ├── EventsList.jsx
│   ├── AttendanceView.jsx
│   └── desktop/            # Desktop-specific components
│       ├── DesktopHeader.jsx
│       └── DesktopSidebar.jsx
├── layouts/                # Layout components
│   ├── MobileLayout.jsx
│   └── DesktopLayout.jsx
├── hooks/                  # Custom React hooks
│   └── useAuth.js
├── pages/                  # Page components
│   └── Dashboard.jsx
├── services/               # Business logic
│   ├── api.js             # API layer with offline support
│   ├── auth.js            # Authentication
│   ├── database.js        # SQLite database service
│   └── sync.js            # Data synchronization
├── utils/                  # Utilities
│   └── platform.js        # Platform detection
├── test/                   # Test setup
│   └── setup.js
├── App.jsx                 # Main app component
└── main.jsx               # App entry point
```

### Platform Detection

The app automatically detects the platform and adjusts the UI:

- **Native Mobile** (Capacitor): Mobile layout + SQLite + offline features
- **Mobile Web** (< 768px): Mobile layout + localStorage fallback
- **Desktop Web** (≥ 768px): Desktop layout + sidebar + print features

### Offline Architecture

#### SQLite Database (Native Mobile)
- **Sections** - Scout sections and permissions
- **Events** - Event details and dates
- **Attendance** - Member attendance records
- **Sync Status** - Track synchronization state

#### API Layer with Smart Fallbacks
```javascript
// Automatic platform-aware data access
const sections = await getUserRoles(token);
// - Online: Fetch from server + save to local storage
// - Offline: Load from SQLite (native) or localStorage (web)
// - Error: Fallback to local storage
```

#### Network Detection & Auto-Sync
- **Network status monitoring** (native and web)
- **Automatic sync** when connection restored
- **Manual sync trigger** for users
- **Sync status indicators** in UI

## Authentication

OAuth2 flow with Online Scout Manager:

1. User clicks "Login with OSM"
2. Redirected to OSM OAuth authorization
3. Backend handles callback and token exchange
4. Token stored in sessionStorage
5. Automatic validation and user info retrieval

## API Integration

All requests go through the backend proxy:
- **Rate limiting protection** (100 req/min per user)
- **OSM API monitoring** to prevent blocking
- **Error handling** with user-friendly messages
- **Token validation** and refresh

## Data Flow

### Online Mode
```
User Action → API Call → Backend → OSM API → Response → Local Storage → UI Update
```

### Offline Mode
```
User Action → Local Database → UI Update
```

### Sync Process
```
Network Restored → Fetch Latest Data → Update Local Storage → Sync Status → UI Update
```

## Development

### Environment Variables

- `VITE_API_URL` - Backend API URL (default: production)

### Testing Strategy

#### Unit Tests (Vitest)
- **Component logic** and utilities
- **API layer** and database operations  
- **Platform detection** functionality
- **Offline/online** state management

#### End-to-End Tests (Cypress)
- **Complete user workflows** from login to attendance viewing
- **Responsive behavior** across different screen sizes
- **Offline functionality** and data caching
- **Authentication flows** and error handling
- **Cross-browser compatibility** testing

#### Test Categories
- **App Loading**: Initial state and performance
- **Authentication**: Login/logout flows and token management
- **Responsive Layout**: Mobile/desktop layout switching
- **Offline Functionality**: Network detection and data caching
- **User Workflows**: Complete feature interactions

#### Cypress Cloud Setup

1. **Create Cypress Cloud Account**:
   - Sign up at [cloud.cypress.io](https://cloud.cypress.io)
   - Create a new project for "Vikings Event Management"

2. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   Add your Cypress Cloud credentials:
   ```env
   CYPRESS_PROJECT_ID=your-project-id
   CYPRESS_RECORD_KEY=your-record-key
   ```

3. **GitHub Secrets** (for CI/CD):
   - Add `CYPRESS_PROJECT_ID` to GitHub repository secrets
   - Add `CYPRESS_RECORD_KEY` to GitHub repository secrets

4. **Run Cloud Tests**:
   ```bash
   npm run cypress:cloud              # Record test run
   npm run cypress:cloud:parallel     # Parallel execution
   npm run test:e2e:cloud            # Full suite with recording
   ```

#### CI/CD Pipeline

The project includes a complete GitHub Actions workflow:
- **Unit tests** on every push/PR
- **Build verification** 
- **Cross-browser e2e tests** with Cypress Cloud
- **Parallel test execution** for faster results
- **Mobile build testing** on macOS runners
- **Automatic deployment** on main branch

View test results, videos, and screenshots in the Cypress Cloud dashboard.

### Adding New Features

1. **Create platform-aware components**:
```javascript
import { isMobileLayout } from '../utils/platform.js';

function MyComponent() {
  const isMobile = isMobileLayout();
  return isMobile ? <MobileView /> : <DesktopView />;
}
```

2. **Add database support**:
```javascript
// Add to services/database.js
async saveMyData(data) {
  if (!this.isNative) {
    localStorage.setItem('my_data', JSON.stringify(data));
    return;
  }
  // SQLite implementation
}
```

3. **Update API layer**:
```javascript
// Add to services/api.js with offline fallback
export async function getMyData(token) {
  if (!isOnline) {
    return await databaseService.getMyData();
  }
  // Online implementation with caching
}
```

## Deployment

### Web Deployment
1. Build: `npm run build`
2. Deploy `dist/` folder to static hosting
3. Configure environment variables
4. Ensure HTTPS for OAuth

### Mobile Deployment
1. Build web assets: `npm run build`
2. Sync with Capacitor: `npx cap sync`
3. Open in Xcode: `npx cap open ios`
4. Configure code signing and provisioning
5. Build and archive for App Store

## Browser & Platform Support

### Web
- Modern desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive enhancement for older browsers

### Mobile
- iOS 12+ (native app)
- Android support (with `npx cap add android`)

## Contributing

1. Follow responsive design principles
2. Test on both desktop and mobile
3. Ensure offline functionality works
4. Write tests for new features
5. Update documentation

## Related Projects

- **VikingsEventMgmtAPI** - Node.js backend API proxy
- **patrolplanner** - Vue.js patrol planning tool

## License

This project is private and proprietary to Walton Vikings Scout Group.
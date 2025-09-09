# URL Routing Feature Flag

This document explains how to use the `VITE_USE_URL_ROUTING` feature flag to toggle between legacy state-based navigation and the new URL-based routing system.

## Overview

The Viking Event Management mobile app supports two navigation modes:

1. **Legacy Mode** (default): State-based navigation using React component state
2. **URL Routing Mode**: React Router v6 with URL-based navigation

## Feature Flag Configuration

### Environment Variable

The feature flag is controlled by the `VITE_USE_URL_ROUTING` environment variable in your `.env` file:

```bash
# Legacy navigation (default - safe for production)
VITE_USE_URL_ROUTING=false

# New URL routing (for testing and future rollout)
VITE_USE_URL_ROUTING=true
```

### Setting Up the Feature Flag

1. **For Local Development:**
   ```bash
   # Edit your .env file
   VITE_USE_URL_ROUTING=false  # or true to enable URL routing
   ```

2. **For New Developers:**
   - Copy `.env.example` to `.env`
   - The feature flag defaults to `false` (legacy mode)
   - Set to `true` only when testing the new routing system

3. **Environment Variable Access:**
   ```javascript
   // In code, the flag is accessed via:
   const useUrlRouting = import.meta.env.VITE_USE_URL_ROUTING === 'true';
   ```

## Navigation Modes

### Legacy Mode (`VITE_USE_URL_ROUTING=false`)

- **How it works**: Uses React component state (`currentView`) to manage navigation
- **Routes**: All routes render the same component with different views
- **URLs**: Static URLs like `/dashboard` always show the dashboard
- **Browser Integration**: Limited back/forward button support
- **Production Status**: ✅ **Safe for production use**

**Current Routes in Legacy Mode:**
- `/` → Dashboard view
- `/dashboard` → Dashboard view  
- `/clear` → Storage clearing utility

### URL Routing Mode (`VITE_USE_URL_ROUTING=true`)

- **How it works**: Uses React Router v6 for true URL-based navigation
- **Routes**: Each feature has its own URL route
- **URLs**: Bookmarkable URLs for each page/view
- **Browser Integration**: Full back/forward button support
- **Production Status**: 🚧 **Development/testing only**

**Planned Routes in URL Mode:**
- `/events` → Events dashboard (redirects from `/` and `/dashboard`)
- `/events/*` → Events sub-pages (to be implemented)
- `/sections` → Sections management (to be implemented)  
- `/movers` → Section movement tracker (to be implemented)
- `/clear` → Redirects to `/events`

## Developer Usage

### Switching Between Modes

1. **To Enable URL Routing:**
   ```bash
   # Update .env file
   VITE_USE_URL_ROUTING=true
   
   # Restart development server
   npm run dev
   ```

2. **To Return to Legacy Mode:**
   ```bash
   # Update .env file  
   VITE_USE_URL_ROUTING=false
   
   # Restart development server
   npm run dev
   ```

### Testing Both Modes

```bash
# Test legacy navigation
VITE_USE_URL_ROUTING=false npm run dev

# Test URL routing (in another terminal)  
VITE_USE_URL_ROUTING=true npm run dev
```

### Verification Steps

**Legacy Mode Verification:**
1. Navigate to `https://localhost:3001/`
2. Should see the standard dashboard interface
3. Navigation uses existing state-based system
4. URL remains static during navigation

**URL Routing Mode Verification:**
1. Navigate to `https://localhost:3001/`  
2. Should redirect to `/events`
3. Should see placeholder routing interface
4. Browser back/forward buttons should work
5. URLs should be bookmarkable

## Build and Deployment

### Build Testing

Always test builds with both routing modes:

```bash
# Test legacy build
VITE_USE_URL_ROUTING=false npm run build

# Test URL routing build  
VITE_USE_URL_ROUTING=true npm run build
```

### Production Deployment

**Current Recommendation:**
- **Production**: Use `VITE_USE_URL_ROUTING=false` (legacy mode)
- **Staging**: Test both modes
- **Development**: Use either mode for testing

**Future Migration:**
Once URL routing is fully implemented, production will migrate to `VITE_USE_URL_ROUTING=true`.

## Architecture Details

### Component Structure

```
src/
├── App.jsx                 # Main app entry point
├── routes/
│   ├── AppRouter.jsx      # Conditional routing logic
│   └── LegacyApp.jsx      # Preserved legacy navigation
└── ...
```

### How It Works

1. **App.jsx** imports and renders `AppRouter`
2. **AppRouter.jsx** checks `import.meta.env.VITE_USE_URL_ROUTING`
3. If `false`: Renders `LegacyApp` (existing functionality)
4. If `true`: Renders `BrowserRouter` with new routes

### Code Implementation

```javascript
// AppRouter.jsx
const USE_URL_ROUTING = import.meta.env.VITE_USE_URL_ROUTING === 'true';

function AppRouter() {
  if (!USE_URL_ROUTING) {
    return <LegacyApp />; // Existing state-based navigation
  }
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/events/*" element={<EventsRouter />} />
        <Route path="/sections" element={<SectionsPage />} />
        <Route path="/movers" element={<MoversPage />} />
        {/* ... */}
      </Routes>
    </BrowserRouter>
  );
}
```

## Troubleshooting

### Common Issues

**1. Feature Flag Not Working**
- Ensure you restart the dev server after changing `.env`
- Check that the variable is correctly named `VITE_USE_URL_ROUTING`
- Verify the value is exactly `'true'` or `'false'` (string values)

**2. Build Errors**
- Both routing modes should build without errors
- If URL routing build fails, check for missing route components
- Ensure all imports in `AppRouter.jsx` are available

**3. Runtime Errors**  
- Legacy mode should work identically to the original app
- URL routing mode may show placeholder content (expected during development)

### Debug Commands

```bash
# Check current feature flag value
grep VITE_USE_URL_ROUTING .env

# Verify environment variable in build
npm run build && grep -r "VITE_USE_URL_ROUTING" dist/ || echo "Not found in build"

# Check for compilation errors
npm run build 2>&1 | grep -i error
```

## Migration Timeline

### Phase 1: ✅ **Foundation** (Current)
- Feature flag implemented
- Conditional routing system active  
- Legacy mode preserved

### Phase 2: 🚧 **Page Migration** (In Progress)
- Movers page → `/movers`
- Sections page → `/sections` 
- Events sub-pages → `/events/*`

### Phase 3: 📅 **Future**  
- Full URL routing implementation
- Production migration
- Legacy mode deprecation

## Support

For questions about the routing feature flag:
1. Check this documentation
2. Review the implementation in `src/routes/AppRouter.jsx`
3. Test both modes locally before making changes
4. Ensure builds succeed for both routing modes

---

**⚠️ Important**: Always test both routing modes when making navigation-related changes to ensure compatibility during the migration period.
# Mobile Development Setup Guide

This guide covers the Capacitor configuration and mobile development workflow for the Vikings Event Management React mobile app.

## 📱 Current Capacitor Setup Status

### ✅ **Implemented & Working**

#### Core Configuration
- **Capacitor Version**: 7.4.0
- **App ID**: `com.vikings.eventmgmt`
- **App Name**: Vikings Event Mgmt
- **Config File**: `capacitor.config.json`

#### Installed Plugins
- `@capacitor/core` (v7.4.0) - Core functionality
- `@capacitor/cli` (v7.4.0) - CLI tools
- `@capacitor/ios` (v7.4.0) - iOS platform
- `@capacitor/network` (v7.0.1) - Network monitoring
- `@capacitor-community/sqlite` (v7.0.0) - Database support

#### Platform Support
- **iOS**: ✅ Fully configured with Xcode project
- **Android**: ❌ Missing (needs setup)

#### Mobile Features
- **Offline Database**: SQLite with localStorage fallback
- **Network Detection**: Real-time online/offline monitoring
- **Platform Detection**: Mobile vs web responsive layouts
- **Background Sync**: Auto-sync when network returns
- **Responsive Design**: Mobile-first with platform awareness

### ❌ **Missing Components**

1. **Android Platform** - No Android project exists
2. **Standard Capacitor Scripts** - Missing development commands
3. **Essential Mobile Plugins** - App lifecycle, splash screen, status bar
4. **Mobile Testing** - No device-specific test configurations

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- iOS development: Xcode 14+ (macOS only)
- Android development: Android Studio + SDK

### Development Commands

```bash
# Web development
npm run dev              # Start web dev server

# Mobile development (after setup)
npm run cap:ios          # Run on iOS simulator
npm run cap:android      # Run on Android emulator
npm run cap:sync         # Sync web build to native platforms
```

## 📋 Complete Setup Instructions

### 1. Install Missing Capacitor Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "cap:ios": "cap run ios",
    "cap:ios:dev": "cap run ios --livereload --external",
    "cap:android": "cap run android",
    "cap:android:dev": "cap run android --livereload --external",
    "cap:sync": "cap sync",
    "cap:sync:ios": "cap sync ios",
    "cap:sync:android": "cap sync android",
    "cap:copy": "cap copy",
    "cap:open:ios": "cap open ios",
    "cap:open:android": "cap open android",
    "cap:build:ios": "npm run build && cap sync ios && cap open ios",
    "cap:build:android": "npm run build && cap sync android && cap open android"
  }
}
```

### 2. Add Android Platform

```bash
# Add Android platform
npx cap add android

# Sync current build
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android
```

### 3. Install Essential Mobile Plugins

```bash
# Core mobile functionality
npm install @capacitor/app @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard

# Optional but recommended
npm install @capacitor/device @capacitor/haptics @capacitor/share @capacitor/preferences

# Sync to native platforms
npx cap sync
```

### 4. Configure Plugins

Update `src/main.jsx` to initialize mobile plugins:

```javascript
// Add mobile plugin imports
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

// Initialize mobile features
if (isPlatform('mobile')) {
  // Configure status bar
  StatusBar.setStyle({ style: Style.Default });
  
  // Hide splash screen when app is ready
  SplashScreen.hide();
  
  // Handle app lifecycle
  App.addListener('appStateChange', ({ isActive }) => {
    console.log('App state changed. Is active?', isActive);
  });
}
```

## 🏗️ Project Structure

```
vikings-eventmgmt-mobile/
├── src/
│   ├── services/
│   │   ├── database.js      # SQLite integration
│   │   ├── sync.js          # Background sync
│   │   └── api.js           # API with offline support
│   ├── utils/
│   │   └── platform.js      # Platform detection
│   ├── components/
│   │   └── OfflineIndicator.jsx  # Network status
│   └── layouts/             # Responsive layouts
├── ios/                     # iOS native project
├── android/                 # Android native project (after setup)
├── capacitor.config.json    # Capacitor configuration
└── docs/
    └── MOBILE_SETUP.md      # This file
```

## 🧪 Mobile Testing Strategy

### Unit & Component Tests
- **Current**: Vitest + React Testing Library
- **Mobile-Specific**: Test platform detection and mobile components
- **Database**: Test SQLite fallbacks and sync logic

### E2E Tests
- **Browser Testing**: Cypress with mobile viewport simulation
- **Device Testing**: Test on actual devices/emulators
- **Offline Testing**: Network simulation and offline scenarios

### Manual Testing Checklist
- [ ] iOS simulator functionality
- [ ] Android emulator functionality
- [ ] Offline/online transitions
- [ ] Database persistence
- [ ] Background sync
- [ ] Platform-specific layouts

## 📦 Build & Deployment

### iOS Deployment

```bash
# Build and sync
npm run build
npx cap sync ios

# Open Xcode for signing and deployment
npx cap open ios

# In Xcode:
# 1. Configure signing & capabilities
# 2. Set deployment target
# 3. Archive for App Store or TestFlight
```

### Android Deployment

```bash
# Build and sync
npm run build
npx cap sync android

# Open Android Studio
npx cap open android

# In Android Studio:
# 1. Generate signed APK/AAB
# 2. Configure Play Store upload
# 3. Handle permissions and security
```

## 🔧 Configuration Files

### capacitor.config.json
```json
{
  "appId": "com.vikings.eventmgmt",
  "appName": "Vikings Event Mgmt",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#0066cc",
      "showSpinner": false
    },
    "StatusBar": {
      "style": "default",
      "backgroundColor": "#0066cc"
    }
  }
}
```

## 🐛 Troubleshooting

### Common Issues

**iOS Build Fails**:
- Run `cd ios && pod install` to update CocoaPods
- Check Xcode version compatibility
- Verify iOS deployment target

**Android Build Fails**:
- Ensure Android SDK is properly installed
- Check Gradle version compatibility
- Verify Android API level targets

**SQLite Issues**:
- Check platform detection in database service
- Verify plugin installation and sync
- Test localStorage fallback

**Network Detection**:
- Ensure `@capacitor/network` plugin is synced
- Check browser compatibility for web version
- Test on actual devices vs simulators

### Debug Commands

```bash
# Check Capacitor setup
npx cap doctor

# View installed plugins
npx cap ls

# Sync and check for issues
npx cap sync --verbose

# Open native IDEs
npx cap open ios     # Xcode
npx cap open android # Android Studio
```

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Deployment Guide](https://capacitorjs.com/docs/ios/deploying-to-app-store)
- [Android Deployment Guide](https://capacitorjs.com/docs/android/deploying-to-google-play)
- [Capacitor Plugin Registry](https://capacitorjs.com/docs/plugins)

## 🎯 Next Steps

1. **Complete Android Setup** - Add Android platform and test
2. **Plugin Enhancement** - Install and configure essential mobile plugins
3. **Testing Strategy** - Implement mobile-specific testing
4. **CI/CD Integration** - Add mobile builds to deployment pipeline
5. **App Store Preparation** - Configure signing, metadata, and submission
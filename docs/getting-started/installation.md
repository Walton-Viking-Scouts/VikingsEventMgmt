---
title: "Installation & Setup Guide"
description: "Complete development environment setup for Vikings Event Management"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["installation", "setup", "development", "environment"]
related_docs: ["development-workflow.md", "mobile-setup.md"]
---

# Installation & Setup Guide

Complete guide for setting up the Vikings Event Management development environment.

## 📋 Prerequisites

### Required Software
- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **npm** 8.0.0 or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

### Optional but Recommended
- **VS Code** with recommended extensions
- **Chrome/Firefox** for development and testing
- **Xcode** (macOS only, for iOS development)
- **Android Studio** (for Android development)

### System Requirements
- **macOS**: 10.15+ (for iOS development)
- **Windows**: 10+ with WSL2 recommended
- **Linux**: Ubuntu 18.04+ or equivalent

## 🚀 Quick Setup

### 1. Clone Repository
```bash
git clone https://github.com/Walton-Viking-Scouts/VikingsEventMgmt.git
cd VikingsEventMgmt
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
# Add your OSM API credentials and other configuration
```

### 4. Start Development Server
```bash
npm run dev
```

The application will be available at `https://localhost:3001`

### 5. Verify Installation
```bash
# Run tests
npm run test:run

# Check linting
npm run lint

# Verify build
npm run build
```

## 🔧 Detailed Setup

### Environment Variables
Create `.env.local` with the following variables:

```bash
# OSM API Configuration
VITE_OSM_API_BASE_URL=https://www.onlinescoutmanager.co.uk
VITE_OSM_CLIENT_ID=your_client_id
VITE_OSM_CLIENT_SECRET=your_client_secret

# Application Configuration
VITE_APP_NAME="Vikings Event Management"
VITE_APP_VERSION=1.1.0

# Development Configuration
VITE_DEBUG_MODE=true
VITE_ENABLE_STORYBOOK=true

# Sentry Configuration (optional)
VITE_SENTRY_DSN=your_sentry_dsn
VITE_SENTRY_ENVIRONMENT=development
```

### VS Code Setup
Install recommended extensions:
```bash
# Install VS Code extensions
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension ms-vscode.vscode-typescript-next
```

Recommended VS Code settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## 📱 Mobile Development Setup

### For iOS Development (macOS only)
```bash
# Install Xcode from App Store
# Install iOS Simulator

# Add iOS platform
npx cap add ios

# Sync and open in Xcode
npx cap sync ios
npx cap open ios
```

### For Android Development
```bash
# Install Android Studio
# Configure Android SDK

# Add Android platform
npx cap add android

# Sync and open in Android Studio
npx cap sync android
npx cap open android
```

See [Mobile Setup Guide](mobile-setup.md) for detailed mobile configuration.

## 🧪 Development Tools

### Storybook
```bash
# Start Storybook for component development
npm run storybook
```

### Testing
```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests (if configured)
npm run test:e2e
```

### Linting and Formatting
```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## 🔍 Troubleshooting

### Common Issues

#### Node.js Version Issues
```bash
# Check Node.js version
node --version

# Use nvm to manage Node.js versions
nvm install 18
nvm use 18
```

#### Port Already in Use
```bash
# Kill process using port 3001
npx kill-port 3001

# Or use different port
npm run dev -- --port 3002
```

#### SSL Certificate Issues
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Permission Issues (macOS/Linux)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Getting Help
- **Documentation**: Check [troubleshooting guide](../user-guides/troubleshooting.md)
- **Issues**: Search [GitHub Issues](https://github.com/Walton-Viking-Scouts/VikingsEventMgmt/issues)
- **Development**: See [development documentation](../development/)

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Development server starts without errors
- [ ] Application loads at `https://localhost:3001`
- [ ] Tests pass (`npm run test:run`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Storybook starts (`npm run storybook`)
- [ ] Environment variables are configured
- [ ] VS Code extensions are installed

## 🚀 Next Steps

Once installation is complete:
1. Review [Development Workflow](development-workflow.md)
2. Explore [System Architecture](../architecture/system-design.md)
3. Check out [Feature Documentation](../features/)
4. Set up [Mobile Development](mobile-setup.md) if needed

---

*For mobile-specific setup instructions, see the [Mobile Setup Guide](mobile-setup.md).*
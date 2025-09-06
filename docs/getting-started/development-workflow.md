---
title: "Development Workflow"
description: "Development processes, commands, and best practices for Vikings Event Management"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["development", "workflow", "process", "commands"]
related_docs: ["installation.md", "../development/testing-strategy.md", "../development/release-process.md"]
---

# Development Workflow

This guide outlines the development processes, commands, and best practices for working on the Vikings Event Management application.

## 🔄 Development Cycle

### Daily Development Workflow
```bash
# 1. Start development session
git checkout main
git pull origin main
npm run dev

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Develop with live reload
# Edit files, see changes at https://localhost:3001

# 4. Test your changes
npm run lint
npm run test:run
npm run build

# 5. Commit and push
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name

# 6. Create pull request
# Use GitHub UI or gh CLI
```

## 📦 Available Commands

### Development Commands
```bash
# Start development server with HTTPS
npm run dev                 # https://localhost:3001

# Build for production
npm run build

# Preview production build
npm run preview             # http://localhost:3001
```

### Testing Commands
```bash
# Run all unit tests once
npm run test:run

# Run tests in watch mode (development)
npm run test

# Run tests with UI
npm run test:ui

# Run E2E tests
npm run test:e2e

# Run E2E tests with different browsers
npm run test:e2e:chrome
npm run cypress:run:firefox
npm run cypress:run:edge

# Run all tests (unit + E2E)
npm run test:all

# Run CI test suite (includes cloud recording)
npm run test:ci
```

### Code Quality Commands
```bash
# Check linting issues
npm run lint

# Fix auto-fixable linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without fixing
npm run format:check
```

### Mobile Development Commands
```bash
# Sync changes to native platforms
npx cap sync

# Open in iOS Simulator (macOS only)
npx cap run ios

# Open in Android emulator
npx cap run android

# Open projects in native IDEs
npx cap open ios
npx cap open android
```

## 🏗️ Project Structure

### Key Directories
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components
│   ├── notifications/  # Notification system
│   └── forms/          # Form components
├── contexts/           # React contexts
├── hooks/              # Custom React hooks
├── pages/              # Route components
├── services/           # API and external services
├── stores/             # State management
├── styles/             # Global styles and themes
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── stories/            # Storybook stories
```

### Configuration Files
```
.env.local              # Environment variables
.env.example           # Environment template
vite.config.ts         # Vite configuration
tailwind.config.js     # TailwindCSS configuration
capacitor.config.ts    # Capacitor configuration
vitest.config.ts       # Testing configuration
.eslintrc.js           # ESLint configuration
```

## 🎯 Development Best Practices

### Code Style
- **Functional Components**: Use hooks-only functional components
- **TypeScript**: Strict typing, no `any` types
- **Props Interface**: Define props interface above component
- **Export Default**: Export default at bottom of file
- **No Comments**: Avoid comments unless explicitly needed

### Component Development
```tsx
// ✅ Good component structure
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

const Button = ({ variant = 'primary', children, onClick }: ButtonProps) => {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
```

### Testing Approach
- **Unit Tests**: Test component logic and behavior
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Accessibility Tests**: Ensure WCAG compliance

### Git Workflow
```bash
# Feature branch naming
feature/notification-system
feature/offline-sync
fix/authentication-bug
chore/update-dependencies

# Commit message format
feat: add toast notification system
fix: resolve offline sync issue
chore: update React to v19
docs: update API documentation
```

## 🔧 Development Environment

### Required Tools
- **Node.js 18+**: JavaScript runtime
- **npm**: Package manager
- **Git**: Version control
- **VS Code**: Recommended editor

### Recommended VS Code Extensions
- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **ESLint**
- **Prettier**
- **TypeScript Importer**

### Browser DevTools
- **React Developer Tools**: Component debugging
- **Redux DevTools**: State management debugging
- **Lighthouse**: Performance auditing
- **Accessibility Insights**: Accessibility testing

## 📱 Mobile Development Workflow

### Testing on Devices
```bash
# iOS Simulator
npx cap run ios

# Android Emulator  
npx cap run android

# Physical device (after USB debugging enabled)
npx cap run ios --target="Your iPhone"
npx cap run android --target="device-id"
```

### Debugging Mobile Issues
- **Safari Web Inspector**: iOS debugging
- **Chrome DevTools**: Android debugging
- **Capacitor Live Reload**: Real-time updates
- **Native Logs**: Xcode/Android Studio console

## 🚀 Performance Optimization

### Development Performance
```bash
# Analyze bundle size
npm run build
npm run analyze

# Check for unused dependencies
npx depcheck

# Update dependencies
npm update
npm audit fix
```

### Runtime Performance
- **React DevTools Profiler**: Component performance
- **Lighthouse**: Web vitals and performance metrics
- **Network Tab**: API call optimization
- **Memory Tab**: Memory leak detection

## 🐛 Debugging Workflow

### Common Debug Commands
```bash
# Debug with verbose logging
DEBUG=* npm run dev

# Debug specific module
DEBUG=api:* npm run dev

# Debug tests
npm run test -- --verbose

# Debug build issues
npm run build -- --debug
```

### Error Tracking
- **Sentry**: Production error monitoring
- **Console Logs**: Development debugging
- **React Error Boundaries**: Component error handling
- **Network Monitoring**: API error tracking

## 📋 Pre-commit Checklist

Before committing code:
- [ ] Tests pass (`npm run test:run`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Changes tested manually
- [ ] Commit message follows convention
- [ ] No sensitive data in commit

## 🔄 Continuous Integration

### GitHub Actions
The project uses GitHub Actions for:
- **Automated Testing**: Run tests on every PR
- **Code Quality**: ESLint and type checking
- **Build Verification**: Ensure builds succeed
- **Deployment**: Automatic deployment to production

### Local CI Simulation
```bash
# Run the same checks as CI
npm run lint && npm run test:run && npm run build
```

## 📚 Additional Resources

- [Testing Strategy](../development/testing-strategy.md)
- [Release Process](../development/release-process.md)
- [Architecture Documentation](../architecture/)
- [Feature Guides](../features/)
- [Troubleshooting](../user-guides/troubleshooting.md)

---

*For detailed setup instructions, see the [Installation Guide](installation.md).*
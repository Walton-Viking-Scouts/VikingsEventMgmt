# CLAUDE.md - Frontend (Mobile App)

**Import shared workflow and use mobile app-specific development patterns.**
@../CLAUDE_SHARED.md

## Development Workflow

### Local Development & Testing
**Before committing any code, ALWAYS run:**

```bash
npm run lint            # Fix linting issues
npm run test:run        # Run all unit tests with Vitest
npm run build           # Ensure build succeeds
# Optional but recommended for mobile features:
npx cap sync            # Sync changes to native platforms
```

### Release Management - ENHANCED WORKFLOW

**IMPORTANT: Version management has been enhanced to solve Sentry source map timing issues.**

#### **New Release-Triggered Deployment:**

The deployment system now uses **GitHub Actions-controlled releases** instead of auto-deploy to ensure version synchronization:

```bash
# 1. Feature Development (NO version bump needed)
git checkout -b feature/awesome-feature
# ... develop and test ...
npm run lint && npm run test:run && npm run build
# NOTE: Do NOT bump version in package.json during development

# 2. PR Review & Merge to Main  
# Create PR → CodeRabbit Review → Address Feedback → Merge
# NOTE: No auto-deployment occurs after merge - production remains stable

# 3. Post-Merge Release Process (AUTOMATIC)
git checkout main && git pull origin main  # Simply sync with merged changes
# 🚀 GitHub Actions automatically handles the rest:
# ✅ Auto-detects PR content and bumps version appropriately
# ✅ Creates version tag (e.g., v1.2.2) automatically
# ✅ Builds application with correct version
# ✅ Uploads source maps to Sentry BEFORE deployment
# ✅ Deploys to Render.com immediately after merge
# ✅ Creates GitHub release with deployment status
# ✅ All happens atomically - no manual intervention needed

# 4. Monitor Deployment Success
# - GitHub Actions shows real-time deployment status
# - Sentry gets correct version with source maps immediately
# - Production errors show proper stack traces, not "t is not a function"
```

#### **Version Bump Rules:**
- **Bug fixes** → Create release with **patch version** (v1.0.1)
- **New features** → Create release with **minor version** (v1.1.0)
- **Breaking changes** → Create release with **major version** (v2.0.0)

#### **Benefits of New Workflow:**
- ✅ **Version Synchronization**: Package.json version always matches deployed code
- ✅ **Sentry Accuracy**: Source maps uploaded before deployment
- ✅ **No Auto-Deploy Issues**: Controlled releases prevent accidental deployments
- ✅ **Atomic Operations**: Version + build + source maps + deploy all together
- ✅ **Better Debugging**: Immediate proper stack traces in Sentry

### Testing Requirements

**All code changes must pass:**
- **Unit tests** - All existing tests must pass (`npm run test:run`)
- **Linting** - Code must pass ESLint checks (`npm run lint`)
- **Build verification** - Code must build successfully (`npm run build`)
- **Manual testing** - Basic functionality verification

## Quick Reference

### Development Commands
```bash
# Mobile App Development
npm run dev              # Start dev server (https://localhost:3001)
npm run lint            # ESLint checks
npm run test:run        # Unit tests
npm run build           # Production build
npx cap sync            # Sync to native platforms

# Post-Merge Process (AUTOMATIC)
git checkout main && git pull origin main  # Just sync with merged PR
# GitHub Actions handles versioning, tagging, and deployment automatically
```

## Code Style Standards

### JavaScript/React
- Functional components with hooks only
- Props interface above component
- Export default at bottom
- **DO NOT ADD COMMENTS** unless explicitly requested

### Development Principles
- **Offline-First**: All functionality must work without internet
- **Mobile-Optimized**: Touch-first interactions and responsive design
- **Rate-Limit Aware**: Respect OSM API limits to prevent blocking
- **Error Resilient**: Graceful degradation when services unavailable

## Documentation

### System Overview & Architecture
- **[System Overview](docs/SYSTEM_OVERVIEW.md)** - Main entry point and quick reference
- **[Architecture Documentation](docs/architecture/)** - Detailed technical architecture

### Development & Setup Guides
- **[Mobile Setup](docs/MOBILE_SETUP.md)** - Capacitor configuration for iOS/Android
- **[Testing Strategy](docs/MOBILE_TESTING_STRATEGY.md)** - Testing framework and strategy
- **[Database Schema](docs/DATABASE_SCHEMA.md)** - SQLite schema reference

### Production Support
- **[Caching Error Handling](docs/CACHING_ERROR_HANDLING.md)** - Production debugging patterns

### External Repository
- **[Backend Documentation](https://github.com/Walton-Viking-Scouts/VikingsEventMgmtAPI/blob/main/CLAUDE.md)** - Node.js Express server documentation

---

**For detailed technical architecture, system design, and comprehensive documentation, see the `docs/` directory.**
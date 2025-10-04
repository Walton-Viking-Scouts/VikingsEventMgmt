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

# 3. Post-Merge Release Process (REQUIRES MANUAL SYNC)
git checkout main && git pull origin main  # Simply sync with merged changes
# 🚀 GitHub Actions automatically handles the rest:
# ✅ Auto-detects PR content and bumps version appropriately
# ✅ Creates version tag (e.g., v1.2.2) automatically
# ✅ Builds application with correct version
# ✅ Uploads source maps to Sentry BEFORE deployment
# ✅ Deploys to Render.com immediately after merge
# ✅ Creates GitHub release with deployment status
# ✅ All happens atomically - no manual intervention needed

# 📦 IMPORTANT: Sync local version after PR merge
# Use Claude Code command: /merged
# Or run manually: npm version $(git describe --tags --abbrev=0 | sed 's/v//') --no-git-tag-version

# 4. Monitor Deployment Success
# - GitHub Actions shows real-time deployment status
# - Sentry gets correct version with source maps immediately
# - Production errors show proper stack traces, not "t is not a function"
```

#### **Version Bump Rules:**
- **Bug fixes** → Create release with **patch version** (v1.0.1)
- **New features** → Create release with **minor version** (v1.1.0) - **Requires "feature:" or "feat:" in PR title**
- **Breaking changes** → Create release with **major version** (v2.0.0) - **Requires "BREAKING CHANGE" or "[major]" in PR title**

#### **PR Title Conventions for Automatic Version Detection:**
- `feat: add new dashboard widget` → **minor version bump**
- `feature: redesign user interface` → **minor version bump**  
- `fix: resolve authentication bug` → **patch version bump**
- `BREAKING CHANGE: remove legacy API` → **major version bump**
- `chore: update dependencies` → **patch version bump** (default)
- `Add new feature [minor]` → **minor version bump** (explicit tag)
- `Critical fix [patch]` → **patch version bump** (explicit tag)

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

### CodeRabbit Review Workflow

**CRITICAL: When using `/coderabbit` command, follow this EXACT workflow:**

1. **Fetch and categorize** all CodeRabbit comments:
   - 🔴 **Actionable** (security, bugs, breaking changes, CI failures) - MUST fix
   - 🟡 **Nitpicks** (style, documentation, best practices) - ASK USER FIRST

2. **Implement actionable fixes** immediately:
   - Fix all security vulnerabilities, bugs, and CI failures
   - Run quality checks: `npm run lint && npm run test:run && npm run build`
   - **DO NOT COMMIT OR PUSH YET** - keep changes staged only

3. **Ask user about nitpicks**:
   - Present categorized list of optional improvements
   - Get explicit approval before proceeding
   - User may say "yes", "no", or "only specific categories"

4. **If nitpicks approved**, implement them:
   - Make all requested nitpick changes
   - Run quality checks again: `npm run lint && npm run test:run && npm run build`
   - **STILL DO NOT COMMIT OR PUSH**

5. **Single comprehensive commit** with ALL changes:
   ```bash
   git add -A
   git commit
   ```

   Use this commit message template in your editor:
   ```
   fix: address CodeRabbit feedback - [category]

   Actionable Fixes:
   - [list actionable fixes]

   Code Quality (if nitpicks approved):
   - [list nitpick improvements]

   Quality checks passed:
   - Lint: ✅ [status]
   - Tests: ✅ [status]
   - Build: ✅ [status]

   Addresses CodeRabbit feedback from PR #XXX

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

6. **Push once** after single commit:
   ```bash
   git push origin feature/branch-name
   ```

**NEVER:**
- ❌ Commit actionable fixes separately from nitpicks
- ❌ Push before getting user approval on nitpicks
- ❌ Create multiple commits for CodeRabbit feedback
- ❌ Skip asking about nitpicks (always present options to user)

## Quick Reference

### Development Commands
```bash
# Mobile App Development
# *** DO NOT RUN DEV SERVER IN BACKGROUND DURING CLAUDE SESSIONS ***
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

### 📚 Complete Documentation
- **[Documentation Hub](docs/)** - Comprehensive documentation portal
- **[Getting Started](docs/getting-started/)** - Setup and development guides
- **[Architecture](docs/architecture/)** - Technical architecture and system design
- **[Features](docs/features/)** - Feature-specific implementation guides

### 🚀 Quick Links
- **[Installation Guide](docs/getting-started/installation.md)** - Complete development setup
- **[Development Workflow](docs/getting-started/development-workflow.md)** - Development processes
- **[Mobile Setup](docs/getting-started/mobile-setup.md)** - Capacitor configuration
- **[Testing Strategy](docs/development/testing-strategy.md)** - Testing framework and strategy
- **[Database Schema](docs/reference/database-schema.md)** - SQLite schema reference

### 🔧 Development Support
- **[Debugging Guides](docs/development/debugging/)** - Error tracking and troubleshooting
- **[Release Process](docs/development/release-process.md)** - Release and deployment workflow
- **[Contributing Guidelines](docs/development/contributing.md)** - How to contribute

### External Repository
- **[Backend Documentation](https://github.com/Walton-Viking-Scouts/VikingsEventMgmtAPI/blob/main/CLAUDE.md)** - Node.js Express server documentation

---

**📍 Start Here**: [Documentation Overview](docs/README.md) for complete technical architecture, system design, and comprehensive documentation.

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

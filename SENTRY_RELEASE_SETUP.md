# Sentry Release Management Setup

This document explains how to set up and use Sentry releases for version tracking and automatic issue resolution.

## 🚀 **Quick Start**

### **Create a Release**
```bash
# Patch release (1.0.0 → 1.0.1)
./scripts/release.sh patch

# Minor release (1.0.1 → 1.1.0) 
./scripts/release.sh minor

# Major release (1.1.0 → 2.0.0)
./scripts/release.sh major
```

### **Manual Release Process**
```bash
# 1. Bump version
npm run version:patch

# 2. Build and upload to Sentry
npm run build:release

# 3. Commit and tag
git add package.json package-lock.json
git commit -m "chore: bump version to v$(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"

# 4. Push
git push origin main --tags
```

## 🔧 **Environment Setup**

### **Required Environment Variables**

#### **Local Development (.env.local):**
```bash
VITE_SENTRY_DSN=your_frontend_sentry_dsn
```

#### **CI/CD (GitHub Actions):**
```bash
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

### **Sentry Configuration File (.sentryclirc)**
```ini
[defaults]
org=walton-vikings
project=viking-event-mgmt

[auth]
token=your_sentry_auth_token
```

**⚠️ Important:** Add your Sentry auth token to `.sentryclirc` for local releases.

## 📊 **How Issue Resolution Works**

### **Automatic Resolution**
When you create a new release, Sentry automatically:

1. **Marks issues as resolved** if they haven't occurred since the previous release
2. **Creates release notes** showing which issues were resolved
3. **Tracks new issues** that appear after the release
4. **Links commits** to the release for better debugging

### **Example Resolution Flow**
```
v1.0.0 → v1.0.1
├── VIKING-EVENT-MGMT-1J (Authentication failed) - ✅ Resolved 
├── VIKING-EVENT-MGMT-15 (SignInOutButton undefined) - ✅ Resolved
└── New issues in v1.0.1 will be tracked separately
```

## 🔗 **Benefits of Release Tracking**

### **Issue Management**
- **Automatic resolution** when bugs are fixed
- **Clear timeline** of when issues started/stopped
- **Release impact analysis** - see what broke/fixed

### **Performance Monitoring**  
- **Performance regression detection** between releases
- **Release health scoring** based on error rates
- **User impact tracking** per release

### **Debugging**
- **Source map uploads** for accurate stack traces
- **Commit linking** to see exact changes
- **Deploy tracking** for production correlation

## 📋 **Available Scripts**

### **Version Management**
```bash
npm run version:patch   # Bump patch version
npm run version:minor   # Bump minor version  
npm run version:major   # Bump major version
```

### **Release Creation**
```bash
npm run release:create    # Create new Sentry release
npm run release:finalize  # Finalize release (marks as complete)
npm run release:deploy    # Mark production deployment (uses --env production)
```

### **Environment-Specific Deployments**
```bash
# Production deployment (default in package.json)
npm run release:deploy

# Manual staging deployment
npx @sentry/cli releases deploys vikings-eventmgmt-mobile@$npm_package_version new --env staging

# Manual production deployment (explicit)
npx @sentry/cli releases deploys vikings-eventmgmt-mobile@$npm_package_version new --env production

# Using environment variable for CI/CD
SENTRY_ENVIRONMENT=staging npx @sentry/cli releases deploys vikings-eventmgmt-mobile@$npm_package_version new --env $SENTRY_ENVIRONMENT
```

### **Source Maps**
```bash
npm run sentry:sourcemaps # Upload source maps to Sentry
```

### **Complete Release**
```bash
npm run build:release     # Build + upload + create release
```

## 🎯 **Best Practices**

### **When to Create Releases**
- **Every production deployment**
- **After fixing critical Sentry issues**
- **Before major feature launches**
- **Weekly/bi-weekly for regular iterations**

### **Version Numbering**
- **Patch (x.x.X)**: Bug fixes, small improvements
- **Minor (x.X.x)**: New features, non-breaking changes  
- **Major (X.x.x)**: Breaking changes, major overhauls

### **Release Notes**
Include in commit messages:
- **Fixed Sentry issues**: `Fixes VIKING-EVENT-MGMT-1J`
- **Resolved GitHub issues**: `Closes #44`
- **Performance improvements**: Note significant changes

## 🔍 **Monitoring Releases**

### **Sentry Release Dashboard**
View releases at: https://walton-vikings.de.sentry.io/releases/

### **Key Metrics to Watch**
- **Crash-free rate**: Should be >99%
- **Error count**: Compare to previous releases
- **Performance**: Response times, load times
- **Adoption rate**: How quickly users update

### **Issue Resolution Verification**
After each release:
1. Check that expected issues are marked as resolved
2. Monitor for new issues introduced
3. Verify performance hasn't regressed
4. Confirm source maps are working (readable stack traces)

## 🚨 **Troubleshooting**

### **Source Maps Not Uploading**
```bash
# Check Sentry auth
npx @sentry/cli info

# Manual upload
npx @sentry/cli sourcemaps upload ./dist --release vikings-eventmgmt-mobile@$(node -p "require('./package.json').version")
```

### **Release Creation Failing**
```bash
# Check organization/project settings
npx @sentry/cli organizations list
npx @sentry/cli projects list
```

### **Issues Not Auto-Resolving**
- Ensure release is properly finalized
- Check that the release version matches your app's reported version
- Verify the issue occurred before the release was created

## 🔗 **Related Documentation**
- [Sentry Releases Documentation](https://docs.sentry.io/platforms/javascript/configuration/releases/)
- [GitHub Actions Integration](../.github/workflows/release.yml)
- [Issue Tracking Setup](./ISSUE_TRACKING.md)
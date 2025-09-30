---
title: "Deployment Architecture"
description: "Automated deployment pipeline with release management and monitoring integration"
created: "2025-09-06"
last_updated: "2025-09-30"
version: "1.0.0"
tags: ["architecture", "deployment", "ci-cd", "releases"]
related_docs: ["system-design.md"]
---

# Deployment Architecture
**Dual Auto-Deploy System with Release Management**

## Purpose
Automated deployment pipeline that provides fast iteration cycles while maintaining proper release management and monitoring integration.

## Deployment Infrastructure

### Dual Deployment Strategy
```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│                     (Source Code + CI/CD)                      │
└─────────────────────────────────────────────────────────────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
                 ▼                ▼                ▼
┌─────────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Render.com       │  │  GitHub Actions │  │    Code.run     │
│  (Frontend Auto)    │  │  (Tag Releases) │  │ (Backend Auto)  │
│                     │  │                 │  │                 │
│ ✅ PR Merge → Deploy│  │ ✅ Tag → Release│  │ ✅ PR → Deploy  │
│ ⚡ Fast (2-3 min)   │  │ 📊 Sentry Maps  │  │ ⚡ Fast (1-2m)  │
└─────────────────────┘  └─────────────────┘  └─────────────────┘
```

### Environment Configuration

#### Frontend (Render.com)
```javascript
// Environment Variables
VITE_API_URL=https://site--vikings-event-management--ytnrhtcfzsqn.code.run
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_APP_VERSION=1.1.0

// Build Configuration
NODE_ENV=production
SENTRY_AUTH_TOKEN=sntryu_... // For source map uploads
SENTRY_DEBUG=false
```

#### Backend (Code.run)
```javascript
// Environment Variables
OAUTH_CLIENT_ID=osm_client_id
OAUTH_CLIENT_SECRET=osm_client_secret
NODE_ENV=production
PORT=3000
SENTRY_DSN=https://...@sentry.io/...
```

## Release Management Workflow

### Standard Development Process
```bash
# 1. Feature Development
git checkout -b feature/new-feature
# ... develop and test ...
npm run lint && npm run test:run && npm run build

# 2. Version Management (Include in PR)
npm version patch --no-git-tag-version  # Updates package.json only
git add package.json package-lock.json
git commit -m "chore: bump version to v1.x.x for release"

# 3. PR Review & Merge
# Create PR → CodeRabbit Review → Address Feedback → Merge
# 🚀 Render.com/Code.run AUTO-DEPLOY immediately

# 4. Create Versioned Release (Sentry Integration)
git checkout main && git pull origin main
git tag v1.x.x
git push origin v1.x.x  # Triggers GitHub Actions release

# 5. Monitor Deployment
# Check Render.com/Code.run dashboards
# Monitor Sentry for new errors
# Verify source maps uploaded correctly
```

### Version Management Standards
```javascript
// Semantic Versioning Rules
const VERSION_RULES = {
  patch: 'Bug fixes, security patches, minor improvements',  // 1.0.1
  minor: 'New features, enhancements, non-breaking changes', // 1.1.0
  major: 'Breaking changes, major refactors'                 // 2.0.0
};

// Version Alignment Requirements
// ✅ MUST include version bump WITH feature in same PR
// ❌ NEVER create separate PRs for version bumps only
// ✅ Version number must match actual code changes
```

### GitHub Actions Release Pipeline
```yaml
# .github/workflows/release.yml
name: Release Pipeline
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm run test:run
        
      - name: Build production
        run: npm run build
        
      - name: Upload source maps to Sentry
        run: npx @sentry/cli sourcemaps upload ./dist
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          
      - name: Create Sentry release
        run: |
          npx @sentry/cli releases new vikings-eventmgmt-mobile@${{ github.ref_name }}
          npx @sentry/cli releases finalize vikings-eventmgmt-mobile@${{ github.ref_name }}
```

## Auto-Deployment Configuration

### Frontend Auto-Deploy (Render.com)
```yaml
# render.yaml (auto-detected)
services:
  - type: web
    name: vikings-eventmgmt-mobile
    env: node
    buildCommand: npm ci && npm run build
    startCommand: npm run preview
    envVars:
      - key: NODE_ENV
        value: production
      - key: VITE_API_URL
        fromSecret: api_url
      - key: VITE_SENTRY_DSN
        fromSecret: sentry_dsn_frontend
```

### Backend Auto-Deploy (Code.run)
```yaml
# code.run configuration
{
  "spec": {
    "kind": "Workflow",
    "spec": {
      "type": "sequential",
      "steps": [
        {
          "kind": "Build",
          "spec": {
            "source": {
              "type": "git",
              "url": "https://github.com/Walton-Viking-Scouts/VikingsEventMgmtAPI"
            },
            "dockerfile": {
              "buildEngine": "kaniko",
              "dockerfile": "Dockerfile"
            }
          }
        },
        {
          "kind": "DeployService",
          "spec": {
            "deployment": {
              "instances": 1,
              "docker": {
                "configType": "default"
              }
            },
            "runtimeEnvironment": {
              "variables": {
                "NODE_ENV": "production",
                "PORT": "3000"
              },
              "secrets": [
                "oauth-credentials",
                "sentry-dsn-backend"
              ]
            }
          }
        }
      ]
    }
  }
}
```

## Branch Protection & CI Requirements

### Repository Settings
```bash
# Required GitHub Branch Protection Rules
- ✅ Require pull request before merging
  - Require approvals: 1
  - Dismiss stale reviews when new commits pushed
- ✅ Require status checks to pass before merging
  - Require branches to be up to date
  - Status checks: build, test, lint
- ✅ Require conversation resolution before merging
- ✅ Include administrators (applies to all users)
- ❌ Allow force pushes (disabled)
- ❌ Allow deletions (disabled)
```

### Automated Setup Script
```bash
#!/bin/bash
# scripts/setup-branch-protection.sh

# Setup branch protection for main
gh api repos/Walton-Viking-Scouts/VikingsEventMgmt/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["build","test","lint"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field required_conversation_resolution=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

## Production Issue Resolution

### Critical Issue Workflow
```bash
# When fixing critical production errors (e.g., VIKING-EVENT-MGMT-1K)

# 1. Create Feature Branch (NOT hotfix - use standard process)
git checkout -b feature/fix-critical-sentry-issue

# 2. Implement Comprehensive Fixes
# - Address root cause (e.g., source maps, error boundaries)
# - Add security enhancements (URL redaction, safe serialization)
# - Include structured logging for debugging

# 3. Version Bump in PR
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump to v1.x.x for critical production fixes"

# 4. PR with Detailed Context & CodeRabbit Review
# - Include Sentry issue IDs: "Fixes VIKING-EVENT-MGMT-1K"
# - Address ALL CodeRabbit feedback (actionable + nitpicks)
# - Include security improvements beyond minimum requirements

# 5. PR Merge → Immediate Production Deployment
# PR merged → Render.com/Code.run auto-deploys → Users get fixes immediately

# 6. Create Sentry Release (CRITICAL for Error Tracking)
git checkout main && git pull origin main  # Get ALL merged fixes
git tag v1.x.x  # Points to complete, reviewed, secure code
git push origin v1.x.x  # GitHub Actions: Sentry release + source maps

# 7. Verify Fix in Production
# - Check Sentry: VIKING-EVENT-MGMT-1K should resolve
# - Monitor: New errors should show clear function names, not minified
```

## Deployment Verification

### Health Check Endpoints
```javascript
// Backend Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// Frontend Connectivity Test
export const verifyDeployment = async () => {
  try {
    const backendStatus = await fetch('/api/health');
    const sentryConnected = Sentry.getCurrentHub().getClient() !== undefined;
    
    return {
      backend: backendStatus.ok,
      sentry: sentryConnected,
      version: import.meta.env.PACKAGE_VERSION,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      backend: false,
      sentry: false,
      error: error.message
    };
  }
};
```

### Deployment Timeline
```
PR Merge → Auto-Deploy (1-3 minutes) → Users See Changes
Tag Creation → GitHub Actions → Sentry Release (2-5 minutes) → Source Maps Available
```

### Monitoring Post-Deployment
```javascript
// Post-Deployment Checklist
const monitorDeployment = async (version) => {
  // 1. Check service health
  const health = await verifyDeployment();
  
  // 2. Monitor Sentry for new errors
  const sentryIssues = await checkSentryIssues(version);
  
  // 3. Verify critical functionality
  const functionalTests = await runSmokeTests();
  
  // 4. Check application logs
  const logs = await getRecentLogs(version);
  
  return {
    health,
    sentryIssues: sentryIssues.length,
    testsPass: functionalTests.success,
    errorRate: logs.errorRate
  };
};
```

## Environment Secrets Management

### Frontend Secrets (Public)
```javascript
// Safe for public exposure (prefixed with VITE_)
VITE_API_URL=https://...                    // Public API endpoint
VITE_SENTRY_DSN=https://...@sentry.io/...  // Public Sentry DSN
VITE_OAUTH_CLIENT_ID=...                   // Public OAuth client ID
```

### Backend Secrets (Private)
```javascript
// Must be kept secure
OAUTH_CLIENT_SECRET=...     // Private OAuth secret
SENTRY_AUTH_TOKEN=...       // Private Sentry auth token
DATABASE_URL=...            // Database connection string (if used)
```

### Secret Rotation Process
```bash
# When secrets are compromised
# 1. Generate new secrets in OSM/Sentry dashboards
# 2. Update deployment environment variables
# 3. Test deployment with new secrets
# 4. Invalidate old secrets
# 5. Update local .env.example files (without real values)
```

## Disaster Recovery

### Rollback Procedures
```bash
# If deployment fails or causes issues

# Option 1: Revert to previous commit
git revert HEAD
git push origin main  # Triggers automatic re-deploy

# Option 2: Manual rollback in hosting dashboards
# - Render.com: Deploy previous successful build
# - Code.run: Rollback to previous deployment

# Option 3: Hotfix branch for urgent fixes
git checkout -b hotfix/urgent-fix
# Fix issue quickly
# Follow standard PR process for review
```

### Backup Strategies
- **Code**: Git provides complete version history
- **Configuration**: Environment variables backed up in secure documentation
- **Deployments**: Both platforms maintain deployment history
- **Monitoring**: Sentry retains error history and performance data

---

*This deployment architecture provides rapid iteration capabilities while maintaining proper release management, monitoring, and recovery procedures.*
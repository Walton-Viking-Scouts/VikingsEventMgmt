# Sentry Debugging Guide

**Comprehensive methodology for investigating and resolving Sentry errors in production environments.**

## Overview

This guide documents lessons learned from systematic Sentry error investigation, including common pitfalls and proven methodologies for identifying real production issues.

## Key Problems with Standard Sentry Searches

### 1. Environment Tagging is Unreliable ⚠️

**Problem**: PR preview sites are often incorrectly tagged as "production" in Sentry.

**Symptom**: Searches for `environment:production` return development and preview deployment errors mixed with real production issues.

**Solution**: Always filter by actual production URL instead of environment tags.

```
❌ Bad:  environment:production
✅ Good: url:https://vikingeventmgmt.onrender.com/
```

### 2. Version Synchronization Issues 🔄

**Problem**: All errors showing outdated version (e.g., `vikings-eventmgmt-mobile@1.1.0`) regardless of actual deployment version.

**Root Cause**: Build process using package.json version instead of git tags.

**Symptoms**:
- All recent errors show old version numbers
- Source maps don't match deployed code (`<unknown>` stack traces)
- Cannot distinguish between releases

**Solution**: Configure build to use git tags for Sentry releases:
- Update `vite.config.js` to use `process.env.SENTRY_RELEASE`
- Set `SENTRY_RELEASE=vikings-eventmgmt-mobile@{git-tag-version}` in CI/CD

### 3. Search API Limitations 🔍

**Problem**: Natural language queries inconsistently translated to Sentry filters.

**Issues**:
- URL-specific searches often miss results
- Complex filters may not work as expected
- API timeouts on large result sets

**Solution**: Use broad searches then manually filter results.

### 4. Development vs Production Mixing 🚧

**Problem**: Development environment errors contaminate production error searches.

**Common Sources**:
- `localhost:3001` development servers
- Demo mode testing (`?demo=true`)
- Local API connection failures
- Development-only features

## Improved Search Strategy

### Step 1: Start with Time-Bounded Broad Search

```
Search: "unresolved issues in last 3 days"
```

**Rationale**: Recent issues are more relevant than historical problems. Focuses attention on current production state.

### Step 2: Manual URL Filtering

For each result, verify the **URL field**:

✅ **Production URLs** (investigate):
- `https://vikingeventmgmt.onrender.com/`
- Production domain variations

❌ **Development URLs** (ignore):
- `https://localhost:3001/`
- Preview deployment URLs
- Demo URLs (`?demo=true`)

### Step 3: Version Cross-Check

After version sync fix, filter by release version:

✅ **Current versions** (investigate):
- `vikings-eventmgmt-mobile@1.3.1` or newer

❌ **Stale versions** (likely resolved):
- `vikings-eventmgmt-mobile@1.1.0` and older

### Step 4: Environment Cross-Check

Verify environment tags align with URL:
- Production URL + production environment ✅
- Production URL + development environment ⚠️ (investigate)
- Development URL + any environment ❌ (ignore)

## Production Issue Identification Criteria

An issue is **real production impact** if ALL criteria are met:

1. **URL**: `https://vikingeventmgmt.onrender.com/` (exact match)
2. **Recency**: Last seen within 3-7 days
3. **User Impact**: Affecting real users (not anonymous testing)
4. **Version**: Current or recent release version
5. **Platform**: Real user devices (not development machines)

## Common False Positives

### Development Environment Issues
- **URL Pattern**: `localhost:3001`, `127.0.0.1`
- **User Agent**: Development tools, specific dev machines
- **Action**: Ignore these entirely

### Stale/Historical Issues
- **Version Pattern**: Old release versions
- **Last Seen**: Weeks or months ago
- **Action**: Close if confirmed fixed in current release

### Preview/Staging Deployments
- **URL Pattern**: Preview URLs, staging domains
- **Environment**: Tagged as "production" but not main site
- **Action**: Important for development, not production priority

### Testing/Demo Activity
- **URL Pattern**: `?demo=true`, test user sessions
- **User Pattern**: Repetitive actions, test data
- **Action**: Valid for feature testing, not production errors

## Investigation Workflow

### 1. Initial Triage (5 minutes)
```bash
# Get recent unresolved issues
task-master next
sentry search "unresolved issues last 3 days"
```

### 2. Production Filtering (10 minutes)
- Review each issue's URL field
- Verify user impact and platform
- Check version alignment

### 3. Priority Assessment (15 minutes)
- **High**: Production URL + recent activity + multiple users
- **Medium**: Production URL + occasional occurrence
- **Low**: Development environment or stale version

### 4. Root Cause Investigation (30-60 minutes per issue)
- Review full error context and breadcrumbs
- Check associated user sessions
- Investigate code paths in current release
- Document findings in GitHub issues

### 5. Resolution Tracking
- Create GitHub issue with Sentry link
- Reference issue ID in fix commits (`Fixes VIKING-EVENT-MGMT-XX`)
- Monitor resolution in production

## Tools and Commands

### Sentry Search Queries
```
# Recent unresolved issues
is:unresolved lastSeen:-3d

# Production URL filtering (manual verification needed)
is:unresolved url:vikingeventmgmt.onrender.com

# Version filtering (post version-sync fix)
is:unresolved release:vikings-eventmgmt-mobile@1.3.1
```

### Task Master Integration
```bash
# View Sentry investigation tasks
task-master show 9.3

# Create follow-up task
task-master add-task --prompt="Fix Sentry issue VIKING-EVENT-MGMT-XX"
```

### GitHub Integration
```bash
# Create issue for Sentry error
gh issue create --title "Sentry Error: ISSUE-ID" --body "..." --label bug

# Reference in commits
git commit -m "fix: resolve api timeout issue

Fixes VIKING-EVENT-MGMT-XX"
```

## Success Metrics

### Investigation Quality
- **False positive rate**: <10% (9 out of 10 "issues" should be real production problems)
- **Issue resolution time**: <48 hours from identification to fix deployment
- **Recurrence prevention**: <5% of fixed issues return within 30 days

### Production Health
- **Active production issues**: <3 at any time
- **User impact**: <1% of sessions affected by unresolved errors
- **Response time**: Critical issues fixed within 24 hours

## Case Study: August 2025 Investigation

**Initial State**: 100+ unresolved Sentry issues reported
**After Filtering**: 1 real production issue identified (VIKING-EVENT-MGMT-2F)

**Key Findings**:
1. **99% false positives** due to environment tagging and version sync issues
2. **Version sync fix** resolved source map problems (`<unknown>` errors)
3. **Methodology improvement** dramatically reduced investigation time

**Outcome**: Production environment confirmed healthy with only 1 backend connectivity issue affecting 13 mobile users.

## Troubleshooting

### Source Maps Not Working
- Verify `SENTRY_RELEASE` environment variable during build
- Check release exists in Sentry with uploaded source maps
- Ensure version exactly matches between build and Sentry release

### Environment Tagging Issues  
- Review deployment configuration
- Set explicit environment in Sentry configuration
- Use URL filtering as primary production identification

### Search Results Missing Known Issues
- Use broader time windows (7-14 days)
- Check issue status (may be auto-resolved)
- Try event search instead of issue search

---

**Maintained by**: Development Team  
**Last Updated**: August 2025  
**Related Documentation**: [System Overview](SYSTEM_OVERVIEW.md), [Deployment](architecture/DEPLOYMENT.md)
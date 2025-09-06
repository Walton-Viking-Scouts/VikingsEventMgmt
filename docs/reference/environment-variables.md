---
title: "Environment Variables Reference"
description: "Complete configuration reference for Vikings Event Management"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["configuration", "environment", "variables", "setup"]
related_docs: ["../getting-started/installation.md", "api-reference.md"]
---

# Environment Variables Reference

Complete configuration reference for the Vikings Event Management application.

## 🔧 Configuration Overview

Environment variables are used to configure the application for different environments (development, staging, production). All variables should be defined in `.env.local` for local development.

### Configuration Files
- **`.env.local`**: Local development configuration (not committed)
- **`.env.example`**: Template with all available variables
- **Production**: Environment variables set in hosting platform

## 🚀 Core Application Variables

### Application Identity
```bash
# Application name and branding
VITE_APP_NAME="Vikings Event Management"
VITE_APP_DESCRIPTION="Scout event management with offline capabilities"
VITE_APP_VERSION=1.1.0

# Application URLs
VITE_APP_URL=https://vikingeventmgmt.onrender.com
VITE_APP_DOMAIN=vikingeventmgmt.onrender.com
```

### Build Configuration
```bash
# Build environment
NODE_ENV=development  # development | production | test
VITE_BUILD_TARGET=web  # web | mobile | both

# Feature flags
VITE_ENABLE_STORYBOOK=true
VITE_ENABLE_DEBUG_MODE=true
VITE_ENABLE_ANALYTICS=false
```

## 🔐 Authentication & Security

### OAuth Configuration
```bash
# Online Scout Manager OAuth
VITE_OSM_CLIENT_ID=your_osm_client_id
VITE_OSM_CLIENT_SECRET=your_osm_client_secret
VITE_OSM_REDIRECT_URI=https://your-app.com/auth/callback

# OAuth scopes
VITE_OSM_SCOPE="section.member:read section.event:read section.medical:read"

# OAuth endpoints
VITE_OSM_AUTH_URL=https://www.onlinescoutmanager.co.uk/oauth/authorize
VITE_OSM_TOKEN_URL=https://www.onlinescoutmanager.co.uk/oauth/token
```

### Security Settings
```bash
# Session configuration
VITE_SESSION_TIMEOUT=3600  # 1 hour in seconds
VITE_SESSION_REFRESH_THRESHOLD=300  # 5 minutes before expiry

# Cookie settings
VITE_AUTH_COOKIE_SECURE=true
VITE_AUTH_COOKIE_SAME_SITE=strict
VITE_AUTH_COOKIE_DOMAIN=.vikingeventmgmt.onrender.com

# CSRF protection
VITE_CSRF_TOKEN_NAME=_csrf_token
VITE_CSRF_HEADER_NAME=X-CSRF-Token
```

### Encryption Keys
```bash
# Data encryption (use strong random keys)
VITE_ENCRYPTION_KEY=your_32_character_encryption_key
VITE_MEDICAL_DATA_KEY=your_medical_data_encryption_key

# JWT signing (for internal tokens)
VITE_JWT_SECRET=your_jwt_signing_secret
VITE_JWT_EXPIRY=3600  # 1 hour
```

## 🌐 API Configuration

### API Configuration
```bash
# Backend API configuration (OSM proxy)
VITE_API_URL=https://site--vikings-event-management--ytnrhtcfzsqn.code.run

# OAuth Configuration
VITE_OAUTH_CLIENT_ID=your_osm_client_id_here
```

## 💾 Database Configuration

### SQLite Settings (Mobile)
```bash
# Database configuration
DATABASE_NAME=vikings_db
DATABASE_VERSION=1
DATABASE_ENCRYPTION=no-encryption  # no-encryption | encryption

# Connection settings
DATABASE_JOURNAL_MODE=WAL
DATABASE_SYNCHRONOUS=NORMAL
DATABASE_CACHE_SIZE=2000
```

### Storage Settings
```bash
# Local storage configuration
VITE_STORAGE_PREFIX=vikings_
VITE_STORAGE_VERSION=1
VITE_STORAGE_QUOTA=50MB  # Maximum storage usage

# Cache settings
VITE_CACHE_DURATION=86400  # 24 hours in seconds
VITE_CACHE_MAX_SIZE=100MB
VITE_CACHE_CLEANUP_INTERVAL=3600  # 1 hour
```

## 📱 Mobile Configuration

### Capacitor Settings
```bash
# Capacitor configuration
CAPACITOR_APP_ID=com.vikings.eventmgmt
CAPACITOR_APP_NAME="Vikings Event Management"
CAPACITOR_APP_VERSION=1.1.0

# Platform-specific settings
CAPACITOR_IOS_SCHEME=vikings-eventmgmt
CAPACITOR_ANDROID_SCHEME=vikings-eventmgmt
```

### Push Notifications
```bash
# Firebase Cloud Messaging (optional)
VITE_FCM_API_KEY=your_fcm_api_key
VITE_FCM_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FCM_PROJECT_ID=your-project-id
VITE_FCM_SENDER_ID=your_sender_id
VITE_FCM_APP_ID=your_app_id

# Notification settings
VITE_NOTIFICATIONS_ENABLED=true
VITE_NOTIFICATION_SOUND=default
```

## 📊 Monitoring & Analytics

### Sentry Configuration
```bash
# Error tracking (optional)
VITE_SENTRY_DSN=your_sentry_dsn_here

# Build configuration (for CI/CD)
SENTRY_AUTH_TOKEN=your_sentry_auth_token_here
SENTRY_DEBUG=false
```

### Analytics (Optional)
```bash
# Google Analytics (if enabled)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_GA_ENABLED=false

# Custom analytics
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_API_KEY=your_analytics_key
```

## 🔄 Sync & Offline Configuration

### Synchronization Settings
```bash
# Sync configuration
VITE_SYNC_INTERVAL=300000  # 5 minutes in milliseconds
VITE_SYNC_RETRY_ATTEMPTS=3
VITE_SYNC_RETRY_DELAY=5000  # 5 seconds
VITE_SYNC_BATCH_SIZE=100  # Records per sync batch

# Offline settings
VITE_OFFLINE_STORAGE_LIMIT=100MB
VITE_OFFLINE_DATA_RETENTION=30  # Days to keep offline data
VITE_OFFLINE_SYNC_ON_STARTUP=true
```

### Conflict Resolution
```bash
# Conflict handling
VITE_CONFLICT_RESOLUTION_STRATEGY=manual  # auto | manual | last_write_wins
VITE_CONFLICT_RETENTION_DAYS=7
VITE_AUTO_RESOLVE_SIMPLE_CONFLICTS=true
```

## 🧪 Development & Testing

### Development Settings
```bash
# Development configuration
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug  # error | warn | info | debug
VITE_MOCK_API=false
VITE_DISABLE_AUTH=false  # For testing only

# Hot reload settings
VITE_HMR_PORT=3001
VITE_HMR_HOST=localhost
```

### Testing Configuration
```bash
# Test environment
VITEST_ENVIRONMENT=jsdom
VITEST_COVERAGE_THRESHOLD=80
VITEST_TIMEOUT=10000  # 10 seconds

# E2E testing
CYPRESS_BASE_URL=https://localhost:3001
CYPRESS_VIDEO=false
CYPRESS_SCREENSHOTS=true
```

### Storybook Settings
```bash
# Storybook configuration
STORYBOOK_PORT=6006
STORYBOOK_HOST=localhost
STORYBOOK_DISABLE_TELEMETRY=true
```

## 🚀 Production Configuration

### Production-Specific Variables
```bash
# Production environment
NODE_ENV=production
VITE_BUILD_TARGET=web

# Security (production only)
VITE_ENABLE_DEBUG_MODE=false
VITE_LOG_LEVEL=error
VITE_AUTH_COOKIE_SECURE=true

# Performance
VITE_ENABLE_SERVICE_WORKER=true
VITE_ENABLE_COMPRESSION=true
VITE_BUNDLE_ANALYZER=false
```

### Hosting Platform Variables
```bash
# Render.com specific
RENDER_SERVICE_NAME=vikings-eventmgmt
RENDER_REGION=oregon

# Build settings
BUILD_COMMAND=npm run build
START_COMMAND=npm run preview
```

## 🔍 Validation & Defaults

### Required Variables
The following variables are **required** for the application to function:
- `VITE_API_URL` - Backend API URL
- `VITE_OAUTH_CLIENT_ID` - OSM OAuth client ID

### Optional Variables
- `VITE_SENTRY_DSN` - Error tracking (recommended for production)
- `SENTRY_AUTH_TOKEN` - For build-time source map uploads

### Optional Variables with Defaults
Variables that have sensible defaults if not specified:
- `VITE_APP_NAME` → "Vikings Event Management"
- `VITE_SESSION_TIMEOUT` → 3600 (1 hour)
- `VITE_SYNC_INTERVAL` → 300000 (5 minutes)
- `VITE_LOG_LEVEL` → "info"

### Environment-Specific Defaults

#### Development Defaults
```bash
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
VITE_MOCK_API=false
VITE_AUTH_COOKIE_SECURE=false
```

#### Production Defaults
```bash
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=error
VITE_MOCK_API=false
VITE_AUTH_COOKIE_SECURE=true
```

## 🛠️ Configuration Management

### Environment File Template
Create `.env.local` from `.env.example`:
```bash
cp .env.example .env.local
# Edit .env.local with your specific values
```

### Validation Script
```bash
# Validate environment configuration
npm run validate-env

# Check for missing required variables
npm run check-env
```

### Configuration Loading Order
1. `.env.local` (highest priority)
2. `.env.development` / `.env.production`
3. `.env`
4. Default values in code

## 🔒 Security Best Practices

### Sensitive Variables
Never commit these variables to version control:
- `VITE_OSM_CLIENT_SECRET`
- `VITE_ENCRYPTION_KEY`
- `VITE_JWT_SECRET`
- `VITE_SENTRY_DSN`
- Any API keys or tokens

### Variable Naming
- Use `VITE_` prefix for client-side variables
- Use descriptive names: `VITE_OSM_CLIENT_ID` not `CLIENT_ID`
- Use UPPER_CASE with underscores
- Group related variables with common prefixes

### Production Security
- Use strong, unique values for all secrets
- Rotate secrets regularly
- Use environment-specific values
- Monitor for exposed secrets in logs

## 🐛 Troubleshooting

### Common Issues

#### Variables Not Loading
```bash
# Check if variables are properly prefixed
echo $VITE_APP_NAME

# Verify .env.local exists and has correct format
cat .env.local
```

#### Build Failures
```bash
# Check for missing required variables
npm run validate-env

# Verify no syntax errors in .env files
# (no spaces around =, no quotes unless needed)
```

#### Runtime Errors
```bash
# Check browser console for undefined variables
# Verify VITE_ prefix for client-side variables
# Check network tab for failed API calls
```

### Debug Commands
```bash
# Print all environment variables
npm run env:debug

# Validate configuration
npm run config:validate

# Test API connectivity
npm run test:api
```

---

*For setup instructions, see [Installation Guide](../getting-started/installation.md). For API details, see [API Reference](api-reference.md).*
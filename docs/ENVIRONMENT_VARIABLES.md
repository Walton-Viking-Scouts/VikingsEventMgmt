# Environment Variables Management Analysis & Recommendations

This document analyzes environment variable usage across all three Viking Event Management repositories and provides recommendations for simplification and security improvements.

## 🚨 **CRITICAL SECURITY ISSUES** 

### **Immediate Action Required**

Both repositories have **REAL SECRETS COMMITTED** to the codebase:

#### **React Mobile Frontend** 
- ❌ **Real OAuth Client ID exposed** in `.env` 
- ❌ **Real Sentry DSN exposed** in `.env`

#### **Backend**
- ❌ **Real OAuth Client ID exposed** in `.env`
- ❌ **Real OAuth Client Secret exposed** in `.env` 
- ❌ **Real Sentry DSN exposed** in `.env`

**IMMEDIATE ACTIONS:**
1. **Remove `.env` files** from both repositories 
2. **Regenerate all exposed secrets** (OAuth credentials, Sentry DSNs)
3. **Add `.env` to `.gitignore`** in both repos
4. **Update deployment environments** with new secrets

## 📊 **Current Environment Variable Analysis**

### **React Mobile Frontend (`vikings-eventmgmt-mobile/`)**

#### **Required Variables:**
- `VITE_API_URL` - Backend API endpoint ✅
- `VITE_OAUTH_CLIENT_ID` - OAuth authentication ❌ (exposed)

#### **Optional Variables:**
- `VITE_SENTRY_DSN` - Error tracking ❌ (exposed)
- `VITE_APP_VERSION` - Version tracking (has fallback) ✅

#### **Issues Found:**
- **Hardcoded URL** in `src/services/auth.js:74` should use `VITE_API_URL`
- **Exposed secrets** in committed `.env` file
- **Redundant version variable** (could read from `package.json`)

### **Backend (`vikings-osm-backend/`)**

#### **Required Variables:**
- `OAUTH_CLIENT_ID` - OAuth authentication ❌ (exposed)
- `OAUTH_CLIENT_SECRET` - OAuth token exchange ❌ (exposed)

#### **Optional Variables:**
- `SENTRY_DSN` - Error monitoring ❌ (exposed)
- `NODE_ENV` - Environment mode ✅
- `PORT` - Server port (has default) ✅
- `BACKEND_URL` - OAuth redirect URI ✅

#### **Issues Found:**
- **Exposed secrets** in committed `.env` file
- **Hardcoded URLs** in CORS and OAuth configuration
- **Missing variables** for external service URLs

### **Vanilla JS Frontend (`vikings-eventmgmt/`)**

Based on CLAUDE.md documentation:
- `VITE_API_URL` - Backend API endpoint ✅

## 🎯 **Simplified Environment Variable Strategy**

### **Tier 1: Essential (Required for basic functionality)**

#### **All Frontend Projects:**
```env
# Required
VITE_API_URL=https://vikings-osm-backend.onrender.com
VITE_OAUTH_CLIENT_ID=your_oauth_client_id

# Optional (graceful fallbacks)
VITE_SENTRY_DSN=your_sentry_dsn_for_error_tracking
```

#### **Backend:**
```env
# Required  
OAUTH_CLIENT_ID=your_oauth_client_id
OAUTH_CLIENT_SECRET=your_oauth_client_secret

# Optional (graceful fallbacks)
SENTRY_DSN=your_sentry_dsn_for_error_tracking
NODE_ENV=production
PORT=3000
```

### **Tier 2: Configuration (For flexibility)**

#### **Backend Additional:**
```env
# Service URLs (to eliminate hardcoding)
OSM_API_BASE_URL=https://www.onlinescoutmanager.co.uk
FRONTEND_URL_PRODUCTION=https://vikings-eventmgmt.onrender.com
FRONTEND_URL_DEVELOPMENT=https://localhost:3000

# Security
CORS_ALLOWED_ORIGINS=https://vikings-eventmgmt.onrender.com,https://localhost:3000
```

### **Tier 3: CI/CD Only**
```env
# Testing (CI/CD only)
CYPRESS_PROJECT_ID=project_id
CYPRESS_RECORD_KEY=record_key
SENTRY_AUTH_TOKEN=build_token
```

## 🔧 **Recommended Changes**

### **1. Immediate Security Fixes**

#### **Remove Exposed Secrets:**
```bash
# For both repos
git rm .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "SECURITY: Remove exposed environment secrets"
```

#### **Update .env.example Files:**
```env
# .env.example (both frontend and backend)
# Copy this to .env and replace with real values

# Required
VITE_API_URL=https://your-backend-url.com
VITE_OAUTH_CLIENT_ID=your_oauth_client_id

# Optional
VITE_SENTRY_DSN=your_sentry_dsn
```

### **2. Code Fixes**

#### **Fix Hardcoded URL in React Mobile:**
```javascript
// src/services/auth.js - line 74
// BEFORE:
const BACKEND_URL = 'https://vikings-osm-backend.onrender.com';

// AFTER:
const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://vikings-osm-backend.onrender.com';
```

#### **Remove Redundant Version Variable:**
```javascript
// src/services/sentry.js
// BEFORE:
const version = import.meta.env.VITE_APP_VERSION || '1.0.0';

// AFTER:
import { version } from '../../package.json';
```

### **3. Backend Configuration Improvements**

#### **Centralize URL Configuration:**
```javascript
// config/urls.js
module.exports = {
  OSM_API_BASE: process.env.OSM_API_BASE_URL || 'https://www.onlinescoutmanager.co.uk',
  FRONTEND_PROD: process.env.FRONTEND_URL_PRODUCTION || 'https://vikings-eventmgmt.onrender.com',
  FRONTEND_DEV: process.env.FRONTEND_URL_DEVELOPMENT || 'https://localhost:3000',
  CORS_ORIGINS: process.env.CORS_ALLOWED_ORIGINS?.split(',') || [
    'https://vikings-eventmgmt.onrender.com',
    'https://localhost:3000',
    'http://localhost:3000'
  ]
};
```

### **4. Add Environment Validation**

#### **Frontend Validation:**
```javascript
// src/config/env.js
const requiredVars = ['VITE_API_URL', 'VITE_OAUTH_CLIENT_ID'];
const missingVars = requiredVars.filter(key => !import.meta.env[key]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  // Show user-friendly error in development
  if (import.meta.env.DEV) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

export const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  oauthClientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD
};
```

#### **Backend Validation:**
```javascript
// config/env.js
const requiredVars = ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET'];
const optionalVars = ['SENTRY_DSN', 'NODE_ENV', 'PORT'];

// Validate required variables
requiredVars.forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

// Validate NODE_ENV values
const validNodeEnvs = ['development', 'production', 'test'];
if (process.env.NODE_ENV && !validNodeEnvs.includes(process.env.NODE_ENV)) {
  console.warn(`Invalid NODE_ENV: ${process.env.NODE_ENV}. Valid values: ${validNodeEnvs.join(', ')}`);
}

module.exports = {
  oauth: {
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET
  },
  sentry: {
    dsn: process.env.SENTRY_DSN
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  }
};
```

## 📋 **Migration Checklist**

### **Phase 1: Security (Critical - Do Immediately)**
- [ ] Remove `.env` files from all repositories
- [ ] Add `.env` to `.gitignore` in all repositories  
- [ ] Regenerate OAuth client credentials
- [ ] Regenerate Sentry DSNs
- [ ] Update deployment environments with new secrets
- [ ] Update CI/CD secrets with new credentials

### **Phase 2: Code Cleanup**
- [ ] Fix hardcoded URL in React mobile auth service
- [ ] Remove redundant `VITE_APP_VERSION` variable
- [ ] Add environment variable validation to both frontend and backend
- [ ] Centralize URL configuration in backend

### **Phase 3: Configuration Improvements**
- [ ] Make CORS origins configurable
- [ ] Add OSM API base URL configuration
- [ ] Create environment-specific configuration files
- [ ] Add URL format validation

### **Phase 4: Documentation**
- [ ] Update README files with environment setup instructions
- [ ] Document required vs optional variables
- [ ] Create troubleshooting guide for environment issues
- [ ] Add development setup guide

## 🎯 **Simplified Final State**

### **Environment Variables Needed:**

#### **For Local Development:**
```env
# Required
VITE_API_URL=http://localhost:3000
VITE_OAUTH_CLIENT_ID=your_dev_oauth_client_id

# Optional  
VITE_SENTRY_DSN=your_dev_sentry_dsn
```

#### **For Production:**
```env
# Required
VITE_API_URL=https://vikings-osm-backend.onrender.com
VITE_OAUTH_CLIENT_ID=your_prod_oauth_client_id

# Optional
VITE_SENTRY_DSN=your_prod_sentry_dsn
```

### **Benefits of This Approach:**
- **Reduced Complexity**: Only 2 required variables for frontend, 2 for backend
- **Better Security**: No secrets in code, proper secret management
- **Improved Flexibility**: Easy to switch between environments
- **Enhanced Maintainability**: Centralized configuration, clear validation
- **Better Developer Experience**: Clear setup instructions, helpful error messages

## 🔍 **Variables You Can Remove**

Based on the analysis, these variables can be eliminated:

1. **`VITE_APP_VERSION`** - Read from `package.json` instead
2. **`DEV_MODE`** - Use `NODE_ENV` instead
3. **`BACKEND_URL`** - Can be derived from other configuration
4. **`FRONTEND_URL`** - Can be configured as a single variable with environment detection

This reduces the total environment variables from **8-10 per project** down to **2-4 essential variables per project**.

The key is distinguishing between what's **required for functionality** vs what's **optional for enhanced features** vs what's **only needed for CI/CD**.
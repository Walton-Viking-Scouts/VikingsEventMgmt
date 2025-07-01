# 🔒 OAuth Security Configuration

## ⚠️ CRITICAL SECURITY NOTICE

**The OAuth client ID has been moved to environment variables for security.** You must configure this before the app will work.

## 🚨 Immediate Actions Required

### 1. **Regenerate OAuth Client ID in OSM** (Recommended)
The previous client ID `x7hx1M0NExVdSiksH1gUBPxkSTn8besx` was exposed in the public repository and should be regenerated:

1. Log into Online Scout Manager
2. Go to **Settings → API Settings**
3. **Regenerate** or create a new OAuth application
4. **Copy the new client ID**
5. **Update your environment variables** (see below)

### 2. **Configure Environment Variables**

#### **Local Development:**
```bash
# In .env file
VITE_OAUTH_CLIENT_ID=your_new_oauth_client_id_here
```

#### **Production Deployment (Render.com):**
1. Go to your Render.com dashboard
2. Select your service
3. Go to **Environment** tab
4. Add environment variable:
   - **Key**: `VITE_OAUTH_CLIENT_ID`
   - **Value**: `your_new_oauth_client_id_here`
5. **Deploy** the updated environment

#### **CI/CD Pipeline:**
Add to GitHub repository secrets:
1. Go to **Settings → Secrets and variables → Actions**
2. Add new secret:
   - **Name**: `VITE_OAUTH_CLIENT_ID`
   - **Value**: `your_new_oauth_client_id_here`

## 🛡️ Security Benefits

### Before (INSECURE):
```javascript
// ❌ EXPOSED in public repository
const clientId = 'x7hx1M0NExVdSiksH1gUBPxkSTn8besx';
```

### After (SECURE):
```javascript
// ✅ PROTECTED via environment variables
const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;
```

## 🔍 Security Validation

The app now validates the OAuth client ID on startup:

```javascript
if (!clientId) {
  throw new Error('OAuth client ID not configured. Please set VITE_OAUTH_CLIENT_ID environment variable.');
}
```

**If not configured, the app will fail to start with a clear error message.**

## 📝 Environment File Structure

### **.env** (Local Development)
```env
VITE_OAUTH_CLIENT_ID=your_actual_client_id
VITE_API_URL=https://vikings-osm-backend.onrender.com
VITE_SENTRY_DSN=your_sentry_dsn
CYPRESS_ENABLE_API_MOCKING=true
```

### **Production Environment (Render.com)**
**Environment variables should be set in Render.com dashboard, NOT in files:**
- `VITE_OAUTH_CLIENT_ID=your_production_client_id`
- `VITE_API_URL=https://vikings-osm-backend.onrender.com`  
- `VITE_NODE_ENV=production`

## 🚀 Deployment Checklist

- [ ] **Regenerate OAuth client ID** in OSM
- [ ] **Update local .env** with new client ID
- [ ] **Test locally** - app should start without errors
- [ ] **Update production environment** variables
- [ ] **Deploy to production** 
- [ ] **Verify production app** loads correctly
- [ ] **Update CI/CD secrets** if needed

## 🔒 Best Practices Applied

1. **Environment Variables**: Sensitive credentials never in source code
2. **Runtime Validation**: App fails fast if misconfigured  
3. **Clear Error Messages**: Easy debugging when credentials missing
4. **Separate Environments**: Different credentials for dev/prod
5. **Public Repository Safe**: No secrets exposed in Git history

## 🆘 Troubleshooting

### **App Won't Start Locally**
```
Error: OAuth client ID not configured
```
**Solution**: Add `VITE_OAUTH_CLIENT_ID=your_client_id` to `.env` file

### **Production App Shows Error**
```
OAuth client ID not configured
```
**Solution**: Add environment variable in Render.com dashboard

### **Tests Failing**
Tests use API mocking, so OAuth client ID is not required for testing.

## 📞 Support

If you need the current OAuth client ID or have issues:
1. Check OSM API settings for your current client ID
2. Regenerate if compromised
3. Update all environments consistently

---

**🛡️ This security update protects your OSM API credentials from unauthorized access.**
---
title: "Authentication System Overview"
description: "OAuth integration and security implementation for Online Scout Manager"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["authentication", "oauth", "security", "osm"]
related_docs: ["oauth-setup.md", "../../architecture/authentication.md"]
---

# Authentication System Overview

Comprehensive authentication system with OAuth integration for Online Scout Manager (OSM).

## 🔐 Authentication Architecture

### OAuth 2.0 Integration
The application uses OAuth 2.0 for secure authentication with Online Scout Manager:
- **Authorization Code Flow**: Secure server-side authentication
- **PKCE (Proof Key for Code Exchange)**: Enhanced security for mobile apps
- **Refresh Tokens**: Automatic session renewal
- **Secure Storage**: Encrypted token storage

### Security Features
- **HTTPS Required**: All authentication requires secure connections
- **Token Encryption**: All tokens encrypted at rest and in transit
- **Session Management**: Automatic session timeout and renewal
- **Cross-Site Protection**: CSRF and XSS protection implemented

## 🚀 Quick Start

### Basic Authentication Flow
```typescript
import { useAuth } from '../contexts/AuthContext';

function LoginComponent() {
  const { login, logout, user, isAuthenticated } = useAuth();

  const handleLogin = async () => {
    try {
      await login();
      // User is now authenticated
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Welcome, {user?.name}</p>
          <button onClick={logout}>Sign Out</button>
        </div>
      ) : (
        <button onClick={handleLogin}>Sign in to OSM</button>
      )}
    </div>
  );
}
```

### Authentication Context
```typescript
import { AuthProvider } from '../contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      {/* Your app components */}
    </AuthProvider>
  );
}
```

## 🔧 Configuration

### Environment Variables
Required environment variables for authentication:
```bash
# OAuth Configuration
VITE_OSM_CLIENT_ID=your_osm_client_id
VITE_OSM_CLIENT_SECRET=your_osm_client_secret
VITE_OSM_REDIRECT_URI=https://your-app.com/auth/callback

# OSM API Configuration
VITE_OSM_API_BASE_URL=https://www.onlinescoutmanager.co.uk
VITE_OSM_SCOPE=section.member:read section.event:read

# Security Configuration
VITE_AUTH_COOKIE_SECURE=true
VITE_AUTH_COOKIE_SAME_SITE=strict
```

### OAuth Setup
See [OAuth Setup Guide](oauth-setup.md) for detailed configuration instructions.

### TypeScript Environment Variables
For TypeScript projects, add environment variable typing:
```typescript
// src/vite-env.d.ts or src/types/env.d.ts
declare global {
  interface ImportMetaEnv {
    readonly VITE_OSM_CLIENT_ID: string;
    readonly VITE_OSM_CLIENT_SECRET: string;
    readonly VITE_OSM_REDIRECT_URI: string;
    readonly VITE_OSM_API_BASE_URL: string;
    readonly VITE_OSM_SCOPE: string;
    readonly VITE_AUTH_COOKIE_SECURE: string;
    readonly VITE_AUTH_COOKIE_SAME_SITE: string;
  }
}

// Usage in code
const authConfig = {
  clientId: import.meta.env.VITE_OSM_CLIENT_ID,
  redirectUri: import.meta.env.VITE_OSM_REDIRECT_URI,
  apiBaseUrl: import.meta.env.VITE_OSM_API_BASE_URL,
};
```

## 🏗️ Implementation Details

### Authentication Flow
1. **User clicks "Sign in to OSM"**
2. **Redirect to OSM OAuth endpoint** with client credentials
3. **User authorizes** the application in OSM
4. **OSM redirects back** with authorization code
5. **Exchange code for tokens** (access + refresh)
6. **Store tokens securely** and establish session
7. **Fetch user profile** and permissions
8. **Redirect to application** with authenticated state

### Token Management
- **Access Tokens**: Short-lived (1 hour) for API requests
- **Refresh Tokens**: Long-lived (30 days) for session renewal
- **Automatic Renewal**: Tokens refreshed before expiration
- **Secure Storage**: Tokens stored in encrypted format

### Permission System
- **Role-Based Access**: Different permissions for leaders vs members
- **Section-Based**: Access limited to user's Scout sections
- **Medical Data**: Special permissions for medical information
- **Admin Functions**: Enhanced permissions for administrative tasks

## 🔒 Security Considerations

### Data Protection
- **Encryption**: All sensitive data encrypted at rest and in transit
- **Token Security**: Tokens never exposed in URLs or logs
- **Session Security**: Secure session management with timeout
- **HTTPS Only**: All authentication requires HTTPS

### Privacy Compliance
- **GDPR Compliance**: Full compliance with data protection regulations
- **Data Minimization**: Only collect necessary user data
- **Consent Management**: Clear consent for data usage
- **Right to Deletion**: Support for data deletion requests

### Security Best Practices
- **Regular Security Audits**: Periodic security reviews
- **Dependency Updates**: Keep security dependencies current
- **Vulnerability Scanning**: Automated security scanning
- **Incident Response**: Procedures for security incidents

## 📱 Mobile Authentication

### Capacitor Integration
- **Native OAuth**: Uses system browser for OAuth flow
- **Secure Storage**: Native secure storage for tokens
- **Biometric Authentication**: Optional biometric unlock
- **Deep Linking**: Proper handling of OAuth redirects

### Offline Authentication
- **Token Caching**: Secure local token storage
- **Offline Validation**: Local token validation when offline
- **Sync on Reconnect**: Automatic token refresh when online
- **Graceful Degradation**: Limited functionality when tokens expire offline

## 🧪 Testing Authentication

### Unit Tests
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import LoginComponent from './LoginComponent';

describe('Authentication', () => {
  it('shows login button when not authenticated', () => {
    render(
      <AuthProvider>
        <LoginComponent />
      </AuthProvider>
    );
    
    expect(screen.getByText('Sign in to OSM')).toBeInTheDocument();
  });
});
```

### Integration Tests
- **OAuth Flow Testing**: End-to-end authentication flow
- **Token Management**: Test token refresh and expiration
- **Permission Testing**: Verify role-based access control
- **Security Testing**: Test for common vulnerabilities

## 🐛 Troubleshooting

### Common Issues
- **OAuth Redirect Errors**: Check redirect URI configuration
- **Token Expiration**: Implement proper token refresh
- **Permission Denied**: Verify user roles and permissions
- **HTTPS Issues**: Ensure proper SSL configuration

### Debug Mode
Enable authentication debugging:
```typescript
<AuthProvider debug={true}>
  {/* Your app */}
</AuthProvider>
```

### Error Handling
```typescript
const { login, error } = useAuth();

const handleLogin = async () => {
  try {
    await login();
  } catch (err) {
    // Handle specific error types
    if (err.code === 'OAUTH_CANCELLED') {
      // User cancelled OAuth flow
    } else if (err.code === 'NETWORK_ERROR') {
      // Network connectivity issue
    } else {
      // Generic error handling
    }
  }
};
```

## 📚 Related Documentation

### Setup and Configuration
- [OAuth Setup Guide](oauth-setup.md) - Complete OAuth configuration
- [Installation Guide](../../getting-started/installation.md) - Environment setup

### Architecture
- [Authentication Architecture](../../architecture/authentication.md) - Technical architecture
- [Security Considerations](../../architecture/authentication.md#security) - Security implementation

### Development
- [Development Workflow](../../getting-started/development-workflow.md) - Development process
- [Testing Strategy](../../development/testing-strategy.md) - Testing approach

---

*For detailed OAuth configuration, see the [OAuth Setup Guide](oauth-setup.md).*
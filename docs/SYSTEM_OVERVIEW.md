# System Overview
**Viking Event Management - Mobile Web Application**

*Version: 1.1.0 | Last Updated: 2025-01-15*

## Quick Start

### For Users
1. **Access**: Open [vikingeventmgmt.onrender.com](https://vikingeventmgmt.onrender.com) in any modern browser
2. **Sign In**: Click "Sign in to OSM" and use your Online Scout Manager credentials
3. **Navigate**: Select your Scout section and view events or attendance
4. **Offline**: App works offline with cached data when no internet connection

### For Developers
1. **Clone**: `git clone https://github.com/Walton-Viking-Scouts/VikingsEventMgmt.git`
2. **Install**: `npm install`
3. **Develop**: `npm run dev` (starts local server with HTTPS)
4. **Test**: `npm run test:run && npm run lint && npm run build`

## What This System Does

### Primary Purpose
Mobile-optimized web application that helps Scout leaders manage:
- **Event Attendance**: Track who's coming to events and activities
- **Camp Groups**: Organize members into groups for camps and activities
- **Member Information**: Access contact details and patrol assignments
- **Sign-In/Out Tracking**: Monitor when members arrive and leave events

### Key Features
- ✅ **Works Offline** - Full functionality without internet connection
- ✅ **Mobile Optimized** - Touch-friendly interface for tablets and phones
- ✅ **Real-Time Updates** - Changes sync when back online
- ✅ **Drag & Drop** - Easy member group assignments
- ✅ **Multi-Section** - Manage multiple Scout sections from one interface

## Architecture Summary

### Technology Stack
```
Frontend:  React 19 + Vite + Capacitor + TailwindCSS
Backend:   Node.js Express (OSM API proxy)
Storage:   SQLite (offline) + localStorage (cache) + OSM API (source)
Deploy:    Render.com (frontend) + Northflank (backend)
Monitor:   Sentry (errors) + Structured logging
```

### Data Flow
```
OSM API ←→ Backend Proxy ←→ Frontend ←→ Local Cache ←→ SQLite DB
   ↑           ↑              ↑           ↑           ↑
Live Data   Rate Limit    User Interface  Fast Cache  Offline Store
```

### Key Design Principles
1. **Offline-First**: Never lose functionality due to network issues
2. **Mobile-Optimized**: Touch interactions and responsive layouts
3. **Rate-Limit Aware**: Respect OSM API limits to prevent blocking
4. **Error Resilient**: Graceful fallbacks when things go wrong
5. **Security Focused**: Secure authentication with minimal data exposure

## Detailed Documentation

### Architecture Deep-Dive
- **[System Overview](./architecture/SYSTEM_OVERVIEW.md)** - Technology stack and high-level design
- **[Authentication](./architecture/AUTHENTICATION.md)** - OAuth flow and security model
- **[Data Management](./architecture/DATA_MANAGEMENT.md)** - Caching and FlexiRecord systems
- **[Deployment](./architecture/DEPLOYMENT.md)** - Release management and CI/CD

### Setup & Development
- **[Mobile Setup](./MOBILE_SETUP.md)** - Capacitor configuration for iOS/Android
- **[Testing Strategy](./MOBILE_TESTING_STRATEGY.md)** - Unit, integration, and E2E testing
- **[Environment Configuration](./architecture/DEPLOYMENT.md#environment-configuration)** - Configuration and security

### Technical References
- **[Database Schema](./DATABASE_SCHEMA.md)** - SQLite table structure and relationships
- **[Caching Error Handling](./CACHING_ERROR_HANDLING.md)** - Production issue resolution patterns

## Common Workflows

### For Leaders (Using the App)
1. **Check Event Attendance**: Select event → View attendees → See who's coming
2. **Organize Camp Groups**: Drag members between groups → Sign members in/out
3. **Access Member Info**: Browse member directory → View contact details
4. **Work Offline**: Use cached data when no internet → Sync when back online

### For Developers (Contributing)
1. **Feature Development**: `git checkout -b feature/name` → develop → test → commit
2. **Code Quality**: `npm run lint && npm run test:run && npm run build`
3. **Pull Request**: Create PR → CodeRabbit review → address feedback → merge
4. **Release**: Version bump → tag → deploy → monitor

## Current Status (v1.1.0)

### Recently Completed ✅
- **Mobile UI Improvements**: 2-column camp group layout, responsive headers
- **Authentication Enhancements**: Proactive token monitoring, simplified flows
- **Code Standardization**: Debug log cleanup, utility module organization
- **Error Handling**: Enhanced Sentry integration, structured logging
- **Performance**: Rate limiting optimizations, cache improvements

### Known Limitations
- **Cache TTL Strategy**: Data expires even when offline (GitHub Issue #71)
- **Limited OSM Features**: Focus on events and attendance only
- **Single Organization**: Designed for 1st Walton on Thames Scout Group

### Monitoring & Health
- **Frontend**: [vikingeventmgmt.onrender.com](https://vikingeventmgmt.onrender.com)
- **Backend**: [Northflank Dashboard](https://app.northflank.com)
- **Errors**: [Sentry Dashboard](https://sentry.io/organizations/scouts/projects/)
- **Source Code**: [GitHub Repository](https://github.com/Walton-Viking-Scouts/VikingsEventMgmt)

## Support & Contributing

### Getting Help
- **Technical Issues**: Create GitHub issue with error details
- **Feature Requests**: Open GitHub discussion with requirements
- **Security Issues**: Email directly (don't create public issues)

### Contributing Guidelines
1. **Follow CLAUDE.md**: Development workflow and standards
2. **Test Thoroughly**: All tests must pass before PR
3. **Code Review**: Address all CodeRabbit feedback
4. **Documentation**: Update docs for significant changes

---

**For detailed technical information, see the `docs/architecture/` directory.**  
**For specific setup guides, see individual files in the `docs/` directory.**
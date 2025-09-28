# System Overview
**Viking Event Management - High-Level Architecture**

## Purpose
Mobile-first web application for Scout leaders to manage event attendance, member information, and camp group assignments with offline capabilities.

## Technology Stack

### Frontend
- **React 19.1.0** - Modern React with concurrent features
- **Vite 7.0.0** - Fast build tool with HMR
- **Capacitor 7.4.0** - Native mobile app capabilities  
- **TailwindCSS 4.1.11** - Utility-first CSS framework
- **React Router DOM 7.6.2** - Client-side routing

### Backend  
- **Node.js Express** - Lightweight proxy server
- **OAuth 2.0** - OSM authentication integration
- **Rate Limiting** - Multi-layer request protection

### Data & Storage
- **OSM API** - Authoritative data source (Online Scout Manager)
- **SQLite** - Local offline database (Capacitor)
- **localStorage** - Browser cache and settings
- **sessionStorage** - Temporary authentication data

### Deployment
- **Frontend**: Render.com (auto-deploy on PR merge)
- **Backend**: Code.run (auto-deploy on PR merge)
- **Releases**: GitHub Actions (tag-triggered with Sentry integration)

### Monitoring
- **Sentry** - Error tracking and performance monitoring
- **Structured Logging** - Comprehensive application logging

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Viking Event Management                      │
│                     Mobile Web Application                       │
│                    (React + Capacitor)                          │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Reference Data  │ │ Events Service  │ │ EventSyncService│    │
│  │ Service (NEW)   │ │    (NEW)        │ │   (ENHANCED)    │    │
│  │                 │ │                 │ │                 │    │
│  │ • Static Data   │ │ • Event Defs    │ │ • Attendance    │    │
│  │ • Load Once     │ │ • Cache-Only UI │ │ • Session Sync  │    │
│  │ • Session Cache │ │ • Manual Refresh│ │ • Manual Refresh│    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│           │                   │                   │             │
│           └───────────────────┼───────────────────┘             │
│                               │                                 │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTPS/OAuth
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Express.js Proxy Server                        │
│                    (Code.run)                                   │
│              • Rate Limiting                                    │
│              • OAuth Handling                                   │
│              • Request Proxying                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Authenticated API Calls
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                Online Scout Manager (OSM)                       │
│                   External API Service                          │
│              • Member Data                                      │
│              • Event Information                                │
│              • FlexiRecord System                               │
└─────────────────────────────────────────────────────────────────┘

Data Storage (Service-Specific):
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SQLite DB     │    │   localStorage  │    │  sessionStorage │
│  (Events &      │    │ (Reference Data │    │    (Auth)       │
│   Attendance)   │    │  Session Cache) │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Principles

### 1. Offline-First
- All data must be cacheable and accessible without connectivity
- Progressive enhancement from offline baseline
- Never lose functionality due to network issues

### 2. Mobile-Optimized
- Touch-first interactions and responsive design
- Optimized for tablet usage in field conditions
- Adaptive layouts for various screen sizes

### 3. Rate Limit Aware
- Respect OSM's strict API rate limits (100 req/min)
- Multi-layer protection against service blocking
- Intelligent request queuing and batching

### 4. Security Focused
- Token-based authentication with minimal credential exposure
- Session-based storage (cleared on browser close)
- Input validation and sanitization

### 5. Error Resilient
- Graceful degradation when services unavailable
- Comprehensive error handling with user-friendly messages
- Fallback to cached data for all operations

## Data Flow Summary

**NEW: Session-Based Three-Service Architecture**

1. **Authentication** → OAuth with OSM → Token stored in sessionStorage
2. **Reference Data Loading** → Static data loaded once at login (terms, user roles, startup data, members, FlexiRecord metadata)
3. **Events Loading** → Event definitions loaded separately (moderately dynamic)
4. **Attendance Sync** → Only EventSyncService refreshes during session (highly dynamic)
5. **UI Access** → All components cache-only, manual refresh controls
6. **Offline Operation** → Full functionality from cached data

## Key Business Capabilities

### Event Management (Events Service)
- View events across multiple Scout sections
- Cache-only UI access for instant loading
- Manual refresh control for Scout leaders
- Offline event data access

### Member Management (Reference Data Service)
- Comprehensive member directories loaded at login
- Contact information and patrol assignments
- Cross-section member handling
- Session-based caching (no refresh needed)

### Attendance Management (EventSyncService)
- Real-time attendance tracking
- Only service that refreshes during session
- Manual sync control for Scout leaders

### Camp Group System (Integrated across services)
- FlexiRecord metadata from Reference Data Service
- Camp group data from EventSyncService
- Visual group organization and status

### Responsive UI (Cache-Only)
- Desktop: Full-featured dashboard layout
- Tablet: Optimized for field usage
- Mobile: Compact efficient interface
- All components use cache-only access patterns

## Integration Points

### External Services
- **OSM API**: All member and event data
- **Sentry**: Error monitoring and performance tracking
- **GitHub**: Source control and CI/CD

### Internal Systems
- **Reference Data Service**: Static data loaded once at login (NEW)
- **Events Service**: Event definitions with cache-only UI access (NEW)
- **EventSyncService**: Attendance data with refresh capabilities (ENHANCED)
- **Database Service**: Local SQLite operations and localStorage fallbacks
- **Auth Service**: Session and token management
- **FlexiRecord Integration**: Camp group and sign-in data via services above

---

*For detailed technical implementation, see other architecture documents in this directory.*
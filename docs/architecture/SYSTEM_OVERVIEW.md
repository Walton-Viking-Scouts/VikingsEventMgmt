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
└─────────────────────────────────────────────────────────────────┘
                                  │
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

Local Storage Components:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SQLite DB     │    │   localStorage  │    │  sessionStorage │
│  (Offline)      │    │    (Cache)      │    │    (Auth)       │
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

1. **Authentication** → OAuth with OSM → Token stored in sessionStorage
2. **Data Loading** → API calls with fallback to local cache
3. **User Interaction** → Local updates with background sync
4. **Offline Operation** → Full functionality from cached data
5. **Online Sync** → Background refresh when connectivity restored

## Key Business Capabilities

### Event Management
- View events across multiple Scout sections
- Real-time attendance tracking
- Offline event data access

### Member Management  
- Comprehensive member directories
- Contact information and patrol assignments
- Cross-section member handling

### Camp Group System
- Drag-and-drop group assignments
- Sign-in/out tracking with timestamps
- Visual group organization and status

### Responsive UI
- Desktop: Full-featured dashboard layout
- Tablet: Optimized for field usage
- Mobile: Compact efficient interface

## Integration Points

### External Services
- **OSM API**: All member and event data
- **Sentry**: Error monitoring and performance tracking
- **GitHub**: Source control and CI/CD

### Internal Systems
- **FlexiRecord Service**: Camp group and sign-in data
- **Database Service**: Local SQLite operations
- **Sync Service**: Online/offline data coordination
- **Auth Service**: Session and token management

---

*For detailed technical implementation, see other architecture documents in this directory.*
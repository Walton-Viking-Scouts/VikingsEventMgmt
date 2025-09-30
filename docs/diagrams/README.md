---
title: "System Flow Diagrams"
description: "PlantUML sequence diagrams showing authentication, data flows, and API call patterns"
created: "2025-09-30"
last_updated: "2025-09-30"
version: "1.0.0"
tags: ["diagrams", "plantuml", "flows", "architecture"]
related_docs: ["../architecture/data-management.md", "../architecture/authentication.md", "../architecture/system-design.md"]
---

# System Flow Diagrams

PlantUML sequence diagrams documenting the complete data flow, API call patterns, and service interactions in Viking Event Management.

## Diagram Overview

### [01. Authentication Flow](./01-authentication-flow.puml)
**OAuth 2.0 authentication with OSM**

Shows the complete authentication lifecycle:
- Initial login with OAuth 2.0
- Token exchange and storage
- Token validation on API calls
- Session expiration handling
- Logout process

**Key Touchpoints:**
- Frontend → Backend → OSM API
- sessionStorage (token persistence)
- authHandler (401/403 handling)
- Sentry user context

**API Calls:** 0 after initial auth (OAuth handled by backend)

---

### [02. Initial Login Data Load](./02-initial-login-data-load.puml)
**Three-service architecture post-authentication**

Complete data loading sequence after successful login:

#### Phase 1: Reference Data Service
- `getTerms()` - Term data for all sections
- `getUserRoles()` - User's section access
- `getStartupData()` - Global configuration
- `getListOfMembers()` - Member lists for all sections
- `getFlexiRecords()` - FlexiRecord lists and structures

**Storage:** IndexedDB (UnifiedStorageService)
**API Calls:** 5

#### Phase 2: Events Service
- `fetchMostRecentTermId()` - Current term per section
- `getEvents()` - Event definitions per section
- `detectAndStoreSharedEventsAcrossSections()` - Multi-section event detection

**Storage:** IndexedDB (events + shared metadata)
**API Calls:** 2-6 (depending on number of sections)

#### Phase 3: EventSync Service
- `getEventAttendance()` - Regular attendance per event (batched)
- `getSharedEventAttendance()` - Multi-section event attendance

**Storage:** IndexedDB (attendance + shared attendance)
**API Calls:** 5-20 (depending on number of events)

**Total API Calls:** 12-31 calls at login
**Load Time:** 3-10 seconds (one-time per session)

---

### [03. Refresh Button Flow](./03-refresh-button-flow.puml)
**Manual data refresh during session**

User clicks the blue refresh button on event dashboard:

#### What Gets Refreshed:
- ✅ **Attendance Data** - Fresh from API
- ✅ **Shared Attendance** - Fresh from API for multi-section events
- ❌ **Reference Data** - Uses cache (no API calls)
- ❌ **Event Definitions** - Uses cache (no API calls)

#### Process:
1. Get cached events (no API call)
2. Batch sync attendance for all events (5-20 API calls)
3. Sync shared attendance for shared events (1-3 API calls)
4. Update cache and re-render UI

**Key Features:**
- Rate limiting (200ms delay between requests)
- Batch processing for multiple events
- Error handling (offline, rate-limited, auth failed)

**API Calls:** 5-25 (only attendance data refreshed)
**Refresh Time:** 2-5 seconds

---

### [04. Opening Attendance Card](./04-attendance-card-opening.puml)
**Cache-only access when viewing event details**

User clicks an event card to view attendance:

#### Data Loading (All from Cache):
1. **Regular Attendance** - From IndexedDB
2. **Shared Event Check** - From IndexedDB metadata
3. **Shared Attendance** - From IndexedDB (if shared event)
4. **Camp Groups** - From IndexedDB FlexiRecord data

**API Calls:** 0 (100% cache-only)
**Load Time:** <100ms (instant)

#### UI Behavior:
- Optimistic updates for attendance changes
- Background sync queued when network available
- Multiple tabs shown based on data availability:
  - Attendance tab (always)
  - Shared Attendance tab (if multi-section event)
  - Camp Groups tab (if FlexiRecord data exists)

**Key Principle:** All UI components use cache-only access pattern

---

### [05. Page Refresh Flow](./05-page-refresh-flow.puml)
**Browser refresh (F5) - session-based cache strategy**

User presses F5 or reloads the page:

#### Session Preservation:
- ✅ **Token** - Survives in sessionStorage
- ✅ **Reference Data** - Loaded from IndexedDB cache
- ✅ **Events** - Loaded from IndexedDB cache
- ✅ **Attendance** - Loaded from IndexedDB cache (last synced)

**API Calls:** 0 (everything from cache)
**Load Time:** <1 second

#### Comparison Table:

| Scenario | Token | Reference | Events | Attendance | API Calls | Time |
|----------|-------|-----------|--------|------------|-----------|------|
| **Initial Login** | OAuth flow | Fresh API | Fresh API | Fresh API | 12-31 | 3-10s |
| **Page Refresh (F5)** | sessionStorage | Cache | Cache | Cache | 0 | <1s |
| **Manual Refresh Button** | sessionStorage | Cache | Cache | Fresh API | 5-25 | 2-5s |

---

## Viewing the Diagrams

### Option 1: VS Code with PlantUML Extension
1. Install "PlantUML" extension in VS Code
2. Open any `.puml` file
3. Press `Alt+D` or use Command Palette → "PlantUML: Preview Current Diagram"

### Option 2: Online PlantUML Editor
1. Visit http://www.plantuml.com/plantuml/uml/
2. Copy/paste diagram content
3. View rendered diagram

### Option 3: Generate PNG Images
```bash
# Install PlantUML (requires Java)
brew install plantuml  # macOS
sudo apt install plantuml  # Linux

# Generate all diagrams
cd docs/diagrams
plantuml *.puml

# Generates PNG files for each diagram
```

---

## Architecture Principles Illustrated

### 1. **Three-Service Architecture**
- **Reference Data Service:** Static data, load once at login
- **Events Service:** Moderately dynamic, cache-only UI access
- **EventSync Service:** Highly dynamic, only service that refreshes

### 2. **Cache-First Pattern**
- All UI components use cache-only access
- No API calls from UI layer
- Dedicated services handle API calls

### 3. **Session-Based Caching**
- Reference data cached for entire session (until logout)
- Events cached until manual refresh
- Attendance can be refreshed during session

### 4. **Shared Event Handling**
- Automatic detection of multi-section events
- Separate API calls for shared attendance
- Cached alongside regular attendance

### 5. **Offline-First Design**
- Zero API calls on page refresh (F5)
- All data accessible from cache
- Graceful degradation when offline

---

## API Call Summary

### By Scenario:
- **Initial Login:** 12-31 API calls (one-time per session)
- **Page Refresh (F5):** 0 API calls (instant from cache)
- **Refresh Button:** 5-25 API calls (attendance only)
- **Opening Attendance Card:** 0 API calls (cache-only)
- **Attendance Updates:** Batched background sync

### By Service:
- **Reference Data Service:** 5 calls at login, 0 during session
- **Events Service:** 2-6 calls at login, 0 during session
- **EventSync Service:** 5-20 calls at login, 5-25 on refresh

### Rate Limiting Protection:
- 200ms delay between batched requests
- Maximum ~100 requests/minute (OSM limit)
- Concurrent request management
- Error recovery and retry logic

---

## Related Documentation

- **[Data Management Architecture](../architecture/data-management.md)** - Detailed service architecture
- **[Authentication Architecture](../architecture/authentication.md)** - OAuth 2.0 implementation
- **[System Design Overview](../architecture/system-design.md)** - Complete technical architecture

---

*Diagrams Version: 1.0.0*
*Last Updated: 2025-09-30*
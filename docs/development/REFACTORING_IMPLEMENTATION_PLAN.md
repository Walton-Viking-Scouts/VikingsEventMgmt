---
title: "Refactoring Implementation Plan: URL-Based Routing"
description: "Step-by-step implementation plan for transitioning to URL-based routing and component refactoring"
created: "2025-01-06"
last_updated: "2025-01-06"
version: "1.0.0"
tags: ["refactoring", "routing", "implementation", "plan"]
related_docs: ["TECHNICAL_DEBT_REPORT.md", "../RELEASE_DOCUMENTATION_RESTRUCTURE.md"]
---

# Refactoring Implementation Plan: URL-Based Routing

Strategic implementation plan for transitioning from state-based navigation to URL-based routing while minimizing disruption and maintaining functionality.

## 🎯 Implementation Strategy

### **Core Principle: Incremental Migration**
- Maintain existing functionality throughout the process
- Use feature flags to enable gradual rollout
- Ensure backward compatibility during transition
- Test thoroughly at each step

## 📋 Phase 1: Foundation Setup (Week 1)

### **Step 1.1: Install and Configure React Router**
```bash
# Install React Router (if not already present)
npm install react-router-dom

# Verify current routing setup
grep -r "react-router" src/
```

### **Step 1.2: Create Basic Route Structure**
**Priority**: Start with the simplest, most isolated page first

**Create**: `src/routes/AppRouter.jsx`
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

// Feature flag for gradual rollout
const USE_URL_ROUTING = process.env.VITE_USE_URL_ROUTING === 'true';

function AppRouter() {
  if (!USE_URL_ROUTING) {
    // Return existing App component during transition
    return <ExistingApp />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Start with Movers - already well-organized */}
        <Route path="/movers" element={<MoversPage />} />
        
        {/* Sections - simpler than Events */}
        <Route path="/sections" element={<SectionsPage />} />
        
        {/* Events - most complex, do last */}
        <Route path="/events/*" element={<EventsRouter />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/events" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### **Step 1.3: Environment Configuration**
**Add to `.env.example` and `.env.local`:**
```bash
# Feature flag for URL routing rollout
VITE_USE_URL_ROUTING=false
```

## 📋 Phase 2: Movers Page Migration (Week 1-2)

### **Why Start with Movers?**
- Already well-organized (238 lines)
- Has proper feature-based structure
- Least complex of the three main pages
- Good pattern to establish for other pages

### **Step 2.1: Create Movers Route**
**Create**: `src/pages/movers/MoversPage.jsx`
```jsx
import { SectionMovementTracker } from '../../components/sectionMovements/SectionMovementTracker';

function MoversPage() {
  return (
    <div className="movers-page">
      <SectionMovementTracker />
    </div>
  );
}

export default MoversPage;
```

### **Step 2.2: Test Movers in Isolation**
```bash
# Enable URL routing for testing
VITE_USE_URL_ROUTING=true npm run dev

# Test navigation to /movers
# Verify all functionality works
# Test browser back/forward buttons
```

### **Step 2.3: Update Navigation Links**
**Modify existing navigation to support both patterns:**
```jsx
function Navigation() {
  const useUrlRouting = process.env.VITE_USE_URL_ROUTING === 'true';
  
  const handleMoversClick = () => {
    if (useUrlRouting) {
      // Let React Router handle it
      return;
    } else {
      // Existing state-based navigation
      setCurrentView('movers');
    }
  };

  return (
    <nav>
      {useUrlRouting ? (
        <Link to="/movers">Movers</Link>
      ) : (
        <button onClick={handleMoversClick}>Movers</button>
      )}
    </nav>
  );
}
```

## 📋 Phase 3: Sections Page Migration (Week 2)

### **Step 3.1: Analyze Current Sections Implementation**
```bash
# Find all Sections-related components
find src -name "*[Ss]ection*" -type f
grep -r "sections\|Sections" src/components/
```

### **Step 3.2: Create Sections Route Structure**
**Create**: `src/pages/sections/SectionsPage.jsx`
```jsx
function SectionsPage() {
  // Extract sections logic from existing components
  return (
    <div className="sections-page">
      <SectionsHeader />
      <SectionsList />
    </div>
  );
}
```

### **Step 3.3: Extract Sections Components**
**Move sections-specific components:**
```bash
# Create sections component directory
mkdir -p src/components/sections

# Move relevant components (identify during analysis)
# Update imports accordingly
```

## 📋 Phase 4: Events Page Preparation (Week 3)

### **Step 4.1: Analyze AttendanceView.jsx Structure**
**Before breaking it down, understand the current structure:**
```bash
# Analyze the 2,240-line file
wc -l src/components/AttendanceView.jsx
grep -n "viewMode\|tab\|switch" src/components/AttendanceView.jsx
```

### **Step 4.2: Identify Sub-page Boundaries**
**Map out the 5 sub-pages within AttendanceView.jsx:**
1. **Dashboard** - Card-based event overview
2. **Overview** - Event details and information
3. **Register** - Event registration/attendance
4. **Detail** - Detailed event information
5. **Camp Groups** - Camp group management

### **Step 4.3: Create Events Route Structure**
**Create**: `src/routes/EventsRouter.jsx`
```jsx
import { Routes, Route } from 'react-router-dom';

function EventsRouter() {
  return (
    <Routes>
      <Route index element={<EventsDashboard />} />
      <Route path="overview" element={<EventsOverview />} />
      <Route path="register" element={<EventsRegister />} />
      <Route path="detail/:eventId" element={<EventsDetail />} />
      <Route path="camp-groups" element={<EventsCampGroups />} />
    </Routes>
  );
}
```

## 📋 Phase 5: Events Sub-page Extraction (Week 3-4)

### **Step 5.1: Extract in Order of Complexity (Simplest First)**

#### **5.1.1: Events Dashboard (Simplest)**
**Create**: `src/pages/events/EventsDashboard.jsx`
```jsx
function EventsDashboard() {
  // Extract dashboard logic from AttendanceView.jsx
  // This is likely the card-based overview
  return (
    <div className="events-dashboard">
      <EventsHeader />
      <EventsCards />
    </div>
  );
}
```

#### **5.1.2: Events Overview**
**Create**: `src/pages/events/EventsOverview.jsx`
```jsx
function EventsOverview() {
  // Extract overview logic
  return (
    <div className="events-overview">
      <EventOverviewContent />
    </div>
  );
}
```

#### **5.1.3: Events Register**
**Create**: `src/pages/events/EventsRegister.jsx`

#### **5.1.4: Events Detail**
**Create**: `src/pages/events/EventsDetail.jsx`
```jsx
import { useParams } from 'react-router-dom';

function EventsDetail() {
  const { eventId } = useParams();
  // Use eventId for specific event details
}
```

#### **5.1.5: Events Camp Groups (Most Complex)**
**Create**: `src/pages/events/EventsCampGroups.jsx`
```jsx
function EventsCampGroups() {
  // Extract camp groups logic from CampGroupsView.jsx (1,727 lines)
  // This will need further breakdown
}
```

### **Step 5.2: Gradual Component Migration**
**For each sub-page extraction:**
1. **Copy** relevant code from AttendanceView.jsx
2. **Test** in isolation with URL routing enabled
3. **Refactor** to remove dependencies on parent state
4. **Update** navigation to use React Router Links
5. **Remove** extracted code from AttendanceView.jsx

## 📋 Phase 6: Navigation Integration (Week 4)

### **Step 6.1: Update Main Navigation**
**Replace state-based navigation with React Router:**
```jsx
import { Link, useLocation } from 'react-router-dom';

function MainNavigation() {
  const location = useLocation();
  
  return (
    <nav>
      <Link 
        to="/events" 
        className={location.pathname.startsWith('/events') ? 'active' : ''}
      >
        Events
      </Link>
      <Link 
        to="/sections"
        className={location.pathname === '/sections' ? 'active' : ''}
      >
        Sections
      </Link>
      <Link 
        to="/movers"
        className={location.pathname === '/movers' ? 'active' : ''}
      >
        Movers
      </Link>
    </nav>
  );
}
```

### **Step 6.2: Update Events Sub-navigation**
**Create tabbed navigation using React Router:**
```jsx
function EventsNavigation() {
  return (
    <nav className="events-tabs">
      <Link to="/events">Dashboard</Link>
      <Link to="/events/overview">Overview</Link>
      <Link to="/events/register">Register</Link>
      <Link to="/events/detail">Detail</Link>
      <Link to="/events/camp-groups">Camp Groups</Link>
    </nav>
  );
}
```

## 📋 Phase 7: API Service Refactoring (Week 5)

### **Step 7.1: Analyze Current API Service**
```bash
# Understand the 2,214-line API service
wc -l src/services/api.js
grep -n "function\|export" src/services/api.js | head -20
```

### **Step 7.2: Split by Feature**
**Create feature-specific API services:**
```
src/services/api/
├── base.js              # Base API configuration
├── events.js            # Events-related API calls
├── sections.js          # Sections-related API calls
├── members.js           # Members-related API calls
├── attendance.js        # Attendance-related API calls
├── flexiRecords.js      # FlexiRecords-related API calls
└── index.js             # Re-export all services
```

### **Step 7.3: Gradual Migration**
1. **Create** new service files
2. **Move** related functions from main api.js
3. **Update** imports in components
4. **Test** each service independently
5. **Remove** migrated code from main api.js

## 📋 Phase 8: Testing and Cleanup (Week 5-6)

### **Step 8.1: Comprehensive Testing**
```bash
# Test all routes
npm run test:e2e

# Test navigation
# Test browser back/forward buttons
# Test direct URL access
# Test bookmarking
```

### **Step 8.2: Remove Legacy Code**
1. **Remove** state-based navigation code
2. **Remove** feature flags
3. **Clean up** unused components
4. **Update** documentation

### **Step 8.3: Performance Verification**
```bash
# Check bundle size impact
npm run build
npm run analyze  # if available

# Monitor performance metrics
# Verify no regressions
```

## ⚠️ Risk Mitigation Strategies

### **1. Maintain Backward Compatibility**
- Use feature flags throughout transition
- Keep existing code until new routes are proven
- Gradual rollout to users

### **2. Comprehensive Testing**
- Test each phase thoroughly before proceeding
- Maintain existing test suite
- Add new tests for routing

### **3. Rollback Plan**
- Keep feature flags for quick rollback
- Document rollback procedures
- Monitor error rates during rollout

### **4. Team Communication**
- Daily standups during refactoring
- Clear documentation of changes
- Pair programming for complex extractions

## 📊 Success Metrics

### **Phase Completion Criteria**
- [ ] All routes accessible via URL
- [ ] Browser navigation works correctly
- [ ] No functionality regressions
- [ ] Performance maintained or improved
- [ ] All tests passing

### **Overall Success Indicators**
- [ ] No component exceeds 500 lines
- [ ] Clear feature-based organization
- [ ] Improved developer velocity
- [ ] Better user experience (bookmarkable URLs)

## 🎯 Timeline Summary

| Phase | Duration | Focus | Risk Level |
|-------|----------|-------|------------|
| 1 | Week 1 | Foundation setup | Low |
| 2 | Week 1-2 | Movers migration | Low |
| 3 | Week 2 | Sections migration | Medium |
| 4 | Week 3 | Events preparation | Medium |
| 5 | Week 3-4 | Events extraction | High |
| 6 | Week 4 | Navigation integration | Medium |
| 7 | Week 5 | API refactoring | Medium |
| 8 | Week 5-6 | Testing & cleanup | Low |

**Total Duration**: 5-6 weeks with careful, incremental approach

---

*This plan prioritizes safety and maintainability over speed, ensuring a smooth transition with minimal disruption to development and user experience.*
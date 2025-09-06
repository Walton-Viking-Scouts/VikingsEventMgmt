---
title: "Architectural Refactoring Plan"
description: "Implementation plan to address critical technical debt: monolithic components and state-based navigation"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["refactoring", "architecture", "technical-debt", "routing"]
related_docs: ["TECHNICAL_DEBT_REPORT.md"]
---

# Architectural Refactoring Plan

Implementation plan to address the **critical technical debt items** identified in the Technical Debt Report, specifically focusing on architectural issues that impact development velocity and maintainability.

## 🎯 Technical Debt Items Addressed

This plan specifically addresses the **High Priority** technical debt items:

### **Critical Issue #1: Monolithic Page Components**
- **AttendanceView.jsx**: 2,240 lines containing 5 sub-pages
- **CampGroupsView.jsx**: 1,727 lines of complex logic  
- **EventDashboard.jsx**: 1,043 lines mixing concerns
- **API service**: 2,214 lines for entire application

### **Critical Issue #2: Poor Page Architecture and Routing**
- State-based navigation instead of URL routing
- Events sub-pages embedded in single component using `viewMode`
- No URL persistence, browser integration issues

### **Critical Issue #3: Confused Feature Separation**
- Mixed architectural patterns across features
- Flat component structure with poor boundaries
- Business logic mixed with UI rendering

## 📋 Implementation Strategy

### **Core Principles**
- **Incremental migration** - maintain functionality throughout
- **Feature flags** - enable gradual rollout and quick rollback
- **Start simple** - begin with least complex pages
- **Test thoroughly** - comprehensive testing at each step

## 🚀 Phase 1: URL-Based Routing Foundation (Week 1)

### **Objective**: Establish routing infrastructure without breaking existing functionality

### **Step 1.1: Install React Router**
```bash
# Install if not present
npm install react-router-dom
```

### **Step 1.2: Create Router with Feature Flag**
**Create**: `src/routes/AppRouter.jsx`
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Feature flag for gradual rollout
const USE_URL_ROUTING = process.env.VITE_USE_URL_ROUTING === 'true';

function AppRouter() {
  if (!USE_URL_ROUTING) {
    return <ExistingApp />; // Current state-based app
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/movers" element={<MoversPage />} />
        <Route path="/sections" element={<SectionsPage />} />
        <Route path="/events/*" element={<EventsRouter />} />
        <Route path="/" element={<Navigate to="/events" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### **Step 1.3: Environment Configuration**
```bash
# Add to .env.example and .env.local
VITE_USE_URL_ROUTING=false  # Start disabled
```

**Technical Debt Items Fixed**: Partial fix for Issue #2 (routing foundation)

## 🚀 Phase 2: Movers Page Migration (Week 1-2)

### **Objective**: Migrate simplest page first to establish pattern

### **Why Movers First?**
- Already well-organized (238 lines)
- Proper feature-based structure exists
- Lowest risk, builds confidence

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
```

### **Step 2.2: Test and Validate**
```bash
# Enable routing for testing
VITE_USE_URL_ROUTING=true npm run dev
# Test /movers route functionality
```

**Technical Debt Items Fixed**: Partial fix for Issue #3 (establishes proper page pattern)

## 🚀 Phase 3: Sections Page Migration (Week 2)

### **Objective**: Apply established pattern to second page

### **Step 3.1: Create Sections Page Structure**
**Create**: `src/pages/sections/SectionsPage.jsx`
```jsx
function SectionsPage() {
  return (
    <div className="sections-page">
      <SectionsHeader />
      <SectionsList />
    </div>
  );
}
```

### **Step 3.2: Extract Sections Components**
```bash
# Create feature directory
mkdir -p src/components/sections
# Move sections-specific components
```

**Technical Debt Items Fixed**: Continued progress on Issue #3 (feature separation)

## 🚀 Phase 4: Events Sub-page Extraction (Week 3-4)

### **Objective**: Break down the 2,240-line AttendanceView.jsx monolith

### **Step 4.1: Create Events Router**
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

### **Step 4.2: Extract Sub-pages (Order by Complexity)**

#### **4.2.1: Events Dashboard (Simplest)**
**Create**: `src/pages/events/EventsDashboard.jsx`
- Extract card-based dashboard logic from AttendanceView.jsx
- Target: <500 lines

#### **4.2.2: Events Overview**
**Create**: `src/pages/events/EventsOverview.jsx`
- Extract overview tab logic
- Target: <500 lines

#### **4.2.3: Events Register**
**Create**: `src/pages/events/EventsRegister.jsx`
- Extract registration/attendance logic
- Target: <500 lines

#### **4.2.4: Events Detail**
**Create**: `src/pages/events/EventsDetail.jsx`
```jsx
import { useParams } from 'react-router-dom';

function EventsDetail() {
  const { eventId } = useParams();
  // Use URL parameter for event-specific details
}
```

#### **4.2.5: Events Camp Groups (Most Complex)**
**Create**: `src/pages/events/EventsCampGroups.jsx`
- Extract from both AttendanceView.jsx and CampGroupsView.jsx
- May need further breakdown if >500 lines

### **Step 4.3: Incremental Extraction Process**
For each sub-page:
1. **Copy** relevant code from AttendanceView.jsx
2. **Create** new page component
3. **Test** in isolation with URL routing
4. **Refactor** to remove parent dependencies
5. **Update** navigation to use React Router
6. **Remove** extracted code from AttendanceView.jsx

**Technical Debt Items Fixed**: Major progress on Issue #1 (monolithic components)

## 🚀 Phase 5: API Service Refactoring (Week 5)

### **Objective**: Break down 2,214-line API service

### **Step 5.1: Create Feature-Based API Services**
```
src/services/api/
├── base.js              # Base configuration
├── events.js            # Events API calls
├── sections.js          # Sections API calls  
├── members.js           # Members API calls
├── attendance.js        # Attendance API calls
├── flexiRecords.js      # FlexiRecords API calls
└── index.js             # Re-export all
```

### **Step 5.2: Gradual Migration**
1. **Create** new service files
2. **Move** related functions from main api.js
3. **Update** imports in components
4. **Test** each service independently
5. **Remove** migrated code from api.js

**Technical Debt Items Fixed**: Completes Issue #1 (monolithic components)

## 🚀 Phase 6: Feature-Based Organization (Week 6)

### **Objective**: Complete feature separation

### **Step 6.1: Reorganize Component Structure**
```
src/
├── pages/
│   ├── events/          # Events pages
│   ├── sections/        # Sections pages
│   └── movers/          # Movers pages
├── components/
│   ├── events/          # Events-specific components
│   ├── sections/        # Sections-specific components
│   ├── shared/          # Shared components
│   └── ui/              # Base UI components
└── services/
    ├── events/          # Events services
    ├── sections/        # Sections services
    └── shared/          # Shared services
```

**Technical Debt Items Fixed**: Completes Issue #3 (feature separation)

## ✅ Success Criteria

### **Phase Completion Criteria**
- [ ] All routes accessible via URL
- [ ] Browser back/forward buttons work
- [ ] No component exceeds 500 lines
- [ ] Clear feature-based organization
- [ ] All functionality preserved
- [ ] All tests passing

### **Technical Debt Resolution**
- [ ] **Issue #1 RESOLVED**: No monolithic components (all <500 lines)
- [ ] **Issue #2 RESOLVED**: URL-based routing implemented
- [ ] **Issue #3 RESOLVED**: Clear feature boundaries established

## 📊 Expected Impact

### **Development Velocity**
- **50-70% improvement** in feature development speed
- **Easier debugging** with focused, single-responsibility components
- **Simplified testing** with isolated page components

### **User Experience**
- **Bookmarkable URLs** for all pages and sub-pages
- **Proper browser integration** (back/forward buttons)
- **Shareable links** to specific views

### **Code Maintainability**
- **Clear feature boundaries** make code easier to locate and modify
- **Consistent patterns** across all pages
- **Scalable architecture** for future feature additions

## ⚠️ Risk Mitigation

### **High Risk: Breaking Existing Functionality**
- **Mitigation**: Feature flags allow instant rollback
- **Testing**: Comprehensive testing at each phase
- **Gradual rollout**: Enable for testing before user rollout

### **Medium Risk: Complex State Dependencies**
- **Mitigation**: Careful analysis of shared state before extraction
- **Strategy**: Move shared state to contexts or URL parameters
- **Fallback**: Keep original components until extraction proven

## 📈 Timeline

| Phase | Duration | Focus | Risk |
|-------|----------|-------|------|
| 1 | Week 1 | Routing foundation | Low |
| 2 | Week 1-2 | Movers migration | Low |
| 3 | Week 2 | Sections migration | Medium |
| 4 | Week 3-4 | Events extraction | High |
| 5 | Week 5 | API refactoring | Medium |
| 6 | Week 6 | Organization cleanup | Low |

**Total Duration**: 6 weeks with careful, incremental approach

---

*This plan specifically addresses the critical architectural technical debt items. Other technical debt items (TypeScript adoption, token refresh, etc.) should be addressed separately after these foundational issues are resolved.*
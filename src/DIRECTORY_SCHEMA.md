# Feature-Based Directory Schema

## Overview
This document defines the target directory structure for reorganizing the Vikings Event Management mobile app from a flat structure to a feature-based organization.

## Root Structure

```
src/
├── features/           # Feature-specific code
│   ├── auth/
│   ├── events/
│   ├── sections/
│   ├── movements/
│   └── admin/
├── shared/             # Shared utilities and services
│   ├── components/     # Reusable UI components
│   ├── hooks/          # Shared custom hooks
│   ├── services/       # Core services (API, database, etc.)
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript definitions (if applicable)
├── contexts/           # React contexts (app-wide state)
├── routes/             # Routing configuration
└── assets/             # Static assets
```

## Feature Directory Structure

Each feature directory follows this consistent pattern:

```
features/{feature-name}/
├── components/         # Feature-specific components
│   ├── {FeatureName}Page.jsx      # Main page component
│   ├── {FeatureName}List.jsx      # List components
│   ├── {FeatureName}Item.jsx      # Item components
│   ├── {FeatureName}Form.jsx      # Form components
│   └── index.js                   # Barrel exports
├── hooks/              # Feature-specific hooks
│   ├── use{FeatureName}.js
│   └── index.js
├── services/           # Feature-specific services
│   ├── {featureName}Service.js
│   └── index.js
├── utils/              # Feature-specific utilities
│   └── index.js
└── index.js            # Main feature export
```

## Specific Feature Organization

### 1. Authentication Feature (`features/auth/`)
```
features/auth/
├── components/
│   ├── LoginForm.jsx
│   ├── AuthStatus.jsx
│   ├── OSMLoginButton.jsx
│   └── index.js
├── hooks/
│   ├── useAuth.js
│   ├── useRouteGuards.js
│   └── index.js
├── services/
│   ├── authService.js
│   └── index.js
└── index.js
```

### 2. Events Feature (`features/events/`)
```
features/events/
├── components/
│   ├── EventsPage.jsx
│   ├── EventsList.jsx
│   ├── EventCard.jsx
│   ├── EventDetails.jsx
│   ├── EventHeader.jsx
│   ├── AttendanceControls.jsx
│   ├── AttendanceGrid.jsx
│   ├── AttendanceStats.jsx
│   └── index.js
├── hooks/
│   ├── useEvents.js
│   ├── useAttendance.js
│   └── index.js
├── services/
│   ├── eventsService.js
│   ├── attendanceService.js
│   └── index.js
└── index.js
```

### 3. Sections Feature (`features/sections/`)
```
features/sections/
├── components/
│   ├── SectionsPage.jsx
│   ├── SectionsList.jsx
│   ├── SectionCard.jsx
│   ├── SectionDetails.jsx
│   ├── MembersList.jsx
│   ├── MemberCard.jsx
│   └── index.js
├── hooks/
│   ├── useSections.js
│   ├── useMembers.js
│   └── index.js
├── services/
│   ├── sectionsService.js
│   ├── membersService.js
│   └── index.js
└── index.js
```

### 4. Movements Feature (`features/movements/`)
```
features/movements/
├── components/
│   ├── SectionMovementsPage.jsx
│   ├── MovementsGrid.jsx
│   ├── MoveButton.jsx
│   └── index.js
├── hooks/
│   ├── useMovements.js
│   └── index.js
├── services/
│   ├── movementsService.js
│   └── index.js
└── index.js
```

### 5. Admin Feature (`features/admin/`)
```
features/admin/
├── components/
│   ├── DataClearPage.jsx
│   ├── AdminPanel.jsx
│   └── index.js
├── hooks/
│   └── index.js
├── services/
│   └── index.js
└── index.js
```

## Shared Directory Organization

### Shared Components (`shared/components/`)
```
shared/components/
├── ui/                 # Basic UI components
│   ├── Card.jsx
│   ├── LoadingSpinner.jsx
│   ├── ErrorBoundary.jsx
│   └── index.js
├── layout/             # Layout components
│   ├── Header.jsx
│   ├── MainNavigation.jsx
│   ├── Footer.jsx
│   └── index.js
├── forms/              # Form components
│   ├── FormField.jsx
│   ├── FormButton.jsx
│   └── index.js
└── index.js            # Main barrel export
```

### Shared Hooks (`shared/hooks/`)
```
shared/hooks/
├── useURLSync.js
├── useLocalStorage.js
├── useApi.js
├── useDebounce.js
└── index.js
```

### Shared Services (`shared/services/`)
```
shared/services/
├── api/
│   ├── apiClient.js
│   ├── apiConfig.js
│   └── index.js
├── storage/
│   ├── database.js
│   ├── localStorage.js
│   └── index.js
├── utils/
│   ├── logger.js
│   ├── dateUtils.js
│   ├── validation.js
│   └── index.js
└── index.js
```

## Naming Conventions

### Files and Directories
- **Feature directories**: lowercase with hyphens (e.g., `section-movements`)
- **Component files**: PascalCase with .jsx extension (e.g., `EventCard.jsx`)
- **Hook files**: camelCase starting with "use" (e.g., `useEvents.js`)
- **Service files**: camelCase ending with "Service" (e.g., `eventsService.js`)
- **Utility files**: camelCase (e.g., `dateUtils.js`)

### Components
- **Page components**: `{FeatureName}Page.jsx` (e.g., `EventsPage.jsx`)
- **List components**: `{FeatureName}List.jsx` (e.g., `EventsList.jsx`)
- **Item components**: `{FeatureName}Card.jsx` or `{FeatureName}Item.jsx`
- **Form components**: `{FeatureName}Form.jsx`

### Services
- **Feature services**: `{featureName}Service.js` (e.g., `eventsService.js`)
- **API services**: `{resource}Api.js` (e.g., `eventsApi.js`)

## Import Patterns

### Barrel Exports
Each directory should have an `index.js` file that exports all public components/functions:

```javascript
// features/events/components/index.js
export { default as EventsPage } from './EventsPage.jsx';
export { default as EventsList } from './EventsList.jsx';
export { default as EventCard } from './EventCard.jsx';
```

### Import Examples
```javascript
// Import from features
import { EventsPage, EventsList } from '@/features/events/components';
import { useEvents } from '@/features/events/hooks';

// Import from shared
import { Card } from '@/shared/components/ui';
import { useApi } from '@/shared/hooks';
```

## Migration Strategy

1. **Create new directory structure** (Task 17.3)
2. **Move components by feature** (Task 17.4)
3. **Update all import statements** (Task 17.5)
4. **Test and verify functionality** (Task 17.6)

## Benefits

- **Feature isolation**: Each feature is self-contained
- **Easier navigation**: Related code is co-located
- **Scalability**: Easy to add new features
- **Maintainability**: Clear separation of concerns
- **Team collaboration**: Multiple developers can work on different features
- **Testing**: Feature-specific tests are easier to organize
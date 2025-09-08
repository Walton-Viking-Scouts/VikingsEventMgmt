# Directory Structure

**Feature-Based Architecture for Viking Event Management**

This document outlines the current directory structure of the Viking Event Management frontend application, following a feature-based architecture pattern for improved maintainability, scalability, and developer experience.

## Overview

The codebase is organized using a **feature-based directory structure** where related components, services, hooks, and pages are grouped by domain/feature rather than by file type. This approach provides:

- **Clear separation of concerns** - Each feature is self-contained
- **Improved maintainability** - Easy to locate and modify feature-specific code
- **Better scalability** - New features can be added without restructuring
- **Enhanced developer experience** - Logical grouping reduces cognitive load

## Root Directory Structure

```
src/
├── adapters/              # External service adapters
├── assets/                # Static assets (images, icons, etc.)
├── config/                # Application configuration
├── contexts/              # Global React contexts
├── features/              # Feature-based organization (MAIN STRUCTURE)
├── layouts/               # Application layout components
├── pages/                 # Top-level page components
├── routes/                # Routing configuration
├── services/              # Legacy/shared services
├── shared/                # Shared utilities and components
├── stories/               # Storybook stories
└── test/                  # Test utilities and setup
```

## Feature-Based Organization

### Core Features

Each feature follows a consistent internal structure:

```
src/features/{feature-name}/
├── components/            # Feature-specific UI components
├── hooks/                 # Feature-specific custom hooks
├── services/              # Feature-specific business logic
└── index.js              # Feature exports
```

### Current Features

#### 1. **Authentication** (`features/auth/`)
- **Purpose**: User authentication and authorization
- **Components**: AuthButton, login/logout flows
- **Hooks**: useAuth, useRouteGuards
- **Services**: auth.js, simpleAuthHandler.js

#### 2. **Events** (`features/events/`)
- **Purpose**: Event management and dashboard
- **Components**: Event display, filtering, management
- **Hooks**: Event-related data hooks
- **Services**: FlexiRecord integration, event data processing

#### 3. **Sections** (`features/sections/`)
- **Purpose**: Section management and member display
- **Components**: SectionsList, MemberDetailModal, SectionFilter
- **Hooks**: Section data management
- **Services**: Section-specific business logic

#### 4. **Movements** (`features/movements/`)
- **Purpose**: Member section transitions and assignments
- **Components**: MoversPage, AssignmentInterface, drag-and-drop components
- **Hooks**: useVikingSectionMovers, section movement logic
- **Services**: Viking Section Movers FlexiRecord integration

#### 5. **Admin** (`features/admin/`)
- **Purpose**: Administrative functions
- **Components**: DataClearPage, admin utilities
- **Hooks**: Admin-specific hooks
- **Services**: Administrative operations

### Pages Structure

Top-level page components that compose features:

```
src/pages/
├── events/                # Event-related pages
├── movers/                # Mover assignment pages
└── sections/              # Section management pages
```

## Shared Architecture

### Shared Components (`shared/components/`)

```
shared/components/
├── forms/                 # Reusable form components
├── guards/                # Route guards and protection
├── layout/                # Layout-related components
├── notifications/         # Notification system
└── ui/                    # Basic UI primitives
```

### Shared Services (`shared/services/`)

```
shared/services/
├── api/                   # API layer and HTTP clients
│   └── api/               # Core API functions
├── storage/               # Data persistence and caching
└── utils/                 # Service utilities (logger, sentry, etc.)
```

### Shared Utilities (`shared/utils/`)

```
shared/utils/
├── sectionMovements/      # Section movement utilities
└── [various utility files] # General-purpose utilities
```

## Context Organization

### Global Contexts (`contexts/`)

```
contexts/
├── app/                   # Application state context
└── notifications/         # Global notification system
```

### Shared Contexts (`shared/contexts/`)

```
shared/contexts/
├── app/                   # Shared app context utilities
└── notifications/         # Notification context utilities
```

## Import Path Conventions

### Internal Feature Imports
```javascript
// Within the same feature
import { ComponentName } from './components/ComponentName.jsx';
import { useFeatureHook } from './hooks/useFeatureHook.js';

// From feature index
import { FeatureComponent } from '../feature-name';
```

### Cross-Feature Imports
```javascript
// From other features
import { AuthButton } from '../auth/components/AuthButton.jsx';
import { useAuth } from '../auth/hooks/useAuth.js';
```

### Shared Resource Imports
```javascript
// Shared components
import { Button } from '../../shared/components/ui/Button.jsx';
import { useNotification } from '../../shared/contexts/notifications';

// Utilities
import { logger } from '../../shared/services/utils/logger.js';
import { safeGetItem } from '../../shared/utils/storageUtils.js';
```

## Directory Principles

### 1. **Feature Cohesion**
- All related files for a feature are grouped together
- Minimal cross-feature dependencies
- Self-contained feature modules

### 2. **Layered Architecture**
- **Pages**: Route-level components that compose features
- **Features**: Domain-specific functionality
- **Shared**: Cross-cutting concerns and utilities
- **Config**: Application-wide configuration

### 3. **Separation of Concerns**
- **Components**: UI presentation logic
- **Hooks**: State management and side effects
- **Services**: Business logic and external integrations
- **Utils**: Pure functions and utilities

### 4. **Import Hierarchy**
- Features can import from shared
- Shared cannot import from features
- Pages can import from features and shared
- No circular dependencies between features

## File Naming Conventions

### Components
- **PascalCase** for React components: `EventDashboard.jsx`
- **camelCase** for utilities and hooks: `useAuth.js`
- **kebab-case** for configuration files: `auth-config.js`

### Directories
- **camelCase** for feature directories: `sectionMovements`
- **kebab-case** for multi-word utilities: `section-movements`

### Index Files
- Each feature and major directory has an `index.js` for clean imports
- Exports should be explicit and well-documented

## Validation Rules

### ESLint Enforcement
The following ESLint rules enforce directory boundaries:

1. **No circular dependencies** between features
2. **Import path validation** to ensure proper layering
3. **Feature isolation** - features cannot import from each other directly
4. **Shared resource imports** must use proper paths

### Static Analysis
- Use dependency graph tools to detect violations
- Regular audits of import patterns
- Automated checks in CI/CD pipeline

## Migration History

### From Monolithic to Feature-Based
- **Previous**: All components in flat `src/components/` directory
- **Current**: Feature-based organization with shared resources
- **Benefits**: Improved maintainability, clearer boundaries, easier testing

### Key Improvements
1. **Reduced cognitive load** - developers know where to find code
2. **Better testing isolation** - feature tests are co-located
3. **Improved onboarding** - clear structure for new developers
4. **Enhanced scalability** - new features follow established patterns

## Future Considerations

### Potential Enhancements
1. **Feature flags integration** at the directory level
2. **Micro-frontend preparation** with clear feature boundaries
3. **Plugin architecture** for extensible features
4. **Automated feature scaffolding** tools

### Maintenance Guidelines
1. **Regular structure audits** to ensure compliance
2. **Documentation updates** when adding new features
3. **Team training** on directory conventions
4. **Tooling improvements** for better developer experience

---

**Last Updated**: September 2024  
**Maintained By**: Development Team  
**Review Schedule**: Monthly architecture reviews
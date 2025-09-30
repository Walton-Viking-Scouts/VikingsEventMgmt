---
title: "Architecture Documentation"
description: "Focused architectural documentation for Viking Event Management System"
created: "2025-09-06"
last_updated: "2025-09-30"
version: "2.0.0"
tags: ["architecture", "documentation", "index"]
related_docs: []
---

# Architecture Documentation

This directory contains focused architectural documentation for the Viking Event Management System.

## Current Architecture Documents

- **[System Design](./system-design.md)** - Comprehensive technical architecture and patterns
- **[Data Management](./data-management.md)** - Three-service architecture for offline access and shared events
- **[Directory Structure](./directory-structure.md)** - Feature-based architecture and organization
- **[Authentication](./authentication.md)** - OAuth 2.0 flow and security architecture
- **[State Management](./state-management.md)** - React Context and URL-based routing
- **[Deployment](./deployment.md)** - Release management and CI/CD pipeline

## System Flow Diagrams

Visual PlantUML sequence diagrams showing complete data flows and API call patterns:

- **[All Diagrams](../diagrams/README.md)** - Complete diagram collection with viewing instructions
- **[Authentication Flow](../diagrams/01-authentication-flow.puml)** - OAuth 2.0 with OSM
- **[Initial Login Data Load](../diagrams/02-initial-login-data-load.puml)** - Three-service post-auth loading
- **[Refresh Button Flow](../diagrams/03-refresh-button-flow.puml)** - Manual data synchronization
- **[Attendance Card Opening](../diagrams/04-attendance-card-opening.puml)** - Cache-only access pattern
- **[Page Refresh Flow](../diagrams/05-page-refresh-flow.puml)** - Browser reload (F5) behavior

## Documentation Standards

All architecture documents follow the [Documentation Maintenance Guide](../DOCUMENTATION_MAINTENANCE.md) standards:

### Required Frontmatter
```yaml
---
title: "Document Title"
description: "Brief description"
created: "YYYY-MM-DD"
last_updated: "YYYY-MM-DD"
version: "X.Y.Z"
tags: ["tag1", "tag2"]
related_docs: ["doc1.md", "doc2.md"]
---
```

### Document Structure
1. **Purpose & Scope** - What this component does
2. **Key Decisions** - Important architectural choices
3. **Implementation Details** - How it works technically
4. **Integration Points** - How it connects to other systems
5. **Monitoring & Troubleshooting** - Operational considerations

## Recent Updates (2025-09-30)

### Simplified Architecture
- **Deleted outdated sync documentation** (migration-implementation-guide.md, simplified-sync-architecture.md, sync-flow-comparison.md, optimized-sync-performance.md)
- **Removed duplicate system overview** (SYSTEM_OVERVIEW.md - consolidated into system-design.md)
- **Removed stub file** (ui-architecture.md - was incomplete)

### Enhanced Data Management
- **Added shared event attendance sync** - EventSyncService now handles multi-section event attendance
- **Updated frontmatter metadata** - All docs now follow documentation standards
- **Improved cross-references** - Related docs properly linked

## Related Documentation

For feature-specific guides and development processes, see:
- **[Getting Started](../getting-started/)** - Setup and development guides
- **[Features](../features/)** - Feature-specific implementation guides
- **[Development](../development/)** - Development processes and guidelines
- **[Reference](../reference/)** - Technical reference materials

---

*Architecture Version: v2.0.0*
*Last Updated: 2025-09-30*
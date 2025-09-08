# Architecture Documentation

This directory contains focused architectural documentation for the Viking Event Management System.

## Quick Reference

- **[System Overview](./SYSTEM_OVERVIEW.md)** - High-level architecture and technology stack
- **[Directory Structure](./directory-structure.md)** - Feature-based architecture and organization
- **[Authentication](./authentication.md)** - OAuth flow and security architecture  
- **[Data Management](./data-management.md)** - Caching, sync, and FlexiRecord systems
- **[State Management](./state-management.md)** - React state and context architecture
- **[UI Architecture](./ui-architecture.md)** - Responsive design and component structure
- **[System Design](./system-design.md)** - Overall system architecture patterns
- **[Deployment](./deployment.md)** - Release management and environment setup
- **[Performance](./performance.md)** - Optimization strategies and monitoring

## Issue-Specific Documentation

For specific technical issues and setup guides, see the main `docs/` directory:
- `CACHING_ERROR_HANDLING.md` - Production caching issue resolution
- `DATABASE_SCHEMA.md` - SQLite schema reference  
- Environment configuration — see [Deployment > Environment Configuration](./DEPLOYMENT.md#environment-configuration) and the project's `.env.example`
- `MOBILE_SETUP.md` - Capacitor and mobile development setup
- `MOBILE_TESTING_STRATEGY.md` - Testing framework and strategy

## Documentation Standards

Each architecture document follows this structure:
1. **Purpose & Scope** - What this component does
2. **Key Decisions** - Important architectural choices
3. **Implementation Details** - How it works technically
4. **Integration Points** - How it connects to other systems
5. **Monitoring & Troubleshooting** - Operational considerations

---

*Architecture Version: v1.1.0*  
*Last Updated: 2025-01-15*
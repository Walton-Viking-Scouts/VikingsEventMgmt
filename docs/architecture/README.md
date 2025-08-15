# Architecture Documentation

This directory contains focused architectural documentation for the Viking Event Management System.

## Quick Reference

- **[System Overview](./SYSTEM_OVERVIEW.md)** - High-level architecture and technology stack
- **[Authentication](./AUTHENTICATION.md)** - OAuth flow and security architecture  
- **[Data Management](./DATA_MANAGEMENT.md)** - Caching, sync, and FlexiRecord systems
- **[UI Architecture](./UI_ARCHITECTURE.md)** - Responsive design and component structure
- **[Deployment](./DEPLOYMENT.md)** - Release management and environment setup
- **[Performance](./PERFORMANCE.md)** - Optimization strategies and monitoring

## Issue-Specific Documentation

For specific technical issues and setup guides, see the main `docs/` directory:
- `CACHING_ERROR_HANDLING.md` - Production caching issue resolution
- `DATABASE_SCHEMA.md` - SQLite schema reference  
- `ENVIRONMENT_VARIABLES.md` - Security analysis and env var management
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
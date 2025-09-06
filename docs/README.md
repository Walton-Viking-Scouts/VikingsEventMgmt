---
title: "Vikings Event Management - Documentation"
description: "Comprehensive documentation for the Vikings Event Management mobile application"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "2.0.0"
tags: ["overview", "documentation", "index"]
---

# Vikings Event Management - Documentation

**Mobile-first Scout event management application with comprehensive offline capabilities**

*Version: 1.1.0 | Documentation Version: 2.0.0 | Last Updated: 2025-09-06*

## 🚀 Quick Start

### For Users
- **Access**: [vikingeventmgmt.onrender.com](https://vikingeventmgmt.onrender.com)
- **Sign In**: Use your Online Scout Manager credentials
- **Guide**: See [User Guide](user-guides/end-user-guide.md) for detailed instructions

### For Developers
- **Setup**: See [Installation Guide](getting-started/installation.md)
- **Development**: See [Development Workflow](getting-started/development-workflow.md)
- **Architecture**: See [System Design](architecture/system-design.md)

## 📚 Documentation Structure

### 🏁 [Getting Started](getting-started/)
Essential information to get up and running quickly
- [Installation & Setup](getting-started/installation.md)
- [Development Workflow](getting-started/development-workflow.md)
- [Mobile Setup (Capacitor)](getting-started/mobile-setup.md)

### 🏗️ [Architecture](architecture/)
Technical architecture and system design
- [System Design Overview](architecture/system-design.md)
- [Data Management](architecture/data-management.md)
- [Authentication & Security](architecture/authentication.md)
- [UI Architecture](architecture/ui-architecture.md)
- [Performance Considerations](architecture/performance.md)
- [Deployment Architecture](architecture/deployment.md)

### ⚡ [Features](features/)
Detailed feature documentation and implementation guides
- [Notifications System](features/notifications/) - Toast, banner, and alert notifications
- [Authentication](features/authentication/) - OAuth and security implementation
- [Offline Capabilities](features/offline-capabilities/) - Data sync and caching
- [Medical Data Handling](features/medical-data/) - Privacy-compliant medical data

### 👥 [User Guides](user-guides/)
Documentation for end users and administrators
- [End User Guide](user-guides/end-user-guide.md)
- [Admin Guide](user-guides/admin-guide.md)
- [Troubleshooting](user-guides/troubleshooting.md)

### 💻 [Development](development/)
Development processes, testing, and contribution guidelines
- [Testing Strategy](development/testing-strategy.md)
- [Code Style Guide](development/code-style-guide.md)
- [Release Process](development/release-process.md)
- [Debugging Guides](development/debugging/)
- [Contributing Guidelines](development/contributing.md)

### 📖 [Reference](reference/)
Technical reference materials and specifications
- [Database Schema](reference/database-schema.md)
- [API Reference](reference/api-reference.md)
- [Environment Variables](reference/environment-variables.md)
- [Changelog](reference/changelog.md)

## 🔧 Tech Stack Overview

### Core Technologies
- **React 19.1.0** - Modern React with hooks-only functional components
- **Vite 7.0.0** - Fast build tool and development server
- **Capacitor 7.4.0** - Native mobile app wrapper for iOS/Android
- **TailwindCSS 4.1.11** - Utility-first CSS framework
- **React Router 7.6.2** - Client-side routing

### Database & Storage
- **SQLite** - Offline database for native mobile apps via @capacitor-community/sqlite
- **localStorage** - Fallback storage for web browsers

### Development Tools
- **Vitest 3.2.4** - Unit testing framework
- **Cypress 14.5.0** - E2E testing framework
- **ESLint 9.29.0** - Code linting and formatting
- **Prettier 3.6.2** - Code formatting

## 🎯 Key Features

- **📱 Mobile-First Design** - Optimized for touch interfaces and mobile usage
- **🔄 Offline Capabilities** - Read-only access to cached data without internet connection
- **🔐 Secure Authentication** - OAuth integration with Online Scout Manager
- **📊 Event Management** - View and manage Scout events from OSM
- **👥 Attendance Tracking** - Digital attendance management with medical data display
- **🔔 Smart Notifications** - Comprehensive toast, banner, and alert notification system
- **⚡ Performance Optimized** - Fast loading with intelligent caching and manual sync

## 🆘 Need Help?

- **Issues**: Check [Troubleshooting Guide](user-guides/troubleshooting.md)
- **Development**: See [Development Documentation](development/)
- **Features**: Browse [Feature Documentation](features/)
- **Bugs**: Report on [GitHub Issues](https://github.com/Walton-Viking-Scouts/VikingsEventMgmt/issues)

## 📝 Contributing to Documentation

This documentation follows a structured approach:
- Each document includes metadata (creation date, last updated, version)
- Cross-references use relative links
- Code examples are fully functional
- Screenshots and diagrams are suggested where helpful

See [Contributing Guidelines](development/contributing.md) for more information.

---

*This documentation is actively maintained. If you find outdated information, please [create an issue](https://github.com/Walton-Viking-Scouts/VikingsEventMgmt/issues) or submit a pull request.*
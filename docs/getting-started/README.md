---
title: "Getting Started - Vikings Event Management"
description: "Quick start guide for developers and users"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["getting-started", "setup", "quickstart"]
related_docs: ["installation.md", "development-workflow.md", "mobile-setup.md"]
---

# Getting Started

Welcome to Vikings Event Management! This section will help you get up and running quickly, whether you're a developer setting up the project or a user accessing the application.

## For Users

### Quick Access
1. **Open**: [vikingeventmgmt.onrender.com](https://vikingeventmgmt.onrender.com)
2. **Sign In**: Click "Sign in to OSM" and use your Online Scout Manager credentials
3. **Navigate**: Select your Scout section and view events or attendance
4. **Offline**: App provides read-only access to cached data when offline

### Detailed Instructions
- [End User Guide](../user-guides/end-user-guide.md) - Complete user documentation
- [Troubleshooting](../user-guides/troubleshooting.md) - Common issues and solutions

## For Developers

### Prerequisites
- **Node.js** 18+ 
- **npm** or **yarn**
- **Git**
- **Modern browser** with HTTPS support

### Quick Setup
```bash
# Clone the repository
git clone https://github.com/Walton-Viking-Scouts/VikingsEventMgmt.git
cd VikingsEventMgmt

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test:run && npm run lint && npm run build
```

### Detailed Setup Guides
- [Installation & Setup](installation.md) - Complete development environment setup
- [Development Workflow](development-workflow.md) - Development processes and commands
- [Mobile Setup](mobile-setup.md) - Capacitor configuration for iOS/Android

## Next Steps

### For Users
- Explore the [User Guide](../user-guides/end-user-guide.md)
- Learn about [key features](../README.md#-key-features)

### For Developers
- Understand the [System Architecture](../architecture/system-design.md)
- Review [Development Guidelines](../development/)
- Explore [Feature Documentation](../features/)

## Need Help?

- **General Issues**: [Troubleshooting Guide](../user-guides/troubleshooting.md)
- **Development Help**: [Development Documentation](../development/)
- **Bug Reports**: [GitHub Issues](https://github.com/Walton-Viking-Scouts/VikingsEventMgmt/issues)
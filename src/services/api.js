// API service for Viking Event Management Mobile
// DEPRECATED: This file has been decomposed into modular services
// All functionality is now re-exported from ./api/index.js for backward compatibility
// 
// New modular structure:
// - ./api/base.js - Core API utilities and shared configuration
// - ./api/auth.js - Authentication and user management
// - ./api/terms.js - Terms data management
// - ./api/events.js - Event-related API calls
// - ./api/members.js - Member data management
// - ./api/flexiRecords.js - FlexiRecord operations
//
// This file maintains backward compatibility while we transition to the new structure

export * from './api/index.js';
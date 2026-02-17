// API Service Module Index
// Re-exports all functions from modular API services for backward compatibility
// This maintains the same import interface as the original monolithic api.js

// Base/Core exports
export {
  BACKEND_URL,
  TokenExpiredError,
  validateTokenBeforeAPICall,
  apiQueue,
  getAPIQueueStats,
  logRateLimitInfo,
  handleAPIResponseWithRateLimit,
  isOnline,
  testBackendConnection,
} from './base.js';

// Auth/Users exports
export {
  getUserRoles,
  getStartupData,
} from './auth.js';

// Terms exports
export {
  getTerms,
  fetchMostRecentTermId,
} from './terms.js';

// Events exports
export {
  getEvents,
  getEventAttendance,
  getEventSummary,
  getEventSharingStatus,
  getSharedEventAttendance,
} from './events.js';

// Members exports
export {
  getMembersGrid,
  getListOfMembers,
} from './members.js';

// FlexiRecords exports
export {
  getFlexiRecords,
  getSingleFlexiRecord,
  getFlexiStructure,
  updateFlexiRecord,
  multiUpdateFlexiRecord,
  createFlexiRecord,
  addFlexiColumn,
  // Re-exported from other services
  // TODO: Move getConsolidatedFlexiRecord to shared layer
  // getConsolidatedFlexiRecord,
  parseFlexiStructure,
  transformFlexiRecordData,
  extractVikingEventFields,
} from './flexiRecords.js';
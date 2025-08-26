import logger, { LOG_CATEGORIES } from '../services/logger.js';
import { isDemoMode } from '../config/demoMode.js';

/**
 * Clean up demo cache data when not in demo mode
 * This prevents demo events from appearing in production
 */
export function cleanupDemoCache() {
  // Only clean up if we're NOT in demo mode
  if (isDemoMode()) {
    return;
  }

  const keysToRemove = [];
  
  // Check all localStorage keys for demo data
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('demo_') || key.includes('demo_event_'))) {
      keysToRemove.push(key);
    }
  }

  // Also check for any regular cache keys that might contain demo events
  const regularCacheKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('viking_events_') || 
      key.includes('viking_attendance_') ||
      key.includes('viking_shared_')
    )) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          // Check if this cache contains demo events
          const hasDemo = checkForDemoData(parsed);
          if (hasDemo) {
            regularCacheKeys.push(key);
          }
        }
      } catch (error) {
        // Skip non-JSON items
      }
    }
  }

  const totalKeys = keysToRemove.length + regularCacheKeys.length;
  if (totalKeys > 0) {
    // Remove demo-prefixed keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    // Remove contaminated regular cache keys
    regularCacheKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    logger.info('🧹 Cleaned up demo cache data from production', {
      demoPrefixedKeys: keysToRemove.length,
      contaminatedKeys: regularCacheKeys.length,
      totalCleaned: totalKeys,
    }, LOG_CATEGORIES.APP);
  }
}

/**
 * Check if data contains demo events or references
 */
function checkForDemoData(data) {
  if (!data) return false;

  // Check if data is an array and has demo events
  if (Array.isArray(data)) {
    return data.some((item) => {
      if (typeof item === 'string') return item.includes('demo_event_');
      if (Array.isArray(item) || (item && typeof item === 'object')) return checkForDemoData(item);
      const eid = item?.eventid;
      return typeof eid === 'string' && eid.startsWith('demo_event_');
    });
  }

  // Check if data has items property with demo events
  if (data.items && Array.isArray(data.items)) {
    return data.items.some((item) => {
      const eid = item?.eventid;
      return typeof eid === 'string' && eid.startsWith('demo_event_');
    });
  }

  // Check if data itself has demo eventid
  if (typeof data.eventid === 'string' && data.eventid.startsWith('demo_event_')) {
    return true;
  }

  // Check nested properties for demo references
  if (typeof data === 'object') {
    for (const value of Object.values(data)) {
      if (typeof value === 'string' && value.includes('demo_event_')) {
        return true;
      }
      if (Array.isArray(value) && checkForDemoData(value)) {
        return true;
      }
      if (value && typeof value === 'object' && checkForDemoData(value)) {
        return true;
      }
    }
  }

  return false;
}
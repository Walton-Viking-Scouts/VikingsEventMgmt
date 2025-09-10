/**
 * @fileoverview Cache cleanup utilities for Viking Event Management
 * 
 * This module provides specialized cache cleanup functions to maintain data
 * integrity across different application modes. Prevents demo data contamination
 * in production environments and ensures clean separation between demo and
 * production cached data.
 * 
 * The cleanup system is essential for the offline-first architecture, ensuring
 * that cached data remains consistent and relevant to the current application
 * mode. Demo data cleanup prevents confusion and maintains professional
 * presentation in production Scout environments.
 * 
 * @module cacheCleanup
 * @version 2.3.7
 * @since 2.2.0 - Demo/production separation
 * @author Vikings Event Management Team
 */

import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import { isDemoMode } from '../../config/demoMode.js';

/**
 * Cleans up demo cache data when application is not in demo mode
 * 
 * Performs comprehensive cleanup of localStorage to remove demo data that
 * might contaminate production Scout environments. Scans for both explicitly
 * demo-prefixed keys and regular cache keys that contain demo event data.
 * 
 * This function is critical for maintaining data integrity when switching
 * between demo mode (for training and demonstrations) and production mode
 * (for actual Scout events). Demo data includes synthetic events, members,
 * and attendance records that should never appear in real Scout operations.
 * 
 * The cleanup process is safe and selective - it only removes data when
 * NOT in demo mode, preserving demo data when demonstrations are intentional.
 * 
 * @returns {void} No return value - operates by side effect on localStorage
 * 
 * @example
 * // Clean up demo data on production application startup
 * import { cleanupDemoCache } from './cacheCleanup.js';
 * 
 * // During app initialization in production
 * if (!isDemoMode()) {
 *   cleanupDemoCache(); // Removes any leftover demo data
 *   logger.info('Demo cache cleanup completed');
 * }
 * 
 * @example
 * // Integration with application mode switching
 * const switchToProductionMode = () => {
 *   // Update mode configuration
 *   setProductionMode(true);
 *   
 *   // Clean up any demo data from localStorage
 *   cleanupDemoCache();
 *   
 *   // Reload Scout data from OSM
 *   await reloadProductionData();
 * };
 * 
 * @example
 * // Cache keys that would be cleaned up in production
 * // Direct demo keys:
 * localStorage.setItem('demo_viking_events_123', JSON.stringify(demoEvents));
 * localStorage.setItem('demo_event_attendance_456', JSON.stringify(demoAttendance));
 * 
 * // Contaminated regular keys:
 * localStorage.setItem('viking_events_offline', JSON.stringify([
 *   { eventid: 'demo_event_123', sectionname: 'Demo Beavers' }, // Demo event
 *   { eventid: 'real_123', sectionname: '1st Walton Beavers' }   // Real event
 * ]));
 * 
 * // After cleanupDemoCache():
 * // - All demo_* keys removed
 * // - viking_events_offline removed (contained demo data)
 * // - Real-only cache keys remain untouched
 * 
 * @example
 * // Monitor cleanup operation results
 * const beforeKeys = Object.keys(localStorage).length;
 * cleanupDemoCache();
 * const afterKeys = Object.keys(localStorage).length;
 * 
 * if (beforeKeys > afterKeys) {
 *   console.log(`Cleanup removed ${beforeKeys - afterKeys} contaminated cache entries`);
 * } else {
 *   console.log('No demo data found - cache already clean');
 * }
 * 
 * @since 2.2.0
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
 * Recursively checks if data structure contains demo events or references
 * 
 * Performs deep inspection of data structures to identify demo content
 * that should not appear in production Scout environments. Checks for
 * demo event IDs, demo section names, and nested demo references.
 * 
 * This function supports the cache cleanup process by accurately identifying
 * contaminated cache entries that mix demo and production data, ensuring
 * complete removal of demo content from production environments.
 * 
 * @param {*} data - Data structure to inspect for demo content
 * @returns {boolean} True if demo content is found, false if data is clean
 * 
 * @example
 * // Check individual event objects
 * const cleanEvent = { eventid: 'evt_123', sectionname: '1st Walton Beavers' };
 * const demoEvent = { eventid: 'demo_event_456', sectionname: 'Demo Scouts' };
 * 
 * console.log(checkForDemoData(cleanEvent)); // false
 * console.log(checkForDemoData(demoEvent));  // true
 * 
 * @example
 * // Check array of mixed data
 * const mixedEvents = [
 *   { eventid: 'real_123', sectionname: '1st Walton Cubs' },
 *   { eventid: 'demo_event_789', sectionname: 'Demo Beavers' },
 *   { eventid: 'real_456', sectionname: '2nd Walton Scouts' }
 * ];
 * 
 * console.log(checkForDemoData(mixedEvents)); // true (contains demo event)
 * 
 * @example
 * // Check nested object structures
 * const nestedData = {
 *   events: {
 *     items: [
 *       { eventid: 'demo_event_123' } // Deep demo reference
 *     ]
 *   },
 *   metadata: { source: 'production' }
 * };
 * 
 * console.log(checkForDemoData(nestedData)); // true (found nested demo)
 * 
 * @example
 * // Check for demo section names
 * const sectionData = { sectionname: 'Demo Beavers Colony' };
 * console.log(checkForDemoData(sectionData)); // true (demo section)
 * 
 * const realSection = { sectionname: '1st Walton Beavers Colony' };
 * console.log(checkForDemoData(realSection)); // false (real section)
 * 
 * @since 2.2.0
 * @private
 */
function checkForDemoData(data) {
  if (!data) return false;

  // Check if data is an array and has demo events
  if (Array.isArray(data)) {
    return data.some((item) => {
      if (typeof item === 'string') return item.includes('demo_event_') || item.startsWith('Demo ');
      if (Array.isArray(item) || (item && typeof item === 'object')) return checkForDemoData(item);
      const eid = item?.eventid;
      const sectionname = item?.sectionname;
      return (typeof eid === 'string' && eid.startsWith('demo_event_')) ||
             (typeof sectionname === 'string' && sectionname.startsWith('Demo '));
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

  // Check if data is a demo section (by sectionname)
  if (typeof data.sectionname === 'string' && data.sectionname.startsWith('Demo ')) {
    return true;
  }

  // Check nested properties for demo references
  if (typeof data === 'object') {
    for (const value of Object.values(data)) {
      if (typeof value === 'string' && (value.includes('demo_event_') || value.startsWith('Demo '))) {
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
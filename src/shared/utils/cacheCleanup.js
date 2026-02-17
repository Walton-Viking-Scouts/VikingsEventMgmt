/**
 * @file Cache cleanup utilities for Viking Event Management
 *
 * Provides demo data cleanup from localStorage when running in production mode.
 * Non-demo data lives in IndexedDB normalized stores and is managed by
 * DatabaseService/IndexedDBService directly.
 *
 * @module cacheCleanup
 */

import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import { isDemoMode } from '../../config/demoMode.js';

/**
 * Cleans up demo cache data from localStorage when not in demo mode.
 *
 * Removes localStorage keys with demo_ prefix or containing demo_event_ to
 * prevent demo data from contaminating production Scout environments.
 * Non-demo production data lives in IndexedDB and is not affected.
 *
 * @returns {void}
 */
export function cleanupDemoCache() {
  if (isDemoMode()) {
    return;
  }

  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('demo_') || key.includes('demo_event_'))) {
      keysToRemove.push(key);
    }
  }

  if (keysToRemove.length > 0) {
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    logger.info('Cleaned up demo cache data from production localStorage', {
      demoPrefixedKeys: keysToRemove.length,
    }, LOG_CATEGORIES.APP);
  }
}

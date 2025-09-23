/**
 * @file Phase 1 Migration Mapping - Cache & Sync Data Migration
 *
 * Defines comprehensive mapping configuration for migrating Phase 1 localStorage
 * keys to IndexedDB. Phase 1 includes cache and sync data which is low-risk and
 * suitable for initial migration testing.
 *
 * Phase 1 localStorage keys:
 * - viking_last_sync: stores timestamp string for last sync
 * - viking_attendance_cache_time_{eventId}: stores timestamp strings for cache validation
 * - viking_shared_metadata_{eventDetails}: stores JSON metadata objects
 *
 * @module phase1Mapping
 * @version 1.0.0
 * @since Task 85.1 - Phase 1 localStorage to IndexedDB migration
 * @author Vikings Event Management Team
 */

import IndexedDBService from '../indexedDBService.js';

/**
 * Phase 1 migration key patterns with comprehensive validation and transformation
 *
 * @constant {Object} PHASE_1_PATTERNS
 */
export const PHASE_1_PATTERNS = {
  /**
   * Last sync timestamp - critical for data synchronization
   * Pattern: viking_last_sync
   * Data type: timestamp string or number
   * IndexedDB store: cache_data
   */
  LAST_SYNC: {
    pattern: /^viking_last_sync$/,
    store: IndexedDBService.STORES.CACHE_DATA,
    type: 'sync',
    description: 'Global last sync timestamp',
    dataType: 'timestamp',
    required: false,

    /**
     * Validate last sync data
     * @param {*} data - Raw localStorage data
     * @returns {Object} Validation result
     */
    validateData(data) {
      if (data === null || data === undefined) {
        return { isValid: true, data: null, warnings: ['No sync timestamp found'] };
      }

      const timestamp = typeof data === 'string' ? parseInt(data) : data;

      if (isNaN(timestamp)) {
        return {
          isValid: false,
          error: `Invalid timestamp format: ${data}`,
          data: null,
        };
      }

      if (timestamp < 0) {
        return {
          isValid: false,
          error: `Negative timestamp not allowed: ${timestamp}`,
          data: null,
        };
      }

      // Check if timestamp is reasonable (not too far in future)
      const now = Date.now();
      if (timestamp > now + (24 * 60 * 60 * 1000)) { // 24 hours in future
        return {
          isValid: true,
          data: timestamp,
          warnings: [`Future timestamp detected: ${new Date(timestamp).toISOString()}`],
        };
      }

      return { isValid: true, data: timestamp };
    },

    /**
     * Transform last sync data for IndexedDB storage
     * @param {*} data - Validated data
     * @param {string} _key - Original localStorage key
     * @returns {Object} Transformed data with metadata
     */
    transformData(data, _key) {
      return {
        lastSyncTimestamp: data,
        syncType: 'global',
        updatedAt: Date.now(),
      };
    },

    /**
     * Generate IndexedDB key for last sync
     * @param {string} _originalKey - Original localStorage key
     * @param {Array} _extractedIds - Extracted IDs from pattern
     * @returns {string} IndexedDB key
     */
    generateIndexedDBKey(_originalKey, _extractedIds) {
      return 'last_sync_global';
    },
  },

  /**
   * Attendance cache timestamps - for cache validation
   * Pattern: viking_attendance_cache_time_{eventId}
   * Data type: timestamp string or number
   * IndexedDB store: cache_data
   */
  ATTENDANCE_CACHE_TIME: {
    pattern: /^viking_attendance_cache_time_(.+)$/,
    store: IndexedDBService.STORES.CACHE_DATA,
    type: 'cache',
    description: 'Event attendance cache timestamps',
    dataType: 'timestamp',
    required: false,

    /**
     * Validate attendance cache time data
     * @param {*} data - Raw localStorage data
     * @param {Array} extractedIds - Event ID from pattern match
     * @returns {Object} Validation result
     */
    validateData(data, extractedIds) {
      const [eventId] = extractedIds || [];

      if (!eventId) {
        return {
          isValid: false,
          error: 'Missing event ID in cache key',
          data: null,
        };
      }

      if (data === null || data === undefined) {
        return { isValid: true, data: null, warnings: [`No cache time for event ${eventId}`] };
      }

      const timestamp = typeof data === 'string' ? parseInt(data) : data;

      if (isNaN(timestamp)) {
        return {
          isValid: false,
          error: `Invalid cache timestamp for event ${eventId}: ${data}`,
          data: null,
        };
      }

      if (timestamp < 0) {
        return {
          isValid: false,
          error: `Negative cache timestamp for event ${eventId}: ${timestamp}`,
          data: null,
        };
      }

      return { isValid: true, data: timestamp };
    },

    /**
     * Transform attendance cache time data for IndexedDB storage
     * @param {*} data - Validated data
     * @param {string} key - Original localStorage key
     * @param {Array} extractedIds - Event ID from pattern match
     * @returns {Object} Transformed data with metadata
     */
    transformData(data, key, extractedIds) {
      const [eventId] = extractedIds || [];

      return {
        eventId,
        cacheTimestamp: data,
        cacheType: 'attendance',
        updatedAt: Date.now(),
      };
    },

    /**
     * Generate IndexedDB key for attendance cache time
     * @param {string} originalKey - Original localStorage key
     * @param {Array} extractedIds - Event ID from pattern match
     * @returns {string} IndexedDB key
     */
    generateIndexedDBKey(originalKey, extractedIds) {
      const [eventId] = extractedIds || [];
      return `attendance_cache_time_${eventId}`;
    },
  },

  /**
   * Shared metadata - event details and configuration
   * Pattern: viking_shared_metadata_{eventDetails}
   * Data type: JSON object
   * IndexedDB store: cache_data
   */
  SHARED_METADATA: {
    pattern: /^viking_shared_metadata_(.+)$/,
    store: IndexedDBService.STORES.CACHE_DATA,
    type: 'metadata',
    description: 'Shared event metadata and configuration',
    dataType: 'json',
    required: false,

    /**
     * Validate shared metadata
     * @param {*} data - Raw localStorage data
     * @param {Array} extractedIds - Event details from pattern match
     * @returns {Object} Validation result
     */
    validateData(data, extractedIds) {
      const [eventDetails] = extractedIds || [];

      if (!eventDetails) {
        return {
          isValid: false,
          error: 'Missing event details in metadata key',
          data: null,
        };
      }

      if (data === null || data === undefined) {
        return { isValid: true, data: null, warnings: [`No metadata for event ${eventDetails}`] };
      }

      // Validate that data is an object (not primitive)
      if (typeof data !== 'object' || Array.isArray(data)) {
        return {
          isValid: false,
          error: `Shared metadata must be an object, got ${typeof data}`,
          data: null,
        };
      }

      // Check for required metadata structure
      const warnings = [];
      if (!Object.prototype.hasOwnProperty.call(data, 'eventId')) {
        warnings.push('Missing eventId in metadata');
      }
      if (!Object.prototype.hasOwnProperty.call(data, 'lastUpdated')) {
        warnings.push('Missing lastUpdated timestamp in metadata');
      }

      return {
        isValid: true,
        data,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },

    /**
     * Transform shared metadata for IndexedDB storage
     * @param {*} data - Validated data
     * @param {string} key - Original localStorage key
     * @param {Array} extractedIds - Event details from pattern match
     * @returns {Object} Transformed data with metadata
     */
    transformData(data, key, extractedIds) {
      const [eventDetails] = extractedIds || [];

      return {
        eventDetails,
        metadata: data,
        metadataType: 'shared',
        originalEventId: data?.eventId || null,
        updatedAt: Date.now(),
      };
    },

    /**
     * Generate IndexedDB key for shared metadata
     * @param {string} originalKey - Original localStorage key
     * @param {Array} extractedIds - Event details from pattern match
     * @returns {string} IndexedDB key
     */
    generateIndexedDBKey(originalKey, extractedIds) {
      const [eventDetails] = extractedIds || [];
      return `shared_metadata_${eventDetails}`;
    },
  },
};

/**
 * Data type validation schemas for Phase 1 data
 *
 * @constant {Object} PHASE_1_VALIDATION_SCHEMAS
 */
export const PHASE_1_VALIDATION_SCHEMAS = {
  /**
   * Timestamp validation schema
   */
  timestamp: {
    type: 'number',
    minimum: 0,
    maximum: 8640000000000000, // Max safe Date value

    validate(value) {
      if (typeof value === 'string') {
        const parsed = parseInt(value);
        return !isNaN(parsed) && parsed >= 0;
      }

      return typeof value === 'number' &&
             value >= 0 &&
             value <= 8640000000000000 &&
             Number.isInteger(value);
    },
  },

  /**
   * JSON object validation schema
   */
  json: {
    type: 'object',

    validate(value) {
      return value !== null &&
             typeof value === 'object' &&
             !Array.isArray(value);
    },
  },
};

/**
 * IndexedDB store configuration for Phase 1 data
 *
 * @constant {Object} PHASE_1_STORE_CONFIG
 */
export const PHASE_1_STORE_CONFIG = {
  [IndexedDBService.STORES.CACHE_DATA]: {
    description: 'Cache and synchronization data',
    indexes: {
      type: { unique: false, description: 'Data type (sync, cache, metadata)' },
      timestamp: { unique: false, description: 'Creation/update timestamp' },
      eventId: { unique: false, description: 'Associated event ID' },
    },
    expectedTypes: ['sync', 'cache', 'metadata'],
  },
};

/**
 * Get all Phase 1 patterns as an array for iteration
 *
 * @returns {Array} Array of pattern configurations
 */
export function getPhase1Patterns() {
  return Object.values(PHASE_1_PATTERNS);
}

/**
 * Find matching pattern for a localStorage key
 *
 * @param {string} key - localStorage key to match
 * @returns {Object|null} Matching pattern configuration or null
 */
export function findPatternForKey(key) {
  for (const [name, pattern] of Object.entries(PHASE_1_PATTERNS)) {
    if (pattern.pattern.test(key)) {
      return { name, ...pattern };
    }
  }
  return null;
}

/**
 * Extract IDs from localStorage key using pattern
 *
 * @param {string} key - localStorage key
 * @param {RegExp} pattern - Regular expression pattern
 * @returns {Array} Extracted IDs or empty array
 */
export function extractIdsFromKey(key, pattern) {
  const match = key.match(pattern);
  return match ? match.slice(1) : [];
}

/**
 * Validate Phase 1 migration data integrity
 *
 * @param {Array} migrationData - Array of migration items
 * @returns {Object} Validation summary
 */
export function validatePhase1DataIntegrity(migrationData) {
  const summary = {
    totalItems: migrationData.length,
    validItems: 0,
    invalidItems: 0,
    warnings: [],
    errors: [],
    byType: {
      sync: 0,
      cache: 0,
      metadata: 0,
    },
  };

  for (const item of migrationData) {
    const pattern = findPatternForKey(item.key);

    if (!pattern) {
      summary.invalidItems++;
      summary.errors.push(`No pattern found for key: ${item.key}`);
      continue;
    }

    const extractedIds = extractIdsFromKey(item.key, pattern.pattern);
    const validation = pattern.validateData(item.data, extractedIds);

    if (validation.isValid) {
      summary.validItems++;
      summary.byType[pattern.type]++;

      if (validation.warnings) {
        summary.warnings.push(...validation.warnings.map(w => `${item.key}: ${w}`));
      }
    } else {
      summary.invalidItems++;
      summary.errors.push(`${item.key}: ${validation.error}`);
    }
  }

  return summary;
}

export default {
  PHASE_1_PATTERNS,
  PHASE_1_VALIDATION_SCHEMAS,
  PHASE_1_STORE_CONFIG,
  getPhase1Patterns,
  findPatternForKey,
  extractIdsFromKey,
  validatePhase1DataIntegrity,
};
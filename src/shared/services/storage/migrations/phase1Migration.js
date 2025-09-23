/**
 * @file Phase 1 Migration Utilities - Cache & Sync Data Migration
 *
 * Provides comprehensive utilities for executing Phase 1 localStorage to IndexedDB
 * migration with robust error handling, validation, rollback capabilities, and
 * progress tracking. Designed for production use with proper logging and monitoring.
 *
 * Features:
 * - Safe localStorage scanning with pattern matching
 * - Data validation before migration
 * - Atomic migration operations with rollback support
 * - Progress tracking and detailed reporting
 * - Comprehensive error handling and logging
 * - Data integrity verification
 *
 * @module phase1Migration
 * @version 1.0.0
 * @since Task 85.1 - Phase 1 localStorage to IndexedDB migration
 * @author Vikings Event Management Team
 */

import { safeGetItem, safeSetItem } from '../../../utils/storageUtils.js';
import IndexedDBService from '../indexedDBService.js';
import {
  getPhase1Patterns,
  findPatternForKey,
  extractIdsFromKey,
  validatePhase1DataIntegrity,
} from './phase1Mapping.js';
import { sentryUtils } from '../../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

/**
 * Migration status constants
 *
 * @constant {Object} MIGRATION_STATUS
 */
export const MIGRATION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back',
  PARTIAL_FAILURE: 'partial_failure',
};

/**
 * Phase 1 Migration Service
 * Handles comprehensive migration of cache and sync data from localStorage to IndexedDB
 */
export class Phase1MigrationService {
  /**
   * Scan localStorage for Phase 1 keys using comprehensive pattern matching
   *
   * @returns {Promise<Array>} Array of found localStorage items with metadata
   * @throws {Error} If scanning fails
   */
  static async scanLocalStorageForPhase1() {
    try {
      logger.info('Starting localStorage scan for Phase 1 keys', {
        operation: 'phase1_scan_start',
        totalStorageKeys: localStorage.length,
      }, LOG_CATEGORIES.DATABASE);

      const foundItems = [];
      const patterns = getPhase1Patterns();
      const scanErrors = [];

      // Scan all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        try {
          // Check if key matches any Phase 1 pattern
          for (const pattern of patterns) {
            if (pattern.pattern.test(key)) {
              const data = safeGetItem(key);
              const extractedIds = extractIdsFromKey(key, pattern.pattern);

              // Validate data using pattern-specific validation
              const validation = pattern.validateData(data, extractedIds);

              const item = {
                key,
                data,
                pattern: pattern.type,
                store: pattern.store,
                extractedIds,
                validation,
                scannedAt: Date.now(),
              };

              foundItems.push(item);

              logger.debug('Phase 1 key found and validated', {
                key,
                pattern: pattern.type,
                isValid: validation.isValid,
                hasWarnings: !!validation.warnings,
                dataSize: data ? JSON.stringify(data).length : 0,
              }, LOG_CATEGORIES.DATABASE);

              break; // Stop checking patterns once we find a match
            }
          }
        } catch (keyError) {
          const errorInfo = {
            key,
            error: keyError.message,
            stack: keyError.stack,
          };
          scanErrors.push(errorInfo);

          logger.warn('Error scanning localStorage key', errorInfo, LOG_CATEGORIES.ERROR);
        }
      }

      // Generate integrity report
      const integrityReport = validatePhase1DataIntegrity(foundItems);

      logger.info('Phase 1 localStorage scan completed', {
        operation: 'phase1_scan_complete',
        totalKeysScanned: localStorage.length,
        foundItems: foundItems.length,
        validItems: integrityReport.validItems,
        invalidItems: integrityReport.invalidItems,
        scanErrors: scanErrors.length,
        byType: integrityReport.byType,
      }, LOG_CATEGORIES.DATABASE);

      if (scanErrors.length > 0) {
        logger.warn('Scan completed with errors', {
          errorCount: scanErrors.length,
          errors: scanErrors,
        }, LOG_CATEGORIES.ERROR);
      }

      return {
        items: foundItems,
        integrity: integrityReport,
        scanErrors,
        scannedAt: Date.now(),
      };

    } catch (error) {
      logger.error('Phase 1 localStorage scan failed', {
        operation: 'phase1_scan_failed',
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'phase1_scan',
          migration_phase: 'phase_1_cache',
        },
      });

      throw error;
    }
  }

  /**
   * Execute Phase 1 migration with comprehensive error handling and progress tracking
   *
   * @param {Object} options - Migration options
   * @param {boolean} options.dryRun - If true, validate but don't migrate
   * @param {boolean} options.skipValidation - If true, skip pre-migration validation
   * @param {Function} options.progressCallback - Progress callback function
   * @returns {Promise<Object>} Migration result with detailed metrics
   * @throws {Error} If migration fails critically
   */
  static async executeMigration(options = {}) {
    const {
      dryRun = false,
      skipValidation = false,
      progressCallback = null,
    } = options;

    const migrationId = `phase1_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info('Starting Phase 1 migration execution', {
        operation: 'phase1_migration_start',
        migrationId,
        dryRun,
        skipValidation,
        hasProgressCallback: !!progressCallback,
      }, LOG_CATEGORIES.DATABASE);

      // Step 1: Scan localStorage for Phase 1 data
      progressCallback?.({ step: 'scanning', progress: 0, message: 'Scanning localStorage...' });

      const scanResult = await this.scanLocalStorageForPhase1();

      if (scanResult.items.length === 0) {
        logger.info('No Phase 1 data found to migrate', {
          migrationId,
          scanErrors: scanResult.scanErrors.length,
        }, LOG_CATEGORIES.DATABASE);

        return {
          success: true,
          migrationId,
          totalItems: 0,
          migratedItems: 0,
          skippedItems: 0,
          errors: [],
          warnings: scanResult.scanErrors.map(e => `Scan error: ${e.error}`),
          duration: Date.now() - startTime,
          dryRun,
        };
      }

      // Step 2: Pre-migration validation
      if (!skipValidation) {
        progressCallback?.({ step: 'validating', progress: 20, message: 'Validating data integrity...' });

        const validationErrors = [];
        const validationWarnings = [];

        for (const item of scanResult.items) {
          if (!item.validation.isValid) {
            validationErrors.push(`${item.key}: ${item.validation.error}`);
          } else if (item.validation.warnings) {
            validationWarnings.push(...item.validation.warnings.map(w => `${item.key}: ${w}`));
          }
        }

        if (validationErrors.length > 0) {
          const error = new Error(`Pre-migration validation failed: ${validationErrors.length} errors`);
          error.validationErrors = validationErrors;

          logger.error('Phase 1 migration validation failed', {
            migrationId,
            validationErrors,
            validationWarnings,
          }, LOG_CATEGORIES.ERROR);

          throw error;
        }

        if (validationWarnings.length > 0) {
          logger.warn('Phase 1 migration validation warnings', {
            migrationId,
            validationWarnings,
          }, LOG_CATEGORIES.DATABASE);
        }
      }

      // Step 3: Execute migration (or dry run)
      progressCallback?.({ step: 'migrating', progress: 40, message: 'Migrating data...' });

      const migrationResults = [];
      const migrationErrors = [];
      let processedCount = 0;

      for (const item of scanResult.items) {
        try {
          const result = await this.migrateItem(item, { dryRun });
          migrationResults.push(result);

          processedCount++;
          const progress = 40 + (processedCount / scanResult.items.length) * 40;
          progressCallback?.({
            step: 'migrating',
            progress,
            message: `Migrated ${processedCount}/${scanResult.items.length} items...`,
          });

          logger.debug('Item migrated successfully', {
            migrationId,
            key: item.key,
            pattern: item.pattern,
            dryRun,
          }, LOG_CATEGORIES.DATABASE);

        } catch (itemError) {
          const errorInfo = {
            key: item.key,
            pattern: item.pattern,
            error: itemError.message,
            stack: itemError.stack,
          };
          migrationErrors.push(errorInfo);

          logger.error('Failed to migrate item', {
            migrationId,
            ...errorInfo,
          }, LOG_CATEGORIES.ERROR);
        }
      }

      // Step 4: Post-migration verification (if not dry run)
      let verificationErrors = [];
      if (!dryRun && migrationResults.length > 0) {
        progressCallback?.({ step: 'verifying', progress: 85, message: 'Verifying migration...' });

        try {
          verificationErrors = await this.verifyMigration(migrationResults);
        } catch (verifyError) {
          logger.error('Migration verification failed', {
            migrationId,
            error: verifyError.message,
          }, LOG_CATEGORIES.ERROR);

          verificationErrors.push(`Verification failed: ${verifyError.message}`);
        }
      }

      // Step 5: Generate final report
      progressCallback?.({ step: 'complete', progress: 100, message: 'Migration complete' });

      const successfulMigrations = migrationResults.filter(r => r.success).length;
      const hasErrors = migrationErrors.length > 0 || verificationErrors.length > 0;

      const result = {
        success: !hasErrors,
        migrationId,
        totalItems: scanResult.items.length,
        migratedItems: successfulMigrations,
        skippedItems: scanResult.items.length - successfulMigrations,
        errors: migrationErrors,
        verificationErrors,
        warnings: scanResult.scanErrors.map(e => `Scan error: ${e.error}`),
        duration: Date.now() - startTime,
        dryRun,
        integrity: scanResult.integrity,
      };

      logger.info('Phase 1 migration execution completed', {
        operation: 'phase1_migration_complete',
        ...result,
      }, LOG_CATEGORIES.DATABASE);

      return result;

    } catch (error) {
      logger.error('Phase 1 migration execution failed', {
        operation: 'phase1_migration_failed',
        migrationId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'phase1_migration',
          migration_phase: 'phase_1_cache',
          migration_id: migrationId,
        },
        contexts: {
          migration: {
            migrationId,
            dryRun,
            skipValidation,
            duration: Date.now() - startTime,
          },
        },
      });

      throw error;
    }
  }

  /**
   * Migrate a single localStorage item to IndexedDB
   *
   * @param {Object} item - Item to migrate with validation results
   * @param {Object} options - Migration options
   * @param {boolean} options.dryRun - If true, don't actually migrate
   * @returns {Promise<Object>} Migration result for this item
   * @throws {Error} If migration fails
   */
  static async migrateItem(item, { dryRun = false } = {}) {
    const { key, pattern, store, extractedIds, validation } = item;

    if (!validation.isValid) {
      throw new Error(`Cannot migrate invalid item: ${validation.error}`);
    }

    // Find pattern configuration
    const patternConfig = findPatternForKey(key);
    if (!patternConfig) {
      throw new Error(`No pattern configuration found for key: ${key}`);
    }

    // Transform data using pattern-specific transformation
    const transformedData = patternConfig.transformData(validation.data, key, extractedIds);

    // Generate IndexedDB key
    const indexedDBKey = patternConfig.generateIndexedDBKey(key, extractedIds);

    if (dryRun) {
      return {
        success: true,
        originalKey: key,
        indexedDBKey,
        store,
        pattern,
        dataSize: JSON.stringify(transformedData).length,
        dryRun: true,
      };
    }

    // Create metadata for IndexedDB record
    const metadata = {
      originalKey: key,
      type: pattern,
      migratedAt: Date.now(),
      phase: 'phase_1_cache',
      version: '1.0.0',
    };

    // Add extracted IDs as metadata
    if (extractedIds.length > 0) {
      if (extractedIds.length === 1) {
        metadata.eventId = extractedIds[0];
      } else if (extractedIds.length > 1) {
        metadata.eventId = extractedIds[0];
        metadata.secondaryId = extractedIds[1];
      }
    }

    // Store in IndexedDB
    await IndexedDBService.set(store, indexedDBKey, transformedData, metadata);

    return {
      success: true,
      originalKey: key,
      indexedDBKey,
      store,
      pattern,
      dataSize: JSON.stringify(transformedData).length,
      metadata,
      migratedAt: metadata.migratedAt,
    };
  }

  /**
   * Verify migration by checking data integrity in IndexedDB
   *
   * @param {Array} migrationResults - Results from migration
   * @returns {Promise<Array>} Array of verification errors
   */
  static async verifyMigration(migrationResults) {
    const errors = [];

    for (const result of migrationResults) {
      if (!result.success) continue;

      try {
        // Check if data exists in IndexedDB
        const indexedData = await IndexedDBService.get(result.store, result.indexedDBKey);

        if (!indexedData) {
          errors.push(`Data not found in IndexedDB: ${result.indexedDBKey}`);
          continue;
        }

        // Verify metadata is present
        if (!result.metadata) {
          errors.push(`Missing metadata for migrated item: ${result.indexedDBKey}`);
        }

        logger.debug('Migration verification passed', {
          originalKey: result.originalKey,
          indexedDBKey: result.indexedDBKey,
          store: result.store,
        }, LOG_CATEGORIES.DATABASE);

      } catch (verifyError) {
        errors.push(`Verification failed for ${result.indexedDBKey}: ${verifyError.message}`);
      }
    }

    return errors;
  }

  /**
   * Execute rollback for Phase 1 migration
   *
   * @param {Object} options - Rollback options
   * @param {Function} options.progressCallback - Progress callback
   * @returns {Promise<Object>} Rollback result
   * @throws {Error} If rollback fails
   */
  static async executeRollback(options = {}) {
    const { progressCallback = null } = options;
    const rollbackId = `phase1_rollback_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info('Starting Phase 1 migration rollback', {
        operation: 'phase1_rollback_start',
        rollbackId,
      }, LOG_CATEGORIES.DATABASE);

      progressCallback?.({ step: 'scanning', progress: 0, message: 'Scanning IndexedDB...' });

      // Get all keys from cache_data store
      const cacheDataKeys = await IndexedDBService.getAllKeys(IndexedDBService.STORES.CACHE_DATA);
      const rollbackItems = [];
      const rollbackErrors = [];

      // Filter for Phase 1 items
      for (const key of cacheDataKeys) {
        try {
          const record = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, key);
          if (record && record.phase === 'phase_1_cache') {
            rollbackItems.push({
              indexedDBKey: key,
              originalKey: record.originalKey,
              data: record,
              store: IndexedDBService.STORES.CACHE_DATA,
            });
          }
        } catch (itemError) {
          rollbackErrors.push({
            key,
            error: itemError.message,
          });
        }
      }

      if (rollbackItems.length === 0) {
        logger.info('No Phase 1 items found for rollback', {
          rollbackId,
          scannedKeys: cacheDataKeys.length,
        }, LOG_CATEGORIES.DATABASE);

        return {
          success: true,
          rollbackId,
          rolledBackItems: 0,
          errors: rollbackErrors,
          duration: Date.now() - startTime,
        };
      }

      progressCallback?.({ step: 'rolling_back', progress: 30, message: 'Rolling back data...' });

      let rolledBackCount = 0;

      // Rollback each item
      for (const item of rollbackItems) {
        try {
          // Restore to localStorage
          if (item.originalKey && item.data) {
            safeSetItem(item.originalKey, item.data);
          }

          // Remove from IndexedDB
          await IndexedDBService.delete(item.store, item.indexedDBKey);

          rolledBackCount++;

          const progress = 30 + (rolledBackCount / rollbackItems.length) * 60;
          progressCallback?.({
            step: 'rolling_back',
            progress,
            message: `Rolled back ${rolledBackCount}/${rollbackItems.length} items...`,
          });

          logger.debug('Item rolled back successfully', {
            rollbackId,
            originalKey: item.originalKey,
            indexedDBKey: item.indexedDBKey,
          }, LOG_CATEGORIES.DATABASE);

        } catch (rollbackError) {
          rollbackErrors.push({
            key: item.indexedDBKey,
            originalKey: item.originalKey,
            error: rollbackError.message,
          });

          logger.error('Failed to rollback item', {
            rollbackId,
            indexedDBKey: item.indexedDBKey,
            error: rollbackError.message,
          }, LOG_CATEGORIES.ERROR);
        }
      }

      progressCallback?.({ step: 'complete', progress: 100, message: 'Rollback complete' });

      const result = {
        success: rollbackErrors.length === 0,
        rollbackId,
        totalItems: rollbackItems.length,
        rolledBackItems: rolledBackCount,
        errors: rollbackErrors,
        duration: Date.now() - startTime,
      };

      logger.info('Phase 1 migration rollback completed', {
        operation: 'phase1_rollback_complete',
        ...result,
      }, LOG_CATEGORIES.DATABASE);

      return result;

    } catch (error) {
      logger.error('Phase 1 migration rollback failed', {
        operation: 'phase1_rollback_failed',
        rollbackId,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'phase1_rollback',
          migration_phase: 'phase_1_cache',
          rollback_id: rollbackId,
        },
      });

      throw error;
    }
  }

  /**
   * Generate comprehensive Phase 1 migration progress report
   *
   * @returns {Promise<Object>} Progress report with current status
   */
  static async generateProgressReport() {
    try {
      const report = {
        phase: 'phase_1_cache',
        timestamp: Date.now(),
        localStorage: {
          totalKeys: localStorage.length,
          phase1Keys: [],
        },
        indexedDB: {
          cacheDataKeys: 0,
          phase1Items: 0,
        },
        migration: {
          status: 'unknown',
          completedItems: 0,
          errors: [],
        },
      };

      // Scan localStorage for Phase 1 keys
      const scanResult = await this.scanLocalStorageForPhase1();
      report.localStorage.phase1Keys = scanResult.items.map(item => ({
        key: item.key,
        pattern: item.pattern,
        isValid: item.validation.isValid,
        hasWarnings: !!item.validation.warnings,
      }));

      // Scan IndexedDB for migrated items
      try {
        const cacheDataKeys = await IndexedDBService.getAllKeys(IndexedDBService.STORES.CACHE_DATA);
        report.indexedDB.cacheDataKeys = cacheDataKeys.length;

        let phase1Count = 0;
        for (const key of cacheDataKeys) {
          try {
            const record = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, key);
            if (record && record.phase === 'phase_1_cache') {
              phase1Count++;
            }
          } catch (readError) {
            report.migration.errors.push(`Error reading ${key}: ${readError.message}`);
          }
        }
        report.indexedDB.phase1Items = phase1Count;
      } catch (idbError) {
        report.migration.errors.push(`IndexedDB scan failed: ${idbError.message}`);
      }

      // Determine migration status
      if (report.localStorage.phase1Keys.length === 0 && report.indexedDB.phase1Items === 0) {
        report.migration.status = 'no_data';
      } else if (report.localStorage.phase1Keys.length > 0 && report.indexedDB.phase1Items === 0) {
        report.migration.status = 'pending';
      } else if (report.localStorage.phase1Keys.length === 0 && report.indexedDB.phase1Items > 0) {
        report.migration.status = 'completed';
        report.migration.completedItems = report.indexedDB.phase1Items;
      } else {
        report.migration.status = 'partial';
        report.migration.completedItems = report.indexedDB.phase1Items;
      }

      return report;

    } catch (error) {
      logger.error('Failed to generate Phase 1 progress report', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      throw error;
    }
  }
}

export default Phase1MigrationService;
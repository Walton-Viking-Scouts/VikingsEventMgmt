import { safeGetItem, safeSetItem } from '../../utils/storageUtils.js';
import IndexedDBService from './indexedDBService.js';
import { sentryUtils } from '../utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';

const MIGRATION_STATUS_KEY = 'viking_migration_status';

const MIGRATION_PHASES = {
  PHASE_1_CACHE: 'phase_1_cache',
  PHASE_2_CONFIG: 'phase_2_config',
  PHASE_3_FLEXI: 'phase_3_flexi',
  PHASE_4_EVENTS: 'phase_4_events',
  PHASE_5_MEMBERS: 'phase_5_members',
};

const RECORD_TYPE_MAPPINGS = {
  // Phase 1: Cache & Sync
  [MIGRATION_PHASES.PHASE_1_CACHE]: {
    patterns: [
      { pattern: /^viking_last_sync$/, store: IndexedDBService.STORES.CACHE_DATA, type: 'sync' },
      { pattern: /^viking_attendance_cache_time_(.+)$/, store: IndexedDBService.STORES.CACHE_DATA, type: 'cache' },
      { pattern: /^viking_shared_metadata_(.+)$/, store: IndexedDBService.STORES.CACHE_DATA, type: 'metadata' },
    ],
  },

  // Phase 2: Configuration
  [MIGRATION_PHASES.PHASE_2_CONFIG]: {
    patterns: [
      { pattern: /^viking_sections_offline$/, store: IndexedDBService.STORES.SECTIONS },
      { pattern: /^viking_startup_data_offline$/, store: IndexedDBService.STORES.STARTUP_DATA },
      { pattern: /^viking_terms_offline$/, store: IndexedDBService.STORES.TERMS },
    ],
  },

  // Phase 3: Flexi System
  [MIGRATION_PHASES.PHASE_3_FLEXI]: {
    patterns: [
      { pattern: /^viking_flexi_lists_(.+)_offline$/, store: IndexedDBService.STORES.FLEXI_LISTS },
      { pattern: /^viking_flexi_records_(.+)_archived_n_offline$/, store: IndexedDBService.STORES.FLEXI_RECORDS },
      { pattern: /^viking_flexi_structure_(.+)_offline$/, store: IndexedDBService.STORES.FLEXI_STRUCTURE },
      { pattern: /^viking_flexi_data_(.+)_offline$/, store: IndexedDBService.STORES.FLEXI_DATA },
    ],
  },

  // Phase 4: Events
  [MIGRATION_PHASES.PHASE_4_EVENTS]: {
    patterns: [
      { pattern: /^viking_events_(.+)_offline$/, store: IndexedDBService.STORES.EVENTS },
      { pattern: /^viking_attendance_(.+)_offline$/, store: IndexedDBService.STORES.ATTENDANCE },
      { pattern: /^viking_shared_attendance_(.+)_offline$/, store: IndexedDBService.STORES.SHARED_ATTENDANCE },
    ],
  },

  // Phase 5: Members
  [MIGRATION_PHASES.PHASE_5_MEMBERS]: {
    patterns: [
      { pattern: /^viking_members_comprehensive_offline$/, store: IndexedDBService.STORES.MEMBERS },
    ],
  },
};

export class MigrationService {
  static PHASES = MIGRATION_PHASES;

  static async getMigrationStatus() {
    try {
      const status = safeGetItem(MIGRATION_STATUS_KEY);

      if (status === null) {
        return {
          [MIGRATION_PHASES.PHASE_1_CACHE]: 'pending',
          [MIGRATION_PHASES.PHASE_2_CONFIG]: 'pending',
          [MIGRATION_PHASES.PHASE_3_FLEXI]: 'pending',
          [MIGRATION_PHASES.PHASE_4_EVENTS]: 'pending',
          [MIGRATION_PHASES.PHASE_5_MEMBERS]: 'pending',
          lastUpdated: null,
        };
      }

      return status;
    } catch (error) {
      logger.error('Failed to get migration status', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      return {
        [MIGRATION_PHASES.PHASE_1_CACHE]: 'pending',
        [MIGRATION_PHASES.PHASE_2_CONFIG]: 'pending',
        [MIGRATION_PHASES.PHASE_3_FLEXI]: 'pending',
        [MIGRATION_PHASES.PHASE_4_EVENTS]: 'pending',
        [MIGRATION_PHASES.PHASE_5_MEMBERS]: 'pending',
        lastUpdated: null,
      };
    }
  }

  static async setMigrationStatus(phase, status) {
    try {
      const currentStatus = await this.getMigrationStatus();
      currentStatus[phase] = status;
      currentStatus.lastUpdated = Date.now();

      safeSetItem(MIGRATION_STATUS_KEY, currentStatus);

      logger.info('Migration status updated', {
        phase,
        status,
        timestamp: currentStatus.lastUpdated,
      }, LOG_CATEGORIES.DATABASE);

      return true;
    } catch (error) {
      logger.error('Failed to set migration status', {
        phase,
        status,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      return false;
    }
  }

  static async scanLocalStorageForPhase(phase) {
    try {
      const mappings = RECORD_TYPE_MAPPINGS[phase];
      if (!mappings) {
        throw new Error(`Unknown migration phase: ${phase}`);
      }

      const foundKeys = [];

      // Scan all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        // Check if key matches any pattern for this phase
        for (const mapping of mappings.patterns) {
          if (mapping.pattern.test(key)) {
            const data = safeGetItem(key);
            if (data !== null) {
              foundKeys.push({
                key,
                store: mapping.store,
                type: mapping.type || 'data',
                data,
                extractedIds: this.extractIdsFromKey(key, mapping.pattern),
              });
            }
          }
        }
      }

      logger.info('localStorage scan completed for phase', {
        phase,
        foundKeysCount: foundKeys.length,
        keys: foundKeys.map(k => k.key),
      }, LOG_CATEGORIES.DATABASE);

      return foundKeys;
    } catch (error) {
      logger.error('localStorage scan failed', {
        phase,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'migration_scan',
          phase,
        },
      });

      throw error;
    }
  }

  static extractIdsFromKey(key, pattern) {
    const match = key.match(pattern);
    return match ? match.slice(1) : [];
  }

  static async migratePhase(phase) {
    try {
      logger.info('Starting migration phase', { phase }, LOG_CATEGORIES.DATABASE);

      // Set status to in-progress
      await this.setMigrationStatus(phase, 'in_progress');

      // Scan for localStorage keys to migrate
      const keysToMigrate = await this.scanLocalStorageForPhase(phase);

      if (keysToMigrate.length === 0) {
        logger.info('No keys found to migrate for phase', { phase }, LOG_CATEGORIES.DATABASE);
        await this.setMigrationStatus(phase, 'completed');
        return { success: true, migratedCount: 0 };
      }

      let migratedCount = 0;
      const errors = [];

      // Migrate each key
      for (const item of keysToMigrate) {
        try {
          const metadata = {
            originalKey: item.key,
            type: item.type,
            migratedAt: Date.now(),
            phase,
          };

          // Add extracted IDs as metadata
          if (item.extractedIds.length > 0) {
            if (item.extractedIds.length === 1) {
              metadata.sectionId = item.extractedIds[0];
            } else if (item.extractedIds.length > 1) {
              metadata.sectionId = item.extractedIds[0];
              metadata.eventId = item.extractedIds[1];
              metadata.recordId = item.extractedIds[0];
            }
          }

          await IndexedDBService.set(item.store, item.key, item.data, metadata);
          migratedCount++;

          logger.debug('Key migrated successfully', {
            key: item.key,
            store: item.store,
            dataSize: JSON.stringify(item.data).length,
          }, LOG_CATEGORIES.DATABASE);

        } catch (keyError) {
          const errorInfo = {
            key: item.key,
            store: item.store,
            error: keyError.message,
          };
          errors.push(errorInfo);

          logger.error('Failed to migrate key', errorInfo, LOG_CATEGORIES.ERROR);
        }
      }

      if (errors.length > 0) {
        await this.setMigrationStatus(phase, 'partial_failure');

        sentryUtils.captureException(new Error('Migration phase had errors'), {
          tags: {
            operation: 'migration_phase',
            phase,
          },
          contexts: {
            migration: {
              phase,
              totalKeys: keysToMigrate.length,
              migratedCount,
              errorCount: errors.length,
              errors,
            },
          },
        });

        return {
          success: false,
          migratedCount,
          errors,
          totalKeys: keysToMigrate.length,
        };
      }

      await this.setMigrationStatus(phase, 'completed');

      logger.info('Migration phase completed successfully', {
        phase,
        migratedCount,
        totalKeys: keysToMigrate.length,
      }, LOG_CATEGORIES.DATABASE);

      return {
        success: true,
        migratedCount,
        totalKeys: keysToMigrate.length,
      };

    } catch (error) {
      await this.setMigrationStatus(phase, 'failed');

      logger.error('Migration phase failed', {
        phase,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'migration_phase_failed',
          phase,
        },
      });

      throw error;
    }
  }

  static async cleanupLocalStorageForPhase(phase) {
    try {
      const status = await this.getMigrationStatus();
      if (status[phase] !== 'completed') {
        throw new Error(`Cannot cleanup localStorage for ${phase}: migration not completed`);
      }

      const keysToCleanup = await this.scanLocalStorageForPhase(phase);
      let cleanedCount = 0;

      for (const item of keysToCleanup) {
        try {
          // Verify data exists in IndexedDB before removing from localStorage
          const idbData = await IndexedDBService.get(item.store, item.key);
          if (idbData) {
            localStorage.removeItem(item.key);
            cleanedCount++;

            logger.debug('localStorage key cleaned up', {
              key: item.key,
              store: item.store,
            }, LOG_CATEGORIES.DATABASE);
          } else {
            logger.warn('Skipping cleanup: data not found in IndexedDB', {
              key: item.key,
              store: item.store,
            }, LOG_CATEGORIES.DATABASE);
          }
        } catch (cleanupError) {
          logger.error('Failed to cleanup localStorage key', {
            key: item.key,
            error: cleanupError.message,
          }, LOG_CATEGORIES.ERROR);
        }
      }

      logger.info('localStorage cleanup completed for phase', {
        phase,
        cleanedCount,
        totalKeys: keysToCleanup.length,
      }, LOG_CATEGORIES.DATABASE);

      return { success: true, cleanedCount };

    } catch (error) {
      logger.error('localStorage cleanup failed', {
        phase,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      throw error;
    }
  }

  static async rollbackPhase(phase) {
    try {
      logger.info('Starting rollback for phase', { phase }, LOG_CATEGORIES.DATABASE);

      const mappings = RECORD_TYPE_MAPPINGS[phase];
      if (!mappings) {
        throw new Error(`Unknown migration phase: ${phase}`);
      }

      // Get all keys from IndexedDB stores for this phase
      const storesToCheck = [...new Set(mappings.patterns.map(p => p.store))];
      let rolledBackCount = 0;

      for (const storeName of storesToCheck) {
        try {
          const keys = await IndexedDBService.getAllKeys(storeName);

          for (const key of keys) {
            try {
              const record = await IndexedDBService.get(storeName, key);
              if (record && record.phase === phase) {
                // Restore to localStorage
                safeSetItem(key, record);

                // Remove from IndexedDB
                await IndexedDBService.delete(storeName, key);

                rolledBackCount++;

                logger.debug('Key rolled back successfully', {
                  key,
                  store: storeName,
                }, LOG_CATEGORIES.DATABASE);
              }
            } catch (keyError) {
              logger.error('Failed to rollback key', {
                key,
                store: storeName,
                error: keyError.message,
              }, LOG_CATEGORIES.ERROR);
            }
          }
        } catch (storeError) {
          logger.error('Failed to process store during rollback', {
            store: storeName,
            error: storeError.message,
          }, LOG_CATEGORIES.ERROR);
        }
      }

      await this.setMigrationStatus(phase, 'rolled_back');

      logger.info('Rollback completed for phase', {
        phase,
        rolledBackCount,
      }, LOG_CATEGORIES.DATABASE);

      return { success: true, rolledBackCount };

    } catch (error) {
      logger.error('Rollback failed', {
        phase,
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      sentryUtils.captureException(error, {
        tags: {
          operation: 'migration_rollback_failed',
          phase,
        },
      });

      throw error;
    }
  }

  static async getMigrationReport() {
    try {
      const status = await this.getMigrationStatus();
      const storeInfo = await IndexedDBService.getStoreInfo();

      return {
        migrationStatus: status,
        indexedDBStores: storeInfo,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to generate migration report', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.ERROR);

      throw error;
    }
  }
}

export default MigrationService;
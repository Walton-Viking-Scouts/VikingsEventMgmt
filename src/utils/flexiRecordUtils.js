// FlexiRecord utility functions for Vikings Event Management Mobile
import { sentryUtils } from '../services/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import { safeGetItem, safeSetItem } from './storageUtils.js';
import { checkNetworkStatus } from './networkUtils.js';
import { 
  getFlexiRecords, 
  getFlexiStructure, 
  getSingleFlexiRecord, 
} from '../services/api.js';

// Storage keys for flexirecord caching
const STORAGE_KEYS = {
  FLEXI_RECORDS_LIST: (sectionId) => `viking_flexi_records_${sectionId}_offline`,
  CONSOLIDATED: (flexirecordId, termId) => `viking_flexi_consolidated_${flexirecordId}_${termId}_offline`,
};

/**
 * Parse flexirecord structure configuration to create field mapping
 * Converts the config JSON string to a map of field IDs to actual column names
 * 
 * @param {Object} structureData - Structure data from getFlexiStructure API
 * @returns {Map<string, Object>} Map of field ID to field metadata
 * @throws {Error} If structure data is invalid
 * 
 * @example
 * // Parse structure configuration
 * const fieldMapping = parseFlexiStructure(structureData);
 * console.log(fieldMapping.get('f_1')); // { name: 'CampGroup', width: '150' }
 */
export function parseFlexiStructure(structureData) {
  try {
    if (!structureData || typeof structureData !== 'object') {
      throw new Error('Invalid structure data: must be an object');
    }

    const fieldMapping = new Map();

    // Parse config JSON if it exists (contains field mappings)
    if (structureData.config) {
      try {
        const configArray = JSON.parse(structureData.config);
        if (Array.isArray(configArray)) {
          configArray.forEach(field => {
            if (field.id && field.name) {
              fieldMapping.set(field.id, {
                name: field.name,
                width: field.width || '150',
                fieldId: field.id,
              });
            }
          });
        }
      } catch (configError) {
        logger.warn('Failed to parse flexirecord config JSON', {
          config: structureData.config,
          error: configError.message,
        }, LOG_CATEGORIES.APP);
      }
    }

    // Also parse structure array for additional metadata
    if (structureData.structure && Array.isArray(structureData.structure)) {
      structureData.structure.forEach(section => {
        if (section.rows && Array.isArray(section.rows)) {
          section.rows.forEach(row => {
            if (row.field && row.field.startsWith('f_')) {
              const existing = fieldMapping.get(row.field) || {};
              fieldMapping.set(row.field, {
                ...existing,
                name: row.name || existing.name,
                width: row.width || existing.width || '150px',
                fieldId: row.field,
                editable: row.editable || false,
                formatter: row.formatter,
              });
            }
          });
        }
      });
    }

    logger.debug('Parsed flexirecord structure', {
      totalFields: fieldMapping.size,
      fieldIds: Array.from(fieldMapping.keys()),
      flexirecordName: structureData.name,
      extraid: structureData.extraid,
    }, LOG_CATEGORIES.APP);

    return fieldMapping;
  } catch (error) {
    logger.error('Error parsing flexirecord structure', {
      error: error.message,
      structureData: structureData,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'parse_flexi_structure',
      },
      contexts: {
        structureData: {
          hasConfig: !!(structureData && structureData.config),
          hasStructure: !!(structureData && structureData.structure),
          extraid: structureData?.extraid,
        },
      },
    });

    throw error;
  }
}

/**
 * Transform flexirecord data by mapping generic field names to actual column names
 * Converts f_1, f_2, etc. to their meaningful names like CampGroup, SignedInBy, etc.
 * 
 * @param {Object} flexiData - Data from getSingleFlexiRecord API
 * @param {Map<string, Object>} fieldMapping - Field mapping from parseFlexiStructure
 * @returns {Object} Transformed data with meaningful field names
 * @throws {Error} If data is invalid
 * 
 * @example
 * // Transform flexirecord data
 * const transformedData = transformFlexiRecordData(flexiData, fieldMapping);
 * // Now access data.items[0].CampGroup instead of data.items[0].f_1
 */
export function transformFlexiRecordData(flexiData, fieldMapping) {
  try {
    if (!flexiData || typeof flexiData !== 'object') {
      throw new Error('Invalid flexiData: must be an object');
    }

    if (!fieldMapping || !(fieldMapping instanceof Map)) {
      throw new Error('Invalid fieldMapping: must be a Map');
    }

    if (!flexiData.items || !Array.isArray(flexiData.items)) {
      logger.warn('FlexiRecord data has no items array', {
        hasItems: !!flexiData.items,
        itemsType: typeof flexiData.items,
      }, LOG_CATEGORIES.APP);
      
      return {
        ...flexiData,
        items: [],
        fieldMapping: Object.fromEntries(fieldMapping),
      };
    }

    const transformedItems = flexiData.items.map(item => {
      const transformedItem = { ...item };

      // Transform generic field names to meaningful names
      fieldMapping.forEach((fieldInfo, fieldId) => {
        if (Object.prototype.hasOwnProperty.call(item, fieldId)) {
          const meaningfulName = fieldInfo.name;
          transformedItem[meaningfulName] = item[fieldId];
          
          
          // Keep original field for reference if needed
          transformedItem[`_original_${fieldId}`] = item[fieldId];
        }
      });

      return transformedItem;
    });

    const result = {
      ...flexiData,
      items: transformedItems,
      fieldMapping: Object.fromEntries(fieldMapping),
      _metadata: {
        originalFieldCount: fieldMapping.size,
        transformedAt: new Date().toISOString(),
        totalItems: transformedItems.length,
      },
    };

    logger.debug('Transformed flexirecord data', {
      totalItems: transformedItems.length,
      fieldsTransformed: fieldMapping.size,
      fieldNames: Array.from(fieldMapping.values()).map(f => f.name),
    }, LOG_CATEGORIES.APP);

    return result;
  } catch (error) {
    logger.error('Error transforming flexirecord data', {
      error: error.message,
      hasFlexiData: !!flexiData,
      hasFieldMapping: !!fieldMapping,
      fieldMappingSize: fieldMapping?.size || 0,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'transform_flexi_record_data',
      },
      contexts: {
        data: {
          hasItems: !!(flexiData && flexiData.items),
          itemsCount: flexiData?.items?.length || 0,
          fieldMappingSize: fieldMapping?.size || 0,
        },
      },
    });

    throw error;
  }
}

/**
 * Get consolidated flexirecord data with meaningful field names
 * This is the main function that combines structure and data retrieval with offline caching
 * 
 * @param {string} sectionId - Section ID
 * @param {string} flexirecordId - FlexiRecord ID (extraid)
 * @param {string} termId - Term ID
 * @param {string} token - Authentication token (null for offline-only)
 * @returns {Promise<Object>} Consolidated flexirecord data with meaningful field names
 * @throws {Error} If any API call fails or data is invalid
 * 
 * @example
 * // Get consolidated flexirecord data (online)
 * const consolidatedData = await getConsolidatedFlexiRecord('49097', '72758', 'term123', token);
 * // Access data using meaningful names
 * console.log(consolidatedData.items[0].CampGroup); // Instead of f_1
 * console.log(consolidatedData.items[0].SignedInBy); // Instead of f_2
 * 
 * // Get from cache (offline)
 * const cachedData = await getConsolidatedFlexiRecord('49097', '72758', 'term123', null);
 */
export async function getConsolidatedFlexiRecord(sectionId, flexirecordId, termId, token) {
  try {
    if (!sectionId || !flexirecordId || !termId) {
      throw new Error('Missing required parameters: sectionId, flexirecordId, and termId are required');
    }

    // Check network status
    const isOnline = await checkNetworkStatus();
    
    // Storage key for consolidated data
    const consolidatedKey = STORAGE_KEYS.CONSOLIDATED(flexirecordId, termId);

    logger.info('Getting consolidated flexirecord data', {
      sectionId,
      flexirecordId,
      termId,
      isOnline,
      hasToken: !!token,
    }, LOG_CATEGORIES.API);


    // For offline/no token, try to get from cache
    if (!isOnline || !token) {
      const cachedData = safeGetItem(consolidatedKey, null);
      if (cachedData) {
        logger.info('Retrieved consolidated flexirecord from cache', {
          flexirecordName: cachedData._structure?.name,
          totalItems: cachedData.items?.length || 0,
          cachedAt: cachedData._metadata?.transformedAt,
        }, LOG_CATEGORIES.API);
        
        return cachedData;
      }
      
      if (!token) {
        throw new Error('No cached data available and no token provided for online access');
      }
      
      if (!isOnline) {
        throw new Error('Network unavailable and no cached consolidated data found');
      }
    }

    // Online: Get structure and data in parallel for better performance
    logger.debug('Making API calls for flexirecord consolidation', {
      flexirecordId,
      sectionId,
      termId,
      gettingStructure: true,
      gettingData: true,
    }, LOG_CATEGORIES.API);
    
    const [structureData, flexiData] = await Promise.all([
      getFlexiStructure(flexirecordId, sectionId, termId, token),
      getSingleFlexiRecord(flexirecordId, sectionId, termId, token),
    ]);

    if (!structureData) {
      throw new Error('Failed to retrieve flexirecord structure');
    }

    if (!flexiData) {
      throw new Error('Failed to retrieve flexirecord data');
    }

    // Parse structure to get field mapping
    const fieldMapping = parseFlexiStructure(structureData);

    // Transform data using field mapping
    const consolidatedData = transformFlexiRecordData(flexiData, fieldMapping);

    // Add structure metadata to result
    consolidatedData._structure = {
      name: structureData.name,
      extraid: structureData.extraid,
      sectionid: structureData.sectionid,
      archived: structureData.archived === '1',
      softDeleted: structureData.soft_deleted === '1',
    };

    // Cache the consolidated data for offline/fallback use
    // This ensures users can still see data when offline or when API calls fail
    if (isOnline) {
      safeSetItem(consolidatedKey, consolidatedData);
    }

    logger.info('Successfully consolidated flexirecord data', {
      flexirecordName: structureData.name,
      totalItems: consolidatedData.items.length,
      fieldsTransformed: fieldMapping.size,
      cached: isOnline,
    }, LOG_CATEGORIES.API);

    return consolidatedData;
  } catch (error) {
    logger.error('Error getting consolidated flexirecord data', {
      sectionId,
      flexirecordId,
      termId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    // Try cache as fallback for online errors
    if (token) {
      try {
        const consolidatedKey = STORAGE_KEYS.CONSOLIDATED(flexirecordId, termId);
        const cachedData = safeGetItem(consolidatedKey, null);
        if (cachedData) {
          logger.warn('Using cached flexirecord data after online failure', {
            flexirecordId,
            error: error.message,
          }, LOG_CATEGORIES.API);
          
          return cachedData;
        }
      } catch (cacheError) {
        logger.error('Cache fallback also failed', {
          originalError: error.message,
          cacheError: cacheError.message,
        }, LOG_CATEGORIES.ERROR);
      }
    }

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_consolidated_flexi_record',
      },
      contexts: {
        request: {
          sectionId,
          flexirecordId,
          termId,
          hasToken: !!token,
        },
      },
    });

    throw error;
  }
}


/**
 * Get all available flexirecords with their consolidated data
 * Fetches all flexirecords for a section and returns them with meaningful field names
 * Includes offline caching support
 * 
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID  
 * @param {string} token - Authentication token (null for offline-only)
 * @param {boolean} includeArchived - Whether to include archived flexirecords
 * @returns {Promise<Array>} Array of consolidated flexirecord data
 * @throws {Error} If any API call fails
 * 
 * @example
 * // Get all flexirecords for a section (online)
 * const allFlexiRecords = await getAllConsolidatedFlexiRecords('49097', 'term123', token);
 * allFlexiRecords.forEach(record => {
 *   console.log(`FlexiRecord: ${record._structure.name}`);
 *   record.items.forEach(item => {
 *     console.log(`Scout: ${item.firstname} - Camp Group: ${item.CampGroup}`);
 *   });
 * });
 * 
 * // Get from cache (offline)
 * const cachedRecords = await getAllConsolidatedFlexiRecords('49097', 'term123', null);
 */
export async function getAllConsolidatedFlexiRecords(sectionId, termId, token, includeArchived = false) {
  try {
    if (!sectionId || !termId) {
      throw new Error('Missing required parameters: sectionId and termId are required');
    }

    // Check network status
    const isOnline = await checkNetworkStatus();
    
    logger.info('Getting all consolidated flexirecords', {
      sectionId,
      termId,
      includeArchived,
      isOnline,
      hasToken: !!token,
    }, LOG_CATEGORIES.API);

    console.log('🔍 getAllConsolidatedFlexiRecords called with termId:', {
      sectionId,
      termId,
      isOnline,
      hasToken: !!token,
    });

    // If offline or no token, try to get cached flexirecord list
    if (!isOnline || !token) {
      const cachedFlexiList = safeGetItem(STORAGE_KEYS.FLEXI_RECORDS_LIST(sectionId), null);
      if (cachedFlexiList && cachedFlexiList.items) {
        logger.info('Using cached flexirecords list', {
          sectionId,
          totalCached: cachedFlexiList.items.length,
        }, LOG_CATEGORIES.API);
        
        // Get consolidated data for each cached flexirecord
        const cachedResults = [];
        for (const record of cachedFlexiList.items) {
          try {
            const consolidatedData = await getConsolidatedFlexiRecord(sectionId, record.extraid, termId, null);
            cachedResults.push(consolidatedData);
          } catch (error) {
            logger.warn('Failed to get cached flexirecord', {
              flexirecordId: record.extraid,
              flexirecordName: record.name,
              error: error.message,
            }, LOG_CATEGORIES.APP);
          }
        }
        
        return cachedResults;
      }
      
      if (!token) {
        throw new Error('No cached flexirecords available and no token provided for online access');
      }
    }

    // Online: Get list of available flexirecords
    const flexiRecordsList = await getFlexiRecordsWithCache(sectionId, token, includeArchived);

    if (!flexiRecordsList || !flexiRecordsList.items || !Array.isArray(flexiRecordsList.items)) {
      logger.warn('No flexirecords found for section', {
        sectionId,
        hasItems: !!(flexiRecordsList && flexiRecordsList.items),
      }, LOG_CATEGORIES.APP);
      
      return [];
    }

    // Get consolidated data for each flexirecord
    const consolidatedRecords = await Promise.allSettled(
      flexiRecordsList.items.map(async (record) => {
        return await getConsolidatedFlexiRecord(sectionId, record.extraid, termId, token);
      }),
    );

    // Process results, separating successful and failed consolidations
    const results = [];
    const errors = [];

    consolidatedRecords.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({
          flexirecord: flexiRecordsList.items[index],
          error: result.reason.message,
        });
      }
    });

    if (errors.length > 0) {
      logger.warn('Some flexirecords failed to consolidate', {
        totalRecords: flexiRecordsList.items.length,
        successfulRecords: results.length,
        failedRecords: errors.length,
        errors: errors.map(e => ({ name: e.flexirecord.name, error: e.error })),
      }, LOG_CATEGORIES.APP);
    }

    logger.info('Successfully retrieved consolidated flexirecords', {
      totalAvailable: flexiRecordsList.items.length,
      successfullyConsolidated: results.length,
      failed: errors.length,
    }, LOG_CATEGORIES.API);

    return results;
  } catch (error) {
    logger.error('Error getting all consolidated flexirecords', {
      sectionId,
      termId,
      includeArchived,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_all_consolidated_flexi_records',
      },
      contexts: {
        request: {
          sectionId,
          termId,
          includeArchived,
          hasToken: !!token,
        },
      },
    });

    throw error;
  }
}

/**
 * Get flexi records list with caching support
 * @private
 */
async function getFlexiRecordsWithCache(sectionId, token, includeArchived) {
  const storageKey = STORAGE_KEYS.FLEXI_RECORDS_LIST(sectionId);
  
  try {
    // Try to get from API
    const flexiRecordsList = await getFlexiRecords(sectionId, token, includeArchived ? 'y' : 'n');
    
    // Cache the flexi records list
    if (flexiRecordsList) {
      safeSetItem(storageKey, flexiRecordsList);
    }
    
    return flexiRecordsList;
  } catch (error) {
    // Try cache as fallback
    const cachedData = safeGetItem(storageKey, null);
    if (cachedData) {
      logger.warn('Using cached flexi records list after API failure', {
        sectionId,
        error: error.message,
      }, LOG_CATEGORIES.API);
      
      return cachedData;
    }
    
    throw error;
  }
}

/**
 * Extract expected Viking Event Management fields from flexirecord data
 * Specifically looks for CampGroup, SignedInBy, SignedInWhen, SignedOutBy, SignedOutWhen
 * 
 * @param {Object} consolidatedData - Consolidated flexirecord data
 * @returns {Array} Array of scout data with Viking Event Management fields
 * 
 * @example
 * // Extract Viking-specific fields
 * const vikingData = extractVikingEventFields(consolidatedData);
 * vikingData.forEach(scout => {
 *   console.log(`${scout.firstname}: Camp Group ${scout.CampGroup}, Signed In: ${scout.SignedInWhen}`);
 * });
 */
export function extractVikingEventFields(consolidatedData) {
  try {
    if (!consolidatedData || !consolidatedData.items) {
      return [];
    }

    const vikingFields = ['CampGroup', 'SignedInBy', 'SignedInWhen', 'SignedOutBy', 'SignedOutWhen'];
    
    return consolidatedData.items.map(scout => {
      const vikingScout = {
        // Core scout info
        scoutid: scout.scoutid,
        firstname: scout.firstname,
        lastname: scout.lastname,
        dob: scout.dob,
        age: scout.age,
        patrol: scout.patrol,
        patrolid: scout.patrolid,
        photo_guid: scout.photo_guid,
      };

      // Add Viking Event Management fields
      vikingFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(scout, field)) {
          vikingScout[field] = scout[field];
        }
      });

      return vikingScout;
    });
  } catch (error) {
    logger.error('Error extracting Viking event fields', {
      error: error.message,
      hasConsolidatedData: !!consolidatedData,
    }, LOG_CATEGORIES.ERROR);

    return [];
  }
}
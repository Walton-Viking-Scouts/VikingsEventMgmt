import { multiUpdateFlexiRecord } from '../../../shared/services/api/api/flexiRecords.js';
import { parseFlexiStructure } from '../../../shared/utils/flexiRecordTransforms.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { sentryUtils } from '../../../shared/services/utils/sentry.js';
import { CLEAR_STRING_SENTINEL, CLEAR_TIME_SENTINEL } from '../../../shared/constants/signInDataConstants.js';

/**
 * Get field ID from field mapping
 * @param {string} fieldName - Field name to find
 * @param {Map} fieldMapping - Field mapping from parsed structure
 * @returns {string} Field ID (e.g., 'f_1')
 * @throws {Error} When field is not found
 */
function getFieldId(fieldName, fieldMapping) {
  for (const [fieldId, fieldInfo] of fieldMapping.entries()) {
    if (fieldInfo.name === fieldName) {
      return fieldId;
    }
  }
  throw new Error(`Field '${fieldName}' not found in flexirecord structure`);
}

/**
 * Extract FlexiRecord context for sign-in operations
 * @param {Object} sectionVikingEventData - Viking Event data for section
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} sectionType - Section type
 * @returns {Object|null} FlexiRecord context
 */
export function extractSignInFlexiRecordContext(sectionVikingEventData, sectionId, termId, sectionType) {
  if (!sectionVikingEventData) {
    logger.warn('No Viking Event data for section', { sectionId }, LOG_CATEGORIES.API);
    return null;
  }

  try {
    // Handle both _structure and structure formats
    const structure = sectionVikingEventData._structure || sectionVikingEventData.structure;

    if (!structure) {
      logger.warn('No structure found in Viking Event data', { sectionId }, LOG_CATEGORIES.API);
      return null;
    }

    // Parse the structure to get field mapping
    const fieldMapping = parseFlexiStructure(structure);

    if (!fieldMapping || fieldMapping.size === 0) {
      logger.warn('No field mapping found in structure', { sectionId }, LOG_CATEGORIES.API);
      return null;
    }

    // Check for required sign-in fields
    const requiredFields = ['SignedInBy', 'SignedInWhen', 'SignedOutBy', 'SignedOutWhen'];
    const missingFields = [];

    for (const fieldName of requiredFields) {
      try {
        getFieldId(fieldName, fieldMapping);
      } catch (error) {
        missingFields.push(fieldName);
      }
    }

    if (missingFields.length > 0) {
      logger.warn('Missing required sign-in fields in FlexiRecord structure', {
        sectionId,
        missingFields,
        availableFields: Array.from(fieldMapping.values()).map(f => f.name),
      }, LOG_CATEGORIES.API);
      return null;
    }

    const flexirecordid = structure.flexirecordid || structure.extraid;

    if (!flexirecordid) {
      logger.warn('No flexirecordid found in structure', { sectionId }, LOG_CATEGORIES.API);
      return null;
    }

    return {
      flexirecordid: String(flexirecordid),
      sectionid: String(sectionId),
      termid: String(termId),
      sectiontype: sectionType,
      fieldMapping,
    };

  } catch (error) {
    logger.error('Failed to extract FlexiRecord context for sign-in operations', {
      error: error.message,
      sectionId,
    }, LOG_CATEGORIES.ERROR);
    return null;
  }
}

/**
 * Clear all sign-in data for multiple members in a section
 * @param {Array<string>} scoutIds - Array of scout IDs
 * @param {Object} flexiRecordContext - FlexiRecord context with field mapping
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} Result object with success status
 */
export async function bulkClearSignInData(scoutIds, flexiRecordContext, token) {
  const startTime = Date.now();

  try {
    if (!scoutIds || scoutIds.length === 0) {
      throw new Error('No scout IDs provided');
    }

    if (!flexiRecordContext) {
      throw new Error('FlexiRecord context is required');
    }

    const { flexirecordid, sectionid, fieldMapping } = flexiRecordContext;

    // Get field IDs for all sign-in/out fields
    const signInByFieldId = getFieldId('SignedInBy', fieldMapping);
    const signInWhenFieldId = getFieldId('SignedInWhen', fieldMapping);
    const signOutByFieldId = getFieldId('SignedOutBy', fieldMapping);
    const signOutWhenFieldId = getFieldId('SignedOutWhen', fieldMapping);

    logger.info('Starting bulk clear sign-in data operation', {
      scoutCount: scoutIds.length,
      sectionid,
      flexirecordid,
      fieldIds: {
        signInBy: signInByFieldId,
        signInWhen: signInWhenFieldId,
        signOutBy: signOutByFieldId,
        signOutWhen: signOutWhenFieldId,
      },
    }, LOG_CATEGORIES.API);

    // Execute 4 bulk updates in sequence - one for each field
    // Use consistent clearing values from shared constants
    const operations = [
      { fieldId: signInByFieldId, fieldName: 'SignedInBy', clearValue: CLEAR_STRING_SENTINEL },
      { fieldId: signInWhenFieldId, fieldName: 'SignedInWhen', clearValue: CLEAR_TIME_SENTINEL },
      { fieldId: signOutByFieldId, fieldName: 'SignedOutBy', clearValue: CLEAR_STRING_SENTINEL },
      { fieldId: signOutWhenFieldId, fieldName: 'SignedOutWhen', clearValue: CLEAR_TIME_SENTINEL },
    ];

    const results = [];

    for (const { fieldId, fieldName, clearValue } of operations) {
      try {
        logger.info(`Clearing ${fieldName} for ${scoutIds.length} members`, {
          fieldName,
          fieldId,
          clearValue,
          sectionid,
        }, LOG_CATEGORIES.API);

        const result = await multiUpdateFlexiRecord(
          sectionid,
          scoutIds,
          clearValue,
          fieldId,
          flexirecordid,
          token,
        );

        // Check for application-level failure (same logic as camp groups)
        if (!result || result.ok === false || result.status === 'error' || result.success === false || result.error === true) {
          throw new Error(`Failed to clear ${fieldName}: ${result?.message || result?.error || 'API returned error status'}`);
        }

        logger.info(`Successfully cleared ${fieldName}`, {
          fieldName,
          scoutCount: scoutIds.length,
        }, LOG_CATEGORIES.API);
        results.push({ fieldName, success: true });

        // Small delay between operations to prevent API overload
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (fieldError) {
        logger.error(`Failed to clear ${fieldName}`, {
          error: fieldError.message,
          fieldName,
          sectionid,
        }, LOG_CATEGORIES.ERROR);
        results.push({ fieldName, success: false, error: fieldError.message });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    if (failureCount === 0) {
      logger.info('Bulk clear sign-in data completed successfully', {
        scoutCount: scoutIds.length,
        clearedFields: successCount,
        duration: `${duration}ms`,
      }, LOG_CATEGORIES.API);

      return {
        success: true,
        scoutIds,
        clearedFields: successCount,
        results,
        duration,
      };
    } else if (successCount > 0) {
      // Partial success - some fields cleared successfully
      logger.warn('Bulk clear sign-in data partially succeeded', {
        scoutCount: scoutIds.length,
        clearedFields: successCount,
        failedFields: failureCount,
        duration: `${duration}ms`,
      }, LOG_CATEGORIES.API);

      return {
        success: true, // Consider partial success as success
        scoutIds,
        clearedFields: successCount,
        failedFields: failureCount,
        results,
        duration,
        partial: true,
      };
    } else {
      throw new Error(`Failed to clear ${failureCount} out of ${results.length} fields`);
    }

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Bulk clear sign-in data failed', {
      scoutCount: scoutIds?.length || 0,
      error: error.message,
      duration: `${duration}ms`,
      operation: 'bulkClearSignInData',
    }, LOG_CATEGORIES.ERROR);

    // Capture in Sentry with context
    sentryUtils.captureException(error, {
      tags: {
        operation: 'bulkClearSignInData',
      },
      contexts: {
        bulkClear: {
          scoutCount: scoutIds?.length || 0,
        },
        flexiRecord: {
          id: flexiRecordContext?.flexirecordid,
          sectionid: flexiRecordContext?.sectionid,
        },
      },
    });

    return {
      success: false,
      scoutIds,
      error: error.message,
      duration,
    };
  }
}
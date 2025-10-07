import { updateFlexiRecord, multiUpdateFlexiRecord } from '../../../shared/services/api/api/flexiRecords.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { sentryUtils } from '../../../shared/services/utils/sentry.js';
import { isDemoMode } from '../../../config/demoMode.js';
import { safeGetItem, safeSetItem } from '../../../shared/utils/storageUtils.js';

/**
 * Service for managing camp group member allocations
 * Handles moving members between groups via OSM FlexiRecord API
 */

/**
 * Move a member to a different camp group
 * 
 * @param {Object} moveData - The move operation data
 * @param {Object} moveData.member - Member being moved
 * @param {string} moveData.fromGroupNumber - Original group number
 * @param {string} moveData.fromGroupName - Original group name  
 * @param {string} moveData.toGroupNumber - Target group number
 * @param {string} moveData.toGroupName - Target group name
 * @param {Object} flexiRecordContext - FlexiRecord configuration
 * @param {string} flexiRecordContext.flexirecordid - FlexiRecord ID
 * @param {string} flexiRecordContext.columnid - Column ID for CampGroup field
 * @param {string} flexiRecordContext.sectionid - Section ID
 * @param {string} flexiRecordContext.termid - Term ID
 * @param {string} flexiRecordContext.section - Section name
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} Result with success status and details
 */
/**
 * Demo mode version of camp group assignment
 * Updates localStorage cache instead of calling OSM API
 */
function assignMemberToCampGroupDemo(moveData, flexiRecordContext) {
  try {
    const memberName = moveData.member.name || `${moveData.member.firstname} ${moveData.member.lastname}` || 'Unknown';
    
    logger.info('Demo mode: Assigning member to camp group', {
      memberId: moveData.member.scoutid,
      memberName,
      toGroup: moveData.toGroupNumber,
    }, LOG_CATEGORIES.API);
    
    // In demo mode, use standardized values
    const flexirecordid = flexiRecordContext?.flexirecordid || 'flexi_viking_event';
    const sectionid = flexiRecordContext?.sectionid || moveData.member.sectionid;
    const termid = flexiRecordContext?.termid || '12345';
    
    const cacheKey = `viking_flexi_data_${flexirecordid}_${sectionid}_${termid}_offline`;
    const cached = safeGetItem(cacheKey, { items: [] });
    
    // Convert scoutid to match the type in cache (both to numbers for comparison)
    const memberScoutId = Number(moveData.member.scoutid);
    const memberIndex = cached.items.findIndex(m => Number(m.scoutid) === memberScoutId);
    if (memberIndex >= 0) {
      const newValue = (moveData.toGroupNumber === 'Unassigned' || !moveData.toGroupNumber) ? '' : moveData.toGroupNumber.toString();
      
      // Update both f_1 (the flexi field) and CampGroup (the transformed field)
      cached.items[memberIndex].f_1 = newValue;
      cached.items[memberIndex].CampGroup = newValue;
      
      safeSetItem(cacheKey, cached);
      
      return {
        ok: true,
        success: true,
        message: `Demo mode: ${memberName} moved to group ${moveData.toGroupNumber}`,
      };
    } else {
      throw new Error(`Member ${memberName} not found in demo cache`);
    }
  } catch (error) {
    logger.error('Demo mode: Failed to assign member to camp group', {
      error: error.message,
      moveData,
    }, LOG_CATEGORIES.API);
    
    return {
      ok: false,
      success: false,
      error: error.message,
    };
  }
}

export async function assignMemberToCampGroup(moveData, flexiRecordContext, token) {
  // Handle demo mode
  if (isDemoMode()) {
    return assignMemberToCampGroupDemo(moveData, flexiRecordContext);
  }
  
  // Production mode continues below
  const startTime = Date.now();
  
  try {
    // Validate required data FIRST
    if (!moveData.member || !moveData.member.scoutid) {
      throw new Error('Invalid member data: missing scoutid');
    }

    // Now safe to log with member data
    logger.info('Starting camp group assignment', {
      memberId: moveData.member.scoutid,
      memberName: moveData.member.name || `${moveData.member.firstname} ${moveData.member.lastname}` || 'Unknown',
      fromGroup: moveData.fromGroupNumber,
      toGroup: moveData.toGroupNumber,
      operation: 'assignMemberToCampGroup',
    }, LOG_CATEGORIES.API);

    if (!flexiRecordContext || !flexiRecordContext.flexirecordid) {
      throw new Error('Invalid FlexiRecord context: missing flexirecordid');
    }

    // Validate all required FlexiRecord context fields
    if (!flexiRecordContext.sectionid) {
      throw new Error('Invalid FlexiRecord context: missing sectionid');
    }

    if (!flexiRecordContext.termid) {
      throw new Error('Invalid FlexiRecord context: missing termid');
    }

    if (!flexiRecordContext.section) {
      throw new Error('Invalid FlexiRecord context: missing section name');
    }

    // Validate columnid follows the f_N pattern (e.g., f_1, f_2, f_3)
    if (!flexiRecordContext.columnid || !/^f_\d+$/.test(flexiRecordContext.columnid)) {
      throw new Error(`Invalid FlexiRecord field ID: expected format 'f_N', got '${flexiRecordContext.columnid || 'undefined'}'`);
    }

    // Validate token is provided
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid or missing authentication token');
    }

    // Determine the new group value for the API
    // Empty string or null for "Unassigned", otherwise the group number
    const newGroupValue = (moveData.toGroupNumber === 'Unassigned' || !moveData.toGroupNumber) 
      ? '' 
      : moveData.toGroupNumber.toString();

    // Call the existing updateFlexiRecord API
    const result = await updateFlexiRecord(
      flexiRecordContext.sectionid,
      moveData.member.scoutid,
      flexiRecordContext.flexirecordid,
      flexiRecordContext.columnid,
      newGroupValue,
      flexiRecordContext.termid,
      flexiRecordContext.section,
      token,
    );

    // Check for application-level failure (API can return HTTP 200 with ok: false)
    if (!result || result.ok === false || result.status === 'error' || result.success === false) {
      throw new Error(result?.message || result?.error || 'FlexiRecord update failed - API returned error status');
    }

    const duration = Date.now() - startTime;

    logger.info('Camp group assignment successful', {
      memberId: moveData.member.scoutid,
      fromGroup: moveData.fromGroupNumber,
      toGroup: moveData.toGroupNumber,
      newValue: newGroupValue,
      duration: `${duration}ms`,
      operation: 'assignMemberToCampGroup',
    }, LOG_CATEGORIES.API);

    return {
      success: true,
      moveData,
      result,
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Camp group assignment failed', {
      memberId: moveData.member?.scoutid,
      memberName: moveData.member ? (moveData.member.name || `${moveData.member.firstname} ${moveData.member.lastname}` || 'Unknown') : 'Unknown',
      fromGroup: moveData.fromGroupNumber,
      toGroup: moveData.toGroupNumber,
      error: error.message,
      duration: `${duration}ms`,
      operation: 'assignMemberToCampGroup',
    }, LOG_CATEGORIES.ERROR);

    // Capture in Sentry with context
    sentryUtils.captureException(error, {
      tags: {
        operation: 'assignMemberToCampGroup',
        memberType: moveData.member?.person_type || 'Unknown',
      },
      contexts: {
        move: {
          memberId: moveData.member?.scoutid,
          fromGroup: moveData.fromGroupNumber,
          toGroup: moveData.toGroupNumber,
        },
        flexiRecord: {
          id: flexiRecordContext?.flexirecordid,
          columnid: flexiRecordContext?.columnid,
          sectionid: flexiRecordContext?.sectionid,
        },
      },
    });

    return {
      success: false,
      moveData,
      error: error.message,
      duration,
    };
  }
}

/**
 * Process multiple member moves in sequence
 * Useful for bulk operations or retry scenarios
 * 
 * @param {Array<Object>} moves - Array of move operations
 * @param {Object} flexiRecordContext - FlexiRecord configuration 
 * @param {string} token - Authentication token
 * @returns {Promise<Array<Object>>} Array of results for each move
 */
export async function batchAssignMembers(moves, flexiRecordContext, token) {
  logger.info('Starting batch camp group assignment', {
    totalMoves: moves.length,
    operation: 'batchAssignMembers',
  }, LOG_CATEGORIES.API);

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const [index, move] of moves.entries()) {
    try {
      logger.debug(`Processing batch move ${index + 1}/${moves.length}`, {
        memberId: move.member?.scoutid,
        memberName: move.member ? (move.member.name || `${move.member.firstname} ${move.member.lastname}` || 'Unknown') : 'Unknown',
      }, LOG_CATEGORIES.API);

      const result = await assignMemberToCampGroup(move, flexiRecordContext, token);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Rate limiting: small delay between API calls
      if (index < moves.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (error) {
      logger.error(`Batch move ${index + 1} failed`, {
        memberId: move.member?.scoutid,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);

      results.push({
        success: false,
        moveData: move,
        error: error.message,
      });
      errorCount++;
    }
  }

  logger.info('Batch camp group assignment completed', {
    totalMoves: moves.length,
    successCount,
    errorCount,
    operation: 'batchAssignMembers',
  }, LOG_CATEGORIES.API);

  return {
    results,
    summary: {
      total: moves.length,
      successful: successCount,
      failed: errorCount,
    },
  };
}

/**
 * Extract FlexiRecord context from Viking Event data
 * 
 * @param {Object} vikingEventData - Viking Event Management FlexiRecord data
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} sectionName - Section name
 * @returns {Object|null} FlexiRecord context or null if not available
 */
export function extractFlexiRecordContext(vikingEventData, sectionId, termId, sectionName) {
  // Debug: Log the actual data being passed
  logger.info('DEBUG: extractFlexiRecordContext called', {
    vikingEventData: vikingEventData ? Object.keys(vikingEventData) : 'null',
    vikingEventDataType: typeof vikingEventData,
    sectionId,
    termId,
    sectionName,
    fullDataSample: vikingEventData ? JSON.stringify(vikingEventData, null, 2).substring(0, 500) + '...' : 'null',
  }, LOG_CATEGORIES.APP);
  
  // Try both _structure and structure properties for compatibility
  const structure = vikingEventData?._structure || vikingEventData?.structure;
  
  if (!vikingEventData || !structure) {
    logger.warn('No Viking Event data or structure available', {
      hasData: !!vikingEventData,
      hasStructure: !!structure,
      hasUnderscoreStructure: !!(vikingEventData?._structure),
      hasRegularStructure: !!(vikingEventData?.structure),
      sectionId,
    }, LOG_CATEGORIES.APP);
    return null;
  }

  // Find the CampGroup field mapping from the structure
  // Field mapping can be either a Map or an object (depending on parsing)
  let campGroupField = null;
  const fieldMapping = structure.fieldMapping || {};

  // Handle Map format (parseFlexiStructure returns a Map)
  if (fieldMapping instanceof Map) {
    for (const [, fieldInfo] of fieldMapping.entries()) {
      if (fieldInfo.name === 'CampGroup') {
        campGroupField = fieldInfo;
        break;
      }
    }
  }
  // Handle object format (cached structure might be an object)
  else if (fieldMapping && typeof fieldMapping === 'object') {
    campGroupField = Object.values(fieldMapping).find(field => field.name === 'CampGroup');
  }

  if (!campGroupField) {
    const availableFields = fieldMapping instanceof Map
      ? Array.from(fieldMapping.values()).map(f => f.name)
      : Object.values(fieldMapping).map(f => f.name);

    logger.warn('No CampGroup field found in FlexiRecord structure', {
      availableFields,
      fieldMappingType: typeof fieldMapping,
      isMap: fieldMapping instanceof Map,
      sectionId,
    }, LOG_CATEGORIES.APP);
    return null;
  }

  return {
    flexirecordid: structure.flexirecordid,
    columnid: campGroupField.columnId, // Should be f_1
    sectionid: sectionId,
    termid: termId,
    section: sectionName,
  };
}

/**
 * Validate that a member can be moved to a specific group
 * 
 * @param {Object} member - Member data
 * @param {string} targetGroupNumber - Target group number
 * @param {Object} currentGroups - Current group organization
 * @returns {Object} Validation result with success/error details
 */
export function validateMemberMove(member, targetGroupNumber, currentGroups) {
  // Validate member object exists
  if (!member) {
    return {
      valid: false,
      error: 'Cannot find member: member object is undefined',
    };
  }

  // Only Young People can be moved between camp groups
  if (member.person_type !== 'Young People') {
    return {
      valid: false,
      error: 'Only Young People can be assigned to camp groups',
    };
  }

  // Check if target group exists (unless it's "Unassigned")
  if (targetGroupNumber !== 'Unassigned' && targetGroupNumber !== '') {
    const targetGroup = Object.values(currentGroups).find(
      group => String(group.number) === String(targetGroupNumber),
    );
    
    if (!targetGroup) {
      return {
        valid: false,
        error: `Target group ${targetGroupNumber} does not exist`,
      };
    }
  }

  return {
    valid: true,
  };
}

/**
 * Bulk update camp group assignments for multiple members using multi-update API
 * More efficient than individual updates for operations like group renaming
 * 
 * @param {Array<string|number>} scoutIds - Array of scout/member IDs to update
 * @param {string} newGroupValue - New camp group value (empty string for "Unassigned")
 * @param {Object} flexiRecordContext - FlexiRecord configuration
 * @param {string} flexiRecordContext.flexirecordid - FlexiRecord ID
 * @param {string} flexiRecordContext.columnid - Column ID for CampGroup field
 * @param {string} flexiRecordContext.sectionid - Section ID
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} Result with success status and details
 */
export async function bulkUpdateCampGroups(scoutIds, newGroupValue, flexiRecordContext, token) {
  // Handle demo mode
  if (isDemoMode()) {
    logger.info('Demo mode: Simulating bulk camp group update', {
      scoutCount: scoutIds.length,
      newGroupValue,
      flexirecordid: flexiRecordContext?.flexirecordid,
    }, LOG_CATEGORIES.API);
    
    // Update demo cache for each scout
    const flexirecordid = flexiRecordContext?.flexirecordid || 'flexi_viking_event';
    const sectionid = flexiRecordContext?.sectionid;
    const termid = '12345'; // Demo term ID
    
    const cacheKey = `viking_flexi_data_${flexirecordid}_${sectionid}_${termid}_offline`;
    const cached = safeGetItem(cacheKey, { items: [] });
    
    let updatedCount = 0;
    scoutIds.forEach(scoutId => {
      const memberIndex = cached.items.findIndex(m => Number(m.scoutid) === Number(scoutId));
      if (memberIndex >= 0) {
        cached.items[memberIndex].f_1 = newGroupValue;
        cached.items[memberIndex].CampGroup = newGroupValue;
        updatedCount++;
      }
    });
    
    safeSetItem(cacheKey, cached);
    
    return {
      ok: true,
      success: true,
      message: `Demo mode: Bulk updated ${updatedCount} members`,
      updatedCount,
    };
  }
  
  // Production mode
  const startTime = Date.now();
  
  try {
    // Validate required data
    if (!Array.isArray(scoutIds) || scoutIds.length === 0) {
      throw new Error('Invalid scout IDs: array is required and must not be empty');
    }

    if (!flexiRecordContext || !flexiRecordContext.flexirecordid) {
      throw new Error('Invalid FlexiRecord context: missing flexirecordid');
    }

    if (!flexiRecordContext.sectionid) {
      throw new Error('Invalid FlexiRecord context: missing sectionid');
    }

    if (!flexiRecordContext.columnid || !/^f_\d+$/.test(flexiRecordContext.columnid)) {
      throw new Error(`Invalid FlexiRecord field ID: expected format 'f_N', got '${flexiRecordContext.columnid || 'undefined'}'`);
    }

    if (!token || typeof token !== 'string') {
      throw new Error('Invalid or missing authentication token');
    }

    logger.info('Starting bulk camp group update', {
      scoutCount: scoutIds.length,
      newGroupValue,
      operation: 'bulkUpdateCampGroups',
    }, LOG_CATEGORIES.API);

    // Call the multi-update API
    const result = await multiUpdateFlexiRecord(
      flexiRecordContext.sectionid,
      scoutIds,
      newGroupValue,
      flexiRecordContext.columnid,
      flexiRecordContext.flexirecordid,
      token,
    );

    // Check for application-level failure
    if (!result || result.ok === false || result.status === 'error' || result.success === false) {
      throw new Error(result?.message || result?.error || 'Multi-update FlexiRecord failed - API returned error status');
    }

    const duration = Date.now() - startTime;

    logger.info('Bulk camp group update successful', {
      scoutCount: scoutIds.length,
      newGroupValue,
      duration: `${duration}ms`,
      operation: 'bulkUpdateCampGroups',
    }, LOG_CATEGORIES.API);

    return {
      success: true,
      scoutIds,
      newGroupValue,
      result,
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Bulk camp group update failed', {
      scoutCount: scoutIds?.length || 0,
      newGroupValue,
      error: error.message,
      duration: `${duration}ms`,
      operation: 'bulkUpdateCampGroups',
    }, LOG_CATEGORIES.ERROR);

    // Capture in Sentry with context
    sentryUtils.captureException(error, {
      tags: {
        operation: 'bulkUpdateCampGroups',
      },
      contexts: {
        bulkUpdate: {
          scoutCount: scoutIds?.length || 0,
          newGroupValue,
        },
        flexiRecord: {
          id: flexiRecordContext?.flexirecordid,
          columnid: flexiRecordContext?.columnid,
          sectionid: flexiRecordContext?.sectionid,
        },
      },
    });

    return {
      success: false,
      scoutIds,
      newGroupValue,
      error: error.message,
      duration,
    };
  }
}
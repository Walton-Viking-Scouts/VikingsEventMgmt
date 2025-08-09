import { updateFlexiRecord } from './api.js';
import logger, { LOG_CATEGORIES } from './logger.js';
import { sentryUtils } from './sentry.js';

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
export async function assignMemberToCampGroup(moveData, flexiRecordContext, token) {
  const startTime = Date.now();
  
  try {
    // Validate required data FIRST
    if (!moveData.member || !moveData.member.scoutid) {
      throw new Error('Invalid member data: missing scoutid');
    }

    // Now safe to log with member data
    logger.info('Starting camp group assignment', {
      memberId: moveData.member.scoutid,
      memberName: `${moveData.member.firstname} ${moveData.member.lastname}`,
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
      memberName: moveData.member ? `${moveData.member.firstname} ${moveData.member.lastname}` : 'Unknown',
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
        memberName: move.member ? `${move.member.firstname} ${move.member.lastname}` : 'Unknown',
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
  // Field mapping is now keyed by field IDs (f_1, f_2, etc.) not by field names
  const campGroupField = Object.values(structure.fieldMapping || {})
    .find(field => field.name === 'CampGroup');
  
  if (!campGroupField) {
    logger.warn('No CampGroup field found in FlexiRecord structure', {
      availableFields: Object.keys(structure.fieldMapping || {}),
      availableFieldNames: Object.values(structure.fieldMapping || {}).map(f => f.name),
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
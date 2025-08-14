// FlexiRecord transformation utilities for Vikings Event Management Mobile
// Pure functions for data transformation and field mapping
import { sentryUtils } from '../services/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

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

// Helper function removed - now using person_type directly from getSummaryStats data

/**
 * Organize members by their camp groups
 * Since Register and Camp Groups use the same data, just process the attendees array
 * which already has vikingEventData attached from getSummaryStats()
 * 
 * @param {Array} processedMembers - Members with vikingEventData from getSummaryStats()
 * @returns {Object} Organized camp groups with leaders and young people
 * 
 * @example
 * const organized = organizeMembersByCampGroups(getSummaryStatsArray);
 * console.log(organized.groups['Group 1'].youngPeople); // Young people in group 1
 */
export function organizeMembersByCampGroups(processedMembers) {
  try {
    if (!processedMembers || !Array.isArray(processedMembers)) {
      logger.warn('Invalid processed members data provided', {
        hasProcessedMembers: !!processedMembers,
        isArray: Array.isArray(processedMembers),
      }, LOG_CATEGORIES.APP);
      
      return { groups: {}, summary: { totalGroups: 0, totalMembers: 0 } };
    }

    logger.info('Organizing members by camp groups', {
      totalProcessedMembers: processedMembers.length,
    }, LOG_CATEGORIES.APP);

    const groups = {};
    let processedCount = 0;

    // Process each member (they already have vikingEventData from getSummaryStats)
    processedMembers.forEach(member => {
      // Skip if no member data
      if (!member) {
        return;
      }

      // Filter out Leaders and Young Leaders using person_type from getSummaryStats
      if (member.person_type === 'Leaders' || member.person_type === 'Young Leaders') {
        logger.debug('Skipping leader from camp groups', {
          scoutid: member.scoutid,
          name: member.name,
          personType: member.person_type,
        }, LOG_CATEGORIES.APP);
        return;
      }

      // Get camp group assignment - getSummaryStats attaches vikingEventData
      const campGroupNumber = member.vikingEventData?.CampGroup;
      const groupName = campGroupNumber ? `Group ${campGroupNumber}` : 'Group Unassigned';

      // Initialize group if it doesn't exist
      if (!groups[groupName]) {
        groups[groupName] = {
          name: groupName,
          number: campGroupNumber || 'Unassigned',
          leaders: [], // Keep empty - no leaders in camp groups
          youngPeople: [],
          totalMembers: 0,
        };
      }

      // Add member to the appropriate group (leaders filtered out above)  
      const memberWithGroup = {
        ...member,
        campGroup: campGroupNumber,
        groupName: groupName,
      };
      
      // Debug member name issue - log to Sentry
      if (processedCount < 2) {
        logger.info(`organizeMembersByCampGroups DEBUG: Processing member ${processedCount}. Original name: "${member.name}", After transform: "${memberWithGroup.name}", Name preserved: ${member.name === memberWithGroup.name}`, {
          originalName: member.name,
          transformedName: memberWithGroup.name,
          namePreserved: member.name === memberWithGroup.name,
          memberKeys: Object.keys(member).join(', '),
        }, LOG_CATEGORIES.APP);
      }
      
      groups[groupName].youngPeople.push(memberWithGroup);
      groups[groupName].totalMembers++;
      processedCount++;
    });

    // Sort groups by number (Unassigned goes last)
    const sortedGroupNames = Object.keys(groups).sort((a, b) => {
      if (a === 'Group Unassigned') return 1;
      if (b === 'Group Unassigned') return -1;
      
      const aNum = parseInt(a.replace('Group ', ''));
      const bNum = parseInt(b.replace('Group ', ''));
      return aNum - bNum;
    });

    // Create sorted groups object
    const sortedGroups = {};
    sortedGroupNames.forEach(groupName => {
      const group = groups[groupName];
      
      // Sort members within each group by lastname, firstname
      group.leaders.sort((a, b) => {
        const aName = `${a.lastname || ''} ${a.firstname || ''}`.trim();
        const bName = `${b.lastname || ''} ${b.firstname || ''}`.trim();
        return aName.localeCompare(bName);
      });
      
      group.youngPeople.sort((a, b) => {
        const aName = `${a.lastname || ''} ${a.firstname || ''}`.trim();
        const bName = `${b.lastname || ''} ${b.firstname || ''}`.trim();
        return aName.localeCompare(bName);
      });
      
      sortedGroups[groupName] = group;
    });

    const summary = {
      totalGroups: Object.keys(sortedGroups).length,
      totalMembers: processedCount,
      totalLeaders: Object.values(sortedGroups).reduce((sum, group) => sum + group.leaders.length, 0),
      totalYoungPeople: Object.values(sortedGroups).reduce((sum, group) => sum + group.youngPeople.length, 0),
      hasUnassigned: !!sortedGroups['Group Unassigned'],
      vikingEventDataAvailable: true, // Data is pre-processed and attached to members
    };

    logger.info('Successfully organized members by camp groups', {
      totalGroups: summary.totalGroups,
      totalMembers: summary.totalMembers,
      totalLeaders: summary.totalLeaders,
      totalYoungPeople: summary.totalYoungPeople,
      hasUnassigned: summary.hasUnassigned,
      groupNames: Object.keys(sortedGroups),
    }, LOG_CATEGORIES.APP);

    return {
      groups: sortedGroups,
      summary,
    };
  } catch (error) {
    logger.error('Error organizing members by camp groups', {
      error: error.message,
      hasProcessedMembers: !!processedMembers,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'organize_members_by_camp_groups',
      },
      contexts: {
        data: {
          processedMembersCount: processedMembers?.length || 0,
        },
      },
    });

    // Return empty structure on error
    return { groups: {}, summary: { totalGroups: 0, totalMembers: 0 } };
  }
}
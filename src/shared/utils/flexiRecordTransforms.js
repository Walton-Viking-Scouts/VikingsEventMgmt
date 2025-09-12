/**
 * @file FlexiRecord transformation utilities for Viking Event Management
 * 
 * This module provides pure functions for transforming OSM FlexiRecord data into
 * meaningful, structured formats for the Viking Event Management system. Handles
 * field mapping, data transformation, and specialized Viking Event data extraction.
 * 
 * FlexiRecords are OSM's flexible record system that allows custom data fields.
 * For Viking Events, these are used to track camp groups, sign-in/out times, and
 * other event-specific data that supplements the standard member information.
 * 
 * All functions are pure and focused on data transformation without side effects,
 * following functional programming principles for better testability and reliability.
 * 
 * @module flexiRecordTransforms
 * @version 2.3.7
 * @since 2.0.0 - Initial FlexiRecord support
 * @author Vikings Event Management Team
 */

import { sentryUtils } from '../services/utils/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

/**
 * Parses FlexiRecord structure configuration to create field mapping
 * 
 * Converts OSM FlexiRecord structure configuration into a standardized Map
 * that maps generic field IDs (f_1, f_2, etc.) to meaningful field metadata
 * including names, widths, and display properties. This enables transformation
 * of raw FlexiRecord data into human-readable formats.
 * 
 * The structure data comes from OSM's getFlexiStructure API and contains both
 * a config JSON string with field definitions and a structure array with
 * additional metadata for each field.
 * 
 * @param {object} structureData - Structure data from OSM getFlexiStructure API
 * @param {string} [structureData.config] - JSON string containing field mappings
 * @param {Array} [structureData.structure] - Array of structure sections with field details
 * @param {string} [structureData.extraid] - FlexiRecord type identifier
 * @returns {Map<string, object>} Map of field ID to comprehensive field metadata
 * @throws {Error} If structure data is invalid or parsing fails
 * 
 * @example
 * // Parse Viking Event FlexiRecord structure
 * const structureData = {
 *   config: '[{"id":"f_1","name":"CampGroup","width":"100"},{"id":"f_2","name":"SignedInBy","width":"150"}]',
 *   structure: [
 *     {
 *       rows: [
 *         { field: 'f_1', name: 'CampGroup', width: '100px', editable: true },
 *         { field: 'f_2', name: 'SignedInBy', width: '150px', editable: false }
 *       ]
 *     }
 *   ]
 * };
 * 
 * const fieldMapping = parseFlexiStructure(structureData);
 * console.log(fieldMapping.get('f_1')); 
 * // Output: { name: 'CampGroup', width: '100px', fieldId: 'f_1', editable: true }
 * 
 * @example
 * // Handle multiple structure sections
 * const complexStructure = {
 *   config: '[{"id":"f_1","name":"CampGroup"},{"id":"f_3","name":"SignedInWhen"}]',
 *   structure: [
 *     { rows: [{ field: 'f_1', name: 'Camp Group', formatter: 'number' }] },
 *     { rows: [{ field: 'f_3', name: 'Sign In Time', formatter: 'datetime' }] }
 *   ]
 * };
 * 
 * const mapping = parseFlexiStructure(complexStructure);
 * mapping.forEach((fieldInfo, fieldId) => {
 *   console.log(`${fieldId}: ${fieldInfo.name} (${fieldInfo.formatter || 'text'})`);
 * });
 * 
 * @example
 * // Error handling for invalid structure
 * try {
 *   const mapping = parseFlexiStructure(null);
 * } catch (error) {
 *   console.error('Structure parsing failed:', error.message);
 *   // Handle gracefully - perhaps show default columns
 * }
 * 
 * @since 2.0.0
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

    // Debug logging removed to prevent console spam
    // Structure parsed successfully with fieldMapping.size fields

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
 * Transforms FlexiRecord data by mapping generic field names to meaningful column names
 * 
 * Converts raw OSM FlexiRecord data with generic field identifiers (f_1, f_2, etc.)
 * into structured data with meaningful property names (CampGroup, SignedInBy, etc.).
 * This transformation makes the data much easier to work with in components and
 * provides better type safety and developer experience.
 * 
 * The transformation process preserves all original data while adding new properties
 * with meaningful names. Original field references are retained with _original_ prefix
 * for debugging and fallback purposes.
 * 
 * @param {object} flexiData - Raw data from OSM getSingleFlexiRecord API
 * @param {Array} flexiData.items - Array of member records with generic field names
 * @param {string} [flexiData.extraid] - FlexiRecord type identifier
 * @param {object} [flexiData.meta] - Metadata about the FlexiRecord
 * @param {Map<string, object>} fieldMapping - Field mapping from parseFlexiStructure
 * @returns {object} Transformed data with meaningful field names and metadata
 * @throws {Error} If data is invalid or transformation fails
 * 
 * @example
 * // Transform Viking Event FlexiRecord data
 * const flexiData = {
 *   items: [
 *     {
 *       scoutid: '12345',
 *       firstname: 'Alice',
 *       lastname: 'Smith',
 *       f_1: '3',           // Camp Group
 *       f_2: 'Leader Bob',  // Signed In By
 *       f_3: '2024-07-15 09:30:00' // Signed In When
 *     },
 *     {
 *       scoutid: '67890', 
 *       firstname: 'Charlie',
 *       lastname: 'Brown',
 *       f_1: '1',
 *       f_2: 'Leader Alice',
 *       f_3: '2024-07-15 09:45:00'
 *     }
 *   ]
 * };
 * 
 * const transformedData = transformFlexiRecordData(flexiData, fieldMapping);
 * 
 * // Access data with meaningful names
 * transformedData.items.forEach(scout => {
 *   console.log(`${scout.firstname} is in Camp Group ${scout.CampGroup}`);
 *   console.log(`Signed in by ${scout.SignedInBy} at ${scout.SignedInWhen}`);
 *   
 *   // Original data still available for debugging
 *   console.log(`Original f_1 value: ${scout._original_f_1}`);
 * });
 * 
 * @example
 * // Handle missing or invalid data gracefully
 * const incompleteData = {
 *   items: [
 *     { scoutid: '111', firstname: 'Dave', f_1: '2' }, // Missing some fields
 *     { scoutid: '222', firstname: 'Eve' }             // No FlexiRecord data
 *   ]
 * };
 * 
 * const result = transformFlexiRecordData(incompleteData, fieldMapping);
 * // Transformation handles missing fields gracefully
 * console.log(result.items[1].CampGroup); // undefined (not an error)
 * 
 * @example
 * // Access transformation metadata
 * const transformed = transformFlexiRecordData(flexiData, fieldMapping);
 * console.log(`Transformed ${transformed._metadata.totalItems} items`);
 * console.log(`Used ${transformed._metadata.originalFieldCount} field mappings`);
 * console.log(`Transformation completed at ${transformed._metadata.transformedAt}`);
 * 
 * @since 2.0.0
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

    // FlexiRecord data transformed successfully

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
 * Extracts Viking Event Management specific fields from transformed FlexiRecord data
 * 
 * Filters and organizes FlexiRecord data to focus specifically on Viking Event
 * Management fields: CampGroup, SignedInBy, SignedInWhen, SignedOutBy, SignedOutWhen.
 * This creates a clean data structure containing only the core scout information
 * plus Viking Event specific tracking data, perfect for event management interfaces.
 * 
 * The function preserves essential scout identification and demographic data while
 * adding the Viking Event Management tracking fields that support camp group
 * organization, attendance tracking, and sign-in/out workflows.
 * 
 * @param {object} consolidatedData - Consolidated and transformed FlexiRecord data
 * @param {Array} consolidatedData.items - Array of scout records with transformed field names
 * @param {object} [consolidatedData.fieldMapping] - Field mapping for reference
 * @returns {Array<object>} Array of scout data containing core info plus Viking Event fields
 * 
 * @example
 * // Extract Viking Event fields for camp group management
 * const consolidatedData = {
 *   items: [
 *     {
 *       scoutid: '12345',
 *       firstname: 'Alice',
 *       lastname: 'Smith',
 *       dob: '2010-03-15',
 *       age: 14,
 *       patrol: 'Eagles',
 *       patrolid: 'P001',
 *       photo_guid: 'photo123',
 *       CampGroup: '3',
 *       SignedInBy: 'Leader Bob',
 *       SignedInWhen: '2024-07-15 09:30:00',
 *       SignedOutBy: null,
 *       SignedOutWhen: null,
 *       // ... other non-Viking fields excluded
 *     }
 *   ]
 * };
 * 
 * const vikingData = extractVikingEventFields(consolidatedData);
 * 
 * vikingData.forEach(scout => {
 *   console.log(`${scout.firstname} ${scout.lastname} (Age ${scout.age})`);
 *   console.log(`Camp Group: ${scout.CampGroup || 'Unassigned'}`);
 *   console.log(`Status: ${scout.SignedInWhen ? 'Signed In' : 'Not Arrived'}`);
 *   
 *   if (scout.SignedInWhen) {
 *     console.log(`Signed in by ${scout.SignedInBy} at ${scout.SignedInWhen}`);
 *   }
 *   
 *   if (scout.SignedOutWhen) {
 *     console.log(`Signed out by ${scout.SignedOutBy} at ${scout.SignedOutWhen}`);
 *   }
 * });
 * 
 * @example
 * // Generate camp group attendance report
 * const vikingScouts = extractVikingEventFields(transformedData);
 * const campGroups = {};
 * 
 * vikingScouts.forEach(scout => {
 *   const group = scout.CampGroup || 'Unassigned';
 *   if (!campGroups[group]) {
 *     campGroups[group] = { signedIn: [], notArrived: [] };
 *   }
 *   
 *   if (scout.SignedInWhen) {
 *     campGroups[group].signedIn.push(scout);
 *   } else {
 *     campGroups[group].notArrived.push(scout);
 *   }
 * });
 * 
 * Object.entries(campGroups).forEach(([groupName, members]) => {
 *   console.log(`${groupName}: ${members.signedIn.length} present, ${members.notArrived.length} expected`);
 * });
 * 
 * @example
 * // Handle missing or incomplete Viking Event data
 * const partialData = { items: [
 *   { scoutid: '111', firstname: 'Bob' }, // No Viking Event data
 *   { scoutid: '222', firstname: 'Sue', CampGroup: '1' } // Partial data
 * ]};
 * 
 * const extracted = extractVikingEventFields(partialData);
 * // Returns scout objects with available fields, undefined for missing ones
 * console.log(extracted[0].CampGroup); // undefined
 * console.log(extracted[1].CampGroup); // '1'
 * 
 * @since 2.0.0
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
 * Organizes members by their assigned camp groups for Viking Event management
 * 
 * Processes member data from getSummaryStats() to create organized camp groups
 * structure. Automatically filters out leaders (who supervise rather than participate
 * in camp groups) and organizes young people by their assigned camp group numbers.
 * 
 * This function is essential for the camp group management interface, providing
 * structured data that enables group-based attendance tracking, activity organization,
 * and leadership supervision during Viking Events.
 * 
 * The function maintains proper separation between leaders and young people,
 * ensures consistent sorting by name within each group, and provides comprehensive
 * metadata about group organization and Viking Event data availability.
 * 
 * @param {Array<object>} processedMembers - Members with attached vikingEventData from getSummaryStats()
 * @param {string} processedMembers[].scoutid - Unique member identifier
 * @param {string} processedMembers[].name - Member full name
 * @param {string} processedMembers[].firstname - Member first name
 * @param {string} processedMembers[].lastname - Member last name
 * @param {string} processedMembers[].person_type - Member type ('Leaders', 'Young Leaders', 'Young People', etc.)
 * @param {object} [processedMembers[].vikingEventData] - Viking Event specific data from FlexiRecord
 * @param {string} [processedMembers[].vikingEventData.CampGroup] - Assigned camp group number
 * @returns {object} Organized camp groups with metadata
 * @returns {object} returns.groups - Camp groups organized by group name
 * @returns {object} returns.summary - Summary statistics and metadata
 * 
 * @example
 * // Organize members from getSummaryStats into camp groups
 * const processedMembers = [
 *   {
 *     scoutid: '12345',
 *     name: 'Alice Smith',
 *     firstname: 'Alice',
 *     lastname: 'Smith',
 *     person_type: 'Young People',
 *     vikingEventData: { CampGroup: '3' }
 *   },
 *   {
 *     scoutid: '67890',
 *     name: 'Bob Johnson',
 *     firstname: 'Bob',
 *     lastname: 'Johnson',
 *     person_type: 'Leaders',
 *     vikingEventData: { CampGroup: '1' } // Leaders filtered out
 *   },
 *   {
 *     scoutid: '11111',
 *     name: 'Charlie Brown',
 *     firstname: 'Charlie',
 *     lastname: 'Brown',
 *     person_type: 'Young People',
 *     vikingEventData: { CampGroup: '3' }
 *   }
 * ];
 * 
 * const organized = organizeMembersByCampGroups(processedMembers);
 * 
 * // Access organized groups
 * console.log('Camp Groups:', Object.keys(organized.groups));
 * // Output: ['Group 3'] (Group 1 not included - only had leaders)
 * 
 * organized.groups['Group 3'].youngPeople.forEach(member => {
 *   console.log(`${member.firstname} ${member.lastname} - Group ${member.campGroup}`);
 * });
 * // Output: 
 * // Charlie Brown - Group 3
 * // Alice Smith - Group 3 (sorted by lastname)
 * 
 * @example
 * // Access summary statistics
 * const result = organizeMembersByCampGroups(members);
 * 
 * console.log(`Total Groups: ${result.summary.totalGroups}`);
 * console.log(`Total Young People: ${result.summary.totalYoungPeople}`);
 * console.log(`Has Unassigned: ${result.summary.hasUnassigned}`);
 * console.log(`Viking Data Available: ${result.summary.vikingEventDataAvailable}`);
 * 
 * // Check for members without camp group assignments
 * if (result.summary.hasUnassigned) {
 *   const unassigned = result.groups['Group Unassigned'];
 *   console.log(`${unassigned.youngPeople.length} members need group assignment`);
 * }
 * 
 * @example
 * // Generate camp group attendance report
 * const campGroupData = organizeMembersByCampGroups(members);
 * 
 * Object.entries(campGroupData.groups).forEach(([groupName, group]) => {
 *   console.log(`\n${groupName} (${group.totalMembers} members):`);
 *   
 *   group.youngPeople.forEach(member => {
 *     const status = member.vikingEventData?.SignedInWhen ? '✓ Present' : '○ Expected';
 *     console.log(`  ${member.firstname} ${member.lastname} - ${status}`);
 *   });
 * });
 * 
 * @example
 * // Handle missing Viking Event data gracefully
 * const membersWithoutFlexiData = [
 *   { scoutid: '999', name: 'Dave Wilson', person_type: 'Young People' }
 * ];
 * 
 * const result = organizeMembersByCampGroups(membersWithoutFlexiData);
 * // Members without vikingEventData go to 'Group Unassigned'
 * console.log(result.groups['Group Unassigned'].youngPeople.length); // 1
 * 
 * @since 2.1.0
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

    logger.debug('Organizing members by camp groups', {
      totalProcessedMembers: processedMembers.length,
    }, LOG_CATEGORIES.APP);

    const groups = {};
    let processedCount = 0;
    let allHaveVikingEventData = true;

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
          number: Number.isFinite(Number(campGroupNumber)) ? Number(campGroupNumber) : null,
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
      
      // Track viking event data availability
      allHaveVikingEventData &&= !!member.vikingEventData;
      
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
      vikingEventDataAvailable: allHaveVikingEventData, // Derived from actual member data
    };

    logger.debug('Successfully organized members by camp groups', {
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
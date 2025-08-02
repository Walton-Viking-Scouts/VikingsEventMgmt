// Camp Group utility functions for Vikings Event Management Mobile
import { sentryUtils } from '../services/sentry.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import { 
  getFlexiRecords,
} from '../services/api.js';
import { 
  getConsolidatedFlexiRecord,
} from './flexiRecordUtils.js';

/**
 * Find Viking Event Management flexirecord for a section
 * Looks for flexirecord with name="VikingEventMgmt"
 * 
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} token - Authentication token (null for offline)
 * @returns {Promise<Object|null>} VikingEventMgmt flexirecord data or null if not found
 * 
 * @example
 * const vikingEventData = await getCampGroupsForSection('49097', 'term123', token);
 * if (vikingEventData) {
 *   console.log('Found Viking Event Management data:', vikingEventData.items.length);
 * }
 */
export async function getCampGroupsForSection(sectionId, termId, token) {
  try {
    if (!sectionId || !termId) {
      throw new Error('Missing required parameters: sectionId and termId are required');
    }

    logger.info('Getting camp groups for section', {
      sectionId,
      termId,
      hasToken: !!token,
    }, LOG_CATEGORIES.API);

    // Get flexirecords list (without structures) - much more efficient
    const flexiRecordsList = await getFlexiRecords(sectionId, token);

    // Find the Viking Event Mgmt flexirecord ID from the list
    const vikingEventFlexiRecord = flexiRecordsList.items?.find(record => 
      record.name === 'Viking Event Mgmt',
    );

    if (!vikingEventFlexiRecord) {
      logger.warn('No "Viking Event Mgmt" flexirecord found for section', {
        sectionId,
        availableRecords: flexiRecordsList.items?.map(r => r.name || 'Unknown') || [],
      }, LOG_CATEGORIES.APP);
      
      return null;
    }

    logger.info('Found "Viking Event Mgmt" flexirecord in list', {
      sectionId,
      flexiRecordId: vikingEventFlexiRecord.extraid,
      flexiRecordName: vikingEventFlexiRecord.name,
    }, LOG_CATEGORIES.API);

    // Only get the consolidated data (structure + data) for the "Viking Event Mgmt" flexirecord
    const vikingEventRecord = await getConsolidatedFlexiRecord(
      sectionId, 
      vikingEventFlexiRecord.extraid, 
      termId, 
      token,
    );

    logger.info('Found "Viking Event Mgmt" flexirecord', {
      sectionId,
      vikingEventName: vikingEventRecord._structure.name,
      totalMembers: vikingEventRecord.items.length,
      extraid: vikingEventRecord._structure.extraid,
    }, LOG_CATEGORIES.API);

    return vikingEventRecord;
  } catch (error) {
    logger.error('Error getting camp groups for section', {
      sectionId,
      termId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_camp_groups_for_section',
      },
      contexts: {
        request: {
          sectionId,
          termId,
          hasToken: !!token,
        },
      },
    });

    throw error;
  }
}

/**
 * Organize members by their camp groups
 * Groups attendees by their CampGroup field value and classifies by person_type
 * 
 * @param {Array} attendees - Event attendees
 * @param {Array} allMembers - All member data (for person_type and other details)
 * @param {Object} campGroupData - Camp group flexirecord data (can be null)
 * @returns {Object} Organized camp groups with leaders and young people
 * 
 * @example
 * const organized = organizeMembersByCampGroups(attendees, members, campGroups);
 * console.log(organized.groups['Group 1'].leaders); // Leaders in group 1
 * console.log(organized.groups['Group 1'].youngPeople); // Young people in group 1
 */
export function organizeMembersByCampGroups(attendees, allMembers, campGroupData) {
  try {
    if (!attendees || !Array.isArray(attendees)) {
      logger.warn('Invalid attendees data provided', {
        hasAttendees: !!attendees,
        isArray: Array.isArray(attendees),
      }, LOG_CATEGORIES.APP);
      
      return { groups: {}, summary: { totalGroups: 0, totalMembers: 0 } };
    }

    if (!allMembers || !Array.isArray(allMembers)) {
      logger.warn('Invalid members data provided', {
        hasMembers: !!allMembers,
        isArray: Array.isArray(allMembers),
      }, LOG_CATEGORIES.APP);
      
      return { groups: {}, summary: { totalGroups: 0, totalMembers: 0 } };
    }

    logger.info('Organizing members by camp groups', {
      totalAttendees: attendees.length,
      totalMembers: allMembers.length,
      hasCampGroupData: !!campGroupData,
    }, LOG_CATEGORIES.APP);

    // Create a lookup map for member details
    const memberLookup = new Map();
    allMembers.forEach(member => {
      memberLookup.set(member.scoutid, member);
    });

    // Create a lookup map for camp group assignments
    const campGroupLookup = new Map();
    if (campGroupData && campGroupData.items) {
      campGroupData.items.forEach(assignment => {
        if (assignment.scoutid && assignment.CampGroup) {
          campGroupLookup.set(assignment.scoutid, assignment.CampGroup);
        }
      });
    }

    const groups = {};
    let processedCount = 0;

    // Process each attendee
    attendees.forEach(attendee => {
      const memberDetails = memberLookup.get(attendee.scoutid);
      if (!memberDetails) {
        logger.warn('No member details found for attendee', {
          scoutid: attendee.scoutid,
          firstname: attendee.firstname,
          lastname: attendee.lastname,
        }, LOG_CATEGORIES.APP);
        return;
      }

      // Skip Leaders and Young Leaders - flexirecords don't apply to them
      const personType = memberDetails.person_type;
      if (personType === 'Leaders' || personType === 'Young Leaders') {
        logger.debug('Skipping leader from camp groups', {
          scoutid: attendee.scoutid,
          name: `${attendee.firstname} ${attendee.lastname}`,
          personType: personType,
        }, LOG_CATEGORIES.APP);
        return;
      }

      // Get camp group assignment for Young People only
      const campGroupNumber = campGroupLookup.get(attendee.scoutid);
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

      // Create combined member object with attendance and details
      const combinedMember = {
        ...memberDetails,
        ...attendee, // Attendance data (attending status, etc.)
        campGroup: campGroupNumber,
        groupName: groupName,
      };

      // Only add to youngPeople since we've already filtered out leaders
      groups[groupName].youngPeople.push(combinedMember);
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
      campGroupDataAvailable: !!campGroupData,
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
      hasAttendees: !!attendees,
      hasAllMembers: !!allMembers,
      hasCampGroupData: !!campGroupData,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'organize_members_by_camp_groups',
      },
      contexts: {
        data: {
          attendeesCount: attendees?.length || 0,
          allMembersCount: allMembers?.length || 0,
          hasCampGroupData: !!campGroupData,
        },
      },
    });

    // Return empty structure on error
    return { groups: {}, summary: { totalGroups: 0, totalMembers: 0 } };
  }
}

/**
 * Get Viking Event Management data for all sections involved in events
 * Each event contains its own termId, so we use section-term combinations from the events
 * 
 * @param {Array} events - Array of events (each must have sectionid and termid)
 * @param {string} token - Authentication token (null for offline)
 * @returns {Promise<Map>} Map of sectionId to camp group data
 * 
 * @example
 * const campGroupsBySections = await getCampGroupsForEvents(events, token);
 * const section1CampGroups = campGroupsBySections.get('49097');
 */
export async function getCampGroupsForEvents(events, token) {
  try {
    if (!events || !Array.isArray(events)) {
      throw new Error('Invalid events: must be an array');
    }

    // Get unique section-term combinations from events
    const sectionTermCombos = [...new Set(
      events.map(event => `${event.sectionid}-${event.termid}`),
    )].map(combo => {
      const [sectionId, termId] = combo.split('-');
      return { sectionId, termId };
    });

    logger.info('Getting camp groups for section-term combinations', {
      totalEvents: events.length,
      uniqueCombinations: sectionTermCombos.length,
      combinations: sectionTermCombos,
    }, LOG_CATEGORIES.API);

    const campGroupPromises = sectionTermCombos.map(async ({ sectionId, termId }) => {
      try {
        if (!termId || termId === 'undefined') {
          throw new Error(`Event missing termId for section ${sectionId} - this should not happen`);
        }

        const campGroups = await getCampGroupsForSection(sectionId, termId, token);
        return { sectionId, campGroups };
      } catch (error) {
        logger.warn('Failed to load camp groups for section', {
          sectionId,
          termId,
          error: error.message,
        }, LOG_CATEGORIES.APP);
        
        return { sectionId, campGroups: null };
      }
    });

    const results = await Promise.all(campGroupPromises);
    const campGroupsBySections = new Map(
      results.map(({ sectionId, campGroups }) => [sectionId, campGroups]),
    );

    const successCount = results.filter(r => r.campGroups !== null).length;
    const failureCount = results.length - successCount;

    logger.info('Completed loading camp groups for sections', {
      totalCombinations: sectionTermCombos.length,
      successfulSections: successCount,
      failedSections: failureCount,
      sectionsWithCampGroups: Array.from(campGroupsBySections.entries())
        .filter(([_, data]) => data !== null)
        .map(([sectionId, _]) => sectionId),
    }, LOG_CATEGORIES.API);

    return campGroupsBySections;
  } catch (error) {
    logger.error('Error getting camp groups for events', {
      error: error.message,
      hasEvents: !!events,
      eventsCount: events?.length || 0,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    sentryUtils.captureException(error, {
      tags: {
        operation: 'get_camp_groups_for_events',
      },
      contexts: {
        request: {
          eventsCount: events?.length || 0,
          hasToken: !!token,
        },
      },
    });

    throw error;
  }
}
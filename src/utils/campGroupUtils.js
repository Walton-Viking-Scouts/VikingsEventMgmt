// Camp Group utility functions for Vikings Event Management Mobile
// NOTE: This file is deprecated - use flexiRecordService.js instead
import logger, { LOG_CATEGORIES } from '../services/logger.js';
import { 
  getVikingEventData,
  getVikingEventDataForEvents,
} from '../services/flexiRecordService.js';
import { organizeMembersByCampGroups as organizeMembersByCampGroupsTransform } from './flexiRecordTransforms.js';

/**
 * Find Viking Event Management flexirecord for a section
 * @deprecated Use getVikingEventData from flexiRecordService.js instead
 * 
 * @param {string} sectionId - Section ID
 * @param {string} termId - Term ID
 * @param {string} token - Authentication token (null for offline)
 * @returns {Promise<Object|null>} VikingEventMgmt flexirecord data or null if not found
 */
export async function getCampGroupsForSection(sectionId, termId, token) {
  logger.warn('getCampGroupsForSection is deprecated, use getVikingEventData from flexiRecordService.js', {
    sectionId, termId, hasToken: !!token,
  }, LOG_CATEGORIES.APP);
  
  return await getVikingEventData(sectionId, termId, token);
}

/**
 * Organize members by their camp groups
 * @deprecated Use organizeMembersByCampGroups from flexiRecordTransforms.js instead
 * 
 * @param {Array} attendees - Event attendees
 * @param {Array} allMembers - All member data (for person_type and other details)
 * @param {Object} campGroupData - Camp group flexirecord data (can be null)
 * @returns {Object} Organized camp groups with leaders and young people
 */
export function organizeMembersByCampGroups(attendees, allMembers, campGroupData) {
  logger.warn('organizeMembersByCampGroups is deprecated, use the function from flexiRecordTransforms.js', {
    attendeesCount: attendees?.length || 0,
    allMembersCount: allMembers?.length || 0,
    hasCampGroupData: !!campGroupData,
  }, LOG_CATEGORIES.APP);
  
  // Call the function from the transforms module
  return organizeMembersByCampGroupsTransform(attendees, allMembers, campGroupData);
}

/**
 * Get Viking Event Management data for all sections involved in events
 * @deprecated Use getVikingEventDataForEvents from flexiRecordService.js instead
 * 
 * @param {Array} events - Array of events (each must have sectionid and termid)
 * @param {string} token - Authentication token (null for offline)
 * @returns {Promise<Map>} Map of sectionId to Viking Event data
 */
export async function getCampGroupsForEvents(events, token) {
  logger.warn('getCampGroupsForEvents is deprecated, use getVikingEventDataForEvents from flexiRecordService.js', {
    eventsCount: events?.length || 0, hasToken: !!token,
  }, LOG_CATEGORIES.APP);
  
  return await getVikingEventDataForEvents(events, token);
}
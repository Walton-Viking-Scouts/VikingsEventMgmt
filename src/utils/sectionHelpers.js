// Section utility functions for Vikings Event Management Mobile
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 * Find member section type by searching through sections cache
 * 
 * @param {string|number} memberSectionId - Section ID to find
 * @param {Array} sectionsCache - Cached sections data
 * @returns {string|null} Section type or null if not found
 * 
 * @example
 * const sectionType = findMemberSectionType(123, sectionsCache);
 * console.log(sectionType); // 'Beavers' or null
 */
export function findMemberSectionType(memberSectionId, sectionsCache) {
  if (!memberSectionId || !sectionsCache || !Array.isArray(sectionsCache)) {
    return null;
  }

  const memberSectionInfo = sectionsCache.find(
    (s) => 
      String(s.sectionid) === String(memberSectionId) ||
      s.sectionid === memberSectionId,
  );
  
  const sectionType = memberSectionInfo?.section || null;
  
  if (!sectionType) {
    logger.warn('Section type not found for member', {
      memberSectionId,
      availableSections: sectionsCache.map(s => ({
        id: s.sectionid,
        section: s.section,
      })),
    }, LOG_CATEGORIES.APP);
  }
  
  return sectionType;
}

/**
 * Get unique sections from events data with proper deduplication
 * 
 * @param {Array} events - Array of event objects with sectionid and sectionname
 * @returns {Array} Array of unique section objects
 * 
 * @example
 * const uniqueSections = getUniqueSectionsFromEvents(events);
 * console.log(uniqueSections); // [{ sectionid: 123, sectionname: 'Beavers' }]
 */
export function getUniqueSectionsFromEvents(events) {
  if (!events || !Array.isArray(events)) {
    return [];
  }
  
  const sectionMap = new Map();
  events.forEach(event => {
    if (event.sectionid && !sectionMap.has(event.sectionid)) {
      sectionMap.set(event.sectionid, {
        sectionid: event.sectionid,
        sectionname: event.sectionname,
      });
    }
  });
  
  return Array.from(sectionMap.values());
}
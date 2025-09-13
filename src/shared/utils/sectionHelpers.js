/**
 * @file Section utility functions for Viking Event Management
 * 
 * This module provides utility functions for working with Scout sections data,
 * including lookups, filtering, and data organization. Supports the multi-section
 * nature of Scout groups where members belong to age-based sections (Beavers,
 * Cubs, Scouts, Explorers, Network) and events can span multiple sections.
 * 
 * Section management is crucial for Scout operations as it determines age-appropriate
 * activities, badge requirements, leadership structures, and event organization.
 * These utilities help maintain data consistency and provide reliable section
 * information lookup across the application.
 * 
 * @module sectionHelpers
 * @version 2.3.7
 * @since 1.5.0 - Section management utilities
 * @author Vikings Event Management Team
 */

import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

/**
 * Finds member section type by searching through cached sections data
 * 
 * Performs lookup to determine the section type (Beavers, Cubs, Scouts, etc.)
 * for a given member's section ID. This is essential for displaying appropriate
 * content, determining age-appropriate activities, and organizing members by
 * their Scout section for events and reports.
 * 
 * The section type determines many operational aspects including badge requirements,
 * activity suitability, leadership ratios, and program content. This function
 * provides reliable section identification with comprehensive error handling.
 * 
 * @param {string|number} memberSectionId - Section ID to lookup (from member data)
 * @param {Array<object>} sectionsCache - Cached sections data from OSM API
 * @param {string|number} sectionsCache[].sectionid - Unique section identifier
 * @param {string} sectionsCache[].section - Section type (Beavers, Cubs, Scouts, etc.)
 * @param {string} sectionsCache[].sectionname - Full section name (e.g. "1st Walton Beavers")
 * @returns {string|null} Section type string or null if section not found
 * 
 * @example
 * // Typical Scout group sections cache
 * const sectionsCache = [
 *   { sectionid: 12345, section: 'Beavers', sectionname: '1st Walton Beavers' },
 *   { sectionid: 12346, section: 'Cubs', sectionname: '1st Walton Cubs' },
 *   { sectionid: 12347, section: 'Scouts', sectionname: '1st Walton Scouts' },
 *   { sectionid: 12348, section: 'Explorers', sectionname: '1st Walton Explorers' }
 * ];
 * 
 * const memberSection = findMemberSectionType(12345, sectionsCache);
 * console.log(memberSection); // 'Beavers'
 * 
 * @example
 * // Use section type for age-appropriate content
 * const displayMemberInfo = (member, sectionsCache) => {
 *   const sectionType = findMemberSectionType(member.sectionid, sectionsCache);
 *   
 *   const sectionColors = {
 *     'Beavers': 'brown',
 *     'Cubs': 'green', 
 *     'Scouts': 'teal',
 *     'Explorers': 'navy',
 *     'Network': 'red'
 *   };
 *   
 *   const sectionBadges = {
 *     'Beavers': ['Activity Badge', 'Challenge Badge'],
 *     'Cubs': ['Activity Badge', 'Challenge Badge', 'Staged Activity Badge'],
 *     'Scouts': ['Activity Badge', 'Challenge Badge', 'Staged Activity Badge'],
 *     'Explorers': ['Activity Badge', 'SCUBA'],
 *     'Network': ['Network Badge']
 *   };
 *   
 *   return {
 *     member,
 *     sectionType,
 *     brandColor: sectionColors[sectionType] || 'gray',
 *     availableBadges: sectionBadges[sectionType] || []
 *   };
 * };
 * 
 * @example
 * // Handle missing section gracefully
 * const unknownSection = findMemberSectionType(99999, sectionsCache);
 * console.log(unknownSection); // null
 * 
 * // Defensive programming with fallback
 * const getSectionTypeWithFallback = (member, sectionsCache) => {
 *   const sectionType = findMemberSectionType(member.sectionid, sectionsCache);
 *   return sectionType || 'Unknown Section';
 * };
 * 
 * @example
 * // Type coercion handling for different ID formats
 * const numericId = findMemberSectionType(12345, sectionsCache);     // number input
 * const stringId = findMemberSectionType('12345', sectionsCache);    // string input
 * console.log(numericId === stringId); // true (both return same result)
 * 
 * @since 1.5.0
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
 * Finds full section name by searching through cached sections data
 * 
 * Retrieves the complete section name (e.g. "1st Walton Beavers") rather than
 * just the section type. This provides the full organizational context including
 * the group number, location, and section type, which is essential for official
 * communications, reports, and display purposes.
 * 
 * Section names are used for formal documentation, parent communications,
 * external event coordination, and anywhere the full Scout group identity
 * needs to be clearly displayed rather than just the section type.
 * 
 * @param {string|number} memberSectionId - Section ID to lookup (from member data)
 * @param {Array<object>} sectionsCache - Cached sections data from OSM API
 * @param {string|number} sectionsCache[].sectionid - Unique section identifier
 * @param {string} sectionsCache[].section - Section type (Beavers, Cubs, Scouts, etc.)
 * @param {string} sectionsCache[].sectionname - Full section name with group details
 * @returns {string|null} Complete section name or null if section not found
 * 
 * @example
 * // Get full section names for official communications
 * const sectionsCache = [
 *   { sectionid: 12345, section: 'Beavers', sectionname: '1st Walton Beavers' },
 *   { sectionid: 12346, section: 'Cubs', sectionname: '1st Walton Cubs' },
 *   { sectionid: 12347, section: 'Scouts', sectionname: '1st Walton Scouts' }
 * ];
 * 
 * const fullName = findMemberSectionName(12345, sectionsCache);
 * console.log(fullName); // '1st Walton Beavers'
 * 
 * @example
 * // Generate formal event invitations
 * const generateEventInvitation = (event, sectionsCache) => {
 *   const participatingSections = event.sectionIds.map(sectionId => {
 *     return findMemberSectionName(sectionId, sectionsCache);
 *   }).filter(Boolean); // Remove null values
 *   
 *   return {
 *     eventTitle: event.name,
 *     participatingSections,
 *     formalTitle: `${event.name} - ${participatingSections.join(', ')}`,
 *     letterHeading: `Dear Parents and Leaders of ${participatingSections.join(' and ')}`
 *   };
 * };
 * 
 * @example
 * // Member registration forms with full section context
 * const generateMemberCard = (member, sectionsCache) => {
 *   const fullSectionName = findMemberSectionName(member.sectionid, sectionsCache);
 *   const sectionType = findMemberSectionType(member.sectionid, sectionsCache);
 *   
 *   return {
 *     memberName: `${member.firstname} ${member.lastname}`,
 *     shortSection: sectionType,           // "Beavers" for badges/casual use
 *     fullSection: fullSectionName,        // "1st Walton Beavers" for formal use
 *     badgeRequirements: getBadgeRequirements(sectionType),
 *     formalMembership: `${member.firstname} ${member.lastname} - ${fullSectionName}`
 *   };
 * };
 * 
 * @example
 * // Compare section type vs full name usage
 * const member = { sectionid: 12345 };
 * 
 * const sectionType = findMemberSectionType(member.sectionid, sectionsCache);
 * const fullName = findMemberSectionName(member.sectionid, sectionsCache);
 * 
 * console.log(`Type: ${sectionType}`);     // "Beavers" (for program logic)
 * console.log(`Full Name: ${fullName}`);   // "1st Walton Beavers" (for display)
 * 
 * @example
 * // Handle multi-group scenarios
 * const crossGroupEvent = {
 *   participatingSections: [
 *     { sectionid: 12345, sectionname: '1st Walton Beavers' },
 *     { sectionid: 23456, sectionname: '2nd Walton Beavers' },
 *     { sectionid: 34567, sectionname: '1st Surbiton Cubs' }
 *   ]
 * };
 * 
 * // Shows clear group distinctions for parents
 * crossGroupEvent.participatingSections.forEach(section => {
 *   console.log(section.sectionname); // Clear group identification
 * });
 * 
 * @since 1.5.0
 */
export function findMemberSectionName(memberSectionId, sectionsCache) {
  if (!memberSectionId || !sectionsCache || !Array.isArray(sectionsCache)) {
    return null;
  }

  const memberSectionInfo = sectionsCache.find(
    (s) => 
      String(s.sectionid) === String(memberSectionId) ||
      s.sectionid === memberSectionId,
  );
  
  const sectionName = memberSectionInfo?.sectionname || null;
  
  if (!sectionName) {
    logger.warn('Section name not found for member', {
      memberSectionId,
      availableSections: sectionsCache.map(s => ({
        id: s.sectionid,
        sectionname: s.sectionname,
        section: s.section,
      })),
    }, LOG_CATEGORIES.APP);
  }
  
  return sectionName;
}

/**
 * Extracts unique sections from events data with proper deduplication
 * 
 * Analyzes an array of events to identify all unique sections involved,
 * removing duplicates to create a clean list of participating sections.
 * This is essential for multi-section events where the same section might
 * host multiple events, and for generating section-specific reports or
 * navigation filters.
 * 
 * The deduplication ensures that sections appearing in multiple events
 * are only listed once, providing a clean reference list for UI components,
 * filters, and organizational purposes.
 * 
 * @param {Array<object>} events - Array of event objects containing section information
 * @param {string|number} events[].sectionid - Unique section identifier
 * @param {string} events[].sectionname - Full section name
 * @param {string} [events[].eventname] - Event name (not used in extraction)
 * @param {string} [events[].eventdate] - Event date (not used in extraction)
 * @returns {Array<object>} Array of unique section objects with sectionid and sectionname
 * 
 * @example
 * // Extract sections from multi-section event calendar
 * const events = [
 *   { eventid: 'evt1', sectionid: 12345, sectionname: '1st Walton Beavers', eventname: 'Nature Walk' },
 *   { eventid: 'evt2', sectionid: 12346, sectionname: '1st Walton Cubs', eventname: 'Badge Workshop' },
 *   { eventid: 'evt3', sectionid: 12345, sectionname: '1st Walton Beavers', eventname: 'Swimming' }, // Duplicate section
 *   { eventid: 'evt4', sectionid: 12347, sectionname: '1st Walton Scouts', eventname: 'Hike' },
 *   { eventid: 'evt5', sectionid: 12346, sectionname: '1st Walton Cubs', eventname: 'Crafts' } // Another duplicate
 * ];
 * 
 * const uniqueSections = getUniqueSectionsFromEvents(events);
 * console.log(uniqueSections);
 * // Output: [
 * //   { sectionid: 12345, sectionname: '1st Walton Beavers' },
 * //   { sectionid: 12346, sectionname: '1st Walton Cubs' },
 * //   { sectionid: 12347, sectionname: '1st Walton Scouts' }
 * // ]
 * 
 * @example
 * // Generate section filter dropdown for event calendar
 * const createSectionFilter = (events) => {
 *   const sections = getUniqueSectionsFromEvents(events);
 *   
 *   return [
 *     { value: 'all', label: 'All Sections' },
 *     ...sections.map(section => ({
 *       value: section.sectionid,
 *       label: section.sectionname
 *     }))
 *   ];
 * };
 * 
 * @example
 * // Section-based event organization
 * const organizeEventsBySection = (events) => {
 *   const sections = getUniqueSectionsFromEvents(events);
 *   const organized = {};
 *   
 *   sections.forEach(section => {
 *     organized[section.sectionname] = events.filter(
 *       event => event.sectionid === section.sectionid
 *     );
 *   });
 *   
 *   return organized;
 * };
 * 
 * // Usage
 * const eventsBySection = organizeEventsBySection(events);
 * console.log(eventsBySection['1st Walton Beavers']); // All Beaver events
 * 
 * @example
 * // Generate section statistics
 * const generateSectionStats = (events) => {
 *   const sections = getUniqueSectionsFromEvents(events);
 *   
 *   return sections.map(section => {
 *     const sectionEvents = events.filter(event => event.sectionid === section.sectionid);
 *     
 *     return {
 *       ...section,
 *       eventCount: sectionEvents.length,
 *       upcomingEvents: sectionEvents.filter(event => 
 *         new Date(event.eventdate) > new Date()
 *       ).length,
 *       eventTypes: [...new Set(sectionEvents.map(event => event.type))]
 *     };
 *   });
 * };
 * 
 * @example
 * // Handle empty or invalid input gracefully
 * console.log(getUniqueSectionsFromEvents([])); // []
 * console.log(getUniqueSectionsFromEvents(null)); // []
 * console.log(getUniqueSectionsFromEvents([
 *   { eventid: 'evt1' } // Missing section data
 * ])); // []
 * 
 * @since 1.5.0
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
// Members API service
// Extracted from monolithic api.js for better modularity

import { osmRequest } from './base.js';
import { checkNetworkStatus } from '../../../utils/networkUtils.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { getMostRecentTermId } from '../../../utils/termUtils.js';
import { CurrentActiveTermsService } from '../../storage/currentActiveTermsService.js';
import { getTerms } from './terms.js';
import databaseService from '../../storage/database.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';

/**
 * Retrieves comprehensive member data for a section using the enhanced grid API
 * Includes contact information, patrol assignments, and member status
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Array of member objects with normalized data
 * @throws {Error} When API request fails and no cached data available
 * 
 * @example
 * const members = await getMembersGrid(123, '456', token);
 * members.forEach(member => {
 *   console.log(`${member.firstname} ${member.lastname} (${member.person_type})`);
 * });
 */
export async function getMembersGrid(sectionId, termId, token) {
  if (isDemoMode()) {
    const cachedMembers = await databaseService.getMembers([sectionId]);
    logger.debug('Demo mode: Using cached members from database service', {
      sectionId,
      memberCount: cachedMembers.length,
    }, LOG_CATEGORIES.API);
    return cachedMembers;
  }

  return osmRequest('getMembersGrid', '/get-members-grid', {
    token,
    method: 'POST',
    body: { section_id: sectionId, term_id: termId },
    cacheRead: () => databaseService.getMembers([sectionId]),
    transform: (data) => transformMembersGridData(data, sectionId),
    cacheWrite: async (transformedMembers) => {
      if (transformedMembers.length > 0) {
        await databaseService.saveMembers([sectionId], transformedMembers);
      }
    },
    emptyValue: [],
  });
}

/**
 * Transforms raw get-members-grid response rows into the app's member shape,
 * stamping the section's sectiontype so the person_type resolver can apply
 * the authoritative section-type override (e.g. 'adults' => Leaders).
 * @param {Object} data - Raw API response
 * @param {number|string} sectionId - Section the request was made for
 * @returns {Promise<Array<Object>>} Normalized member objects
 */
async function transformMembersGridData(data, sectionId) {
  if (!data || !data.data || !data.data.members) {
    return [];
  }

  const sectionRow = await databaseService.getSections()
    .then(rows => (rows || []).find(s => Number(s.sectionid) === Number(sectionId)))
    .catch((err) => {
      logger.warn('Could not look up sectiontype for getMembersGrid; section-type override disabled for this sync', {
        sectionId,
        error: err?.message,
      }, LOG_CATEGORIES.API);
      return null;
    });
  const sectiontype = sectionRow?.sectiontype || sectionRow?.section || null;

  return (Array.isArray(data?.data?.members) ? data.data.members : [])
    .map(member => {
      const scoutId = Number(member.member_id ?? member.scoutid);
      const sectionIdNum = Number(member.section_id ?? member.sectionid);
      const patrolId = Number(member.patrol_id ?? member.patrolid);
      let person_type = 'Young People';
      if (patrolId === -2) person_type = 'Leaders';
      else if (patrolId === -3) person_type = 'Young Leaders';

      return {
        ...member,
        // Core member info (normalised)
        scoutid: scoutId,
        member_id: scoutId,
        firstname: member.first_name ?? member.firstname,
        lastname: member.last_name ?? member.lastname,
        date_of_birth: member.date_of_birth ?? member.dob,
        age: (() => {
          const ageValue = member.age || member.yrs || '';
          if (!ageValue) return '';
          const match = String(ageValue).match(/^(\d+)/);
          if (match) {
            const numericAge = parseInt(match[1], 10);
            if (numericAge >= 25) return '25+';
          }
          return ageValue;
        })(),
        yrs: member.yrs || member.age || '',
        // Section info
        sectionid: sectionIdNum,
        section: sectiontype,
        patrol: member.patrol,
        patrol_id: patrolId,
        person_type,
        started: member.started,
        joined: member.joined,
        active: member.active,
        end_date: member.end_date,
        // Photo info
        photo_guid: member.photo_guid,
        has_photo: (() => {
          const v = member.has_photo ?? member.pic ?? member.photo_guid;
          return typeof v === 'string'
            ? ['1', 'y', 'true'].includes(v.toLowerCase())
            : Boolean(v);
        })(),
        // Backward-compatible grouped contacts
        contact_groups: member.contact_groups,
      };
    })
    .filter(m => Number.isFinite(m.scoutid) && Number.isFinite(m.sectionid));
}

/**
 * Retrieves members across multiple sections with deduplication
 * Optimized to load terms once and reuse for all sections
 * @param {Array<Object>} sections - Array of section objects with sectionid
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Deduplicated array of members with section assignments
 * @throws {Error} When offline with no cached data or API requests fail
 * 
 * @example
 * const allMembers = await getListOfMembers([
 *   { sectionid: 123, sectionname: 'Beavers' },
 *   { sectionid: 456, sectionname: 'Cubs' }
 * ], token);
 * console.log(`Total unique members: ${allMembers.length}`);
 */
export async function getListOfMembers(sections, token, forceRefresh = false) {
  // Skip API calls in demo mode - use cached data only
  const demoMode = isDemoMode();
  if (demoMode) {
    const validSections = sections.filter(section => section.sectionid);
    const sectionIds = validSections.map(s => s.sectionid);
    const cachedMembers = await databaseService.getMembers(sectionIds);
    logger.debug('Demo mode: Using cached members from database service', {
      sectionCount: validSections.length,
      memberCount: cachedMembers.length,
    }, LOG_CATEGORIES.API);
    return cachedMembers;
  }

  // Check network status first
  const isOnline = await checkNetworkStatus();
  
  // Filter out sections with invalid IDs upfront
  const validSections = sections.filter(section => {
    if (!section.sectionid || section.sectionid === null || section.sectionid === undefined) {
      logger.warn('Filtering out section with invalid ID', {
        section: section,
        sectionKeys: Object.keys(section || {}),
      }, LOG_CATEGORIES.API);
      return false;
    }
    return true;
  });
  
  if (validSections.length === 0) {
    logger.error('No valid sections provided to getListOfMembers', {
      originalCount: sections.length,
      sections: sections,
    }, LOG_CATEGORIES.ERROR);
    return [];
  }
  
  const sectionIds = validSections.map(s => s.sectionid);

  let cachedMembers = [];
  try {
    cachedMembers = await databaseService.getMembers(sectionIds);
    if (!forceRefresh && cachedMembers.length > 0) {
      logger.info(`Using cached members: ${cachedMembers.length} members for sections ${sectionIds.join(', ')}`);
      return cachedMembers;
    }
  } catch (error) {
    logger.warn('Failed to get cached members:', error);
  }

  if (!isOnline) {
    if (cachedMembers.length > 0) {
      logger.info(`Offline mode – serving cached members: ${cachedMembers.length} for sections ${sectionIds.join(', ')}`);
      return cachedMembers;
    }
    logger.error('Offline mode - no cached members available');
    throw new Error('Unable to retrieve members while offline and no cache available');
  }

  // Online mode - fetch from API if cache is empty
  const memberMap = new Map(); // For deduplication by scoutid

  // Load terms once for all sections
  logger.info('Loading terms once for all sections', {}, LOG_CATEGORIES.API);
  const allTerms = await getTerms(token);

  // Fetch all sections concurrently — the rate-limit queue serializes actual
  // network dispatch, so this removes per-section latency stacking without
  // increasing OSM pressure.
  const sectionResults = await Promise.allSettled(validSections.map(async (section) => {
    let termId = null;
    try {
      const currentTerm = await CurrentActiveTermsService.getCurrentActiveTerm(section.sectionid);
      termId = currentTerm?.currentTermId || null;
    } catch (tableError) {
      logger.warn('Table lookup failed, falling back to legacy method', {
        sectionId: section.sectionid,
        error: tableError.message,
      }, LOG_CATEGORIES.API);
    }

    if (!termId) {
      termId = getMostRecentTermId(section.sectionid, allTerms);
    }

    if (!termId) return { section, members: [] };

    const members = await getMembersGrid(section.sectionid, termId, token);
    return { section, members };
  }));

  sectionResults.forEach((result, i) => {
    if (result.status === 'rejected') {
      logger.warn('Failed to fetch members for section', {
        sectionId: validSections[i]?.sectionid,
        error: result.reason,
      }, LOG_CATEGORIES.API);
      return;
    }

    const { section, members: sectionMembers } = result.value;
    sectionMembers.forEach(member => {
      if (member && member.scoutid) {
        const scoutId = member.scoutid;

        if (memberMap.has(scoutId)) {
          const existingMember = memberMap.get(scoutId);
          if (!existingMember.sections) {
            existingMember.sections = [existingMember.sectionname];
          }
          if (!existingMember.sections.includes(section.sectionname)) {
            existingMember.sections.push(section.sectionname);
          }

          if (!existingMember.sectionMemberships) {
            existingMember.sectionMemberships = [{
              sectionid: existingMember.sectionid,
              sectionname: existingMember.sectionname,
              person_type: existingMember.person_type,
              patrol: existingMember.patrol,
              patrol_id: existingMember.patrol_id,
              started: existingMember.started,
              joined: existingMember.joined,
              end_date: existingMember.end_date,
              active: existingMember.active,
              patrol_role_level: existingMember.patrol_role_level,
              patrol_role_level_label: existingMember.patrol_role_level_label,
              section: existingMember.section,
            }];
          }

          existingMember.sectionMemberships.push({
            sectionid: member.sectionid,
            sectionname: section.sectionname,
            person_type: member.person_type,
            patrol: member.patrol,
            patrol_id: member.patrol_id,
            started: member.started,
            joined: member.joined,
            end_date: member.end_date,
            active: member.active,
            patrol_role_level: member.patrol_role_level,
            patrol_role_level_label: member.patrol_role_level_label,
            section: section.section,
          });
        } else {
          memberMap.set(scoutId, {
            ...member,
            sectionname: section.sectionname,
            section: section.section,
            sections: [section.sectionname],
            sectionMemberships: [{
              sectionid: member.sectionid,
              sectionname: section.sectionname,
              person_type: member.person_type,
              patrol: member.patrol,
              patrol_id: member.patrol_id,
              started: member.started,
              joined: member.joined,
              end_date: member.end_date,
              active: member.active,
              patrol_role_level: member.patrol_role_level,
              patrol_role_level_label: member.patrol_role_level_label,
              section: section.section,
            }],
          });
        }
      }
    });
  });

  // Convert map back to array
  const members = Array.from(memberMap.values());
  
  // Cache the members for offline use
  if (members.length > 0) {
    try {
      await databaseService.saveMembers(sectionIds, members);
      logger.info(`Cached ${members.length} members for offline use`);
    } catch (error) {
      logger.warn('Failed to cache members:', error);
      // Don't throw error - this is not critical for the main flow
    }
  }
  
  return members;
}
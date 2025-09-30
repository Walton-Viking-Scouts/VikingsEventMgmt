// Members API service
// Extracted from monolithic api.js for better modularity

import {
  BACKEND_URL,
  validateTokenBeforeAPICall,
  handleAPIResponseWithRateLimit,
} from './base.js';
import { withRateLimitQueue } from '../../../utils/rateLimitQueue.js';
import { checkNetworkStatus } from '../../../utils/networkUtils.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import { authHandler } from '../../auth/authHandler.js';
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
  try {
    // Skip API calls in demo mode - use cached data only
    const demoMode = isDemoMode();
    if (demoMode) {
      const cachedMembers = await databaseService.getMembers([sectionId]);
      logger.debug('Demo mode: Using cached members from database service', {
        sectionId,
        memberCount: cachedMembers.length,
      }, LOG_CATEGORIES.API);
      return cachedMembers;
    }

    // Check network status first
    const isOnline = await checkNetworkStatus();
    
    // If offline, get from local database (fallback to old format)
    if (!isOnline) {
      const cachedMembers = await databaseService.getMembers([sectionId]);
      return cachedMembers;
    }

    // Validate token before making API call
    validateTokenBeforeAPICall(token, 'getMembersGrid');

    // Simple circuit breaker - use cache if auth already failed
    if (!authHandler.shouldMakeAPICall()) {
      logger.info('Auth failed - using cached members only', { sectionId }, LOG_CATEGORIES.API);
      const cachedMembers = await databaseService.getMembers([sectionId]);
      return cachedMembers;
    }

    const data = await withRateLimitQueue(async () => {
      const response = await fetch(`${BACKEND_URL}/get-members-grid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          section_id: sectionId,
          term_id: termId,
        }),
      });
      
      return await handleAPIResponseWithRateLimit(response, 'getMembersGrid');
    });
    
    // Transform the grid data into a more usable format
    if (data && data.data && data.data.members) {
      const transformedMembers = (Array.isArray(data?.data?.members) ? data.data.members : [])
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
            age: typeof member.age === 'string' ? Number(member.age) : member.age,
            // Section info
            sectionid: sectionIdNum,
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
      
      // CRITICAL FIX: Save the transformed members to cache
      try {
        await databaseService.saveMembers([sectionId], transformedMembers);
        logger.info('Members successfully cached', {
          sectionId,
          memberCount: transformedMembers.length,
        }, LOG_CATEGORIES.API);
      } catch (saveError) {
        logger.error('Failed to save members to cache', {
          sectionId,
          error: saveError.message,
          memberCount: transformedMembers.length,
        }, LOG_CATEGORIES.ERROR);
        // Don't throw - return the data even if caching fails
      }
      
      return transformedMembers;
    }

    return [];

  } catch (error) {
    logger.error('Error fetching members grid', { sectionId, error: error.message }, LOG_CATEGORIES.API);
    
    // If online request fails, try local database as fallback
    const isOnline = await checkNetworkStatus();
    if (isOnline) {
      try {
        const cachedMembers = await databaseService.getMembers([sectionId]);
        return cachedMembers;
      } catch (dbError) {
        logger.error('Database fallback failed', { dbError: dbError.message }, LOG_CATEGORIES.API);
      }
    }
    
    throw error;
  }
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
export async function getListOfMembers(sections, token) {
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
  
  // Try cache first (both online and offline)
  try {
    const cachedMembers = await databaseService.getMembers(sectionIds);
    if (cachedMembers.length > 0) {
      logger.info(`Using cached members: ${cachedMembers.length} members for sections ${sectionIds.join(', ')}`);
      return cachedMembers;
    }
  } catch (error) {
    logger.warn('Failed to get cached members:', error);
  }
  
  // If offline and no cache, throw error
  if (!isOnline) {
    logger.error('Offline mode - no cached members available');
    throw new Error('Unable to retrieve members while offline and no cache available');
  }

  // Online mode - fetch from API if cache is empty
  const memberMap = new Map(); // For deduplication by scoutid
  
  // Load terms once for all sections (major optimization!)
  logger.info('Loading terms once for all sections', {}, LOG_CATEGORIES.API);
  const allTerms = await getTerms(token);
  
  for (const section of validSections) {
    try {
      // Use cached terms instead of calling API again
      // Defensive check for section ID
      if (!section.sectionid || section.sectionid === null || section.sectionid === undefined) {
        logger.warn('Skipping section with invalid ID in getListOfMembers', {
          section: section,
          sectionKeys: Object.keys(section),
        }, LOG_CATEGORIES.API);
        continue;
      }
      
      // Try direct table lookup first
      let termId = null;
      try {
        const currentTerm = await CurrentActiveTermsService.getCurrentActiveTerm(section.sectionid);
        termId = currentTerm?.currentTermId || null;
        if (termId) {
          // Term ID found, can be used for future operations
        }
      } catch (tableError) {
        logger.warn('Table lookup failed, falling back to legacy method', {
          sectionId: section.sectionid,
          error: tableError.message,
        }, LOG_CATEGORIES.API);
      }

      // Fallback to legacy method if table lookup failed or returned no result
      if (!termId) {
        termId = getMostRecentTermId(section.sectionid, allTerms);
        if (termId) {
          logger.debug('Using fallback legacy method for term lookup', {
            sectionId: section.sectionid,
            termId,
          }, LOG_CATEGORIES.API);
        }
      }

      if (!termId) continue;
      
      // Use the new getMembersGrid API for comprehensive data
      const members = await getMembersGrid(section.sectionid, termId, token);
      
      members.forEach(member => {
        if (member && member.scoutid) {
          const scoutId = member.scoutid;
          
          if (memberMap.has(scoutId)) {
            // Member already exists, add section to their sections list
            const existingMember = memberMap.get(scoutId);
            if (!existingMember.sections) {
              existingMember.sections = [existingMember.sectionname];
            }
            if (!existingMember.sections.includes(section.sectionname)) {
              existingMember.sections.push(section.sectionname);
            }

            // If this membership is Young Leaders, update the person_type
            if (member.person_type === 'Young Leaders') {
              existingMember.person_type = 'Young Leaders';
              existingMember.sectionname = section.sectionname;
            }
          } else {
            // New member, add to map with section info
            memberMap.set(scoutId, {
              ...member,
              sectionname: section.sectionname,
              section: section.section,
              sections: [section.sectionname], // Track all sections this member belongs to
            });
          }
        }
      });
      
    } catch (sectionError) {
      logger.warn('Failed to fetch members for section', { sectionId: section.sectionid, error: sectionError.message }, LOG_CATEGORIES.API);
      // Continue with other sections
    }
  }
  
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
// Events API service
// Extracted from monolithic api.js for better modularity

import { osmRequest } from './base.js';
import { safeGetItem } from '../../../utils/storageUtils.js';
import { isDemoMode } from '../../../../config/demoMode.js';
import databaseService from '../../storage/database.js';
import IndexedDBService from '../../storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../../utils/logger.js';
import { sentryUtils } from '../../utils/sentry.js';
import { buildSharedSectionsList } from '../../../utils/sharedEventAttendance.js';
import { deriveBestPersonType } from '../../../utils/personTypeDerivation.js';

/**
 * Retrieves events for a specific section and term
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Array of events with attendance data
 * @throws {Error} When API request fails and no cached data available
 * 
 * @example
 * const events = await getEvents(123, '456', userToken);
 * logger.debug(`Found ${events.length} events`);
 */
export async function getEvents(sectionId, termId, token) {
  if (isDemoMode()) {
    const cacheKey = `demo_viking_events_${sectionId}_${termId}_offline`;
    return safeGetItem(cacheKey, []);
  }

  return osmRequest(
    'getEvents',
    `/get-events?sectionid=${encodeURIComponent(sectionId)}&termid=${encodeURIComponent(termId)}`,
    {
      token,
      cacheRead: () => databaseService.getEvents(sectionId),
      transform: (data) => {
        const events = (data && data.items) ? data.items : [];
        return events
          .filter((event) => {
            const eid = event?.eventid;
            return !(typeof eid === 'string' && eid.startsWith('demo_event_'));
          })
          .map((event) => ({
            ...event,
            termid: event.termid ?? termId ?? null,
            sectionid: event.sectionid ?? sectionId ?? null,
          }));
      },
      cacheWrite: (events) => databaseService.saveEvents(sectionId, events),
      emptyValue: [],
    },
  );
}

/**
 * Retrieves attendance data for a specific event
 * @param {number|string} sectionId - OSM section identifier
 * @param {number|string} eventId - OSM event identifier
 * @param {number|string} termId - OSM term identifier
 * @param {string} token - OSM authentication token
 * @returns {Promise<Array<Object>>} Array of attendance records
 * @throws {Error} When API request fails and no cached data available
 * 
 * @example
 * const attendance = await getEventAttendance(123, 789, '456', userToken);
 * logger.debug(`${attendance.length} people attended`);
 */
export async function getEventAttendance(sectionId, eventId, termId, token) {
  if (isDemoMode()) {
    const cacheKey = `demo_viking_attendance_${sectionId}_${termId}_${eventId}_offline`;
    const cached = safeGetItem(cacheKey, []);
    return Array.isArray(cached) ? cached : (cached.items || []);
  }

  return osmRequest(
    'getEventAttendance',
    `/get-event-attendance?sectionid=${encodeURIComponent(sectionId)}&termid=${encodeURIComponent(termId)}&eventid=${encodeURIComponent(eventId)}`,
    {
      token,
      cacheRead: () => databaseService.getAttendance(eventId),
      transform: (data) => ((data && data.items) ? data.items : []),
      cacheWrite: async (attendance) => {
        if (attendance.length > 0) {
          await databaseService.saveAttendance(eventId, attendance);
        }
      },
      emptyValue: [],
    },
  );
}

/**
 * Retrieves combined attendance data from all sections participating in a shared event
 * @param {number|string} eventId - OSM event identifier
 * @param {number|string} sectionId - OSM section identifier (owner section)  
 * @param {string} token - OSM authentication token
 * @returns {Promise<Object>} Combined attendance data from all shared sections
 * @throws {Error} When API request fails
 * 
 * @example
 * const sharedAttendance = await getSharedEventAttendance('12345', '67890', token);
 * logger.debug(`${sharedAttendance.combined_attendance.length} total attendees`);
 */
export async function getSharedEventAttendance(eventId, sectionId, token) {
  if (isDemoMode()) {
    logger.debug('Demo mode: Generating shared attendance data', { eventId, sectionId }, LOG_CATEGORIES.API);
    return generateDemoSharedAttendance(eventId, sectionId);
  }

  return osmRequest(
    'getSharedEventAttendance',
    `/get-shared-event-attendance?eventid=${encodeURIComponent(eventId)}&sectionid=${encodeURIComponent(sectionId)}`,
    {
      token,
      cacheRead: async () => {
        const sharedRecords = await databaseService.getAttendance(eventId);
        const cachedShared = (sharedRecords || []).filter(r => r.isSharedSection === true);
        return cachedShared.length > 0 ? { items: cachedShared } : null;
      },
      cacheWrite: async (data) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        const combined = Array.isArray(data?.combined_attendance) ? data.combined_attendance : [];
        const attendance = items.length > 0 ? items : combined;
        if (attendance.length === 0) return;

        const coreSharedRecords = attendance.map(record => ({
          scoutid: record.scoutid,
          eventid: String(eventId),
          sectionid: Number(record.sectionid ?? sectionId),
          attending: record.attending,
          patrol: record.patrol ?? null,
          notes: record.notes ?? null,
          isSharedSection: true,
        }));
        await databaseService.saveSharedAttendance(eventId, coreSharedRecords);

        const sharedSections = buildSharedSectionsList(attendance, sectionId);
        if (sharedSections.length === 0) {
          logger.warn('Shared attendance returned records but yielded no valid section metadata', {
            eventId,
            sectionId,
            attendanceCount: attendance.length,
            sampleSectionIds: attendance.slice(0, 3).map(r => r?.sectionid),
          }, LOG_CATEGORIES.API);
        }
        await databaseService.saveSharedEventMetadata({
          eventid: String(eventId),
          isSharedEvent: true,
          ownerSectionId: Number(sectionId),
          sections: sharedSections,
        });
      },
      throwWhenUnavailable: true,
    },
  );
}

/**
 * Get cached shared attendance data for demo mode
 */
function generateDemoSharedAttendance(eventId, sectionId) {
  // Simply fetch the cached shared attendance data - use demo prefix
  const sharedCacheKey = `demo_viking_shared_attendance_${eventId}_${sectionId}_offline`;
  const cachedSharedAttendance = safeGetItem(sharedCacheKey);

  if (import.meta.env.DEV) {
    logger.debug('Demo mode: Looking for cached shared attendance', {
      eventId,
      sectionId,
      cacheKey: sharedCacheKey,
      found: !!cachedSharedAttendance,
    }, LOG_CATEGORIES.API);
  }

  if (cachedSharedAttendance) {
    return cachedSharedAttendance;
  }

  // Return empty structure if no cached data found
  return {
    identifier: 'scoutsectionid',
    items: [],
    _cacheTimestamp: Date.now(),
  };
}

export async function createMemberSectionRecordsForSharedAttendees(sectionId, attendance) {
  try {
    logger.debug('createMemberSectionRecordsForSharedAttendees called', {
      ownerSectionId: sectionId,
      attendanceCount: attendance.length,
    }, LOG_CATEGORIES.DATABASE);

    if (attendance.length === 0) {
      logger.debug('No attendance records to process', {}, LOG_CATEGORIES.DATABASE);
      return;
    }

    // Step 1: Group attendees by their ACTUAL sectionid (not the owner section)
    const attendeesBySection = new Map();
    attendance.forEach(attendee => {
      const attendeeSectionId = Number(attendee.sectionid);
      if (!attendeesBySection.has(attendeeSectionId)) {
        attendeesBySection.set(attendeeSectionId, []);
      }
      attendeesBySection.get(attendeeSectionId).push(attendee);
    });

    logger.debug('Grouped attendees by their actual sections', {
      totalSections: attendeesBySection.size,
    }, LOG_CATEGORIES.DATABASE);

    // Step 2: Create core_members for ALL attendees (section-agnostic)
    const uniqueScoutIds = [...new Set(attendance.map(a => Number(a.scoutid)))];
    const existingCoreMembers = await IndexedDBService.bulkGetCoreMembers(uniqueScoutIds);
    const existingCoreMemberIds = new Set(existingCoreMembers.map(m => m.scoutid));


    const attendanceByScoutId = new Map(attendance.map(a => [Number(a.scoutid), a]));

    // Core_member records carry display fields (firstname, lastname, age,
    // dob) used by EventCard, AttendanceGrid, and the View Attendees pages.
    // For external-group attendees, the shared-attendance API is the only
    // source of these — local members syncs only cover the user's own
    // sections — so persist them here.
    const buildCoreFieldsFromAttendee = (a) => ({
      firstname: a?.firstname || '',
      lastname: a?.lastname || '',
      patrol: a?.patrol || '',
      age: a?.age ?? null,
      yrs: a?.yrs ?? null,
      date_of_birth: a?.dob ?? a?.date_of_birth ?? null,
      active: true,
    });

    const missingCoreMembers = uniqueScoutIds
      .filter(scoutid => !existingCoreMemberIds.has(scoutid))
      .map(scoutid => ({
        scoutid,
        ...buildCoreFieldsFromAttendee(attendanceByScoutId.get(scoutid)),
      }));

    // Backfill existing core_members whose age/dob is currently missing —
    // these were created on earlier syncs before age was persisted.
    const existingNeedingBackfill = existingCoreMembers
      .map(m => {
        const a = attendanceByScoutId.get(Number(m.scoutid));
        if (!a) return null;
        const updates = {};
        if (!m.age && a.age) updates.age = a.age;
        if (!m.yrs && a.yrs) updates.yrs = a.yrs;
        if (!m.date_of_birth && (a.dob || a.date_of_birth)) {
          updates.date_of_birth = a.dob ?? a.date_of_birth;
        }
        if (!m.firstname && a.firstname) updates.firstname = a.firstname;
        if (!m.lastname && a.lastname) updates.lastname = a.lastname;
        if (Object.keys(updates).length === 0) return null;
        return { scoutid: m.scoutid, ...updates };
      })
      .filter(Boolean);

    const coreMembersToUpsert = [...missingCoreMembers, ...existingNeedingBackfill];

    if (coreMembersToUpsert.length > 0) {
      await IndexedDBService.bulkUpsertCoreMembers(coreMembersToUpsert);
      logger.debug('Upserted core_member records for shared attendees', {
        new: missingCoreMembers.length,
        backfilled: existingNeedingBackfill.length,
      }, LOG_CATEGORIES.DATABASE);
    } else {
      logger.debug('All shared attendees already exist in core_members with complete data', {}, LOG_CATEGORIES.DATABASE);
    }

    // sectiontype lookup table for person_type derivation. An attendee in an
    // `'adults'` section is authoritatively a Leader, even if per-attendee
    // signals don't agree — losing this lookup downgrades the resolver to
    // patrol_id/age signals only.
    const ownSections = await databaseService.getSections().catch((err) => {
      logger.error('Failed to load sections during shared-attendee person_type derivation', {
        error: err,
        impact: 'Adults-section authoritative override disabled for this sync; falling back to per-attendee patrol_id/age signals.',
      }, LOG_CATEGORIES.DATABASE);
      return [];
    });
    const sectionTypeBySectionId = new Map(
      (ownSections || []).map(s => [Number(s.sectionid), s.sectiontype || null]),
    );

    // Step 4: Process each section group separately
    let totalNewRecords = 0;
    for (const [attendeeSectionId, sectionAttendees] of attendeesBySection.entries()) {
      const sectionName = sectionAttendees[0]?.sectionname || sectionAttendees[0]?.section_name || sectionAttendees[0]?.section || null;
      const sectiontype = sectionTypeBySectionId.get(Number(attendeeSectionId)) || null;
      const scoutIdsForSection = sectionAttendees.map(a => Number(a.scoutid));


      const existingSections = await IndexedDBService.getMemberSectionsByScoutIds(scoutIdsForSection, attendeeSectionId);
      const existingSectionMap = new Map(existingSections.map(s => [s.scoutid, s]));


      // Create records for new scouts + update existing records with null sectionname
      // or with a person_type that fresh signals disagree with.
      const memberSectionsToUpsert = scoutIdsForSection
        .map(scoutid => {
          const existing = existingSectionMap.get(scoutid);
          const attendee = sectionAttendees.find(a => Number(a.scoutid) === scoutid);

          const personType = deriveBestPersonType({ sectiontype, attendee, existing });

          // Skip if record exists AND has both sectionname AND correct person_type
          if (existing && existing.sectionname && existing.person_type === personType) {
            return null;
          }

          return {
            scoutid,
            sectionid: attendeeSectionId,
            sectionname: sectionName,
            person_type: personType,
            active: true,
          };
        })
        .filter(record => record !== null);

      const newRecords = memberSectionsToUpsert.filter(r => !existingSectionMap.has(r.scoutid));
      const updatedRecords = memberSectionsToUpsert.filter(r => existingSectionMap.has(r.scoutid));

      if (memberSectionsToUpsert.length > 0) {
        await IndexedDBService.bulkUpsertMemberSections(memberSectionsToUpsert);
        totalNewRecords += memberSectionsToUpsert.length;
        logger.debug('Upserted member_section records for section', {
          count: memberSectionsToUpsert.length,
          newRecords: newRecords.length,
          updatedRecords: updatedRecords.length,
          sectionId: attendeeSectionId,
          sectionName,
        }, LOG_CATEGORIES.DATABASE);
      }
    }

    logger.debug('Created member_section records for shared attendees', {
      totalNewRecords,
      sectionCount: attendeesBySection.size,
    }, LOG_CATEGORIES.DATABASE);
  } catch (error) {
    logger.error('Failed to create member_section records for shared attendees', {
      ownerSectionId: sectionId,
      error,
      attendanceCount: attendance?.length,
    }, LOG_CATEGORIES.ERROR);
    if (error instanceof Error) {
      sentryUtils.captureException(error, {
        tags: { operation: 'create_member_section_records_for_shared_attendees' },
        contexts: {
          sharedAttendance: {
            ownerSectionId: sectionId,
            attendanceCount: attendance?.length,
          },
        },
      });
    }
  }
}
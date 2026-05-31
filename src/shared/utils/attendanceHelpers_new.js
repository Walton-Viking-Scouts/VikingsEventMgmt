import databaseService from '../services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import { sentryUtils } from '../services/utils/sentry.js';

function formatRejectionReason(reason) {
  if (reason instanceof Error || (reason && typeof reason.message === 'string')) {
    return reason.message;
  }
  if (reason === null || reason === undefined) {
    return `rejected with ${reason}`;
  }
  return String(reason);
}

/**
 * Loads all attendance from the normalized IndexedDB store with read-time enrichment.
 * Raw attendance records contain only core fields (scoutid, eventid, sectionid, attending, patrol, notes).
 *
 * Enrichment fields are joined at read time:
 *   - eventname, eventdate from the events store (keyed by record.eventid)
 *   - sectionname for own-section records from the sections store (keyed by
 *     record.sectionid); for shared records (sections the user has no direct
 *     access to) from shared_event_metadata.sections[] (keyed by eventid+sectionid).
 *     event.sectionname is used as a last-resort fallback.
 *   - groupname for shared records from shared_event_metadata.sections[]. The
 *     local sections cache has no group info, so own-section records get
 *     groupname=null.
 *
 * The shared-metadata join matters for shared events: a record's sectionid can
 * belong to a different section than the event's owner (cross-section invitee
 * via OSM event sharing). Joining sectionname from event.sectionname instead
 * would mis-label those rows under the event-owner's section name and they
 * would collide on the per-section grid.
 *
 * Per-event load failures (e.g. transient DB errors) are tolerated: the failed
 * event's records are skipped and a warn is logged with the failed eventids
 * and sample error messages, but successful events still surface. A top-level
 * failure (e.g. getSections rejecting) returns [] and is logged as an error.
 *
 * @returns {Promise<Array<Object>>} Enriched attendance records
 */
export async function loadAllAttendanceFromDatabase() {
  try {
    const sections = await databaseService.getSections();
    const sectionNameById = new Map(
      (sections || []).map(s => [Number(s.sectionid), s.sectionname]),
    );
    const allEvents = [];

    for (const section of sections) {
      const events = await databaseService.getEvents(section.sectionid);
      allEvents.push(...(events || []));
    }

    const perEventSharedInfo = new Map();
    await Promise.all(allEvents.map(async (event) => {
      const info = await loadSharedSectionInfoForEvent(event.eventid);
      perEventSharedInfo.set(String(event.eventid), info);
    }));

    const globalSectionGroupMap = buildGlobalSectionGroupMap(perEventSharedInfo);
    const ownGroupName = inferOwnGroupName(sectionNameById, globalSectionGroupMap);

    // Observability: if any shared metadata exists but we still couldn't infer
    // the user's own group, log a breadcrumb. Most likely cause is a backend
    // regression dropping `groupname` from the shared-attendance payload — in
    // which case every shared event will silently render under "Unknown group".
    if (!ownGroupName && globalSectionGroupMap.size === 0 && perEventSharedInfo.size > 0) {
      const eventsWithMetadata = Array.from(perEventSharedInfo.entries())
        .filter(([, info]) => info.size > 0)
        .length;
      if (eventsWithMetadata > 0) {
        logger.warn('Shared metadata present but no groupname on any section — rendering will use "Unknown group"', {
          eventsWithMetadata,
          ownSectionCount: sectionNameById.size,
        }, LOG_CATEGORIES.DATA_SERVICE);
      }
    }

    const attendancePromises = allEvents.map(async (event) => {
      const records = await databaseService.getAttendance(event.eventid);
      if (!records || records.length === 0) return [];

      const sharedSectionInfo = perEventSharedInfo.get(String(event.eventid)) ?? new Map();

      return records.map(record => enrichAttendanceRecord(record, {
        event,
        sectionNameById,
        sharedSectionInfo,
        globalSectionGroupMap,
        ownGroupName,
      }));
    });

    const results = await Promise.allSettled(attendancePromises);
    const rejected = results
      .map((r, i) => ({ result: r, event: allEvents[i] }))
      .filter(({ result }) => result.status === 'rejected');

    if (rejected.length > 0) {
      logger.warn('Failed to load attendance for some events', {
        failedCount: rejected.length,
        totalEvents: allEvents.length,
        sampleFailures: rejected.slice(0, 3).map(({ result, event }) => ({
          eventid: event?.eventid,
          eventname: event?.name,
          error: formatRejectionReason(result.reason),
        })),
      }, LOG_CATEGORIES.DATA_SERVICE);
    }

    const allAttendance = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    logger.debug('Loaded attendance from normalized store with enrichment', {
      eventCount: allEvents.length,
      recordCount: allAttendance.length,
      failedEventCount: rejected.length,
    }, LOG_CATEGORIES.DATA_SERVICE);

    return allAttendance;
  } catch (error) {
    logger.error('Failed to load sections/events for attendance enrichment', {
      error: error.message,
      errorName: error.name,
    }, LOG_CATEGORIES.DATA_SERVICE);
    return [];
  }
}

/**
 * Loads attendance for a single event from the normalized store with read-time enrichment
 * @param {string|number} eventid - Event identifier
 * @returns {Promise<Array<Object>>} Enriched attendance records for the event
 */
export async function loadAttendanceForEvent(eventid) {
  let records;
  try {
    records = await databaseService.getAttendance(eventid);
  } catch (error) {
    logger.error('Failed to load attendance for event from normalized store', {
      eventid,
      error: error.message,
      errorName: error.name,
    }, LOG_CATEGORIES.DATA_SERVICE);
    if (error instanceof Error) {
      sentryUtils.captureException(error, {
        tags: { operation: 'load_attendance_for_event' },
        contexts: { event: { eventid: String(eventid) } },
      });
    }
    return [];
  }

  if (!records || records.length === 0) return [];

  try {
    const event = await databaseService.getEventById(eventid);
    const sections = await databaseService.getSections();
    const sectionNameById = new Map(
      (sections || []).map(s => [Number(s.sectionid), s.sectionname]),
    );
    const sharedSectionInfo = await loadSharedSectionInfoForEvent(eventid);
    const globalSectionGroupMap = buildGlobalSectionGroupMap(
      new Map([[String(eventid), sharedSectionInfo]]),
    );
    const ownGroupName = inferOwnGroupName(sectionNameById, globalSectionGroupMap);

    return records.map(record => enrichAttendanceRecord(record, {
      event,
      sectionNameById,
      sharedSectionInfo,
      globalSectionGroupMap,
      ownGroupName,
    }));
  } catch (error) {
    logger.error('Failed to enrich attendance records for event', {
      eventid,
      recordCount: records.length,
      error: error.message,
      errorName: error.name,
    }, LOG_CATEGORIES.DATA_SERVICE);
    if (error instanceof Error) {
      sentryUtils.captureException(error, {
        tags: { operation: 'enrich_attendance_for_event' },
        contexts: { event: { eventid: String(eventid) } },
      });
    }
    return [];
  }
}

/**
 * Loads the per-section info (sectionname, groupname) for sections participating
 * in a shared event. Returns an empty Map when the event isn't shared or the
 * metadata lookup fails.
 *
 * @param {string|number} eventid - Event identifier
 * @returns {Promise<Map<number, {sectionname: string|null, groupname: string|null}>>}
 */
async function loadSharedSectionInfoForEvent(eventid) {
  const map = new Map();
  let metadata;
  try {
    metadata = await databaseService.getSharedEventMetadata(String(eventid));
  } catch (lookupError) {
    logger.error('Shared metadata lookup threw — enrichment skipped for event', {
      eventid,
      error: lookupError?.message,
      errorName: lookupError?.name,
    }, LOG_CATEGORIES.DATA_SERVICE);
    if (lookupError instanceof Error) {
      sentryUtils.captureException(lookupError, {
        tags: { operation: 'load_shared_section_info' },
        contexts: { event: { eventid: String(eventid) } },
      });
    }
    return map;
  }

  const rawSections = Array.isArray(metadata?.sections)
    ? metadata.sections
    : [];
  for (const section of rawSections) {
    const sid = Number(section?.sectionid);
    if (!Number.isFinite(sid)) continue;
    map.set(sid, {
      sectionname: section?.sectionname ?? null,
      groupname: section?.groupname ?? null,
    });
  }
  return map;
}

/**
 * Builds a global section → groupname lookup by unioning all per-event
 * shared metadata. Once we've learned a section's group from any shared event
 * the user has access to, we can apply that group name to records for the
 * same section in events that don't carry shared metadata (the user's own
 * non-shared events).
 *
 * @param {Map<string, Map<number, {sectionname: string|null, groupname: string|null}>>} perEventSharedInfo
 * @returns {Map<number, string>} sectionid → groupname (only sections with a non-null groupname)
 */
function buildGlobalSectionGroupMap(perEventSharedInfo) {
  const map = new Map();
  for (const sharedSectionInfo of perEventSharedInfo.values()) {
    for (const [sid, info] of sharedSectionInfo.entries()) {
      if (info?.groupname && !map.has(sid)) {
        map.set(sid, info.groupname);
      }
    }
  }
  return map;
}

/**
 * Infers the user's own group name by finding any of their own sections that
 * appears in the global section→group map. If their Thursday Beavers section
 * is in a shared event with groupname '1st Walton', we can attribute their
 * Adults section (which may not be in any shared event) to '1st Walton' too.
 *
 * Returns the most-common groupname among the user's own sections, so it
 * still produces a sensible answer for the (rare) case of a leader who
 * volunteers across multiple groups. On a tie, the strict `>` comparison
 * keeps the first non-null groupname encountered in iteration order — i.e.
 * whichever section `getSections()` returned first wins. Deterministic
 * per-load but arbitrary across loads if section ordering changes.
 *
 * @param {Map<number, string>} sectionNameById - User's own sectionids
 * @param {Map<number, string>} globalSectionGroupMap - sectionid → groupname
 * @returns {string|null}
 */
function inferOwnGroupName(sectionNameById, globalSectionGroupMap) {
  const counts = new Map();
  for (const sid of sectionNameById.keys()) {
    const group = globalSectionGroupMap.get(sid);
    if (!group) continue;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [group, count] of counts.entries()) {
    if (count > bestCount) {
      best = group;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Enriches a single attendance record with eventname, eventdate, sectionname
 * and groupname.
 *
 * Resolution order for sectionname:
 *   1. Own-section records (record.sectionid in sectionNameById): use that.
 *   2. Shared records (sectionid not in own sections cache): look up in
 *      sharedSectionInfo. This is the critical case — without it we'd fall
 *      back to event.sectionname and mis-label cross-section invitees under
 *      the event-owner's section.
 *   3. Last-resort fallback to event.sectionname.
 *
 * Resolution order for groupname:
 *   1. This event's shared metadata for the record's sectionid.
 *   2. Global shared-metadata lookup (the same section may have been seen
 *      with a groupname on a different event).
 *   3. If the record is for one of the user's own sections, fall back to the
 *      inferred user's group name — otherwise the section would render under
 *      "Unknown group" in the EventCard grouped layout despite being a
 *      section the user clearly belongs to.
 *
 * @param {Object} record - Raw attendance record (sectionid required)
 * @param {Object} context
 * @param {Object} context.event - Event the record belongs to (for fallbacks)
 * @param {Map<number, string>} context.sectionNameById - Own-section name lookup
 * @param {Map<number, {sectionname: string|null, groupname: string|null}>} context.sharedSectionInfo
 *   Per-section shared metadata for this event.
 * @param {Map<number, string>} context.globalSectionGroupMap - Cross-event
 *   sectionid → groupname union from all of the user's events' shared metadata.
 * @param {string|null} context.ownGroupName - User's own group name inferred
 *   from any of their sections that does appear in shared metadata.
 * @returns {Object} Enriched record
 */
function enrichAttendanceRecord(record, { event, sectionNameById, sharedSectionInfo, globalSectionGroupMap, ownGroupName }) {
  const sid = Number(record.sectionid);
  const ownName = sectionNameById.get(sid) ?? null;
  const sharedInfo = sharedSectionInfo.get(sid) ?? null;
  const isOwnSection = ownName !== null;

  return {
    ...record,
    eventname: event?.name ?? null,
    eventdate: event?.startdate ?? null,
    sectionname:
      ownName ??
      sharedInfo?.sectionname ??
      event?.sectionname ??
      null,
    groupname:
      sharedInfo?.groupname ??
      globalSectionGroupMap?.get(sid) ??
      (isOwnSection ? (ownGroupName ?? null) : null),
  };
}

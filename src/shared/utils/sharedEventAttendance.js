/**
 * Dedup attendance records across a group of events that represent the same logical
 * occasion (e.g. one shared OSM event surfaced as a separate per-section event row).
 *
 * Applied per record:
 *   1. If the record's sectionid matches its event's owner sectionid, keep it
 *      (own-section record — the canonical copy for that scout).
 *   2. Otherwise, if the record's sectionid is the owner of any other event in the
 *      group, drop it — we'll get the canonical copy from that event instead
 *      (cross-section duplicate).
 *   3. Otherwise (no event in the group covers the scout's section, i.e. the user
 *      lacks direct access to that section), keep the record as a fallback so the
 *      scout still appears.
 *
 * Note: the rule is purely sectionid-based. The function does NOT inspect
 * isSharedSection — it works whether the duplicate copy on the wrong event was
 * synced as shared or as regular attendance.
 *
 * Without this dedup, a scout invited to a shared event appears once via their own
 * section's event AND again via the shared records on the other section's event,
 * which inflates per-section counts and double-counts the same person.
 *
 * @param {Array<{eventid: string|number, sectionid: string|number}>} events
 *   Events in the group (e.g. produced by groupEventsByName). Required fields:
 *   eventid, sectionid (the event-owner section).
 * @param {Array<{eventid: string|number, sectionid: string|number}>} records
 *   Attendance records for those events. Required fields: eventid (must match an
 *   event in the group), sectionid (the scout's actual section).
 * @returns {Array<Object>} Filtered records, one per scout per group.
 */
export function dedupAttendanceForEventGroup(events, records) {
  if (!Array.isArray(events) || events.length === 0 || !Array.isArray(records)) {
    return records ?? [];
  }

  const ownerSectionByEventId = new Map(
    events.map((e) => [String(e.eventid), Number(e.sectionid)]),
  );
  const accessibleSectionIds = new Set(events.map((e) => Number(e.sectionid)));

  return records.filter((record) => {
    const ownerSid = ownerSectionByEventId.get(String(record.eventid));
    const personSid = Number(record.sectionid);

    if (personSid === ownerSid) return true;
    if (accessibleSectionIds.has(personSid)) return false;
    return true;
  });
}

/**
 * Apply dedupAttendanceForEventGroup to a per-event attendance map and return a new
 * map keyed by eventid. Used by the dashboard EventCard wiring (EventDashboard,
 * EventsOverview) to dedup before handing attendanceData to the card.
 *
 * @param {Array<{eventid: string|number, sectionid: string|number}>} events
 *   Events in one name-group.
 * @param {Map<string|number, Array<Object>>} attendanceByEventId
 *   Map from eventid to the raw attendance records for that event.
 * @returns {Map<string, Array<Object>>} Map from String(eventid) to the deduped
 *   subset of records that should be rendered on that event's card.
 */
export function dedupAttendanceMapForEventGroup(events, attendanceByEventId) {
  const allGroupRecords = (events ?? []).flatMap(
    (event) => attendanceByEventId?.get(event.eventid) ?? [],
  );
  const deduped = dedupAttendanceForEventGroup(events ?? [], allGroupRecords);

  const dedupedByEventId = new Map();
  for (const record of deduped) {
    const key = String(record.eventid);
    const list = dedupedByEventId.get(key) ?? [];
    list.push(record);
    dedupedByEventId.set(key, list);
  }
  return dedupedByEventId;
}

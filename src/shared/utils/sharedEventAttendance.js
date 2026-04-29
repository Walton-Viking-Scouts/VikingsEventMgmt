/**
 * Dedup attendance records across a group of events that represent the same logical
 * occasion (e.g. one shared OSM event surfaced as a separate per-section event row).
 *
 * Rule: for each scout, prefer the record from the event whose owner section matches
 * the scout's own section. If the user has no event in the group for the scout's
 * section (i.e. the user lacks access to that section), keep any shared-event record
 * we can find as a fallback so the scout still appears.
 *
 * Without this dedup, a scout invited to a shared event appears once via their own
 * section's event AND again via the shared records on the other section's event,
 * which inflates per-section counts and double-counts the same person.
 *
 * @param {Array<Object>} events - Events in the group (e.g. produced by groupEventsByName)
 * @param {Array<Object>} records - Attendance records for those events
 * @returns {Array<Object>} Filtered records, one per scout per group
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

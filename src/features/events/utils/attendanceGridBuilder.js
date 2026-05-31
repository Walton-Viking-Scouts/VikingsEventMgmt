/**
 * @file attendanceGridBuilder — builds the section/group grid rendered by
 *   AttendanceGrid for a card on the events summary screen.
 *
 * Returned shape is one of two variants:
 *
 *   FLAT (single-group events):
 *     {
 *       [sectionName]: { attending, notAttending, invited, notInvited },
 *       ...,
 *       _totals: { attending, notAttending, invited, notInvited },
 *     }
 *
 *   GROUPED (shared events spanning >=2 distinct groups):
 *     {
 *       _grouped: true,
 *       groups: [
 *         {
 *           groupname: '1st Walton on Thames',
 *           sections: [
 *             { sectionname: 'Thursday Beavers', attending, notAttending, invited, notInvited },
 *             ...
 *           ],
 *           subtotal: { attending, notAttending, invited, notInvited },
 *         },
 *         ...
 *       ],
 *       _totals: { attending, notAttending, invited, notInvited },
 *     }
 *
 * AttendanceGrid checks `data._grouped` to decide which renderer to use.
 *
 * Why a separate file: the previous logic lived inside EventCard.jsx as an
 * inlined IIFE. Splitting it out makes the grid math unit-testable and lets
 * the same builder be reused on the OverviewTab inner page.
 */

const EMPTY_COUNTS = () => ({
  attending: 0,
  notAttending: 0,
  invited: 0,
  notInvited: 0,
});

/**
 * @param {string|null|undefined} scoutid
 * @returns {boolean}
 */
function isSynthetic(scoutid) {
  return String(scoutid ?? '').startsWith('synthetic-');
}

/**
 * @param {string|number} scoutid
 * @returns {string|number}
 */
function stripSyntheticPrefix(scoutid) {
  const s = String(scoutid ?? '');
  return s.startsWith('synthetic-') ? s.substring(10) : scoutid;
}

/**
 * @param {{attending: string|null|undefined}} person
 * @returns {keyof ReturnType<typeof EMPTY_COUNTS>}
 */
function bucketFor(person) {
  switch (person.attending) {
  case 'Yes': return 'attending';
  case 'No': return 'notAttending';
  case 'Invited': return 'invited';
  default: return 'notInvited';
  }
}

/**
 * Build the deduplicated grand totals for a set of events. Scouts are
 * deduplicated on `${realScoutId}-${attendingStatus}` so a scout who appears
 * in two events (their own + a shared copy) is only counted once per status.
 *
 * @param {Array<{attendanceData?: Array<Object>}>} events
 * @returns {ReturnType<typeof EMPTY_COUNTS>}
 */
function computeDedupedTotals(events) {
  const seen = new Map();
  for (const event of events) {
    if (!Array.isArray(event.attendanceData)) continue;
    for (const person of event.attendanceData) {
      const key = `${stripSyntheticPrefix(person.scoutid)}-${person.attending}`;
      if (!seen.has(key)) seen.set(key, person.attending);
    }
  }
  const totals = EMPTY_COUNTS();
  for (const status of seen.values()) {
    totals[bucketFor({ attending: status })]++;
  }
  return totals;
}

/**
 * Tally a single person into the per-section bucket.
 * @param {Object} bucket
 * @param {{attending: string|null|undefined}} person
 */
function tally(bucket, person) {
  bucket[bucketFor(person)]++;
}

/**
 * Build the section→counts map keyed by `${groupname}::${sectionname}`. This
 * disambiguates same-named sections across different groups (e.g. two groups
 * both having a "Beavers" section in a shared district event).
 *
 * Returns: Map<compositeKey, { groupname, sectionname, counts }>
 *
 * @param {Array<Object>} events
 * @param {boolean} hasSharedData - When true, accessible-section records take
 *   priority over shared/synthetic ones (we trust the real data).
 * @returns {Map<string, {groupname: string|null, sectionname: string, counts: object}>}
 */
function buildSectionMap(events, hasSharedData) {
  const map = new Map();

  const accessibleSectionNames = new Set();
  for (const event of events) {
    if (event.sectionname) accessibleSectionNames.add(event.sectionname);
  }

  const ensureBucket = (groupname, sectionname) => {
    const key = `${groupname ?? ''}::${sectionname}`;
    if (!map.has(key)) {
      map.set(key, {
        groupname: groupname ?? null,
        sectionname,
        counts: EMPTY_COUNTS(),
      });
    }
    return map.get(key);
  };

  for (const event of events) {
    if (!Array.isArray(event.attendanceData)) continue;

    for (const person of event.attendanceData) {
      const sectionname = person.sectionname || event.sectionname || null;
      if (!sectionname || sectionname === 'null') continue;

      const synthetic = isSynthetic(person.scoutid);

      // For shared events: if we have real (non-synthetic) data for an
      // accessible section, ignore synthetic copies for that same section.
      if (hasSharedData && synthetic && accessibleSectionNames.has(sectionname)) {
        const hasRealForSection = events.some(e =>
          Array.isArray(e.attendanceData) &&
          e.attendanceData.some(p =>
            (p.sectionname || e.sectionname) === sectionname &&
            !isSynthetic(p.scoutid),
          ),
        );
        if (hasRealForSection) continue;
      }

      const groupname = person.groupname ?? null;
      const bucket = ensureBucket(groupname, sectionname);
      tally(bucket.counts, person);
    }
  }

  return map;
}

/**
 * Distinct, non-null group names present in the map (case-sensitive).
 * @param {Map<string, {groupname: string|null}>} sectionMap
 * @returns {string[]}
 */
function distinctGroupNames(sectionMap) {
  const groups = new Set();
  for (const { groupname } of sectionMap.values()) {
    if (groupname) groups.add(groupname);
  }
  return Array.from(groups);
}

/**
 * Convert the section map into the FLAT shape (keyed by section name).
 * Used when the event has only one group (or no group info at all).
 *
 * @param {Map<string, {groupname: string|null, sectionname: string, counts: object}>} sectionMap
 * @param {object} totals
 * @returns {object}
 */
function toFlatShape(sectionMap, totals) {
  const flat = {};
  for (const { sectionname, counts } of sectionMap.values()) {
    if (flat[sectionname]) {
      flat[sectionname].attending += counts.attending;
      flat[sectionname].notAttending += counts.notAttending;
      flat[sectionname].invited += counts.invited;
      flat[sectionname].notInvited += counts.notInvited;
    } else {
      flat[sectionname] = { ...counts };
    }
  }
  flat._totals = totals;
  return flat;
}

/**
 * Convert the section map into the GROUPED shape. Sections without a known
 * group are bucketed under "Unknown group" so they remain visible (and the
 * missing data is flagged to the user).
 *
 * Groups are ordered alphabetically, with "Unknown group" pinned to the end.
 *
 * @param {Map<string, {groupname: string|null, sectionname: string, counts: object}>} sectionMap
 * @param {object} totals
 * @returns {object}
 */
function toGroupedShape(sectionMap, totals) {
  const UNKNOWN_GROUP = 'Unknown group';
  const groupBuckets = new Map();

  for (const entry of sectionMap.values()) {
    const groupLabel = entry.groupname || UNKNOWN_GROUP;
    if (!groupBuckets.has(groupLabel)) {
      groupBuckets.set(groupLabel, {
        groupname: groupLabel,
        sections: [],
        subtotal: EMPTY_COUNTS(),
      });
    }
    const bucket = groupBuckets.get(groupLabel);
    bucket.sections.push({ sectionname: entry.sectionname, ...entry.counts });
    bucket.subtotal.attending += entry.counts.attending;
    bucket.subtotal.notAttending += entry.counts.notAttending;
    bucket.subtotal.invited += entry.counts.invited;
    bucket.subtotal.notInvited += entry.counts.notInvited;
  }

  const groups = Array.from(groupBuckets.values()).sort((a, b) => {
    if (a.groupname === UNKNOWN_GROUP) return 1;
    if (b.groupname === UNKNOWN_GROUP) return -1;
    return a.groupname.localeCompare(b.groupname);
  });

  for (const group of groups) {
    group.sections.sort((a, b) => a.sectionname.localeCompare(b.sectionname));
  }

  return {
    _grouped: true,
    groups,
    _totals: totals,
  };
}

/**
 * Build the attendance grid for an event card.
 *
 * @param {Array<Object>} events - The events backing one EventCard. Each event
 *   should have an `attendanceData` array of enriched records (with sectionname
 *   and ideally groupname for shared events).
 * @returns {object} See module-level docstring for shape.
 */
export function buildAttendanceGridImpl(events) {
  const hasSharedData = events.some(e =>
    Array.isArray(e.attendanceData) &&
    e.attendanceData.some(p => isSynthetic(p.scoutid)),
  );

  const sectionMap = buildSectionMap(events, hasSharedData);
  const totals = computeDedupedTotals(events);
  const groupCount = distinctGroupNames(sectionMap).length;

  if (groupCount >= 2) {
    return toGroupedShape(sectionMap, totals);
  }
  return toFlatShape(sectionMap, totals);
}

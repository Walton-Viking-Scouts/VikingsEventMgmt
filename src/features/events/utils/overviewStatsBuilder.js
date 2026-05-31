/**
 * @file overviewStatsBuilder — builds the per-section attendance breakdown
 *   (YP/YL/L by status) rendered on the View Attendees Overview tab.
 *
 * Returned shape mirrors what OverviewTab consumes:
 *   {
 *     sections: [{ name, groupname, yes, no, invited, notInvited, total }, ...],
 *     totals: { yes, no, invited, notInvited, total } | null,
 *     groups?: [{ groupname, sections: [...], subtotal: {...} }, ...]
 *   }
 *
 * `groups` is only emitted when >= 2 distinct non-null `groupname` values are
 * present — single-group events keep the flat sections list and OverviewTab
 * falls through to its flat renderer.
 *
 * Each role bucket is `{ yp, yl, l, total }` where total = yp + yl + l.
 *
 * Pure function — no React hooks, no DB access. Lives outside EventAttendance
 * so it can be unit-tested against realistic multi-group fixtures.
 */

const UNKNOWN_GROUP = 'Unknown group';

const EMPTY_ROLE_BUCKET = () => ({ yp: 0, yl: 0, l: 0, total: 0 });

const EMPTY_SECTION_STATS = () => ({
  yes: EMPTY_ROLE_BUCKET(),
  no: EMPTY_ROLE_BUCKET(),
  invited: EMPTY_ROLE_BUCKET(),
  notInvited: EMPTY_ROLE_BUCKET(),
  total: EMPTY_ROLE_BUCKET(),
});

/**
 * @param {string|null|undefined} personType
 * @returns {'yp'|'yl'|'l'|null}
 */
function roleTypeFor(personType) {
  if (personType === 'Young People') return 'yp';
  if (personType === 'Young Leaders') return 'yl';
  if (personType === 'Leaders') return 'l';
  return null;
}

/**
 * Mutates `bucket` to add `count` to both the per-role slot and `total`.
 * @param {{yp:number,yl:number,l:number,total:number}} bucket
 * @param {'yp'|'yl'|'l'} roleType
 * @param {number} count
 */
function addToBucket(bucket, roleType, count) {
  bucket[roleType] += count;
  bucket.total += count;
}

/**
 * @param {Array<Object>} events - Each may have sectionid + sectionname.
 * @returns {Map<any, string>}
 */
function buildSectionIdToName(events) {
  const map = new Map();
  for (const event of events) {
    if (event?.sectionid && event?.sectionname) {
      map.set(event.sectionid, event.sectionname);
    }
  }
  return map;
}

/**
 * Sum each section's stats into the running totals object (mutates `totals`).
 * @param {Object} totals
 * @param {Object} section
 */
function accumulateTotals(totals, section) {
  for (const status of ['yes', 'no', 'invited', 'notInvited', 'total']) {
    for (const role of ['yp', 'yl', 'l', 'total']) {
      totals[status][role] += section[status][role];
    }
  }
}

/**
 * Build the optional `groups` array — one entry per Scout group, with member
 * sections nested inside and a group subtotal.
 *
 * Groups are sorted alphabetically with "Unknown group" pinned to the end so
 * a known group always appears before the catch-all bucket. Sections inside a
 * group are sorted by name.
 *
 * @param {Array<Object>} sections - Each has name, groupname, and one role
 *   bucket per attendance status (yes/no/invited/notInvited/total).
 * @returns {Array<Object>}
 */
function buildGroupsArray(sections) {
  const groupMap = new Map();
  for (const section of sections) {
    const label = section.groupname || UNKNOWN_GROUP;
    if (!groupMap.has(label)) {
      groupMap.set(label, {
        groupname: label,
        sections: [],
        subtotal: EMPTY_SECTION_STATS(),
      });
    }
    const group = groupMap.get(label);
    group.sections.push(section);
    accumulateTotals(group.subtotal, section);
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.groupname === UNKNOWN_GROUP) return 1;
    if (b.groupname === UNKNOWN_GROUP) return -1;
    return a.groupname.localeCompare(b.groupname);
  });

  for (const group of groups) {
    group.sections.sort((a, b) => a.name.localeCompare(b.name));
  }

  return groups;
}

/**
 * Build the OverviewTab `attendees` prop from enriched attendees + events.
 *
 * @param {Array<Object>} enrichedAttendees - One entry per (scoutid, sectionid)
 *   with pre-aggregated yes/no/invited/notInvited counts and a `person_type`.
 * @param {Array<Object>} events - Each may have sectionid + sectionname.
 * @returns {Object} { sections, totals, groups? } — see module docstring.
 */
export function buildOverviewStats(enrichedAttendees, events) {
  if (!enrichedAttendees || enrichedAttendees.length === 0) {
    return { sections: [], totals: null };
  }

  const sectionIdToName = buildSectionIdToName(events);
  const sectionMap = new Map();

  for (const member of enrichedAttendees) {
    if (!sectionMap.has(member.sectionid)) {
      const sectionName = sectionIdToName.get(member.sectionid)
        || member.sectionname
        || 'Unknown Section';
      sectionMap.set(member.sectionid, {
        name: sectionName,
        groupname: member.groupname || null,
        ...EMPTY_SECTION_STATS(),
      });
    }
    const section = sectionMap.get(member.sectionid);

    // A member's groupname may arrive on a later record than the one that
    // created the section entry — fill in the first non-null value we see.
    if (!section.groupname && member.groupname) {
      section.groupname = member.groupname;
    }

    const roleType = roleTypeFor(member.person_type);
    if (!roleType) continue;

    addToBucket(section.yes, roleType, member.yes || 0);
    addToBucket(section.no, roleType, member.no || 0);
    addToBucket(section.invited, roleType, member.invited || 0);
    addToBucket(section.notInvited, roleType, member.notInvited || 0);

    const memberTotal = (member.yes || 0) + (member.no || 0)
      + (member.invited || 0) + (member.notInvited || 0);
    addToBucket(section.total, roleType, memberTotal);
  }

  const sections = Array.from(sectionMap.values());

  const totals = EMPTY_SECTION_STATS();
  for (const section of sections) {
    accumulateTotals(totals, section);
  }

  const distinctGroups = new Set(
    sections.map(s => s.groupname).filter(Boolean),
  );
  if (distinctGroups.size < 2) {
    return { sections, totals };
  }

  return { sections, totals, groups: buildGroupsArray(sections) };
}

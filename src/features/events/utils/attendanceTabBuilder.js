/**
 * @file attendanceTabBuilder — builds the section-card list (and optional
 *   per-group grouping) for the View Attendees Attendance tab.
 *
 * The Attendance tab renders one masonry-laid-out card per section, with
 * YP/adult counts in the card header. For shared events spanning multiple
 * Scout groups, the cards are split into one masonry block per group with a
 * group header above each block.
 *
 * Returned shape:
 *   {
 *     sections: [{ sectionid, sectionname, groupname, members, youngPeopleCount, adultsCount }, ...],
 *     totalYoungPeople: number,
 *     totalAdults: number,
 *     totalMembers: number,
 *     distinctGroupCount: number,
 *     sectionsByGroup: Array<[groupname: string, sections: Array]> | null,
 *     useGrouped: boolean,
 *   }
 *
 * `sectionsByGroup` is only present (and `useGrouped` true) when >= 2 distinct
 * non-null `groupname` values are present across the section list.
 *
 * Pure function — no React hooks, no DB access. Lives outside EventAttendance
 * so it can be unit-tested against realistic multi-group fixtures.
 */

const UNKNOWN_GROUP = 'Unknown group';

/**
 * @param {string|null|undefined} age - OSM age format ("11 / 03", "25+", etc.)
 * @returns {boolean} true when age is missing or under 18, false otherwise
 */
export function isYoungPerson(age) {
  if (!age) return true;
  if (age === '25+') return false;

  const slashMatch = String(age).match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    return parseInt(slashMatch[1], 10) < 18;
  }
  const intMatch = String(age).match(/^(\d+)/);
  if (intMatch) {
    return parseInt(intMatch[1], 10) < 18;
  }
  return true;
}

/**
 * @param {string|null|undefined} age
 * @returns {number} Age in months, used for sort comparison. 25+ → 999, missing → 0.
 */
export function getNumericAge(age) {
  if (!age) return 0;
  if (age === '25+') return 999;

  const slashMatch = String(age).match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    return parseInt(slashMatch[1], 10) * 12 + parseInt(slashMatch[2], 10);
  }
  const intMatch = String(age).match(/^(\d+)/);
  return intMatch ? parseInt(intMatch[1], 10) * 12 : 0;
}

/**
 * Build the sectionGroups → group-headered structure for the Attendance tab.
 *
 * @param {Array<Object>} filteredData - Attendance records (already filtered by
 *   tab filters). Each record needs sectionid + scoutid; sectionname/groupname
 *   are optional but used for display.
 * @param {Array<Object>} events - Each may have sectionid + sectionname.
 * @param {Map<string, Object>} coreMembersById - Member detail by scoutid (for
 *   firstname/lastname/age/consents enrichment).
 * @returns {Object} See module-level docstring for shape.
 */
export function buildAttendanceTabSections(filteredData, events, coreMembersById) {
  const sectionIdToName = new Map();
  for (const event of events) {
    if (event?.sectionid && event?.sectionname) {
      sectionIdToName.set(event.sectionid, event.sectionname);
    }
  }

  // Composite key (groupname::sectionid) so two groups' Beavers sections don't
  // collapse into one card.
  const sectionGroups = {};
  let totalYoungPeople = 0;
  let totalAdults = 0;

  for (const record of filteredData) {
    const memberData = coreMembersById.get(String(record.scoutid));
    const sectionName = sectionIdToName.get(record.sectionid)
      || record.sectionname
      || memberData?.sectionname
      || 'Unknown Section';
    const groupName = record.groupname || memberData?.groupname || null;
    const age = memberData?.age || record.age || 'N/A';

    const member = {
      ...memberData,
      ...record,
      sectionname: sectionName,
      groupname: groupName,
      age,
      firstname: record.firstname || memberData?.firstname,
      lastname: record.lastname || memberData?.lastname,
    };

    const isYP = isYoungPerson(age);
    if (isYP) totalYoungPeople++;
    else totalAdults++;

    const sectionKey = `${groupName ?? ''}::${record.sectionid}`;
    if (!sectionGroups[sectionKey]) {
      sectionGroups[sectionKey] = {
        sectionid: member.sectionid,
        sectionname: sectionName,
        groupname: groupName,
        members: [],
        youngPeopleCount: 0,
        adultsCount: 0,
      };
    }
    if (isYP) sectionGroups[sectionKey].youngPeopleCount++;
    else sectionGroups[sectionKey].adultsCount++;

    sectionGroups[sectionKey].members.push(member);
  }

  // Sort each section's members youngest-first for display.
  for (const section of Object.values(sectionGroups)) {
    section.members.sort((a, b) => getNumericAge(a.age) - getNumericAge(b.age));
  }

  const sections = Object.values(sectionGroups);
  const distinctGroupNames = new Set(sections.map(s => s.groupname).filter(Boolean));
  const useGrouped = distinctGroupNames.size >= 2;

  let sectionsByGroup = null;
  if (useGrouped) {
    const byGroup = new Map();
    for (const section of sections) {
      const label = section.groupname || UNKNOWN_GROUP;
      if (!byGroup.has(label)) byGroup.set(label, []);
      byGroup.get(label).push(section);
    }
    sectionsByGroup = Array.from(byGroup.entries()).sort(([a], [b]) => {
      if (a === UNKNOWN_GROUP) return 1;
      if (b === UNKNOWN_GROUP) return -1;
      return a.localeCompare(b);
    });
    for (const [, sectionsInGroup] of sectionsByGroup) {
      sectionsInGroup.sort((a, b) => a.sectionname.localeCompare(b.sectionname));
    }
  }

  return {
    sections,
    totalYoungPeople,
    totalAdults,
    totalMembers: totalYoungPeople + totalAdults,
    distinctGroupCount: distinctGroupNames.size,
    sectionsByGroup,
    useGrouped,
  };
}

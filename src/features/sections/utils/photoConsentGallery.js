/**
 * @file photoConsentGallery — builds the section-grouped member lists for the
 *   Photo Consent gallery page (features/sections/components/PhotoConsentPage.jsx).
 *
 * Filters members down to those whose photographs consent is not an explicit
 * 'Yes' (see isNotPhotoConsentYes in shared/utils/contactGroups.js), optionally
 * excludes adults (person_type === 'Leaders'), then groups the matches into
 * one bucket per section — mirroring the section-card shape rendered by the
 * attendance masonry (sectionid, sectionname, members).
 *
 * Pure function — no React, no DB/API access — so it can be unit tested
 * directly against member fixtures.
 */

import { groupContactInfo, isNotPhotoConsentYes } from '../../../shared/utils/contactGroups.js';
import { resolveSectionName } from '../../../shared/utils/memberUtils.js';

/**
 * @param {Object} member - A member record as returned by getListOfMembers.
 * @returns {boolean} true when the member's merged permissions+consents
 *   photographs field is anything other than an explicit 'Yes'.
 */
function memberLacksPhotoConsent(member) {
  const contactGroups = groupContactInfo(member);
  const consents = {
    ...(contactGroups.permissions || {}),
    ...(contactGroups.consents || {}),
  };
  return isNotPhotoConsentYes(consents);
}

/**
 * Groups members without photo consent into one card per section.
 *
 * @param {Array<Object>} members - Members loaded via getListOfMembers for the
 *   currently selected sections.
 * @param {Object} [options]
 * @param {boolean} [options.hideAdults=false] - Exclude person_type === 'Leaders'.
 * @param {Array<Object>} [options.sections] - Section rows (sectionid, sectionname)
 *   used to resolve display names; member.section only holds the section type
 *   (e.g. 'cubs'), not the section's actual name.
 * @returns {Array<{sectionid: string|number|undefined, sectionname: string, members: Array<Object>}>}
 *   One entry per section that has at least one matching member, sorted
 *   alphabetically by section name; members within each section are sorted
 *   alphabetically by first then last name.
 */
export function groupNoConsentMembersBySection(members, { hideAdults = false, sections = [] } = {}) {
  const sectionsById = new Map();
  const sectionNamesById = new Map(
    (sections || [])
      .filter((s) => s?.sectionid !== null && s?.sectionid !== undefined && s?.sectionname)
      .map((s) => [String(s.sectionid), s.sectionname]),
  );

  for (const member of members || []) {
    if (hideAdults && member.person_type === 'Leaders') continue;
    if (!memberLacksPhotoConsent(member)) continue;

    const sectionName = sectionNamesById.get(String(member.sectionid))
      || member.sectionname
      || resolveSectionName(member);
    const sectionKey = member.sectionid ?? sectionName;

    if (!sectionsById.has(sectionKey)) {
      sectionsById.set(sectionKey, {
        sectionid: member.sectionid,
        sectionname: sectionName,
        members: [],
      });
    }
    sectionsById.get(sectionKey).members.push(member);
  }

  const grouped = Array.from(sectionsById.values());

  for (const section of grouped) {
    section.members.sort((a, b) => {
      const aName = `${a.firstname || ''} ${a.lastname || ''}`.trim();
      const bName = `${b.firstname || ''} ${b.lastname || ''}`.trim();
      return aName.localeCompare(bName);
    });
  }

  grouped.sort((a, b) => a.sectionname.localeCompare(b.sectionname));

  return grouped;
}

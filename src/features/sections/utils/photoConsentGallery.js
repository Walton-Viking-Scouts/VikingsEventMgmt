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
 * @returns {Array<{sectionid: string|number|undefined, sectionname: string, members: Array<Object>}>}
 *   One entry per section that has at least one matching member, sorted
 *   alphabetically by section name; members within each section are sorted
 *   alphabetically by first then last name.
 */
export function groupNoConsentMembersBySection(members, { hideAdults = false } = {}) {
  const sectionsById = new Map();

  for (const member of members || []) {
    if (hideAdults && member.person_type === 'Leaders') continue;
    if (!memberLacksPhotoConsent(member)) continue;

    const sectionName = resolveSectionName(member);
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

  const sections = Array.from(sectionsById.values());

  for (const section of sections) {
    section.members.sort((a, b) => {
      const aName = `${a.firstname || ''} ${a.lastname || ''}`.trim();
      const bName = `${b.firstname || ''} ${b.lastname || ''}`.trim();
      return aName.localeCompare(bName);
    });
  }

  sections.sort((a, b) => a.sectionname.localeCompare(b.sectionname));

  return sections;
}

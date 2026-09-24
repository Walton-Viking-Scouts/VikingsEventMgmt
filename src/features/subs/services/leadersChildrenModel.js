/**
 * Pure derivations for the Leaders' children view: finds Young People whose
 * primary contacts share a name with an adult leader anywhere in the group
 * (a Leader in any section, or anyone in an adults section), and reports
 * which subs scheme each of those young people is in.
 *
 * Nothing here touches storage or the network, so every rule is directly
 * testable.
 *
 * @module leadersChildrenModel
 */

import { groupContactInfo } from '../../../shared/utils/contactGroups.js';
import { isLeadersScheme } from '../components/termLabels.js';

const YOUNG_PEOPLE = 'Young People';
const LEADERS = 'Leaders';
const ADULTS_SECTION_TYPE = 'adults';

const PARENT_CONTACTS = [
  { group: 'primary_contact_1', label: 'Primary contact 1' },
  { group: 'primary_contact_2', label: 'Primary contact 2' },
];

/**
 * Normalises a person's name for matching: lower case, accents and
 * punctuation dropped, whitespace collapsed.
 *
 * @param {string|null|undefined} name - Name to normalise
 * @returns {string} Normalised name, empty when there is nothing to match on
 */
export function normaliseName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Joins a first and last name, skipping blanks.
 *
 * @param {string|null|undefined} firstName - First name
 * @param {string|null|undefined} lastName - Last name
 * @returns {string} Display name
 */
function fullName(firstName, lastName) {
  return [firstName, lastName].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
}

/**
 * The named primary contacts on a member record. Contact fields may sit on
 * the member as flattened `group__field` keys or inside `contact_groups`.
 *
 * @param {Object} member - Cached member record
 * @returns {Array<{contact: string, name: string}>} Primary contacts with a name
 */
export function parentContacts(member) {
  const nested = member?.contact_groups && typeof member.contact_groups === 'object'
    ? member.contact_groups
    : {};
  const groups = groupContactInfo({ ...nested, ...member });
  return PARENT_CONTACTS
    .map(({ group, label }) => ({
      contact: label,
      name: fullName(groups[group]?.first_name, groups[group]?.last_name),
    }))
    .filter((entry) => normaliseName(entry.name) !== '');
}

/**
 * Indexes every adult leader by normalised full name. A member counts as an
 * adult leader in a section when their membership there is 'Leaders' or the
 * section is an adults section; Young Leaders are not adults and are left out.
 *
 * @param {Array<Object>} members - Cached members across all sections
 * @param {Map<string, {sectionName: string, sectionType: string}>} sectionsById - Section lookup
 * @returns {Map<string, Array<{scoutId: string, name: string, sections: Array<{sectionId: string, sectionName: string}>}>>} Normalised name to leaders
 */
export function indexLeaders(members, sectionsById) {
  const byScoutId = new Map();
  for (const member of members ?? []) {
    const scoutId = String(member?.scoutid);
    for (const membership of Array.isArray(member?.sections) ? member.sections : []) {
      const sectionId = String(membership.sectionid);
      const section = sectionsById.get(sectionId);
      const isAdult = membership.person_type === LEADERS || section?.sectionType === ADULTS_SECTION_TYPE;
      if (!isAdult) {
        continue;
      }
      if (!byScoutId.has(scoutId)) {
        byScoutId.set(scoutId, {
          scoutId,
          name: fullName(member.firstname, member.lastname),
          sections: [],
        });
      }
      const leader = byScoutId.get(scoutId);
      if (!leader.sections.some((entry) => entry.sectionId === sectionId)) {
        leader.sections.push({
          sectionId,
          sectionName: section?.sectionName ?? membership.sectionname ?? `Section ${sectionId}`,
        });
      }
    }
  }

  const byName = new Map();
  for (const leader of byScoutId.values()) {
    const key = normaliseName(leader.name);
    if (!key) {
      continue;
    }
    leader.sections.sort((a, b) => a.sectionName.localeCompare(b.sectionName));
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key).push(leader);
  }
  return byName;
}

/**
 * Finds, for every section, the Young People with a primary contact whose
 * name matches an adult leader.
 *
 * @param {Object} input - Cached data to derive from
 * @param {Array<Object>} input.sections - Cached section rows (sectionid, sectionname, sectiontype)
 * @param {Array<Object>} input.members - Cached members across all sections, with per-section memberships
 * @returns {Array<{sectionId: string, sectionName: string, children: Array<Object>}>} One entry per non-adults section, in section order; each child carries scoutId, firstName, lastName and parents: [{contact, name, leaders}]
 */
export function findLeadersChildren({ sections = [], members = [] }) {
  const sectionsById = new Map(
    (sections ?? []).map((section) => [String(section.sectionid), {
      sectionName: section.sectionname ?? `Section ${section.sectionid}`,
      sectionType: String(section.sectiontype ?? section.section ?? '').toLowerCase(),
    }]),
  );
  const leadersByName = indexLeaders(members, sectionsById);

  const childrenBySection = new Map();
  for (const member of members ?? []) {
    const scoutId = String(member?.scoutid);
    const parents = parentContacts(member)
      .map((parent) => ({
        ...parent,
        leaders: (leadersByName.get(normaliseName(parent.name)) ?? [])
          .filter((leader) => leader.scoutId !== scoutId),
      }))
      .filter((parent) => parent.leaders.length > 0);
    if (parents.length === 0) {
      continue;
    }
    for (const membership of Array.isArray(member.sections) ? member.sections : []) {
      const sectionId = String(membership.sectionid);
      if (membership.person_type !== YOUNG_PEOPLE || sectionsById.get(sectionId)?.sectionType === ADULTS_SECTION_TYPE) {
        continue;
      }
      if (!childrenBySection.has(sectionId)) {
        childrenBySection.set(sectionId, new Map());
      }
      childrenBySection.get(sectionId).set(scoutId, {
        scoutId,
        firstName: member.firstname ?? '',
        lastName: member.lastname ?? '',
        parents,
      });
    }
  }

  return (sections ?? [])
    .filter((section) => sectionsById.get(String(section.sectionid))?.sectionType !== ADULTS_SECTION_TYPE)
    .map((section) => {
      const sectionId = String(section.sectionid);
      const children = [...(childrenBySection.get(sectionId)?.values() ?? [])]
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
      return { sectionId, sectionName: sectionsById.get(sectionId).sectionName, children };
    });
}

/**
 * Which subs group a young person is in within a loaded section summary:
 * 'leaders' when any of their schemes is a leaders' scheme, 'other' when they
 * are only in other subs schemes, 'none' when they are in no subs scheme.
 *
 * @param {Object} summary - SectionSubsSummary for the child's section
 * @param {string} scoutId - The young person's scout id
 * @returns {{group: 'leaders'|'other'|'none', schemeNames: string[]}} Subs group and the scheme names
 */
export function subsGroupFor(summary, scoutId) {
  const wanted = String(scoutId);
  const schemes = (summary?.schemes ?? [])
    .filter((scheme) => (scheme.members ?? []).some((member) => String(member.scoutId) === wanted));
  if (schemes.length === 0) {
    return { group: 'none', schemeNames: [] };
  }
  return {
    group: schemes.some(isLeadersScheme) ? 'leaders' : 'other',
    schemeNames: schemes.map((scheme) => scheme.name),
  };
}

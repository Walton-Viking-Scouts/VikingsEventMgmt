/**
 * Pure derivations for the Leaders' children view: finds Young People whose
 * primary contacts share a name or an email address with an adult leader
 * anywhere in the group (a Leader in any section, or anyone in an adults
 * section), and reports which subs scheme each of those young people is in.
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

const EMAIL_FIELDS = ['email_1', 'email_2', 'email'];

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
 * Normalises an email address for matching: trimmed and lower case.
 *
 * @param {string|null|undefined} email - Email to normalise
 * @returns {string} Normalised email, empty when it is not an address
 */
export function normaliseEmail(email) {
  const value = String(email ?? '').trim().toLowerCase();
  return value.includes('@') ? value : '';
}

/**
 * The distinct normalised email addresses in one contact group.
 *
 * @param {Object|undefined} group - Contact group fields
 * @returns {string[]} Email addresses
 */
function groupEmails(group) {
  return [...new Set(EMAIL_FIELDS.map((field) => normaliseEmail(group?.[field])).filter(Boolean))];
}

/**
 * A member's contact groups, from flattened `group__field` keys on the
 * member or inside `contact_groups`.
 *
 * @param {Object} member - Cached member record
 * @returns {Object<string, Object>} Contact groups by name
 */
function contactGroupsOf(member) {
  const nested = member?.contact_groups && typeof member.contact_groups === 'object'
    ? member.contact_groups
    : {};
  return groupContactInfo({ ...nested, ...member });
}

/**
 * A leader's own email addresses: the member's top-level email and any
 * address in their own member contact group. Their primary and emergency
 * contacts are other people and are not used.
 *
 * @param {Object} member - Cached member record
 * @returns {string[]} Email addresses
 */
export function leaderEmails(member) {
  const groups = contactGroupsOf(member);
  const emails = Object.entries(groups)
    .filter(([group]) => group.startsWith('member'))
    .flatMap(([, fields]) => groupEmails(fields));
  return [...new Set([normaliseEmail(member?.email), ...emails].filter(Boolean))];
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
 * The primary contacts on a member record that carry a name or an email.
 * Contact fields may sit on the member as flattened `group__field` keys or
 * inside `contact_groups`.
 *
 * @param {Object} member - Cached member record
 * @returns {Array<{contact: string, name: string, emails: string[]}>} Primary contacts
 */
export function parentContacts(member) {
  const groups = contactGroupsOf(member);
  return PARENT_CONTACTS
    .map(({ group, label }) => ({
      contact: label,
      name: fullName(groups[group]?.first_name, groups[group]?.last_name),
      emails: groupEmails(groups[group]),
    }))
    .filter((entry) => normaliseName(entry.name) !== '' || entry.emails.length > 0);
}

/**
 * Indexes every adult leader by normalised full name and by email. A member
 * counts as an adult leader in a section when their membership there is
 * 'Leaders' or the section is an adults section; Young Leaders are not adults
 * and are left out.
 *
 * @param {Array<Object>} members - Cached members across all sections
 * @param {Map<string, {sectionName: string, sectionType: string}>} sectionsById - Section lookup
 * @returns {{byName: Map<string, Array<Object>>, byEmail: Map<string, Array<Object>>}} Leaders ({scoutId, name, sections}) by normalised name and by email
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
          emails: leaderEmails(member),
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
  const byEmail = new Map();
  const add = (map, key, leader) => {
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(leader);
  };
  for (const { emails, ...leader } of byScoutId.values()) {
    leader.sections.sort((a, b) => a.sectionName.localeCompare(b.sectionName));
    const key = normaliseName(leader.name);
    if (key) {
      add(byName, key, leader);
    }
    emails.forEach((email) => add(byEmail, email, leader));
  }
  return { byName, byEmail };
}

/**
 * The adult leaders matching one parent contact, by name or by any of the
 * contact's email addresses, each tagged with what matched.
 *
 * @param {{name: string, emails: string[]}} parent - A primary contact
 * @param {{byName: Map<string, Array<Object>>, byEmail: Map<string, Array<Object>>}} index - Leader index
 * @param {string} childScoutId - The child's own scout id, never matched
 * @returns {Array<Object>} Leaders with `matchedOn` ('name' and/or 'email')
 */
function matchLeaders(parent, index, childScoutId) {
  const matches = new Map();
  const record = (leader, reason) => {
    if (leader.scoutId === childScoutId) {
      return;
    }
    if (!matches.has(leader.scoutId)) {
      matches.set(leader.scoutId, { ...leader, matchedOn: [] });
    }
    const match = matches.get(leader.scoutId);
    if (!match.matchedOn.includes(reason)) {
      match.matchedOn.push(reason);
    }
  };
  const nameKey = normaliseName(parent.name);
  if (nameKey) {
    (index.byName.get(nameKey) ?? []).forEach((leader) => record(leader, 'name'));
  }
  parent.emails.forEach((email) => {
    (index.byEmail.get(email) ?? []).forEach((leader) => record(leader, 'email'));
  });
  return [...matches.values()];
}

/**
 * Finds, for every section, the Young People with a primary contact whose
 * name or email matches an adult leader.
 *
 * @param {Object} input - Cached data to derive from
 * @param {Array<Object>} input.sections - Cached section rows (sectionid, sectionname, sectiontype)
 * @param {Array<Object>} input.members - Cached members across all sections, with per-section memberships
 * @returns {Array<{sectionId: string, sectionName: string, children: Array<Object>}>} One entry per non-adults section, in section order; each child carries scoutId, firstName, lastName and parents: [{contact, name, emails, leaders}], each leader with `matchedOn`
 */
export function findLeadersChildren({ sections = [], members = [] }) {
  const sectionsById = new Map(
    (sections ?? []).map((section) => [String(section.sectionid), {
      sectionName: section.sectionname ?? `Section ${section.sectionid}`,
      sectionType: String(section.sectiontype ?? section.section ?? '').toLowerCase(),
    }]),
  );
  const leaderIndex = indexLeaders(members, sectionsById);

  const childrenBySection = new Map();
  for (const member of members ?? []) {
    const scoutId = String(member?.scoutid);
    const parents = parentContacts(member)
      .map((parent) => ({ ...parent, leaders: matchLeaders(parent, leaderIndex, scoutId) }))
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

/** Display labels for the subs groups returned by {@link subsGroupFor}. */
export const SUBS_GROUP_LABELS = { leaders: 'Leaders', other: 'Other', none: 'Not set up' };

/**
 * Why a section's subs group cannot be shown, or undefined when it can.
 *
 * @param {{sectionId: string, canView: boolean, permissionsSynced: boolean}} section - Section with its access
 * @param {Object} context - Load state
 * @param {boolean} context.needsFinanceScope - The token lacks the finance scope
 * @param {Object<string, {message: string}>} context.sectionErrors - Local-only errors by section id
 * @returns {string|undefined} Reason text
 */
export function subsUnavailableReason(section, { needsFinanceScope, sectionErrors }) {
  if (needsFinanceScope) {
    return 'Sign in to see';
  }
  if (!section.permissionsSynced) {
    return 'Permissions not synced — refresh the app data';
  }
  if (!section.canView) {
    return 'No finance access';
  }
  return sectionErrors?.[section.sectionId]?.message;
}

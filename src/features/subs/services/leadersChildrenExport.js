/**
 * CSV export for the Leaders' children view: one row per young person,
 * matching parent contact and leader, across every section.
 *
 * @module leadersChildrenExport
 */

import { csvCell } from '../../../shared/utils/memberDataExtractor.js';
import { SUBS_GROUP_LABELS, subsGroupFor, subsUnavailableReason } from './leadersChildrenModel.js';

const HEADERS = [
  'Section',
  'First name',
  'Last name',
  'Parent contact',
  'Parent name',
  'Leader name',
  'Leader sections',
  'Matched on',
  'Subs group',
  'Subs schemes',
];

/**
 * The subs group and scheme names for one child as CSV text: the group label
 * once the section's summary is loaded, otherwise why it is not available.
 *
 * @param {Object} section - Section with its access
 * @param {Object|undefined} summary - Loaded SectionSubsSummary
 * @param {string} scoutId - The child's scout id
 * @param {Object} context - Load state for {@link subsUnavailableReason}
 * @returns {{group: string, schemes: string}} Subs group and schemes text
 */
function subsColumns(section, summary, scoutId, context) {
  const reason = subsUnavailableReason(section, context);
  if (reason) {
    return { group: reason, schemes: '' };
  }
  if (!summary) {
    return { group: 'Not loaded', schemes: '' };
  }
  const { group, schemeNames } = subsGroupFor(summary, scoutId);
  return { group: SUBS_GROUP_LABELS[group], schemes: schemeNames.join('; ') };
}

/**
 * Builds the CSV rows for every matched child in every section.
 *
 * @param {Array<Object>} sections - Sections from useLeadersChildren, with children and access
 * @param {Object<string, Object>} summaries - Loaded SectionSubsSummary by section id
 * @param {Object} context - Load state
 * @param {boolean} context.needsFinanceScope - The token lacks the finance scope
 * @param {Object<string, {message: string}>} context.sectionErrors - Local-only errors by section id
 * @returns {string[]} Header row then one row per child, parent contact and leader
 */
export function buildLeadersChildrenCsvRows(sections, summaries, context) {
  const rows = [HEADERS.map(csvCell).join(',')];
  for (const section of sections ?? []) {
    for (const child of section.children ?? []) {
      const subs = subsColumns(section, summaries?.[section.sectionId], child.scoutId, context);
      for (const parent of child.parents ?? []) {
        for (const leader of parent.leaders ?? []) {
          rows.push([
            section.sectionName,
            child.firstName,
            child.lastName,
            parent.contact,
            parent.name,
            leader.name,
            leader.sections.map((entry) => entry.sectionName).join('; '),
            (leader.matchedOn ?? []).join(' and '),
            subs.group,
            subs.schemes,
          ].map(csvCell).join(','));
        }
      }
    }
  }
  return rows;
}

/**
 * The download filename, dated today.
 *
 * @param {Date} [now=new Date()] - Clock, injectable for tests
 * @returns {string} e.g. "leaders_children_2026-09-24.csv"
 */
export function leadersChildrenCsvFilename(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `leaders_children_${now.getFullYear()}-${month}-${day}.csv`;
}

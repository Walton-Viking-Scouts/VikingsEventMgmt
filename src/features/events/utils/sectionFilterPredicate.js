/**
 * @file sectionFilterPredicate — pure helper used by EventAttendance's three
 *   filtered-by-section views (registeredFilteredAttendees,
 *   campGroupsFilteredAttendees, the attendance-tab IIFE) to decide whether
 *   a given sectionid should be visible under the current filter state.
 *
 * Invariant on the filter map (kept by EventAttendance.jsx): values are
 * strictly `true` (show) or `false` (hide). Missing keys are treated as
 * "show" so that:
 *   - the brief window between attendanceData arriving and the
 *     augmenting effect populating the filter map doesn't hide rows;
 *   - external-group sectionids that the user has never explicitly
 *     toggled default to visible.
 */

/**
 * @param {string|number|null|undefined} sectionid
 * @param {Object<string|number, boolean>|null|undefined} sectionFilters
 * @returns {boolean}
 */
export function isSectionAllowed(sectionid, sectionFilters) {
  if (!sectionFilters) return true;
  return sectionFilters[sectionid] !== false;
}

/**
 * Young-people headcounts per section from the cached member store — the
 * default "expected kids" for a session, since water evenings are regular
 * programme nights rather than OSM events.
 *
 * @module useSectionYPCounts
 */

import { useEffect, useState } from 'react';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

/**
 * Count Young People per section id.
 *
 * @param {Array<string|number>} sectionIds - Sections to count
 * @returns {{counts: Object, loading: boolean}} Map of sectionId (string) to YP count
 */
export function useSectionYPCounts(sectionIds) {
  const [state, setState] = useState({ counts: {}, loading: true });
  const key = (sectionIds ?? []).map(String).sort().join(',');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!key) {
        setState({ counts: {}, loading: false });
        return;
      }
      try {
        const stringIds = key.split(',');
        // member_section stores sectionid as a Number and the IndexedDB index
        // lookup is type-strict, so query with numeric ids (matching how
        // useAttendanceData calls getMembers). String ids silently return
        // nothing on the web backend.
        const members = await databaseService.getMembers(stringIds.map(Number));
        const counts = {};
        for (const id of stringIds) {
          counts[id] = 0;
        }
        // Count from each member's per-section memberships, not the top-level
        // person_type (which reflects only their primary section). A scout is a
        // Young Person in section X iff their section-X membership says so.
        for (const member of members ?? []) {
          const sections = Array.isArray(member.sections) ? member.sections : [];
          for (const membership of sections) {
            const sid = String(membership.sectionid);
            if (sid in counts && membership.person_type === 'Young People') {
              counts[sid] += 1;
            }
          }
        }
        if (!cancelled) {
          setState({ counts, loading: false });
        }
      } catch (error) {
        logger.error('YP count load failed', { error: error.message }, LOG_CATEGORIES.ERROR);
        if (!cancelled) {
          setState({ counts: {}, loading: false });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}

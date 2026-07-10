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
        const ids = key.split(',');
        const members = await databaseService.getMembers(ids);
        const counts = {};
        for (const id of ids) {
          counts[id] = 0;
        }
        for (const member of members ?? []) {
          if (member.person_type !== 'Young People') {
            continue;
          }
          const sid = String(member.sectionid);
          if (sid in counts) {
            counts[sid] += 1;
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

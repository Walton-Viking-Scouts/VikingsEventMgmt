/**
 * Candidate regular permit holders for each participating section: the
 * section's leaders who are also members of the host section (so they have a
 * row in the rota record and can be assigned).
 *
 * scoutid is global, so a section leader's scoutid is the same row we write in
 * the host-section-hosted record.
 *
 * @module useSectionLeaders
 */

import { useEffect, useState } from 'react';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

/**
 * A candidate regular permit holder.
 *
 * @typedef {Object} LeaderCandidate
 * @property {string} scoutid - Global member id (also the host-record row id)
 * @property {string} name - Display name
 */

/**
 * Build the candidate list of leaders per section who can be pre-filled as
 * regulars — i.e. members who are Leaders in the section AND members of the
 * host section.
 *
 * @param {Array<string|number>} sectionIds - Participating section ids
 * @param {string|number|null} hostSectionId - Host section id (rota record lives here)
 * @returns {{candidates: Object<string, LeaderCandidate[]>, loading: boolean}} Map of sectionId → candidates
 */
export function useSectionLeaders(sectionIds, hostSectionId) {
  const [state, setState] = useState({ candidates: {}, loading: true });
  const key = (sectionIds ?? []).map(String).sort().join(',');
  const host = hostSectionId !== null && hostSectionId !== undefined ? String(hostSectionId) : '';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!key || !host) {
        setState({ candidates: {}, loading: false });
        return;
      }
      try {
        const stringIds = key.split(',');
        // Query host + all sections at once so each returned member carries its
        // full per-section memberships (needed to test host membership).
        const ids = [...new Set([host, ...stringIds])].map(Number);
        const members = await databaseService.getMembers(ids);

        const candidates = {};
        for (const id of stringIds) {
          candidates[id] = [];
        }
        for (const member of members ?? []) {
          const sections = Array.isArray(member.sections) ? member.sections : [];
          const inHost = sections.some(
            (m) => String(m.sectionid) === host,
          );
          if (!inHost) {
            continue;
          }
          for (const membership of sections) {
            const sid = String(membership.sectionid);
            if (sid in candidates && membership.person_type === 'Leaders') {
              candidates[sid].push({ scoutid: String(member.scoutid), name: memberName(member) });
            }
          }
        }
        for (const list of Object.values(candidates)) {
          list.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (!cancelled) {
          setState({ candidates, loading: false });
        }
      } catch (error) {
        logger.error('Section leader candidate load failed', {
          error: error.message,
        }, LOG_CATEGORIES.ERROR);
        if (!cancelled) {
          setState({ candidates: {}, loading: false });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [key, host]);

  return state;
}

/**
 * Display name for a member, preferring firstname/lastname.
 *
 * @param {Object} member - Member record
 * @returns {string} "First Last" (best effort)
 */
function memberName(member) {
  const combined = [member.firstname, member.lastname].filter(Boolean).join(' ').trim();
  return combined || member.name || `Member ${member.scoutid}`;
}

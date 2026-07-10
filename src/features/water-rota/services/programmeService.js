/**
 * Programme meetings for the water rota: fetches a section's programme
 * summary and normalizes it into the meeting shape consumed by
 * generateSessionsFromProgramme.
 *
 * OSM's programme summary reliably carries meeting dates; start/end times
 * are not guaranteed (the summary payload may omit them entirely), so both
 * normalize to null and per-section defaults fill the gap downstream.
 *
 * @module programmeService
 */

import { getProgramme } from '../../../shared/services/api/api/index.js';

/**
 * Normalized programme meeting consumed by session generation.
 *
 * @typedef {Object} ProgrammeMeeting
 * @property {string|null} eveningid - OSM programme entry id
 * @property {string|null} title - Meeting title
 * @property {string} date - Meeting date (yyyy-mm-dd)
 * @property {string|null} startTime - HH:mm, or null when OSM omits it
 * @property {string|null} endTime - HH:mm, or null when OSM omits it
 */

/**
 * Fetch and normalize a section's programme meetings for a term.
 *
 * @param {number|string} sectionId - OSM section id
 * @param {number|string} termId - OSM term id
 * @param {string} token - OSM authentication token
 * @returns {Promise<ProgrammeMeeting[]>} Meetings with parseable dates, sorted by date
 */
export async function fetchProgrammeMeetings(sectionId, termId, token) {
  const programme = await getProgramme(sectionId, termId, token);
  return normalizeProgrammeMeetings(programme?.items);
}

/**
 * Normalize raw OSM programme summary items. Items without a parseable
 * meeting date are dropped; times are normalized to HH:mm or null.
 *
 * @param {Array<Object>|null|undefined} items - Raw programme summary items
 * @returns {ProgrammeMeeting[]} Normalized meetings sorted by date
 */
export function normalizeProgrammeMeetings(items) {
  return (items ?? [])
    .map((item) => {
      const date = normalizeDate(item?.meetingdate);
      if (!date) {
        return null;
      }
      return {
        eveningid: item.eveningid !== null && item.eveningid !== undefined ? String(item.eveningid) : null,
        title: typeof item.title === 'string' && item.title.trim() !== '' ? item.title.trim() : null,
        date,
        startTime: normalizeTime(item.starttime),
        endTime: normalizeTime(item.endtime),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Normalize an OSM date value to yyyy-mm-dd. Accepts ISO (yyyy-mm-dd,
 * optionally with a time suffix) and UK (dd/mm/yyyy) forms.
 *
 * @param {*} value - Raw date value
 * @returns {string|null} yyyy-mm-dd, or null when unparseable
 */
function normalizeDate(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const uk = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (uk) {
    return `${uk[3]}-${uk[2]}-${uk[1]}`;
  }
  return null;
}

/**
 * Normalize an OSM time value to HH:mm. Accepts HH:mm and HH:mm:ss.
 *
 * @param {*} value - Raw time value
 * @returns {string|null} HH:mm, or null when absent/unparseable
 */
function normalizeTime(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

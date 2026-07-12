/**
 * Pure date utilities for the Water Rota: session generation from programme
 * meetings (or weekly slot fallback) and week bucketing for display.
 *
 * All functions take and return ISO yyyy-mm-dd date strings and are
 * clock-free — callers supply "today" where relevant.
 *
 * @module rotaDates
 */

import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { guessActivityFromTitle } from '../services/rotaTemplates.js';

/**
 * Session descriptor produced by generation, consumed by setup/board code.
 *
 * @typedef {Object} SessionDescriptor
 * @property {string} date - Session date (yyyy-mm-dd)
 * @property {string} sectionId - OSM section id
 * @property {string} sectionName - Display name of the section
 * @property {string} startTime - HH:mm
 * @property {string} endTime - HH:mm
 * @property {string} activity - Default activity for the session
 * @property {string|null} title - Programme meeting title when derived from the programme
 */

/**
 * Generate session descriptors from a section's programme meetings.
 * One session per meeting date inside the range; duplicate dates collapse to
 * the first meeting. Programme times win; section defaults fill gaps.
 *
 * @param {Array<{date: string, startTime: string|null, endTime: string|null, title: string|null}>} meetings - Normalized programme meetings
 * @param {{sid: string, sname: string, act: string, st: string, en: string}} section - Per-section defaults from RotaConfig
 * @param {{start: string, end: string}} range - Inclusive rota date range
 * @returns {SessionDescriptor[]} Sessions sorted by date
 */
export function generateSessionsFromProgramme(meetings, section, range) {
  const seen = new Set();
  const sessions = [];

  for (const meeting of meetings ?? []) {
    const date = meeting.date;
    if (!isWithinRange(date, range) || seen.has(date)) {
      continue;
    }
    seen.add(date);
    sessions.push({
      date,
      sectionId: section.sid,
      sectionName: section.sname,
      startTime: meeting.startTime || section.st,
      endTime: meeting.endTime || section.en,
      activity: guessActivityFromTitle(meeting.title) ?? section.act,
      title: meeting.title ?? null,
    });
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generate session descriptors from a weekly slot — the fallback when a
 * section's programme is empty. Produces one session on the slot's weekday
 * for every week in the range.
 *
 * @param {{weekday: number, sid: string, sname: string, st: string, en: string, act: string}} slot - Weekly slot (weekday: 1=Monday..7=Sunday)
 * @param {{start: string, end: string}} range - Inclusive rota date range
 * @returns {SessionDescriptor[]} Sessions sorted by date
 */
export function expandWeeklySlot(slot, range) {
  const sessions = [];
  let cursor = firstWeekdayOnOrAfter(range.start, slot.weekday);

  while (isWithinRange(cursor, range)) {
    sessions.push({
      date: cursor,
      sectionId: slot.sid,
      sectionName: slot.sname,
      startTime: slot.st,
      endTime: slot.en,
      activity: slot.act,
      title: null,
    });
    cursor = format(addDays(parseISO(cursor), 7), 'yyyy-MM-dd');
  }

  return sessions;
}

/**
 * Group sessions into calendar weeks (Monday start) for the board list and
 * overview strip.
 *
 * @param {Array<{date: string}>} sessions - Any objects carrying a session date
 * @returns {Array<{weekStart: string, sessions: Array}>} Weeks sorted ascending, sessions within a week sorted by date
 */
export function bucketSessionsByWeek(sessions) {
  const byWeek = new Map();

  for (const session of sessions ?? []) {
    const weekStart = startOfIsoWeek(session.date);
    if (!byWeek.has(weekStart)) {
      byWeek.set(weekStart, []);
    }
    byWeek.get(weekStart).push(session);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weekSessions]) => ({
      weekStart,
      sessions: weekSessions.sort((a, b) => a.date.localeCompare(b.date)),
    }));
}

/**
 * Group already-week-bucketed sessions into per-day sub-buckets, for the
 * board's day-row grid.
 *
 * @param {Array} sessions - Sessions within one week
 * @returns {Array<{date: string, sessions: Array}>} Days ascending by date, sessions keeping their incoming order
 */
export function groupSessionsByDay(sessions) {
  const byDay = new Map();

  for (const session of sessions ?? []) {
    if (!byDay.has(session.date)) {
      byDay.set(session.date, []);
    }
    byDay.get(session.date).push(session);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySessions]) => ({ date, sessions: daySessions }));
}

/**
 * Bucket a member's commitments into display horizons.
 *
 * @param {Array<{date: string}>} sessions - Sessions the member is committed to
 * @param {string} todayISO - Today's date (yyyy-mm-dd), caller-supplied
 * @returns {{thisWeek: Array, nextWeek: Array, later: Array, past: Array}} Horizon buckets, each sorted by date
 */
export function groupByHorizon(sessions, todayISO) {
  const thisWeekStart = startOfIsoWeek(todayISO);
  const nextWeekStart = format(addDays(parseISO(thisWeekStart), 7), 'yyyy-MM-dd');
  const laterStart = format(addDays(parseISO(thisWeekStart), 14), 'yyyy-MM-dd');

  const buckets = { thisWeek: [], nextWeek: [], later: [], past: [] };

  for (const session of sessions ?? []) {
    if (session.date < todayISO) {
      buckets.past.push(session);
    } else if (session.date < nextWeekStart) {
      buckets.thisWeek.push(session);
    } else if (session.date < laterStart) {
      buckets.nextWeek.push(session);
    } else {
      buckets.later.push(session);
    }
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => a.date.localeCompare(b.date));
  }

  return buckets;
}

/**
 * Monday of the calendar week containing a date.
 *
 * @param {string} dateISO - Date (yyyy-mm-dd)
 * @returns {string} Week-start Monday (yyyy-mm-dd)
 */
export function startOfIsoWeek(dateISO) {
  return format(startOfWeek(parseISO(dateISO), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * First occurrence of a weekday on or after a date.
 *
 * @param {string} dateISO - Starting date (yyyy-mm-dd)
 * @param {number} weekday - 1=Monday..7=Sunday
 * @returns {string} Date of the first matching weekday (yyyy-mm-dd)
 */
function firstWeekdayOnOrAfter(dateISO, weekday) {
  const start = parseISO(dateISO);
  const startWeekday = ((start.getDay() + 6) % 7) + 1;
  const offset = (weekday - startWeekday + 7) % 7;
  return format(addDays(start, offset), 'yyyy-MM-dd');
}

/**
 * Inclusive range check on ISO date strings.
 *
 * @param {string} dateISO - Date to test (yyyy-mm-dd)
 * @param {{start: string, end: string}} range - Inclusive range
 * @returns {boolean} True when the date falls inside the range
 */
function isWithinRange(dateISO, range) {
  return typeof dateISO === 'string' && dateISO >= range.start && dateISO <= range.end;
}

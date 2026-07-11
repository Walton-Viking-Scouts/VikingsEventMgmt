/**
 * Pure display logic for the Water Rota board: resolves decoded sessions
 * into render-ready view models (with config-default self-healing) and
 * computes cover status.
 *
 * @module rotaDisplay
 */

import { SIGNUP_STATUS, buildSessionColumnName } from '../services/rotaEncoding.js';

/**
 * Cover status values, from healthy to missing data.
 * covered: confirmed >= needed. atRisk: confirmed short but backups close
 * the gap. short: not enough even with backups. off: not on water this
 * week. unset: nobody has set a permit-holder target yet.
 *
 * @type {{COVERED: string, AT_RISK: string, SHORT: string, OFF: string, UNSET: string}}
 */
export const COVER_STATUS = {
  COVERED: 'covered',
  AT_RISK: 'atRisk',
  SHORT: 'short',
  OFF: 'off',
  UNSET: 'unset',
};

/**
 * Compute the cover status for a session.
 *
 * @param {{confirmedCount: number, backupCount: number, needed: number|null, cancelled: boolean}} session - Resolved session counts
 * @returns {string} One of COVER_STATUS
 */
export function coverStatus({ confirmedCount, backupCount, needed, cancelled }) {
  if (cancelled) {
    return COVER_STATUS.OFF;
  }
  if (needed === null || needed === undefined) {
    return COVER_STATUS.UNSET;
  }
  if (confirmedCount >= needed) {
    return COVER_STATUS.COVERED;
  }
  if (confirmedCount + backupCount >= needed) {
    return COVER_STATUS.AT_RISK;
  }
  return COVER_STATUS.SHORT;
}

/**
 * Render-ready session view model.
 *
 * @typedef {Object} SessionView
 * @property {string} fieldId - Session column field id
 * @property {string} date - yyyy-mm-dd
 * @property {string} sectionId - OSM section id
 * @property {string} sectionName - Display section name
 * @property {string} activity - Activity name
 * @property {string} startTime - HH:mm
 * @property {string} endTime - HH:mm
 * @property {number|null} kids - Expected young people, null when unset
 * @property {number|null} needed - Permit holders needed, null when unset
 * @property {string} notes - Session notes ('' when none)
 * @property {boolean} cancelled - Not on water this week
 * @property {boolean} hasMeta - False when showing config defaults only
 * @property {Array} confirmed - Confirmed signups ({scoutid, name, status, at})
 * @property {Array} backups - Backup signups
 * @property {string} status - COVER_STATUS value
 */

/**
 * Resolve a decoded session against plan config defaults. When no metadata
 * candidate survives (e.g. the writer left the host section), the session
 * self-heals from the config's per-section defaults.
 *
 * @param {{fieldId: string, date: string, sectionId: string, meta: Object|null, signups: Array}} session - Decoded session from loadRota
 * @param {Object|null} config - LWW-winning config candidate ({cfg}) or null
 * @param {Object} [sectionNames] - Fallback map of sectionId to name (from cached sections)
 * @returns {SessionView} Render-ready view model
 */
export function resolveSessionView(session, config, sectionNames = {}) {
  const sectionDefaults = (config?.cfg?.sections ?? []).find(
    (entry) => String(entry.sid) === String(session.sectionId),
  );
  // Per-session overrides captured at setup (activity from the programme
  // meeting title, programme times) sit between live per-session edits (meta)
  // and the section defaults.
  const columnName = buildSessionColumnName(session.date, session.sectionId);
  const override = config?.cfg?.sessions?.[columnName];
  const meta = session.meta;

  const confirmed = session.signups.filter((signup) => signup.status === SIGNUP_STATUS.IN);
  const backups = session.signups.filter((signup) => signup.status === SIGNUP_STATUS.BACKUP);

  const view = {
    fieldId: session.fieldId,
    date: session.date,
    sectionId: session.sectionId,
    sectionName: sectionDefaults?.sname ?? sectionNames[String(session.sectionId)] ?? `Section ${session.sectionId}`,
    activity: meta?.act ?? override?.act ?? sectionDefaults?.act ?? '',
    startTime: meta?.st ?? override?.st ?? sectionDefaults?.st ?? '',
    endTime: meta?.en ?? override?.en ?? sectionDefaults?.en ?? '',
    kids: meta?.k ?? override?.k ?? sectionDefaults?.k ?? null,
    needed: meta?.p ?? override?.p ?? sectionDefaults?.p ?? null,
    notes: meta?.n ?? '',
    cancelled: meta?.c === 1,
    hasMeta: Boolean(meta),
    confirmed,
    backups,
  };

  view.status = coverStatus({
    confirmedCount: confirmed.length,
    backupCount: backups.length,
    needed: view.needed,
    cancelled: view.cancelled,
  });

  return view;
}

/**
 * Resolve every session in a loaded rota, sorted by date.
 *
 * @param {import('../services/rotaService.js').LoadedRota} rota - Loaded rota
 * @returns {SessionView[]} View models sorted by date then section
 */
export function resolveAllSessions(rota) {
  return (rota?.sessions ?? [])
    .map((session) => resolveSessionView(session, rota.config, rota.sectionNames))
    .sort((a, b) => a.date.localeCompare(b.date) || a.sectionName.localeCompare(b.sectionName));
}

/**
 * The current user's signup status on a resolved session.
 *
 * @param {SessionView} session - Resolved session view
 * @param {string|null|undefined} scoutid - The user's member row id
 * @returns {string|null} SIGNUP_STATUS value, or null when not signed up
 */
export function myStatusFor(session, scoutid) {
  if (!scoutid) {
    return null;
  }
  const id = String(scoutid);
  if (session.confirmed.some((signup) => signup.scoutid === id)) {
    return SIGNUP_STATUS.IN;
  }
  if (session.backups.some((signup) => signup.scoutid === id)) {
    return SIGNUP_STATUS.BACKUP;
  }
  return null;
}

/**
 * Whether withdrawing (or stepping down from confirmed) needs confirmation:
 * true when the user is currently confirmed and losing them drops the
 * session below its permit-holder target.
 *
 * @param {SessionView} session - Resolved session view
 * @param {string|null} currentStatus - The user's current signup status
 * @param {string|null} newStatus - The requested signup status
 * @returns {boolean} True when the change warrants a confirm dialog
 */
export function withdrawalNeedsConfirm(session, currentStatus, newStatus) {
  if (currentStatus !== SIGNUP_STATUS.IN || newStatus === SIGNUP_STATUS.IN) {
    return false;
  }
  if (session.needed === null) {
    return false;
  }
  return session.confirmed.length - 1 < session.needed;
}

/**
 * Tailwind classes for a section chip, matching the app's section colors.
 *
 * @param {string} sectionName - Section display name
 * @returns {string} Chip background/text classes
 */
export function sectionChipClass(sectionName) {
  const name = (sectionName ?? '').toLowerCase();
  if (name.includes('earlyyears')) return 'bg-scout-red text-white';
  if (name.includes('squirrel')) return 'bg-scout-red text-white';
  if (name.includes('beaver')) return 'bg-scout-blue text-white';
  if (name.includes('cub')) return 'bg-scout-forest-green text-white';
  if (name.includes('scout')) return 'bg-scout-navy text-white';
  if (name.includes('explorer')) return 'bg-scout-green text-white';
  if (name.includes('adult')) return 'bg-scout-purple text-white';
  return 'bg-scout-purple text-white';
}

/**
 * Tailwind background class for a cover status (rail and strip dots).
 *
 * @param {string} status - COVER_STATUS value
 * @returns {string} Background class
 */
export function coverStatusBgClass(status) {
  switch (status) {
  case COVER_STATUS.COVERED:
    return 'bg-scout-green';
  case COVER_STATUS.AT_RISK:
    return 'bg-scout-orange';
  case COVER_STATUS.SHORT:
    return 'bg-scout-red';
  case COVER_STATUS.OFF:
    return 'bg-gray-300';
  default:
    return 'bg-gray-300';
  }
}

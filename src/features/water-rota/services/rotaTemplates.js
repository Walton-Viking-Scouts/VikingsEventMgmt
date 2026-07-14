/**
 * Presets and naming for the Water Session Permit Rota.
 *
 * The rota is stored as one OSM FlexiRecord per (planning section, that
 * section's own term), all hosted in the Adults section. Record identity —
 * planning sectionid, planning termid, season bucket — is fully name-derived
 * so every leader's device finds it without local configuration and without
 * depending on any term resolution.
 *
 * @module rotaTemplates
 */

/**
 * Name prefix shared by every rota FlexiRecord.
 * @type {string}
 */
export const ROTA_RECORD_NAME_PREFIX = 'Viking Water Rota';

/**
 * Activity presets offered as one-tap chips in session editing.
 * Free-text activities are also allowed; these are just the common ones.
 * @type {string[]}
 */
export const ACTIVITY_PRESETS = [
  'Kayaking',
  'Canoeing',
  'Paddleboarding',
  'Powerboats',
];

/**
 * Default permit holders needed per session until a leader sets a number.
 * @type {number}
 */
export const DEFAULT_PERMIT_HOLDERS = 4;

/**
 * Fallback session times used when a section has no programme times and the
 * planner has not yet set per-section defaults.
 * @type {{start: string, end: string}}
 */
export const DEFAULT_SESSION_TIMES = { start: '18:30', end: '20:00' };

/**
 * Options forwarded to createFlexiRecord so the rota record starts with only
 * our custom columns (no OSM auto DOB/Age/Patrol columns).
 * @type {{dob: string, age: string, patrol: string, type: string}}
 */
export const ROTA_CREATE_OPTIONS = { dob: '0', age: '0', patrol: '0', type: 'none' };

/**
 * Build the exact FlexiRecord name for one planning section's record.
 *
 * @param {Object} identity
 * @param {string} identity.sectionName - Planning section's display name
 * @param {string} identity.seasonBucket - Deterministic season label (see {@link seasonBucketForRange})
 * @param {string|number} identity.sectionId - Planning section id
 * @param {string|number} identity.termId - Planning section's own term id the plan was built from
 * @returns {string} Record name, e.g. "Viking Water Rota Scouts Summer 2026 [49097.924956]"
 */
export function buildRotaRecordName({ sectionName, seasonBucket, sectionId, termId }) {
  return `${ROTA_RECORD_NAME_PREFIX} ${sectionName} ${seasonBucket} [${sectionId}.${termId}]`;
}

/**
 * Parse a rota FlexiRecord name back into its identity. Names from the
 * retired year model (or any other shape) are not rota records and parse to
 * null — good, since a record's identity must be fully name-derived.
 *
 * @param {string} name - FlexiRecord name
 * @returns {{sectionName: string, seasonBucket: string, sectionId: string, termId: string}|null} Record identity, or null when the name is not a rota record
 */
export function parseRotaRecordName(name) {
  const match = /^Viking Water Rota (.+) ((?:Spring|Summer|Autumn) \d{4}) \[(\d+)\.(\d+)\]$/
    .exec(String(name ?? '').trim());
  return match
    ? { sectionName: match[1].trim(), seasonBucket: match[2], sectionId: match[3], termId: match[4] }
    : null;
}

/**
 * Derive the deterministic season-bucket grouping key from a term's date
 * range, using the range's midpoint month so every section's own term for
 * "the same season" (different dates, different termids) lands in the same
 * bucket. Term names are not reliable identifiers; dates are.
 *
 * @param {string} startISO - Term start date (yyyy-mm-dd)
 * @param {string} endISO - Term end date (yyyy-mm-dd)
 * @returns {string} Season bucket label, e.g. "Summer 2026"
 */
export function seasonBucketForRange(startISO, endISO) {
  const mid = new Date((Date.parse(startISO) + Date.parse(endISO)) / 2);
  const month = mid.getUTCMonth() + 1;
  const season = month <= 3 ? 'Spring' : month <= 8 ? 'Summer' : 'Autumn';
  return `${season} ${mid.getUTCFullYear()}`;
}

/**
 * Guess a water-activity preset from a programme meeting title. OSM leaders
 * put the session type in the meeting name (e.g. "Kayaking", "Cubs
 * Powerboats"), so match the title against the known presets, including
 * common singular/spelling variants.
 *
 * @param {string|null|undefined} title - Programme meeting title
 * @returns {string|null} Matched activity preset, or null when nothing matches
 */
export function guessActivityFromTitle(title) {
  if (typeof title !== 'string' || title.trim() === '') {
    return null;
  }
  const haystack = title.toLowerCase();
  const aliases = {
    Kayaking: ['kayak'],
    Canoeing: ['canoe'],
    Paddleboarding: ['paddleboard', 'paddle board', 'sup', 'stand up paddle'],
    Powerboats: ['powerboat', 'power boat', 'motorboat', 'safety boat'],
  };
  for (const preset of ACTIVITY_PRESETS) {
    const needles = aliases[preset] ?? [preset.toLowerCase()];
    if (needles.some((needle) => haystack.includes(needle))) {
      return preset;
    }
  }
  return null;
}

/**
 * Keywords that mark a programme meeting as an on-water session. Kept broad
 * (a leader can untick a false positive) so real water nights are never
 * silently dropped.
 * @type {string[]}
 */
export const WATER_KEYWORDS = [
  'water', 'river', 'ocean', 'lake',
  'kayak', 'canoe', 'paddle', 'boat', 'sail', 'raft', 'swim',
];

/**
 * Whether a programme meeting title looks like an on-water session, used to
 * pre-select the water nights in setup (most programme meetings are not on
 * the water).
 *
 * @param {string|null|undefined} title - Programme meeting title
 * @returns {boolean} True when the title mentions a water/boat keyword
 */
export function looksLikeWaterSession(title) {
  if (typeof title !== 'string') {
    return false;
  }
  const haystack = title.toLowerCase();
  return WATER_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

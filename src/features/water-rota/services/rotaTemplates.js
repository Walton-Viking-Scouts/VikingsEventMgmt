/**
 * Presets and naming for the Water Session Permit Rota.
 *
 * The rota is stored in one OSM FlexiRecord per calendar year, discovered by
 * name prefix so every leader's device finds it without local configuration.
 *
 * @module rotaTemplates
 */

/**
 * Name prefix shared by every yearly rota FlexiRecord.
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
export const DEFAULT_PERMIT_HOLDERS = 2;

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
 * Build the exact FlexiRecord name for a rota year.
 *
 * @param {number} year - Four-digit calendar year (e.g. 2026)
 * @returns {string} Record name, e.g. "Viking Water Rota 2026"
 */
export function buildRotaRecordName(year) {
  return `${ROTA_RECORD_NAME_PREFIX} ${year}`;
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
 * Extract the year from a rota FlexiRecord name.
 *
 * @param {string} name - FlexiRecord name
 * @returns {number|null} Four-digit year, or null when the name is not a rota record
 */
export function parseRotaRecordYear(name) {
  const match = /^Viking Water Rota (\d{4})$/.exec(String(name ?? '').trim());
  return match ? Number(match[1]) : null;
}

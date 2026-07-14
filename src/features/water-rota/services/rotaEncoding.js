/**
 * Pure encoding/decoding for the Water Rota FlexiRecord.
 *
 * Layout: one FlexiRecord per (planning section, that section's own term),
 * all hosted in the Adults section. Rows are host-section members. A permit
 * holder only ever writes their own row's signup cell, so signups never
 * conflict across users (setup/regular pre-fill is the one exception — the
 * organiser writes other members' cells once, up front). Two column kinds:
 *
 * - "RotaConfig": one section's whole-plan config JSON. Written to a single
 *   deterministic anchor row (the lowest-scoutid host member), not the
 *   editor's own row; readers take the last-writer-wins (LWW) winner across
 *   all rows by (v, at).
 * - "S_<yyyymmdd>_<sectionid>": one column per session. A cell holds the row
 *   member's signup (s/sat) plus an optional session-metadata candidate (m);
 *   readers take the LWW winner of m across the column.
 *
 * All functions here are pure: no network, no storage, no clock reads —
 * timestamps are supplied by callers so merges stay deterministic and testable.
 *
 * @module rotaEncoding
 */

import { z } from 'zod';

/**
 * Column name holding whole-plan config.
 * @type {string}
 */
export const ROTA_CONFIG_COLUMN = 'RotaConfig';

/**
 * Signup status codes stored in session cells.
 * @type {{IN: string, BACKUP: string}}
 */
export const SIGNUP_STATUS = { IN: 'I', BACKUP: 'B' };

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoInstantSchema = z.string().min(1);

const sessionOverrideSchema = z
  .object({
    act: z.string().optional(),
    st: timeSchema.optional(),
    en: timeSchema.optional(),
    k: z.number().int().nonnegative().optional(),
    p: z.number().int().nonnegative().optional(),
    // c:1 marks a programme week that is not on the water — stored here
    // (rather than as a signup column) so the full term shows without
    // creating a FlexiRecord column per non-water week.
    c: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .passthrough();

const rotaConfigSchema = z
  .object({
    v: z.number().int().nonnegative(),
    at: isoInstantSchema,
    by: z.string(),
    // One section's whole plan — a single-section record has nothing to
    // merge, so this replaces the old cfg.sections[] array.
    cfg: z
      .object({
        sid: z.string().min(1),
        sname: z.string(),
        act: z.string(),
        st: timeSchema,
        en: timeSchema,
        k: z.number().int().nonnegative().optional(),
        p: z.number().int().nonnegative().optional(),
        // Scoutids of the section's regular permit holders — pre-filled as
        // confirmed signups on every on-water session for the section.
        regulars: z.array(z.string()).optional(),
        start: isoDateSchema.optional(),
        end: isoDateSchema.optional(),
        sessions: z.record(z.string(), sessionOverrideSchema).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const sessionMetaSchema = z
  .object({
    v: z.number().int().nonnegative(),
    at: isoInstantSchema,
    by: z.string(),
    act: z.string(),
    st: timeSchema,
    en: timeSchema,
    k: z.number().int().nonnegative(),
    p: z.number().int().nonnegative(),
    n: z.string().optional(),
    c: z.union([z.literal(0), z.literal(1)]),
  })
  .passthrough();

const sessionCellSchema = z
  .object({
    s: z.enum([SIGNUP_STATUS.IN, SIGNUP_STATUS.BACKUP]).optional(),
    sat: isoInstantSchema.optional(),
    m: sessionMetaSchema.optional(),
  })
  .passthrough();

/**
 * Build the column name identifying a session.
 *
 * @param {string} dateISO - Session date as yyyy-mm-dd
 * @param {string|number} sectionId - OSM section id
 * @returns {string} Column name, e.g. "S_20260714_49097"
 */
export function buildSessionColumnName(dateISO, sectionId) {
  const compact = String(dateISO).replaceAll('-', '');
  return `S_${compact}_${sectionId}`;
}

/**
 * Parse a session column name back into its identity.
 *
 * @param {string} columnName - FlexiRecord column name
 * @returns {{date: string, sectionId: string}|null} Session identity, or null for non-session columns
 */
export function parseSessionColumnName(columnName) {
  const match = /^S_(\d{4})(\d{2})(\d{2})_(\d+)$/.exec(String(columnName ?? ''));
  if (!match) {
    return null;
  }
  return { date: `${match[1]}-${match[2]}-${match[3]}`, sectionId: match[4] };
}

/**
 * Parse a raw cell string into a validated session cell object.
 * Unparseable or invalid cells are treated as empty — the encoding is
 * self-healing rather than propagating corrupt data.
 *
 * @param {string|null|undefined} raw - Raw FlexiRecord cell value
 * @returns {Object|null} Validated cell object, or null when empty/invalid
 */
export function parseSessionCell(raw) {
  const parsed = parseJson(raw);
  if (!parsed) {
    return null;
  }
  const result = sessionCellSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Parse a raw RotaConfig cell string into a validated config candidate.
 *
 * @param {string|null|undefined} raw - Raw FlexiRecord cell value
 * @returns {Object|null} Validated config candidate, or null when empty/invalid
 */
export function parseConfigCell(raw) {
  const parsed = parseJson(raw);
  if (!parsed) {
    return null;
  }
  const result = rotaConfigSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Merge the RotaConfig column across all rows, returning the LWW winner.
 *
 * @param {Array<string|null|undefined>} cellValues - Raw RotaConfig values from every row
 * @returns {Object|null} Winning config candidate ({v, at, by, cfg}), or null when none valid
 */
export function mergeLwwConfig(cellValues) {
  return (cellValues ?? [])
    .map(parseConfigCell)
    .filter(Boolean)
    .reduce((winner, candidate) => (isNewer(candidate, winner) ? candidate : winner), null);
}

/**
 * Merge one session column across all rows into display-ready data.
 *
 * @param {Array<{scoutid: string|number, name: string, value: string|null|undefined}>} rows - One entry per host-section member row
 * @returns {{meta: Object|null, signups: Array<{scoutid: string, name: string, status: string, at: string|null}>}} LWW-winning metadata and all signups
 */
export function mergeSessionColumn(rows) {
  let meta = null;
  const signups = [];

  for (const row of rows ?? []) {
    const cell = parseSessionCell(row.value);
    if (!cell) {
      continue;
    }
    if (cell.m && isNewer(cell.m, meta)) {
      meta = cell.m;
    }
    if (cell.s) {
      signups.push({
        scoutid: String(row.scoutid),
        name: row.name,
        status: cell.s,
        at: cell.sat ?? null,
      });
    }
  }

  signups.sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')));
  return { meta, signups };
}

/**
 * Encode a signup change into the member's own cell, preserving any session
 * metadata candidate (and unknown future fields) already stored there.
 *
 * @param {string|null|undefined} existingRaw - The member's current raw cell value
 * @param {string|null} status - SIGNUP_STATUS.IN, SIGNUP_STATUS.BACKUP, or null to withdraw
 * @param {string} at - ISO timestamp of the change (caller-supplied)
 * @returns {string} New raw cell value ('' when the cell becomes empty)
 */
export function encodeSignup(existingRaw, status, at) {
  const cell = parseSessionCell(existingRaw) ?? {};
  if (status === null) {
    delete cell.s;
    delete cell.sat;
  } else {
    cell.s = status;
    cell.sat = at;
  }
  return isEmptyCell(cell) ? '' : JSON.stringify(cell);
}

/**
 * Encode a session-metadata update into the editor's own cell, preserving
 * their signup (and unknown future fields). The caller supplies the bumped
 * version and timestamp so concurrent edits resolve by LWW.
 *
 * @param {string|null|undefined} existingRaw - The editor's current raw cell value
 * @param {Object} meta - Full metadata candidate ({v, at, by, act, st, en, k, p, n?, c})
 * @returns {string} New raw cell value
 */
export function encodeSessionMeta(existingRaw, meta) {
  const validated = sessionMetaSchema.parse(meta);
  const cell = parseSessionCell(existingRaw) ?? {};
  cell.m = validated;
  return JSON.stringify(cell);
}

/**
 * Encode a whole-plan config candidate for the editor's own RotaConfig cell.
 *
 * @param {Object} candidate - Full candidate ({v, at, by, cfg})
 * @returns {string} New raw cell value
 */
export function encodeConfig(candidate) {
  return JSON.stringify(rotaConfigSchema.parse(candidate));
}

/**
 * Compare two versioned candidates ({v, at}) for LWW ordering.
 *
 * @param {Object|null} candidate - New candidate
 * @param {Object|null} incumbent - Current winner
 * @returns {boolean} True when candidate should replace incumbent
 */
function isNewer(candidate, incumbent) {
  if (!candidate) {
    return false;
  }
  if (!incumbent) {
    return true;
  }
  if (candidate.v !== incumbent.v) {
    return candidate.v > incumbent.v;
  }
  return String(candidate.at).localeCompare(String(incumbent.at)) > 0;
}

/**
 * Leniently parse a JSON object from a raw cell string.
 *
 * @param {string|null|undefined} raw - Raw cell value
 * @returns {Object|null} Parsed object, or null for empty/invalid/non-object values
 */
function parseJson(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Determine whether a cell object carries no data worth storing.
 *
 * @param {Object} cell - Session cell object
 * @returns {boolean} True when the cell should be stored as an empty string
 */
function isEmptyCell(cell) {
  return Object.keys(cell).length === 0;
}
